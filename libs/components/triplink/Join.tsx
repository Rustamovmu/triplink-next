import { useTranslation } from 'next-i18next';
import React, { useState } from 'react';
import Image from 'next/image';
import { Alert, Button, IconButton, InputAdornment, MenuItem, Stack, TextField } from '@mui/material';
import { useRouter } from 'next/router';
import { useReactiveVar } from '@apollo/client';
import { memberVar } from '../../../apollo/store';
import { logIn, signUp, safeReturnUrl } from '../../auth';
import { useAction } from './Common';
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
					{member ? (
						<Alert severity="success">
							{t('You are logged in.')} <Button onClick={() => void router.push('/mypage')}>{t('My workspace')}</Button>
						</Alert>
					) : (
						<Stack
							component="form"
							className="triplink-join__form"
							spacing={2}
							onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
								event.preventDefault();
								const form = new FormData(event.currentTarget);
								const nick = String(form.get('nick') ?? '').trim();
								const password = String(form.get('password') ?? '');
								void action.run(async () => {
									if (signup)
										await signUp(nick, password, String(form.get('phone') ?? ''), String(form.get('role') ?? 'USER'));
									else await logIn(nick, password);
									await router.push(safeReturnUrl(router.query.referrer));
								});
							}}
						>
							<TextField
								id="join-nick"
								name="nick"
								label={t('Nickname')}
								required
								inputProps={{ minLength: 3, maxLength: 20 }}
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
								inputProps={{ minLength: 8, maxLength: 72 }}
								autoComplete={signup ? 'new-password' : 'current-password'}
							/>
							{signup && (
								<>
									<TextField
										id="join-phone"
										name="phone"
										label={t('Phone')}
										type="tel"
										required
										inputProps={{ minLength: 7, maxLength: 20 }}
										autoComplete="tel"
									/>
									<TextField id="join-role" name="role" label={t('Role')} select defaultValue="USER">
										<MenuItem value="USER">{t('Traveler')}</MenuItem>
										<MenuItem value="AGENT">{t('Travel agent')}</MenuItem>
									</TextField>
								</>
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
					<div className="triplink-join__note">
						<LockOutlined aria-hidden="true" />
						<span>{t('Your account connects your bookings, saved tours, and travel community.')}</span>
					</div>
				</div>
			</div>
		</section>
	);
}
