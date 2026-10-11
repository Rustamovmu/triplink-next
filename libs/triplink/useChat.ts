import { useEffect, useRef, useState } from 'react';
import { socketVar } from '../../apollo/store';
import { ChatMember, ChatMessage, ChatPresence } from '../types/triplink';
import { CHAT_MESSAGE_LIMIT, isChatMember, isChatMessage, isChatPresence, mergeMessages } from './chat';

const emptyPresence: ChatPresence = { list: [], totalMembers: 0, totalClients: 0 };
export function useChat(memberId: string | undefined, token: string | null) {
	const [attempt, setAttempt] = useState(0);
	const [status, setStatus] = useState<'connecting' | 'authenticated' | 'closed'>('closed');
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [presence, setPresence] = useState(emptyPresence);
	const [typing, setTyping] = useState<Record<string, ChatMember>>({});
	const [error, setError] = useState('');
	const [denied, setDenied] = useState(false);
	const connection = useRef<WebSocket | null>(null);
	const idle = useRef<ReturnType<typeof setTimeout>>();
	const lastTyping = useRef(0);
	const typingSent = useRef(false);
	const authenticated = useRef(false);
	const remoteTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
	const stopTyping = () => {
		clearTimeout(idle.current);
		if (typingSent.current && authenticated.current && connection.current?.readyState === WebSocket.OPEN) {
			try {
				connection.current.send(JSON.stringify({ event: 'typing', data: { isTyping: false } }));
			} catch {
				/* Connection handlers provide the recovery state. */
			}
		}
		typingSent.current = false;
	};
	const notifyTyping = (text: string) => {
		if (!text.trim()) return stopTyping();
		if (!authenticated.current || connection.current?.readyState !== WebSocket.OPEN) return;
		if (Date.now() - lastTyping.current >= 2000) {
			try {
				connection.current.send(JSON.stringify({ event: 'typing', data: { isTyping: true } }));
				lastTyping.current = Date.now();
				typingSent.current = true;
			} catch {
				return;
			}
		}
		clearTimeout(idle.current);
		idle.current = setTimeout(stopTyping, 3000);
	};
	useEffect(() => {
		setMessages([]);
		setPresence(emptyPresence);
		setTyping({});
		setError('');
		setDenied(false);
		authenticated.current = false;
		lastTyping.current = 0;
		if (!memberId || !token) {
			setStatus('closed');
			return;
		}
		let active = true;
		let socket: WebSocket;
		setStatus('connecting');
		try {
			socket = new WebSocket(process.env.REACT_APP_API_WS || 'ws://localhost:3007/chat');
		} catch {
			setStatus('closed');
			setError('Unable to connect to chat');
			return;
		}
		connection.current = socket;
		socketVar(socket);
		const clearRemote = () => {
			remoteTimers.current.forEach(clearTimeout);
			remoteTimers.current.clear();
		};
		const timeout = setTimeout(() => {
			if (active && !authenticated.current) {
				setError('Chat authentication timed out');
				socket.close();
			}
		}, 12000);
		socket.onopen = () => {
			try {
				socket.send(JSON.stringify({ event: 'authenticate', data: { token } }));
			} catch {
				setError('Chat connection failed');
				socket.close();
			}
		};
		socket.onmessage = (event) => {
			if (!active) return;
			try {
				const frame = JSON.parse(event.data);
				const data = frame?.data;
				switch (frame?.event) {
					case 'authenticated':
						if (!isChatMember(data?.memberData) || data.memberData._id !== memberId) throw new Error();
						clearTimeout(timeout);
						authenticated.current = true;
						setStatus('authenticated');
						setError('');
						break;
					case 'getMessages':
						if (!authenticated.current || !Array.isArray(data?.list) || !data.list.every(isChatMessage))
							throw new Error();
						setMessages((previous) => mergeMessages(previous, data.list));
						break;
					case 'message':
						if (!authenticated.current || !isChatMessage(data)) throw new Error();
						setMessages((previous) => mergeMessages(previous, [data]));
						break;
					case 'presence':
						if (!authenticated.current || !isChatPresence(data)) throw new Error();
						setPresence(data);
						setTyping((previous) =>
							Object.fromEntries(
								Object.entries(previous).filter(([id]) => data.list.some((m: ChatMember) => m._id === id)),
							),
						);
						break;
					case 'typing': {
						if (!authenticated.current || !isChatMember(data?.memberData) || typeof data.isTyping !== 'boolean')
							throw new Error();
						const id = data.memberData._id;
						if (id === memberId) break;
						clearTimeout(remoteTimers.current.get(id));
						remoteTimers.current.delete(id);
						const remove = () => {
							remoteTimers.current.delete(id);
							if (active)
								setTyping((previous) => {
									const next = { ...previous };
									delete next[id];
									return next;
								});
						};
						if (data.isTyping) {
							setTyping((previous) => ({ ...previous, [id]: data.memberData }));
							remoteTimers.current.set(id, setTimeout(remove, 5000));
						} else remove();
						break;
					}
					case 'error':
						setError(typeof data?.message === 'string' ? data.message : 'Chat error');
						if (['UNAUTHENTICATED', 'FORBIDDEN'].includes(data?.code)) {
							setDenied(true);
							socket.close();
						}
				}
			} catch {
				setError('Invalid chat response');
			}
		};
		socket.onclose = () => {
			if (connection.current === socket) connection.current = null;
			if (socketVar() === socket) socketVar(undefined);
			clearTimeout(timeout);
			authenticated.current = false;
			typingSent.current = false;
			clearTimeout(idle.current);
			clearRemote();
			if (active) {
				setStatus('closed');
				setPresence(emptyPresence);
				setTyping({});
			}
		};
		socket.onerror = () => {
			if (active) setError('Chat connection failed');
		};
		return () => {
			active = false;
			clearTimeout(timeout);
			stopTyping();
			authenticated.current = false;
			clearRemote();
			socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
			socket.close();
			connection.current = null;
			if (socketVar() === socket) socketVar(undefined);
		};
		// Connection ownership depends only on the account, token and explicit reconnect.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [memberId, token, attempt]);
	const send = (text: string): boolean => {
		const trimmed = text.trim();
		if (
			!authenticated.current ||
			connection.current?.readyState !== WebSocket.OPEN ||
			!trimmed ||
			trimmed.length > CHAT_MESSAGE_LIMIT
		)
			return false;
		try {
			connection.current.send(JSON.stringify({ event: 'message', data: trimmed }));
			stopTyping();
			return true;
		} catch {
			setError('Message could not be sent');
			return false;
		}
	};
	return {
		status,
		messages,
		presence,
		typing: Object.values(typing),
		error,
		denied,
		send,
		notifyTyping,
		stopTyping,
		reconnect: () => setAttempt((value) => value + 1),
	};
}
