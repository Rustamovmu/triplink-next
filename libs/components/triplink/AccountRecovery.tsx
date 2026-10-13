import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Stack, TextField } from '@mui/material';
import { useTranslation } from 'next-i18next';
import { publicAuthRequest, validNewPassword } from '../../auth/security';
import { clearAuthentication } from '../../auth/runtime';
import { useAction } from './Common';
export default function AccountRecovery() {
	const { t } = useTranslation('common'),
		action = useAction();
	const [credential, setCredential] = useState<{ kind: 'reset' | 'verify'; token: string } | null>(null);
	const [codes, setCodes] = useState(false),
		[message, setMessage] = useState(''),
		[complete, setComplete] = useState(false);
	useEffect(() => {
		const fragment = new URLSearchParams(window.location.hash.slice(1));
		const reset = fragment.get('reset'),
			verify = fragment.get('verify');
		if (reset || verify) setCredential({ kind: reset ? 'reset' : 'verify', token: reset ?? verify! });
		// One-time email credentials are kept in component memory, never storage or query parameters.
		if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
	}, []);
	return (
		<section className="triplink-auth-task">
			<h1>{t(credential?.kind === 'verify' ? 'Verify recovery email' : 'Recover your account')}</h1>
			<p>{t('Use your verified recovery email or a saved recovery code. TripLink does not use SMS.')}</p>
			{action.feedback}
			{message && <Alert severity="success">{t(message)}</Alert>}
			{!complete &&
				(credential?.kind === 'verify' ? (
					<Button
						disabled={action.busy}
						variant="contained"
						onClick={() =>
							void action.run(async () => {
								await publicAuthRequest('email/verification/confirm', { token: credential.token });
								setCredential(null);
								setComplete(true);
								setMessage('Your recovery email has been verified.');
							})
						}
					>
						{t('Verify email')}
					</Button>
				) : credential?.kind === 'reset' || codes ? (
					<Stack
						component="form"
						spacing={2}
						onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
							event.preventDefault();
							const form = event.currentTarget,
								data = new FormData(form);
							void action.run(async () => {
								const password = String(data.get('password') ?? '');
								if (!validNewPassword(password)) throw new Error('Use a password with at least 12 characters.');
								if (password !== String(data.get('confirm') ?? '')) throw new Error('Passwords do not match.');
								await publicAuthRequest('password/reset', {
									password,
									...(credential
										? { token: credential.token }
										: {
												memberNick: String(data.get('username') ?? ''),
												recoveryCode: String(data.get('code') ?? '').trim(),
										  }),
								});
								clearAuthentication();
								setCredential(null);
								form.reset();
								setComplete(true);
								setMessage('Password reset. Sign in again with your new password.');
							});
						}}
					>
						{codes && !credential && (
							<>
								<TextField
									name="username"
									label={t('Username')}
									required
									autoComplete="username"
									inputProps={{ maxLength: 30 }}
								/>
								<TextField
									name="code"
									label={t('Recovery code')}
									required
									autoComplete="off"
									inputProps={{ minLength: 24, maxLength: 24 }}
								/>
							</>
						)}
						<TextField
							name="password"
							label={t('New password')}
							type="password"
							required
							autoComplete="new-password"
							inputProps={{ minLength: 12, maxLength: 1024 }}
						/>
						<TextField
							name="confirm"
							label={t('Confirm password')}
							type="password"
							required
							autoComplete="new-password"
							inputProps={{ minLength: 12, maxLength: 1024 }}
						/>
						<Button type="submit" variant="contained" disabled={action.busy}>
							{t('Reset password')}
						</Button>
					</Stack>
				) : (
					<Stack
						component="form"
						spacing={2}
						onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
							event.preventDefault();
							const identifier = String(new FormData(event.currentTarget).get('identifier') ?? '');
							void action.run(async () => {
								const result = await publicAuthRequest('password/forgot', { identifier });
								setMessage(result.message);
							});
						}}
					>
						<TextField
							name="identifier"
							label={t('Username or email')}
							required
							autoComplete="username"
							inputProps={{ maxLength: 254 }}
						/>
						<Button type="submit" variant="contained" disabled={action.busy}>
							{t('Send reset link')}
						</Button>
						<Button
							onClick={() => {
								setCodes(true);
								setMessage('');
							}}
						>
							{t('Use a recovery code')}
						</Button>
					</Stack>
				))}
			<p>
				<Link href="/account/join">{t('Back to login')}</Link>
			</p>
		</section>
	);
}
