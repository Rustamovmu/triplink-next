import { useEffect, useRef, useState } from 'react';
import { ensureAccessToken, refreshAccessToken, AuthRequestError, clearAuthentication } from '../auth/runtime';
import { tokenIdentity } from '../auth/token';
import { socketVar } from '../../apollo/store';
import { ChatMember, ChatMessage, ChatPresence } from '../types/triplink';
import { CHAT_MESSAGE_LIMIT, isChatMember, isChatMessage, isChatPresence, mergeMessages } from './chat';

const emptyPresence: ChatPresence = { list: [], totalMembers: 0, totalClients: 0 };
export function useChat(memberId: string | undefined, token: string | null) {
	const sessionKey = tokenIdentity(token ?? '');
	const tokenRef = useRef(token);
	tokenRef.current = token;
	const sentToken = useRef('');
	const renewing = useRef<Promise<void> | null>(null);
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
	const reauthenticate = (next: string) => {
		if (
			connection.current?.readyState === WebSocket.OPEN &&
			authenticated.current &&
			next !== sentToken.current &&
			tokenIdentity(next) === sessionKey
		) {
			connection.current.send(JSON.stringify({ event: 'reauthenticate', data: { token: next } }));
			sentToken.current = next;
		}
	};
	const renew = () => {
		if (!renewing.current)
			renewing.current = refreshAccessToken(true)
				.then(reauthenticate)
				.catch((error: unknown) => {
					setError('Unable to restore your session. Please retry.');
					if (error instanceof AuthRequestError && error.definitive) {
						setDenied(true);
						connection.current?.close();
					}
				})
				.finally(() => {
					renewing.current = null;
				});
		return renewing.current;
	};
	useEffect(() => {
		if (token) reauthenticate(token);
	}, [token]); // eslint-disable-line react-hooks/exhaustive-deps
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
		const refreshPhoto = (person: ChatMember) => {
			if (person.memberImage === undefined) return;
			setPresence((previous) => ({
				...previous,
				list: previous.list.map((entry) =>
					entry._id === person._id ? { ...entry, memberImage: person.memberImage } : entry,
				),
			}));
		};
		const timeout = setTimeout(() => {
			if (active && !authenticated.current) {
				setError('Chat authentication timed out');
				socket.close();
			}
		}, 12000);
		socket.onopen = () => {
			void ensureAccessToken()
				.then((next) => {
					if (!active || tokenIdentity(next) !== sessionKey) return;
					sentToken.current = next;
					socket.send(JSON.stringify({ event: 'authenticate', data: { token: next } }));
				})
				.catch(() => {
					if (active) {
						setError('Chat connection failed');
						socket.close();
					}
				});
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
						refreshPhoto(data.memberData);
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
						refreshPhoto(data.memberData);
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
						if (data?.code === 'ACCESS_TOKEN_EXPIRED') {
							void renew();
							break;
						}
						setError(typeof data?.message === 'string' ? data.message : 'Chat error');
						if (['UNAUTHENTICATED', 'FORBIDDEN'].includes(data?.code)) {
							setDenied(true);
							if (tokenIdentity(tokenRef.current ?? '') === sessionKey) clearAuthentication();
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
	}, [memberId, sessionKey, attempt]);
	const send = async (text: string): Promise<boolean> => {
		const trimmed = text.trim();
		try {
			const next = await ensureAccessToken();
			reauthenticate(next);
		} catch {
			setError('Unable to restore your session. Please retry.');
			return false;
		}
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
