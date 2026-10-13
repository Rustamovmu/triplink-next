import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';
import { useReactiveVar } from '@apollo/client';
import {
	Alert,
	Avatar,
	Button,
	Dialog,
	IconButton,
	Paper,
	Popover,
	TextField,
	Tooltip,
	useMediaQuery,
} from '@mui/material';
import ChatBubbleOutlineRounded from '@mui/icons-material/ChatBubbleOutlineRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import OpenInFullRounded from '@mui/icons-material/OpenInFullRounded';
import CloseFullscreenRounded from '@mui/icons-material/CloseFullscreenRounded';
import SendRounded from '@mui/icons-material/SendRounded';
import SentimentSatisfiedAltRounded from '@mui/icons-material/SentimentSatisfiedAltRounded';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import KeyboardArrowDownRounded from '@mui/icons-material/KeyboardArrowDownRounded';
import { memberVar } from '../../apollo/store';
import { tokenIdentity } from '../auth/token';
import { accessTokenVar } from '../../apollo/store';
import { ChatMember } from '../types/triplink';
import { CHAT_MESSAGE_LIMIT, chatImageUrl, chatInitials, chatProfile, chatRole } from '../triplink/chat';
import { useChat } from '../triplink/useChat';

// Desktop remains a modeless dock; mobile uses MUI's modal focus/scroll handling.
function ChatSurface({
	open,
	mobile,
	reducedMotion,
	expanded,
	height,
	onClose,
	panelRef,
	children,
}: {
	open: boolean;
	mobile: boolean;
	reducedMotion: boolean;
	expanded: boolean;
	height?: number;
	onClose: () => void;
	panelRef: React.RefObject<HTMLDivElement>;
	children: React.ReactNode;
}) {
	const paper = {
		id: 'triplink-chat-panel',
		className: `triplink-chat ${expanded ? 'is-expanded' : ''}`,
		ref: panelRef,
		tabIndex: -1,
	};
	if (mobile)
		return (
			<Dialog
				open={open}
				onClose={onClose}
				transitionDuration={reducedMotion ? 0 : 180}
				maxWidth={false}
				aria-labelledby="triplink-chat-title"
				className="triplink-chat-dialog is-mobile"
				PaperProps={{ ...paper, style: height ? { height } : undefined }}
			>
				{children}
			</Dialog>
		);
	return open ? (
		<div className="triplink-chat-dialog triplink-chat-dock">
			<Paper {...paper} role="dialog" aria-modal="false" aria-labelledby="triplink-chat-title">
				{children}
			</Paper>
		</div>
	) : null;
}

