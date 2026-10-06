import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar, Box, Stack } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import Badge from '@mui/material/Badge';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import MarkChatUnreadIcon from '@mui/icons-material/MarkChatUnread';
import { useRouter } from 'next/router';
import ScrollableFeed from 'react-scrollable-feed';
import { RippleBadge } from '../../scss/MaterialTheme/styled';
import { useReactiveVar } from '@apollo/client';
import { socketVar, userVar } from '../../apollo/store';
import { Member } from '../types/member/member';
import { Messages, REACT_APP_API_URL } from '../config';
import { sweetErrorAlert } from '../sweetAlert';
import { getJwtToken } from '../auth';

interface MessagePayload {
	event: string;
	text: string;
	memberData: Member | null;
}

interface InfoPayload {
	event: string;
	totalClients: number;
	memberData: Member | null;
	action: string;
}

const Chat = () => {
	const chatContentRef = useRef<HTMLDivElement>(null);
	const [messagesList, setMessagesList] = useState<MessagePayload[]>([]);
	const [onlineUsers, setOnlineUsers] = useState<number>(0);
	const [messageInput, setMessageInput] = useState<string>('');
	const [open, setOpen] = useState(false);
	const [openButton, setOpenButton] = useState(false);
	const router = useRouter();
	const user = useReactiveVar(userVar);
	const socket = useReactiveVar(socketVar);
	const [connected, setConnected] = useState(false);

	/** LIFECYCLES **/
	useEffect(() => {
		// Live chat uses the Nest WsAdapter gateway at /, separately from GraphQL.
		const url = new URL(REACT_APP_API_URL);
		url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
		url.pathname = '/';
		url.search = '';
		url.searchParams.set('token', getJwtToken() || '');
		const chatSocket = new WebSocket(url.toString());
		socketVar(chatSocket);
		setConnected(false);

		chatSocket.onopen = () => setConnected(true);
		chatSocket.onclose = () => {
			setConnected(false);
			setOnlineUsers(0);
		};
		chatSocket.onerror = () => setConnected(false);
		chatSocket.onmessage = (msg) => {
			try {
				const data = JSON.parse(msg.data);
				switch (data.event) {
					case 'info':
						setOnlineUsers((data as InfoPayload).totalClients);
						break;
					case 'getMessages':
						setMessagesList(data.list);
						break;
					case 'message':
						setMessagesList((messages) => [...messages, data as MessagePayload]);
						break;
				}
			} catch (error) {
				console.error('Invalid chat message:', error);
			}
		};

		return () => {
			chatSocket.onopen = null;
			chatSocket.onclose = null;
			chatSocket.onerror = null;
			chatSocket.onmessage = null;
			chatSocket.close();
			if (socketVar() === chatSocket) socketVar(undefined);
		};
	}, [user._id]);

	useEffect(() => {
		const timeoutId = setTimeout(() => {
			setOpenButton(true);
		}, 100);
		return () => clearTimeout(timeoutId);
	}, []);

	useEffect(() => {
		setOpenButton(false);
	}, [router.pathname]);

	/** HANDLERS **/
	const handleOpenChat = () => {
		setOpen((prevState) => !prevState);
	};

	const getInputMessageHandler = useCallback((e: any) => {
		const text = e.target.value;
		setMessageInput(text);
	}, []);

	const getKeyHandler = (e: any) => {
		try {
			if (e.key == 'Enter') {
				onClickHandler();
			}
		} catch (err: any) {
			console.log(err);
		}
	};

	const onClickHandler = () => {
		const text = messageInput.trim();
		if (!text) {
			void sweetErrorAlert(Messages.error4);
			return;
		}
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			void sweetErrorAlert('Chat is disconnected. Please refresh the page to reconnect.');
			return;
		}
		try {
			socket.send(JSON.stringify({ event: 'message', data: text }));
			setMessageInput('');
		} catch (error) {
			void sweetErrorAlert('Message could not be sent. Please try again.');
		}
	};

	return (
		<Stack className="chatting">
			{openButton ? (
				<button className="chat-button" onClick={handleOpenChat}>
					{open ? <CloseFullscreenIcon /> : <MarkChatUnreadIcon />}
				</button>
			) : null}
			<Stack className={`chat-frame ${open ? 'open' : ''}`}>
				<Box className={'chat-top'} component={'div'}>
					<div style={{ fontFamily: 'Nunito' }}>Online Chat</div>
					<RippleBadge style={{ margin: '-18px 0 0 21px' }} badgeContent={onlineUsers} />
				</Box>
				<Box className={'chat-content'} id="chat-content" ref={chatContentRef} component={'div'}>
					<ScrollableFeed>
						<Stack className={'chat-main'}>
							<Box flexDirection={'row'} style={{ display: 'flex' }} sx={{ m: '10px 0px' }} component={'div'}>
								<div className={'welcome'}>Welcome to Live chat!</div>
							</Box>
							{messagesList.map((ele: MessagePayload, index: number) => {
								const { text, memberData } = ele;
								const memberImage = memberData?.memberImage
									? `${REACT_APP_API_URL}/${memberData.memberImage}`
									: '/img/profile/defaultUser.svg';

								return memberData?._id === user?._id ? (
									<Box
										key={index}
										component={'div'}
										flexDirection={'row'}
										style={{ display: 'flex' }}
										alignItems={'flex-end'}
										justifyContent={'flex-end'}
										sx={{ m: '10px 0px' }}
									>
										<div className={'msg-right'}>{text}</div>
									</Box>
								) : (
									<Box
										key={index}
										flexDirection={'row'}
										style={{ display: 'flex' }}
										sx={{ m: '10px 0px' }}
										component={'div'}
									>
										<Avatar alt={'jonik'} src={memberImage} />
										<div className={'msg-left'}>{text}</div>
									</Box>
								);
							})}
						</Stack>
					</ScrollableFeed>
				</Box>
				<Box className={'chat-bott'} component={'div'}>
					<input
						type={'text'}
						name={'message'}
						className={'msg-input'}
						placeholder={'Type message'}
						value={messageInput}
						onChange={getInputMessageHandler}
						onKeyDown={getKeyHandler}
					/>
					<button className={'send-msg-btn'} onClick={onClickHandler} disabled={!connected} aria-label="Send message">
						<SendIcon style={{ color: '#fff' }} />
					</button>
				</Box>
			</Stack>
		</Stack>
	);
};

export default Chat;
