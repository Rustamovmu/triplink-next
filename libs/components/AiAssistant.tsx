import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { useReactiveVar } from '@apollo/client';
import {
	Alert,
	Button,
	Checkbox,
	Dialog,
	Fade,
	FormControlLabel,
	IconButton,
	Paper,
	TextField,
	Tooltip,
	useMediaQuery,
} from '@mui/material';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import RestartAltRounded from '@mui/icons-material/RestartAltRounded';
import SendRounded from '@mui/icons-material/SendRounded';
import ArrowOutwardRounded from '@mui/icons-material/ArrowOutwardRounded';
import { memberVar } from '../../apollo/store';
import { getJwtToken } from '../auth/token';
import { useAiAssistant } from '../triplink/useAiAssistant';
import { parseTourSearchQuery } from '../triplink/tourSearchUrl';
import { AiChatInput, AiIntent, AI_MESSAGE_LIMIT } from '../types/triplink/ai';

const quickActions: [string, AiIntent, string][] = [
	['Find Tours', 'FIND_TOURS', 'Help me find a tour.'],
	['Popular Destinations', 'POPULAR_DESTINATIONS', 'Show me destinations from popular TripLink tours.'],
	['Plan My Trip', 'PLAN_TRIP', 'Help me plan my trip.'],
	['Best-Rated Tours', 'BEST_RATED', 'Show me the best-rated TripLink tours.'],
];
const errors = {
	rate: 'AI is busy. Wait a moment, then retry.',
	unavailable: 'AI assistance is unavailable right now. Please retry.',
	network: 'The response could not be received. Please retry.',
	session: 'Your session is unavailable. Please sign in again.',
};

