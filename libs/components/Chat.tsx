import { useTranslation } from 'next-i18next';
import React, { useEffect, useRef, useState } from 'react';
import { useReactiveVar } from '@apollo/client';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { memberVar, socketVar } from '../../apollo/store';
import { getJwtToken } from '../auth/token';
import { ChatMessage } from '../types/triplink';
import { isChatMessage as isMessage, mergeMessages } from '../triplink/chat';
export default function Chat() {
	const { t } = useTranslation('common');

	const member = useReactiveVar(memberVar);
	const token = getJwtToken();
	const [open, setOpen] = useState(false);
	const [attempt, setAttempt] = useState(0);
	const [status, setStatus] = useState<'connecting' | 'authenticated' | 'closed'>('closed');
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [clients, setClients] = useState(0);
	const [text, setText] = useState('');
	const [error, setError] = useState('');
	const [denied, setDenied] = useState(false);
	const connection = useRef<WebSocket | null>(null);
	useEffect(() => {
		setMessages([]);
		setClients(0);
		setText('');
		setError('');
		setDenied(false);
		if (!member?._id || !token) {
			setStatus('closed');
			return;
		}
		let active = true;
		let socket: WebSocket;
		try {
			socket = new WebSocket(process.env.REACT_APP_API_WS || 'ws://localhost:3007/chat');
		} catch {
			setError('Unable to connect to chat');
			return;
		}
		connection.current = socket;
		socketVar(socket);
		setStatus('connecting');
		const timeout = setTimeout(() => {
			if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
				setError('Chat authentication timed out');
				socket.close();
			}
		}, 12000);
		socket.onopen = () => socket.send(JSON.stringify({ event: 'authenticate', data: { token } }));
		socket.onmessage = (event) => {
			if (!active) return;
			try {
				const message = JSON.parse(event.data);
				switch (message.event) {
					case 'authenticated':
						clearTimeout(timeout);
						setStatus('authenticated');
						setClients(message.data.totalClients);
						break;
					case 'getMessages':
						if (Array.isArray(message.data?.list))
							setMessages((previous) => mergeMessages(previous, message.data.list.filter(isMessage)));
						break;
					case 'message':
						if (isMessage(message.data)) setMessages((previous) => mergeMessages(previous, [message.data]));
						break;
					case 'info':
						if (typeof message.data?.totalClients === 'number') setClients(message.data.totalClients);
						break;
					case 'error':
						setError(message.data?.message ?? 'Chat error');
						if (['UNAUTHENTICATED', 'FORBIDDEN'].includes(message.data?.code)) {
							setDenied(true);
							socket.close();
						}
						break;
				}
			} catch {
				setError('Invalid chat response');
			}
		};
		socket.onclose = () => {
			clearTimeout(timeout);
			if (active) {
				setStatus('closed');
				setClients(0);
			}
		};
		socket.onerror = () => {
			if (active) setError('Chat connection failed');
		};
		return () => {
			active = false;
			clearTimeout(timeout);
			socket.onopen = null;
			socket.onmessage = null;
			socket.onclose = null;
			socket.onerror = null;
			socket.close();
			connection.current = null;
			if (socketVar() === socket) socketVar(undefined);
		};
	}, [member?._id, token, attempt]);
	if (!member) return null;
	return (
		<Box
			component="div"
			sx={{
				position: 'fixed',
				right: { xs: 8, md: 24 },
				bottom: 16,
				zIndex: 1300,
				width: open ? { xs: 'calc(100vw - 16px)', sm: 360 } : 'auto',
			}}
		>
			<Button variant="contained" aria-expanded={open} onClick={() => setOpen(!open)}>
				{t(open ? 'Close chat' : 'Shared chat')}
			</Button>
			{open && (
				<Paper elevation={6} sx={{ p: 2, mt: 1 }}>
					<Stack spacing={2}>
						<Typography variant="h6">
							{t('Shared chat ·')} {clients} {t('connections')}
						</Typography>
						<Typography variant="caption">{t('Latest five messages. History resets on server restart.')}</Typography>
						{error && <Alert severity="error">{t(error)}</Alert>}
						<Box component="div" sx={{ maxHeight: 300, overflowY: 'auto' }}>
							{messages.map((message) => (
								<Box component="div" key={message._id} sx={{ py: 1 }}>
									<Typography variant="caption">{message.memberData.memberNick}</Typography>
									<Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{message.text}</Typography>
								</Box>
							))}
						</Box>
						{status === 'closed' && !denied && (
							<Button onClick={() => setAttempt(attempt + 1)}>{t('Reconnect')}</Button>
						)}
						{denied && <Alert severity="warning">{t('Login again to reconnect.')}</Alert>}
						<Stack
							component="form"
							spacing={1}
							onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
								event.preventDefault();
								const socket = connection.current;
								if (status !== 'authenticated' || socket?.readyState !== WebSocket.OPEN || !text.trim()) return;
								try {
									socket.send(JSON.stringify({ event: 'message', data: text.trim() }));
									setText('');
								} catch {
									setError('Message could not be sent');
								}
							}}
						>
							<TextField
								label={t('Message')}
								value={text}
								onChange={(e) => setText(e.target.value)}
								inputProps={{ maxLength: 1000 }}
								disabled={status !== 'authenticated'}
							/>
							<Button type="submit" disabled={status !== 'authenticated' || !text.trim()}>
								{t('Send')}
							</Button>
						</Stack>
					</Stack>
				</Paper>
			)}
		</Box>
	);
}
