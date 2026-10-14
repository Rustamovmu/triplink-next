import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import {
	Alert,
	Button,
	CircularProgress,
	Dialog,
	DialogActions,
	DialogContent,
	DialogContentText,
	DialogTitle,
} from '@mui/material';
import { useReactiveVar } from '@apollo/client';
import { memberVar } from '../../../apollo/store';
import { sessionRequest } from '../../auth/runtime';
interface DeviceSession {
	id: string;
	deviceName: string;
	userAgent: string;
	lastUsedAt: string;
	createdAt: string;
	isCurrentSession: boolean;
}
export function ActiveSessions({ refreshKey = 0 }: { refreshKey?: number }) {
	const { t, i18n } = useTranslation('common');
	const member = useReactiveVar(memberVar);
	const [sessions, setSessions] = useState<DeviceSession[]>([]);
	const [loaded, setLoaded] = useState(false);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [selection, setSelection] = useState<DeviceSession | 'all' | null>(null);
	const epoch = useRef(0);
	const lock = useRef(false);
	const load = async () => {
		const current = ++epoch.current;
		setLoading(true);
		setError('');
		try {
			const list = await sessionRequest('sessions');
			if (!Array.isArray(list)) throw new Error('Invalid session response');
			if (current === epoch.current) {
				setSessions(list);
				setLoaded(true);
			}
		} catch {
			if (current === epoch.current) setError('Unable to load sessions. Please retry.');
		} finally {
			if (current === epoch.current) setLoading(false);
		}
	};
	const invalidate = () => {
		epoch.current++;
	};
	useEffect(() => {
		void load();
		return invalidate;
	}, [member?._id, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
	const confirm = async () => {
		if (!selection || lock.current) return;
		lock.current = true;
		setBusy(true);
		setError('');
		const target = selection;
		try {
			await sessionRequest(
				target === 'all' ? 'logout-all' : `sessions/${target.id}`,
				target === 'all' ? 'POST' : 'DELETE',
			);
			if (target === 'all' || target.isCurrentSession) {
				// The shared transport cleared this account inside the cookie lock.
			} else await load();
			setSelection(null);
		} catch {
			setError('Unable to sign out. Please retry.');
		} finally {
			lock.current = false;
			setBusy(false);
		}
	};
	const browserName = (agent: string) =>
		/Edg\//.test(agent)
			? 'Edge'
			: /Firefox\//.test(agent)
			? 'Firefox'
			: /Chrome\/|Chromium\//.test(agent)
			? 'Chrome'
			: /Safari\//.test(agent)
			? 'Safari'
			: t('Browser information unavailable');
	const date = (value: string) =>
		new Intl.DateTimeFormat((i18n.language === 'kr' ? 'ko-KR' : i18n.language === 'ru' ? 'ru-RU' : i18n.language === 'uz' ? 'uz-UZ' : 'en-US'), {
			dateStyle: 'medium',
			timeStyle: 'short',
		}).format(new Date(value));
	return (
		<section className="triplink-sessions" aria-labelledby="active-sessions-title">
			<div className="triplink-sessions__heading">
				<div>
					<h3 id="active-sessions-title">{t('Active sessions')}</h3>
					<p>{t('Manage the browsers signed in to your account.')}</p>
				</div>
				<Button onClick={() => void load()} disabled={loading || busy}>
					{t('Refresh')}
				</Button>
			</div>
			{error && !selection && <Alert severity="error">{t(error, { defaultValue: t('Something went wrong!') })}</Alert>}
			{loading ? (
				<div role="status">
					<CircularProgress size={24} aria-label={t('Loading sessions')} />
				</div>
			) : !sessions.length ? (
				loaded && !error ? (
					<p>{t('No active sessions.')}</p>
				) : null
			) : (
				<ul className="triplink-sessions__list">
					{sessions.map((session) => (
						<li key={session.id}>
							<div>
								<strong>{session.deviceName}</strong>
								{session.isCurrentSession && <span className="triplink-sessions__current">{t('This device')}</span>}
								<p className="triplink-sessions__browser">{browserName(session.userAgent)}</p>
								<p>
									{t('Last used')}: <time dateTime={session.lastUsedAt}>{date(session.lastUsedAt)}</time>
								</p>
							</div>
							<Button
								variant="outlined"
								disabled={busy}
								onClick={() => setSelection(session)}
								aria-label={t('Sign out of {{device}}, {{browser}}, last used {{date}}', {
									device: session.deviceName,
									browser: browserName(session.userAgent),
									date: date(session.lastUsedAt),
								})}
							>
								{t('Sign out')}
							</Button>
						</li>
					))}
				</ul>
			)}
			<Button
				color="error"
				variant="outlined"
				disabled={loading || busy || !sessions.length}
				onClick={() => setSelection('all')}
			>
				{t('Log out from all devices')}
			</Button>
			<Dialog
				open={!!selection}
				onClose={() => {
					if (!busy) setSelection(null);
				}}
				aria-labelledby="session-confirm-title"
				aria-describedby="session-confirm-description"
			>
				<DialogTitle id="session-confirm-title">
					{t(selection === 'all' ? 'Log out from all devices?' : 'Sign out of this session?')}
				</DialogTitle>
				<DialogContent>
					{error && <Alert severity="error">{t(error, { defaultValue: t('Something went wrong!') })}</Alert>}
					<DialogContentText id="session-confirm-description">
						{selection === 'all' ? (
							t('Every signed-in browser will need to sign in again.')
						) : selection ? (
							<>
								{t('Selected session: {{device}}, {{browser}}. Last used: {{date}}.', {
									device: selection.deviceName,
									browser: browserName(selection.userAgent),
									date: date(selection.lastUsedAt),
								})}{' '}
								{t(
									selection.isCurrentSession
										? 'You will be signed out on this device. Other sessions will stay signed in.'
										: 'The selected browser will need to sign in again. You will stay signed in on this device.',
								)}
							</>
						) : null}
					</DialogContentText>
				</DialogContent>
				<DialogActions>
					<Button disabled={busy} onClick={() => setSelection(null)}>
						{t('Cancel')}
					</Button>
					<Button color="error" disabled={busy} onClick={() => void confirm()}>
						{t(busy ? 'Signing out…' : 'Sign out')}
					</Button>
				</DialogActions>
			</Dialog>
		</section>
	);
}
