import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, CircularProgress, Stack, TextField } from '@mui/material';
import { useMutation, useReactiveVar } from '@apollo/client';
import { useTranslation } from 'next-i18next';
import { memberVar } from '../../../apollo/store';
import { PROFILE_UPDATE } from '../../../apollo/user/triplink';
import { acceptAuth } from '../../auth';
import { AuthRequestError, sessionRequest } from '../../auth/runtime';
import { availableProviders, AuthProvider, SecurityStatus, startProvider, validNewPassword } from '../../auth/security';
import { ActiveSessions } from './ActiveSessions';
import { ProviderIcon } from './ProviderButtons';
const names = { GOOGLE: 'Google', TELEGRAM: 'Telegram', KAKAO: 'Kakao' };
const eventLabels: Record<string, string> = {
	SIGNED_IN: 'Signed in',
	REAUTHENTICATED: 'Identity confirmed',
	PASSWORD_CHANGED: 'Password changed',
	PASSWORD_ADDED: 'Password added',
	PASSWORD_RECOVERED: 'Password recovered',
	PROVIDER_CONNECTED: 'Provider connected',
	PROVIDER_DISCONNECTED: 'Provider disconnected',
	SOCIAL_ACCOUNT_CREATED: 'Account created',
	RECOVERY_CODES_REGENERATED: 'Recovery codes regenerated',
	RECOVERY_EMAIL_VERIFIED: 'Recovery email verified',
};
export function SecuritySettings() {
	const { t, i18n } = useTranslation('common');
	const member = useReactiveVar(memberVar);
	const [status, setStatus] = useState<SecurityStatus | null>(null);
	const [providers, setProviders] = useState<AuthProvider[]>([]);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');
	const [codes, setCodes] = useState<string[]>([]);
	const [reauth, setReauth] = useState(false);
	const [disconnect, setDisconnect] = useState<AuthProvider | null>(null);
	const [sessionRevision, setSessionRevision] = useState(0);
	const epoch = useRef(0),
		lock = useRef(false);
	const [update] = useMutation(PROFILE_UPDATE);
	const load = async () => {
		const current = ++epoch.current;
		try {
			const [account, enabled] = await Promise.all([
				sessionRequest('security') as Promise<SecurityStatus>,
				availableProviders(),
			]);
			if (current === epoch.current) {
				setStatus(account);
				setProviders(enabled);
			}
		} catch {
			if (current === epoch.current) setError('Unable to load account security. Please retry.');
		}
	};
	const invalidate = () => {
		epoch.current++;
	};
	useEffect(() => {
		setStatus(null);
		setCodes([]);
		setSuccess('');
		setError('');
		void load();
		return invalidate;
	}, [member?._id]); // eslint-disable-line react-hooks/exhaustive-deps
	const run = async (work: () => Promise<unknown>, message = '', refreshSessions = false) => {
		if (lock.current) return;
		lock.current = true;
		setBusy(true);
		setError('');
		setSuccess('');
		const current = epoch.current;
		try {
			await work();
			if (current === epoch.current) {
				setSuccess(message);
				if (refreshSessions) setSessionRevision((revision) => revision + 1);
				await load();
			}
		} catch (failure) {
			if (current === epoch.current) {
				if (failure instanceof AuthRequestError && failure.code === 'REAUTHENTICATION_REQUIRED') setReauth(true);
				setError(failure instanceof Error ? failure.message : 'Unable to update account security. Please retry.');
			}
		} finally {
			lock.current = false;
			setBusy(false);
		}
	};
	const date = (value: string) =>
		new Intl.DateTimeFormat((i18n.language === 'kr' ? 'ko-KR' : i18n.language === 'ru' ? 'ru-RU' : i18n.language === 'uz' ? 'uz-UZ' : 'en-US'), {
			dateStyle: 'medium',
			timeStyle: 'short',
		}).format(new Date(value));
	return (
		<div className="triplink-security" aria-busy={busy}>
			{error && (
				<Alert
					severity="error"
					action={!status ? <Button onClick={() => void load()}>{t('Retry')}</Button> : undefined}
				>
					{t(error, { defaultValue: t('Something went wrong!') })}
				</Alert>
			)}
			{success && <Alert severity="success">{t(success)}</Alert>}
			{!status ? (
				<div role="status">
					<CircularProgress size={24} aria-label={t('Loading account security')} />
				</div>
			) : (
				<>
					<section aria-labelledby="security-methods-title">
						<h3 id="security-methods-title">{t('Connected accounts')}</h3>
						<p>
							{t('Connect a provider to sign in to this same TripLink account. Your trips and profile stay together.')}
						</p>
						<ul className="triplink-security__providers">
							{(['GOOGLE', 'TELEGRAM', 'KAKAO'] as AuthProvider[]).map((provider) => {
								const connected = status.identities.some((i) => i.provider === provider);
								return (
									<li key={provider}>
										<div>
											<ProviderIcon provider={provider} />
											<strong>{names[provider]}</strong>
											<span>{t(connected ? 'Connected' : 'Not connected')}</span>
										</div>
										{connected ? (
											<Button
												color="error"
												disabled={busy || (!status.hasPassword && status.identities.length === 1)}
												onClick={() => setDisconnect(provider)}
											>
												{t('Disconnect {{provider}}', { provider: names[provider] })}
											</Button>
										) : providers.includes(provider) ? (
											<Button
												disabled={busy}
												onClick={() => void run(() => startProvider(provider, 'LINK', '/mypage?category=security'))}
											>
												{t('Connect {{provider}}', { provider: names[provider] })}
											</Button>
										) : (
											<span>{t('Unavailable')}</span>
										)}
									</li>
								);
							})}
						</ul>
						{!status.hasPassword && status.identities.length === 1 && (
							<p>{t('Add a password or connect another provider before disconnecting your only sign-in method.')}</p>
						)}
						{disconnect && (
							<Alert severity="warning">
								<p>
									{t('Disconnecting this provider signs out other devices. Your trips and profile will be preserved.')}
								</p>
								<Button
									disabled={busy}
									onClick={() =>
										void run(
											async () => {
												await sessionRequest(`identities/${disconnect.toLowerCase()}`, 'DELETE');
												setDisconnect(null);
											},
											'Provider disconnected.',
											true,
										)
									}
								>
									{t('Confirm disconnect')}
								</Button>
								<Button disabled={busy} onClick={() => setDisconnect(null)}>
									{t('Cancel')}
								</Button>
							</Alert>
						)}
					</section>
					<section aria-labelledby="security-reauth-title">
						<h3 id="security-reauth-title">{t('Confirm your identity')}</h3>
						<p>{t('Sensitive changes require a sign-in within the last five minutes. Confirm again if prompted.')}</p>
						{status.hasPassword ? (
							<Stack
								component="form"
								spacing={2}
								onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
									event.preventDefault();
									const form = event.currentTarget;
									const password = String(new FormData(form).get('reauthPassword') ?? '');
									void run(async () => {
										await sessionRequest('security/reauthenticate', 'POST', { password });
										form.reset();
										setReauth(false);
									}, 'Identity confirmed. You can retry your security change.');
								}}
							>
								<TextField
									name="reauthPassword"
									label={t('Current password')}
									type="password"
									required
									autoComplete="current-password"
									inputProps={{ maxLength: 1024 }}
								/>
								<Button disabled={busy} type="submit" variant={reauth ? 'contained' : 'outlined'}>
									{t('Confirm identity')}
								</Button>
							</Stack>
						) : (
							<Stack direction="row" flexWrap="wrap" gap={1}>
								{status.identities
									.filter((i) => providers.includes(i.provider))
									.map((i) => (
										<Button
											key={i.provider}
											disabled={busy}
											onClick={() => void run(() => startProvider(i.provider, 'REAUTH', '/mypage?category=security'))}
										>
											{t('Confirm with {{provider}}', { provider: names[i.provider] })}
										</Button>
									))}
							</Stack>
						)}
					</section>
					<section aria-labelledby="security-password-title">
						<h3 id="security-password-title">{t(status.hasPassword ? 'Change password' : 'Add a password')}</h3>
						<p>{t('Use at least 12 characters. Spaces and passphrases are welcome.')}</p>
						<Stack
							component="form"
							spacing={2}
							onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
								event.preventDefault();
								const form = event.currentTarget,
									data = new FormData(form);
								void run(
									async () => {
										const password = String(data.get('newPassword') ?? '');
										if (!validNewPassword(password)) throw new Error('Use a password with at least 12 characters.');
										if (password !== String(data.get('confirmPassword') ?? ''))
											throw new Error('Passwords do not match.');
										if (status.hasPassword) {
											const response = await update({
												variables: {
													input: {
														passwordChange: {
															currentPassword: String(data.get('currentPassword') ?? ''),
															newPassword: password,
														},
													},
												},
											});
											if (!response.data?.result) throw new Error('Unable to change password. Please retry.');
											await acceptAuth(response.data.result);
										} else await sessionRequest('password/set', 'POST', { password });
										form.reset();
									},
									'Password saved. Other devices have been signed out.',
									true,
								);
							}}
						>
							{status.hasPassword && (
								<TextField
									name="currentPassword"
									label={t('Current password')}
									type="password"
									required
									autoComplete="current-password"
									inputProps={{ maxLength: 1024 }}
								/>
							)}
							<TextField
								name="newPassword"
								label={t('New password')}
								type="password"
								required
								autoComplete="new-password"
								inputProps={{ minLength: 12, maxLength: 1024 }}
							/>
							<TextField
								name="confirmPassword"
								label={t('Confirm password')}
								type="password"
								required
								autoComplete="new-password"
								inputProps={{ minLength: 12, maxLength: 1024 }}
							/>
							<Button disabled={busy} variant="contained" type="submit">
								{t(status.hasPassword ? 'Change password' : 'Add password')}
							</Button>
						</Stack>
					</section>
					<section aria-labelledby="security-recovery-title">
						<h3 id="security-recovery-title">{t('Account recovery')}</h3>
						<p>
							{t(
								'A verified email or saved recovery code is required to recover a forgotten password. TripLink does not use SMS.',
							)}
						</p>
						{status.recoveryEmail && (
							<p>
								{status.recoveryEmail} — {t(status.emailVerified ? 'Verified' : 'Not verified')}
							</p>
						)}
						{status.emailDeliveryAvailable ? (
							<Stack
								component="form"
								spacing={2}
								onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
									event.preventDefault();
									const email = String(new FormData(event.currentTarget).get('email') ?? '');
									void run(
										() => sessionRequest('email/verification/request', 'POST', { email }),
										'Verification email sent. Follow its link to confirm your recovery address.',
									);
								}}
							>
								<TextField
									name="email"
									label={t('Recovery email')}
									type="email"
									required
									autoComplete="email"
									inputProps={{ maxLength: 254 }}
								/>
								<Button disabled={busy} type="submit" variant="outlined">
									{t('Send verification email')}
								</Button>
							</Stack>
						) : (
							<p>{t('Email delivery is not configured. Save recovery codes to protect your account.')}</p>
						)}
						<p>{t('{{count}} unused recovery codes', { count: status.recoveryCodesRemaining })}</p>
						<Button
							disabled={busy}
							variant="outlined"
							onClick={() =>
								void run(async () => {
									const result = await sessionRequest('recovery-codes/generate', 'POST');
									setCodes(result.codes);
								}, 'New recovery codes generated. Previous codes are no longer valid.')
							}
						>
							{t('Generate new recovery codes')}
						</Button>
						{!!codes.length && (
							<div className="triplink-security__codes">
								<Alert severity="warning">
									{t('Save these codes somewhere private. They are shown only once. Each code works once.')}
								</Alert>
								<ul>
									{codes.map((code) => (
										<li key={code}>
											<code>{code}</code>
										</li>
									))}
								</ul>
								<Button onClick={() => setCodes([])}>{t('I saved my codes')}</Button>
							</div>
						)}
					</section>
					<ActiveSessions refreshKey={sessionRevision} />
					<Button
						disabled={busy}
						variant="outlined"
						onClick={() =>
							void run(
								() => sessionRequest('sessions/revoke-others', 'POST'),
								'Other devices have been signed out.',
								true,
							)
						}
					>
						{t('Log out all other devices')}
					</Button>
					<section aria-labelledby="security-events-title">
						<h3 id="security-events-title">{t('Recent security activity')}</h3>
						{status.events.length ? (
							<ul className="triplink-security__events">
								{status.events.map((event, index) => (
									<li key={`${event.createdAt}-${index}`}>
										<span>
											{t(eventLabels[event.action] ?? 'Account security updated')}
											{event.provider ? ` · ${names[event.provider]}` : ''}
										</span>
										<time dateTime={event.createdAt}>{date(event.createdAt)}</time>
									</li>
								))}
							</ul>
						) : (
							<p>{t('No recent security activity.')}</p>
						)}
					</section>
				</>
			)}
		</div>
	);
}
