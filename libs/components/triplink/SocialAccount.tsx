import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Alert, Button, CircularProgress, Stack, TextField } from '@mui/material';
import { useTranslation } from 'next-i18next';
import { restoreSession, safeReturnUrl } from '../../auth';
import { publicAuthRequest, validNewUsername } from '../../auth/security';
import { useAction } from './Common';
export function SocialComplete() {
	const { t } = useTranslation('common'),
		router = useRouter();
	const [error, setError] = useState('');
	const flight = useRef<Promise<{ returnTo: string }> | null>(null);
	useEffect(() => {
		if (!router.isReady) return;
		let active = true;
		if (!flight.current)
			flight.current =
				router.query.security === '1'
					? restoreSession(true).then(() => ({ returnTo: '/mypage?category=security' }))
					: publicAuthRequest('social/finish', {}, 'login');
		void flight.current
			.then((result) => {
				if (active) void router.replace(safeReturnUrl(result.returnTo));
			})
			.catch(() => {
				if (active) setError('Unable to complete sign-in. Please sign in again.');
			});
		return () => {
			active = false;
		};
	}, [router.isReady, router]);
	return (
		<section className="triplink-auth-task">
			<h1>{t('Completing sign-in')}</h1>
			{error ? (
				<Alert severity="error">
					{t(error, { defaultValue: t('Something went wrong!') })} <Link href="/account/join">{t('Login')}</Link>
				</Alert>
			) : (
				<div role="status">
					<CircularProgress aria-label={t('Completing sign-in')} />
				</div>
			)}
		</section>
	);
}
export function SocialOnboarding() {
	const { t } = useTranslation('common'),
		router = useRouter();
	const action = useAction();
	const [name, setName] = useState<string | null>(null),
		[error, setError] = useState('');
	useEffect(() => {
		let active = true;
		void publicAuthRequest('social/onboarding')
			.then((result) => {
				if (active) setName(result.suggestedName);
			})
			.catch(() => {
				if (active) setError('Your sign-in request has expired. Please sign in with your provider again.');
			});
		return () => {
			active = false;
		};
	}, []);
	return (
		<section className="triplink-auth-task">
			<h1>{t('Choose your TripLink username')}</h1>
			<p>
				{t(
					'Your username connects your trips, saved tours, and community profile. No phone number or password is required.',
				)}
			</p>
			{action.feedback}
			{error ? (
				<Alert severity="error">
					{t(error, { defaultValue: t('Something went wrong!') })} <Link href="/account/join">{t('Login')}</Link>
				</Alert>
			) : name === null ? (
				<div role="status">
					<CircularProgress aria-label={t('Loading account')} />
				</div>
			) : (
				<Stack
					component="form"
					spacing={2}
					onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
						event.preventDefault();
						const data = new FormData(event.currentTarget);
						void action.run(async () => {
							const memberNick = String(data.get('username') ?? '').trim();
							if (!validNewUsername(memberNick))
								throw new Error('Choose a username with 3–30 letters, numbers, underscores, periods or hyphens.');
							const fullname = String(data.get('fullname') ?? '').trim();
							const result = await publicAuthRequest(
								'social/onboarding',
								{ memberNick, ...(fullname ? { memberFullname: fullname } : {}) },
								'login',
							);
							await router.replace(safeReturnUrl(result.returnTo));
						});
					}}
				>
					<TextField
						name="username"
						label={t('Username')}
						required
						autoComplete="username"
						inputProps={{ minLength: 3, maxLength: 30 }}
					/>
					<TextField
						name="fullname"
						label={t('Full name (optional)')}
						defaultValue={name}
						autoComplete="name"
						inputProps={{ minLength: 2, maxLength: 100 }}
					/>
					<Button disabled={action.busy} type="submit" variant="contained">
						{t(action.busy ? 'Please wait…' : 'Complete account setup')}
					</Button>
				</Stack>
			)}
		</section>
	);
}
