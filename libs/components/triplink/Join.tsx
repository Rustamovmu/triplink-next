import { useTranslation } from 'next-i18next';
import React, { useState } from 'react';
import Image from 'next/image';
import { Alert, Button, IconButton, InputAdornment, Stack, TextField } from '@mui/material';
import { useRouter } from 'next/router';
import { useReactiveVar } from '@apollo/client';
import { memberVar } from '../../../apollo/store';
import { logIn, signUp, safeReturnUrl } from '../../auth';
import { useAction } from './Common';
import Link from 'next/link';
import { ProviderButtons } from './ProviderButtons';
import { validNewUsername, validNewPassword } from '../../auth/security';
import { VisibilityOutlined, VisibilityOffOutlined, LandscapeOutlined, LockOutlined } from '@mui/icons-material';
export default function Join() {
	const { t } = useTranslation('common');
	const router = useRouter();
	const member = useReactiveVar(memberVar);
	const [signup, setSignup] = useState(false);
	const action = useAction();
	const [showPassword, setShowPassword] = useState(false);
	return (
		<section className="triplink-join" aria-labelledby="join-title">
			<div className="triplink-join__layout">
				<aside className="triplink-join__visual">
					<Image
						src="/img/banner/tours-alpine-lake.jpg"
						alt={t('An alpine lake surrounded by mountains')}
						fill
						priority
						sizes="(max-width: 767px) 100vw, (max-width: 1120px) 50vw, 560px"
					/>
					<div className="triplink-join__story">
						<LandscapeOutlined aria-hidden="true" />
						<h2>{t('A little further. A lot more to discover.')}</h2>
						<p>{t('Find your next journey, meet local guides, and make room for something unforgettable.')}</p>
					</div>
					<div className="triplink-join__caption">{t('Your next chapter starts here.')}</div>
				</aside>
				<div className="triplink-join__panel">
					{!member && (
						<div className="triplink-join__switch" aria-label={t('Account access')}>
							<Button
								aria-pressed={!signup}
								disabled={action.busy}
								onClick={() => {
									setSignup(false);
									setShowPassword(false);
								}}
							>
								{t('Login')}
							</Button>
							<Button
								aria-pressed={signup}
								disabled={action.busy}
								onClick={() => {
									setSignup(true);
									setShowPassword(false);
								}}
							>
								{t('Register')}
							</Button>
						</div>
					)}
					<header className="triplink-join__heading">
						<h1 id="join-title">
							{t(member ? 'You are logged in.' : signup ? 'Your journey begins here.' : 'Welcome back.')}
						</h1>
						<p>
							{t(
								member
									? 'Your account connects your bookings, saved tours, and travel community.'
									: signup
									? 'Create an account to explore, save, and book your next trip.'
									: 'Log in to pick up where your last adventure left off.',
							)}
						</p>
					</header>
					{action.feedback}
					{typeof router.query.authError === 'string' && (
						<Alert severity="warning">
							{t(
								router.query.authError === 'cancelled'
									? 'Sign-in was canceled. Please try again.'
									: router.query.authError === 'link-required'
									? 'Sign in to your existing account, then connect this provider in Security settings.'
									: 'We could not complete provider sign-in. Please try again.',
							)}
						</Alert>
					)}
					{member ? (
						<Alert severity="success">
							{t('You are logged in.')} <Button onClick={() => void router.push('/mypage')}>{t('My workspace')}</Button>
						</Alert>
					) : (
						<Stack
							key={signup ? 'signup' : 'login'}
							component="form"
							className="triplink-join__form"
							spacing={2}
							onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
								event.preventDefault();
								const form = new FormData(event.currentTarget);
								const nick = String(form.get('nick') ?? '').trim();
								const password = String(form.get('password') ?? '');
								void action.run(async () => {
									if (signup) {
										if (!validNewUsername(nick))
											throw new Error('Choose a username with 3–30 letters, numbers, underscores, periods or hyphens.');
										if (!validNewPassword(password)) throw new Error('Use a password with at least 12 characters.');
										if (password !== String(form.get('confirmPassword') ?? ''))
											throw new Error('Passwords do not match.');
										await signUp(nick, password, String(form.get('email') ?? ''), String(form.get('fullname') ?? ''));
									} else await logIn(nick, password);
									await router.push(safeReturnUrl(router.query.referrer));
								});
							}}
						>
							<TextField
								id="join-nick"
								name="nick"
								label={t(signup ? 'Username' : 'Username or email')}
								required
								inputProps={{ minLength: signup ? 3 : 1, maxLength: signup ? 30 : 254 }}
								autoComplete="username"
							/>
							<TextField
								id="join-password"
								name="password"
								label={t('Password')}
								type={showPassword ? 'text' : 'password'}
								InputProps={{
									endAdornment: (
										<InputAdornment position="end">
											<IconButton
												aria-label={t(showPassword ? 'Hide password' : 'Show password')}
												aria-pressed={showPassword}
												onClick={() => setShowPassword(!showPassword)}
												edge="end"
											>
												{showPassword ? <VisibilityOffOutlined /> : <VisibilityOutlined />}
											</IconButton>
										</InputAdornment>
									),
								}}
								required
								inputProps={{ minLength: signup ? 12 : 1, maxLength: 1024 }}
								autoComplete={signup ? 'new-password' : 'current-password'}
							/>
							{signup && (
								<>
									<TextField
										id="join-confirm"
										name="confirmPassword"
										label={t('Confirm password')}
										type={showPassword ? 'text' : 'password'}
										required
										autoComplete="new-password"
										inputProps={{ minLength: 12, maxLength: 1024 }}
									/>
									<p className="triplink-join__requirements">
										{t('Use at least 12 characters. Spaces and passphrases are welcome.')}
									</p>
									<TextField
										id="join-fullname"
										name="fullname"
										label={t('Full name (optional)')}
										autoComplete="name"
										inputProps={{ minLength: 2, maxLength: 100 }}
									/>
									<TextField
										id="join-email"
										name="email"
										label={t('Email (optional)')}
										type="email"
										autoComplete="email"
										inputProps={{ maxLength: 254 }}
									/>
								</>
							)}
							{!signup && (
								<Link className="triplink-join__forgot" href="/account/recovery">
									{t('Forgot password?')}
								</Link>
							)}
							<Button
								className="triplink-join__submit"
								type="submit"
								variant="contained"
								disableElevation
								disabled={action.busy}
							>
								{t(action.busy ? 'Please wait…' : signup ? 'Create an account' : 'Login')}
							</Button>
							<Button
								className="triplink-join__alternate"
								disabled={action.busy}
								onClick={() => {
									setSignup(!signup);
									setShowPassword(false);
								}}
							>
								{t(signup ? 'Already registered? Login' : 'Create an account')}
							</Button>
						</Stack>
					)}
					{!member && <ProviderButtons returnTo={router.query.referrer} disabled={action.busy} />}
					<div className="triplink-join__note">
						<LockOutlined aria-hidden="true" />
						<span>{t('Your account connects your bookings, saved tours, and travel community.')}</span>
					</div>
				</div>
			</div>
		</section>
	);
}