export default function AiAssistant() {
	const { t, i18n } = useTranslation('common');
	const router = useRouter();
	const member = useReactiveVar(memberVar);
	const token = getJwtToken();
	const ai = useAiAssistant(member?._id, token);
	const mobile = useMediaQuery('(max-width:599px)');
	const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
	const [open, setOpen] = useState(false);
	const [text, setText] = useState('');
	const [detailed, setDetailed] = useState(false);
	const [viewportHeight, setViewportHeight] = useState<number>();
	const launcher = useRef<HTMLButtonElement>(null);
	const input = useRef<HTMLTextAreaElement>(null);
	const panel = useRef<HTMLDivElement>(null);
	const feed = useRef<HTMLDivElement>(null);
	const composing = useRef(false);
	const locale = i18n.language === 'kr' ? 'ko' : i18n.language || 'en';
	const price = (value: number) =>
		new Intl.NumberFormat(locale, {
			style: 'currency',
			currency: 'USD',
			maximumFractionDigits: 2,
			minimumFractionDigits: 0,
		}).format(value);
	useEffect(() => {
		setOpen(false);
		setText('');
		setDetailed(false);
	}, [member?._id, token]);
	const close = () => {
		setOpen(false);
		launcher.current?.focus();
	};
	useEffect(() => {
		if (!open) return;
		const viewport = window.visualViewport;
		const resize = () => setViewportHeight(viewport?.height ?? window.innerHeight);
		resize();
		viewport?.addEventListener('resize', resize);
		const escape = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && !mobile) {
				setOpen(false);
				launcher.current?.focus();
			}
		};
		document.addEventListener('keydown', escape);
		return () => {
			viewport?.removeEventListener('resize', resize);
			document.removeEventListener('keydown', escape);
		};
	}, [open, mobile]);
	useEffect(() => {
		if (!open || mobile) return;
		const frame = requestAnimationFrame(() => input.current?.focus());
		return () => cancelAnimationFrame(frame);
	}, [open, mobile]);
	useEffect(() => {
		if (feed.current && open) feed.current.scrollTop = feed.current.scrollHeight;
	}, [ai.turns, ai.loading, ai.error, open]);
	const context = (intent?: AiIntent): Omit<AiChatInput, 'message' | 'history'> => {
		const result: Omit<AiChatInput, 'message' | 'history'> = { detailed, ...(intent ? { intent } : {}) };
		if (
			!intent &&
			router.pathname === '/tour/detail' &&
			typeof router.query.id === 'string' &&
			/^[a-f0-9]{24}$/i.test(router.query.id)
		)
			result.tourId = router.query.id;
		if (router.pathname === '/tour') {
			try {
				result.search = parseTourSearchQuery(router.query).search;
			} catch {
				// Invalid URLs do not inject unchecked search objects into the assistant.
			}
		}
		return result;
	};
	const submit = () => {
		if (ai.send(text, context())) {
			setText('');
			input.current?.focus();
		}
	};
	if (!member) return null;
	const content = (
		<>
			<header className="triplink-ai__header">
				<div className="triplink-ai__mark">
					<AutoAwesomeRounded />
				</div>
				<div className="triplink-ai__heading">
					<h2 id="triplink-ai-title">{t('AI Assistant')}</h2>
					<p>{t('Your next journey, a little closer.')}</p>
				</div>
				<Tooltip title={t('Clear conversation')}>
					<IconButton
						onClick={() => {
							ai.clear();
							setText('');
							input.current?.focus();
						}}
						aria-label={t('Clear conversation')}
					>
						<RestartAltRounded />
					</IconButton>
				</Tooltip>
				<IconButton onClick={close} aria-label={t('Close AI assistant')}>
					<CloseRounded />
				</IconButton>
			</header>
			<div
				className="triplink-ai__feed"
				ref={feed}
				role="log"
				aria-label={t('AI conversation')}
				aria-live="polite"
				aria-relevant="additions text"
			>
				<div className="triplink-ai__welcome">
					<span className="triplink-ai__speaker">{t('TripLink AI')}</span>
					<p>{t("Hi! I'm your TripLink AI assistant. Where would you like to travel?")}</p>
					{!ai.turns.length && (
						<div className="triplink-ai__quick-actions">
							{quickActions.map(([label, intent, prompt]) => (
								<button key={intent} disabled={ai.loading} onClick={() => ai.send(t(prompt), context(intent))}>
									{t(label)}
									<ArrowOutwardRounded />
								</button>
							))}
						</div>
					)}
				</div>
				{ai.turns.map((turn) => (
					<article key={turn.id} className={`triplink-ai__message is-${turn.role}`}>
						<span className="triplink-ai__speaker">{t(turn.role === 'user' ? 'You' : 'TripLink AI')}</span>
						<p>{turn.text}</p>
						{!!turn.sources?.length && (
							<details className="triplink-ai__sources">
								<summary>
									{t('Tours used for this answer')} <span>{turn.sources.length}</span>
								</summary>
								<ul>
									{turn.sources.map((source) => (
										<li key={source.tourId}>
											<Link href={{ pathname: '/tour/detail', query: { id: source.tourId } }} onClick={close} passHref>
												<strong>{source.title}</strong>
												<ArrowOutwardRounded />
												<span>
													{source.destination} · {price(source.price)} ·{' '}
													{t('{{count}} days', { count: source.durationDays })}
												</span>
												<span>
													{source.status === 'SOLD_OUT'
														? t('Sold out')
														: source.reviewCount > 0
														? t('Rated {{rating}} / 5', { rating: source.rating.toFixed(1) })
														: t('No reviews yet')}
												</span>
											</Link>
										</li>
									))}
								</ul>
							</details>
						)}
					</article>
				))}
				{ai.loading && (
					<div className="triplink-ai__loading" role="status">
						<span />
						<span />
						<span />
						<span className="triplink-ai__loading-label">{t('Thinking about your trip…')}</span>
					</div>
				)}
				{ai.error && (
					<Alert
						severity="warning"
						action={
							ai.error !== 'session' ? (
								<Button onClick={ai.retry} disabled={ai.loading}>
									{t('Retry')}
								</Button>
							) : undefined
						}
					>
						{t(errors[ai.error])}
					</Alert>
				)}
			</div>
			<footer className="triplink-ai__footer">
				<form
					onSubmit={(event) => {
						event.preventDefault();
						submit();
					}}
				>
					<TextField
						multiline
						maxRows={4}
						fullWidth
						inputRef={input}
						value={text}
						placeholder={t('Ask about your next trip…')}
						disabled={ai.error === 'session'}
						onChange={(event) => setText(event.target.value)}
						inputProps={{ maxLength: AI_MESSAGE_LIMIT, 'aria-label': t('Message AI assistant') }}
						onCompositionStart={() => {
							composing.current = true;
						}}
						onCompositionEnd={() => {
							composing.current = false;
						}}
						onKeyDown={(event) => {
							if (event.key === 'Enter' && !event.shiftKey && !composing.current && !event.nativeEvent.isComposing) {
								event.preventDefault();
								submit();
							}
						}}
					/>
					<IconButton
						type="submit"
						className="triplink-ai__send"
						disabled={ai.loading || !text.trim() || ai.error === 'session'}
						aria-label={t('Send to AI assistant')}
					>
						<SendRounded />
					</IconButton>
				</form>
				<div className="triplink-ai__options">
					<FormControlLabel
						control={
							<Checkbox size="small" checked={detailed} onChange={(event) => setDetailed(event.target.checked)} />
						}
						label={t('More detail')}
					/>
					<span>
						{text.length}/{AI_MESSAGE_LIMIT}
					</span>
				</div>
				<p className="triplink-ai__note">{t('AI can make mistakes. Check tour details before booking.')}</p>
			</footer>
		</>
	);
	const paperProps = { id: 'triplink-ai-panel', className: 'triplink-ai', ref: panel, tabIndex: -1 };
	return (
		<>
			<Button
				className="triplink-ai-launcher"
				ref={launcher}
				startIcon={<AutoAwesomeRounded />}
				onClick={(event) => {
					if (mobile) event.currentTarget.blur();
					setOpen(true);
				}}
				aria-expanded={open}
				aria-controls={open ? 'triplink-ai-panel' : undefined}
			>
				{t('AI Assistant')}
			</Button>
			{mobile ? (
				<Dialog
					open={open}
					onClose={close}
					maxWidth={false}
					transitionDuration={reducedMotion ? 0 : 180}
					aria-labelledby="triplink-ai-title"
					className="triplink-ai-dialog"
					PaperProps={{ ...paperProps, style: viewportHeight ? { height: viewportHeight } : undefined }}
				>
					{content}
				</Dialog>
			) : (
				<Fade in={open} timeout={reducedMotion ? 0 : 180} mountOnEnter unmountOnExit>
					<div className="triplink-ai-dock">
						<Paper {...paperProps} role="dialog" aria-modal="false" aria-labelledby="triplink-ai-title">
							{content}
						</Paper>
					</div>
				</Fade>
			)}
		</>
	);
}