const emojis = [
	['😊', 'Smiling face'],
	['👋', 'Wave'],
	['❤️', 'Heart'],
	['👍', 'Thumbs up'],
	['🎉', 'Celebration'],
	['✨', 'Sparkles'],
	['✈️', 'Airplane'],
	['🌍', 'Globe'],
	['🏖️', 'Beach'],
	['🏔️', 'Mountain'],
	['📍', 'Location'],
	['🙏', 'Thank you'],
];
export default function Chat() {
	const { t, i18n } = useTranslation('common');
	const member = useReactiveVar(memberVar);
	const token = useReactiveVar(accessTokenVar);
	const sessionIdentity = tokenIdentity(token);
	const chat = useChat(member?._id, token);
	const { stopTyping } = chat;
	const mobile = useMediaQuery('(max-width:599px)');
	const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
	const [open, setOpen] = useState(false);
	const [expanded, setExpanded] = useState(false);
	const [view, setView] = useState<'messages' | 'people'>('messages');
	const [text, setText] = useState('');
	const [emojiAnchor, setEmojiAnchor] = useState<HTMLElement | null>(null);
	const [notice, setNotice] = useState('');
	const [copied, setCopied] = useState('');
	const [jump, setJump] = useState(false);
	const [viewportHeight, setViewportHeight] = useState<number>();
	const input = useRef<HTMLTextAreaElement>(null);
	const panel = useRef<HTMLDivElement>(null);
	const launcher = useRef<HTMLButtonElement>(null);
	const feed = useRef<HTMLDivElement>(null);
	const nearBottom = useRef(true);
	const firstMessage = useRef('');
	const metrics = useRef({ top: 0, height: 0 });
	const selection = useRef({ start: 0, end: 0 });
	const composing = useRef(false);
	const locale = i18n.language === 'kr' ? 'ko' : i18n.language || 'en';
	const time = (date: string) =>
		new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(new Date(date));
	const fullDate = (date: string) =>
		new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
	useEffect(() => {
		setText('');
		setOpen(false);
		setEmojiAnchor(null);
		setNotice('');
		setCopied('');
	}, [member?._id, sessionIdentity]);
	useEffect(() => {
		if (!notice && !copied) return;
		const timer = setTimeout(() => {
			setNotice('');
			setCopied('');
		}, 3000);
		return () => clearTimeout(timer);
	}, [notice, copied]);
	useEffect(() => {
		if (!open) return;
		const viewport = window.visualViewport;
		const resize = () => setViewportHeight(viewport?.height ?? window.innerHeight);
		resize();
		viewport?.addEventListener('resize', resize);
		return () => viewport?.removeEventListener('resize', resize);
	}, [open]);
	useEffect(() => {
		const node = feed.current;
		if (!node || !open || view !== 'messages') return;
		if (nearBottom.current) {
			node.scrollTop = node.scrollHeight;
			setJump(false);
		} else {
			if (firstMessage.current && firstMessage.current !== chat.messages[0]?._id)
				node.scrollTop = Math.max(0, metrics.current.top + node.scrollHeight - metrics.current.height);
			setJump(true);
		}
		firstMessage.current = chat.messages[0]?._id ?? '';
		metrics.current = { top: node.scrollTop, height: node.scrollHeight };
	}, [chat.messages, open, view]);
	const close = () => {
		stopTyping();
		setEmojiAnchor(null);
		setOpen(false);
		launcher.current?.focus();
	};
	useEffect(() => {
		if (!open) return;
		const escape = (event: KeyboardEvent) => {
			if (event.key !== 'Escape' || emojiAnchor) return;
			event.preventDefault();
			stopTyping();
			setOpen(false);
			launcher.current?.focus();
		};
		document.addEventListener('keydown', escape);
		return () => document.removeEventListener('keydown', escape);
	}, [open, emojiAnchor, stopTyping]);
	useEffect(() => {
		if (!open || mobile) return;
		const frame = requestAnimationFrame(() => {
			if (view === 'messages' && input.current && !input.current.disabled) input.current.focus();
			else panel.current?.focus();
		});
		return () => cancelAnimationFrame(frame);
	}, [open, mobile, view]);
	const updateText = (next: string) => {
		setText(next);
		chat.notifyTyping(next);
	};
	const sending = useRef(false);
	const submit = async () => {
		if (sending.current) return;
		sending.current = true;
		const draft = text;
		try {
			if (await chat.send(draft)) {
				setText((previous) => (previous === draft ? '' : previous));
				nearBottom.current = true;
				setJump(false);
				input.current?.focus();
			}
		} finally {
			sending.current = false;
		}
	};
	const avatarSource = (person: ChatMember) => {
		const online = chat.presence.list.find((entry) => entry._id === person._id);
		// Prefer the current roster; an empty image explicitly removes an older photo.
		return chatImageUrl(
			online?.memberImage ??
				(person._id === member?._id ? member?.memberImage ?? person.memberImage : person.memberImage),
		);
	};
	const identity = (person: ChatMember) => {
		const href = chatProfile(person);
		return (
			<div className="triplink-chat__identity">
				{href ? (
					<Link href={href} onClick={close}>
						{person.memberNick}
					</Link>
				) : (
					<strong>{person.memberNick}</strong>
				)}
				{person._id === member?._id && <span className="triplink-chat__you">{t('You')}</span>}
				<span className={`triplink-chat__role triplink-chat__role--${person.memberType.toLowerCase()}`}>
					{t(chatRole(person.memberType))}
				</span>
			</div>
		);
	};
	if (!member) return null;
	return (
		<>
			<Button
				ref={launcher}
				className="triplink-chat-launcher"
				variant="contained"
				startIcon={<ChatBubbleOutlineRounded />}
				aria-expanded={open}
				aria-controls={open ? 'triplink-chat-panel' : undefined}
				onClick={() => {
					nearBottom.current = true;
					setView('messages');
					setOpen(true);
				}}
			>
				{t('Shared chat')}
				<span
					className={`triplink-chat-launcher__dot ${chat.status === 'authenticated' ? 'is-online' : ''}`}
					aria-hidden="true"
				/>
			</Button>
			<ChatSurface
				open={open}
				onClose={close}
				mobile={mobile}
				reducedMotion={reducedMotion}
				expanded={expanded}
				height={viewportHeight}
				panelRef={panel}
			>
				<header className="triplink-chat__header">
					<div className="triplink-chat__room-icon">
						<ChatBubbleOutlineRounded />
					</div>
					<div className="triplink-chat__heading">
						<h2 id="triplink-chat-title">{t('Travel lounge')}</h2>
						<p>
							<span
								className={`triplink-chat__status ${chat.status === 'authenticated' ? 'is-online' : ''}`}
								aria-hidden="true"
							/>
							{chat.status === 'authenticated'
								? t(chat.presence.totalMembers === 1 ? '{{count}} person online' : '{{count}} people online', {
										count: chat.presence.totalMembers,
								  })
								: t(chat.status === 'connecting' ? 'Connecting…' : 'Disconnected')}
						</p>
					</div>
					{!mobile && (
						<Tooltip title={t(expanded ? 'Restore chat size' : 'Expand chat')}>
							<IconButton
								aria-label={t(expanded ? 'Restore chat size' : 'Expand chat')}
								onClick={() => setExpanded(!expanded)}
							>
								{expanded ? <CloseFullscreenRounded /> : <OpenInFullRounded />}
							</IconButton>
						</Tooltip>
					)}
					<Tooltip title={t('Close chat')}>
						<IconButton aria-label={t('Close chat')} onClick={close}>
							<CloseRounded />
						</IconButton>
					</Tooltip>
				</header>
				<nav className="triplink-chat__tabs" aria-label={t('Chat views')}>
					<button
						type="button"
						aria-pressed={view === 'messages'}
						onClick={() => {
							nearBottom.current = true;
							setView('messages');
						}}
					>
						{t('Messages')}
					</button>
					<button
						type="button"
						aria-pressed={view === 'people'}
						onClick={() => {
							stopTyping();
							setView('people');
						}}
					>
						{t('People')}
						<span>{chat.presence.totalMembers}</span>
					</button>
				</nav>
				{chat.error && (
					<Alert severity="error" className="triplink-chat__alert">
						{t(chat.error)}
					</Alert>
				)}
				{chat.denied ? (
					<Alert severity="warning">{t('Login again to reconnect.')}</Alert>
				) : (
					chat.status === 'closed' && (
						<div className="triplink-chat__reconnect">
							<p>{t('Reconnect to keep chatting.')}</p>
							<Button onClick={chat.reconnect}>{t('Reconnect')}</Button>
						</div>
					)
				)}
				{view === 'messages' ? (
					<>
						<div
							className="triplink-chat__feed"
							ref={feed}
							role="log"
							aria-label={t('Group messages')}
							aria-live="polite"
							aria-relevant="additions"
							onScroll={() => {
								const node = feed.current;
								if (!node) return;
								nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 64;
								metrics.current = { top: node.scrollTop, height: node.scrollHeight };
								if (nearBottom.current) setJump(false);
							}}
						>
							{!chat.messages.length && (
								<div className="triplink-chat__empty">
									<span aria-hidden="true">✈</span>
									<h3>{t('A good trip starts with a hello.')}</h3>
									<p>{t('Share a travel tip or ask the community a question.')}</p>
								</div>
							)}
							{chat.messages.map((message) => (
								<article
									key={message._id}
									className={`triplink-chat__message ${message.memberData._id === member._id ? 'is-own' : ''}`}
								>
									<Avatar
										src={avatarSource(message.memberData)}
										className={`triplink-chat__avatar triplink-chat__avatar--${message.memberData.memberType.toLowerCase()}`}
										aria-hidden="true"
									>
										{chatInitials(message.memberData.memberNick)}
									</Avatar>
									<div className="triplink-chat__message-body">
										{identity(message.memberData)}
										<p className="triplink-chat__bubble">{message.text}</p>
										<div className="triplink-chat__message-meta">
											<time dateTime={message.createdAt} title={fullDate(message.createdAt)}>
												{time(message.createdAt)}
											</time>
											<Tooltip title={t(copied === message._id ? 'Copied' : 'Copy message')}>
												<IconButton
													size="small"
													aria-label={t('Copy message by {{name}}', { name: message.memberData.memberNick })}
													onClick={async () => {
														try {
															await navigator.clipboard.writeText(message.text);
															setCopied(message._id);
															setNotice('Message copied');
														} catch {
															setNotice('Could not copy. Select the message text to copy it.');
														}
													}}
												>
													{copied === message._id ? <CheckRounded /> : <ContentCopyRounded />}
												</IconButton>
											</Tooltip>
										</div>
									</div>
								</article>
							))}
						</div>
						{jump && (
							<Button
								className="triplink-chat__jump"
								endIcon={<KeyboardArrowDownRounded />}
								onClick={() => {
									if (feed.current) feed.current.scrollTop = feed.current.scrollHeight;
									nearBottom.current = true;
									setJump(false);
								}}
							>
								{t('Jump to latest')}
							</Button>
						)}
						<div className="triplink-chat__typing" role="status">
							{chat.typing.length > 0 &&
								t(chat.typing.length === 1 ? '{{name}} is typing…' : '{{name}} and others are typing…', {
									name: chat.typing[0].memberNick,
								})}
						</div>
						<form
							className="triplink-chat__composer"
							onSubmit={(event) => {
								event.preventDefault();
								submit();
							}}
						>
							<TextField
								className="triplink-chat__input"
								multiline
								minRows={1}
								maxRows={4}
								autoFocus
								inputRef={input}
								placeholder={t('Share something with the group…')}
								value={text}
								disabled={chat.status !== 'authenticated'}
								inputProps={{ maxLength: CHAT_MESSAGE_LIMIT, 'aria-label': t('Message') }}
								onChange={(event) => updateText(event.target.value)}
								onBlur={stopTyping}
								onCompositionStart={() => {
									composing.current = true;
								}}
								onCompositionEnd={() => {
									composing.current = false;
								}}
								onKeyDown={(event) => {
									if (
										event.key === 'Enter' &&
										!event.shiftKey &&
										!composing.current &&
										!event.nativeEvent.isComposing &&
										event.keyCode !== 229
									) {
										event.preventDefault();
										submit();
									}
								}}
							/>
							<div className="triplink-chat__composer-tools">
								<Tooltip title={t('Add emoji')}>
									<IconButton
										aria-label={t('Add emoji')}
										disabled={chat.status !== 'authenticated'}
										onClick={(event) => {
											selection.current = {
												start: input.current?.selectionStart ?? text.length,
												end: input.current?.selectionEnd ?? text.length,
											};
											setEmojiAnchor(event.currentTarget);
										}}
									>
										<SentimentSatisfiedAltRounded />
									</IconButton>
								</Tooltip>
								<span
									className={`triplink-chat__counter ${text.length === CHAT_MESSAGE_LIMIT ? 'is-full' : ''}`}
									aria-label={t('{{count}} of 1000 characters', { count: text.length })}
								>
									{text.length}/1000
								</span>
								<Button
									type="submit"
									className="triplink-chat__send"
									variant="contained"
									endIcon={<SendRounded />}
									disabled={chat.status !== 'authenticated' || !text.trim()}
								>
									{t('Send')}
								</Button>
							</div>
							<p className="triplink-chat__hint">
								{t(
									mobile
										? 'Everyone in this room can see your messages.'
										: 'Enter to send. Shift + Enter for a new line.',
								)}
							</p>
						</form>
					</>
				) : (
					<section className="triplink-chat__people" aria-label={t('Online members')}>
						<p className="triplink-chat__people-summary">{t('One person may have several connections.')}</p>
						{chat.presence.list.map((person) => (
							<div className="triplink-chat__person" key={person._id}>
								<Avatar
									src={avatarSource(person)}
									className={`triplink-chat__avatar triplink-chat__avatar--${person.memberType.toLowerCase()}`}
									aria-hidden="true"
								>
									{chatInitials(person.memberNick)}
								</Avatar>
								{identity(person)}
								<span className="triplink-chat__online-label">{t('Online')}</span>
							</div>
						))}
						{!chat.presence.list.length && (
							<p>{t(chat.status === 'connecting' ? 'Connecting…' : 'Reconnect to see who is here.')}</p>
						)}
						<p className="triplink-chat__connection-count">
							{t('{{count}} active connections', { count: chat.presence.totalClients })}
						</p>
					</section>
				)}
				<div className="triplink-chat__notice" role="status">
					{notice && t(notice)}
				</div>
				<footer className="triplink-chat__footer">
					{t('Latest 50 messages. History clears when the server restarts.')}
				</footer>
			</ChatSurface>
			<Popover
				open={Boolean(emojiAnchor)}
				anchorEl={emojiAnchor}
				onClose={() => setEmojiAnchor(null)}
				anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
				transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
			>
				<div className="triplink-chat-emojis" aria-label={t('Choose an emoji')}>
					{emojis.map(([emoji, label]) => (
						<button
							key={label}
							type="button"
							aria-label={t(label)}
							onClick={() => {
								const next = text.slice(0, selection.current.start) + emoji + text.slice(selection.current.end);
								if (next.length > CHAT_MESSAGE_LIMIT) {
									setNotice('Message limit reached');
									return;
								}
								updateText(next);
								setEmojiAnchor(null);
								requestAnimationFrame(() => {
									input.current?.focus();
									const caret = selection.current.start + emoji.length;
									input.current?.setSelectionRange(caret, caret);
								});
							}}
						>
							{emoji}
						</button>
					))}
				</div>
			</Popover>
		</>
	);
}
