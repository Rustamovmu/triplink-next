import { useTranslation } from 'next-i18next';
import React, { useState } from 'react';
import { Alert, Button, MenuItem, Stack, TextField } from '@mui/material';
import { useRouter } from 'next/router';
import { useReactiveVar } from '@apollo/client';
import { memberVar } from '../../../apollo/store';
import { logIn, signUp, safeReturnUrl } from '../../auth';
import { Frame, useAction } from './Common';
export default function Join() {
	const { t } = useTranslation('common');
	const router = useRouter();
	const member = useReactiveVar(memberVar);
	const [signup, setSignup] = useState(false);
	const action = useAction();
	return (
		<Frame title={t(signup ? 'Register' : 'Login')}>
			{action.feedback}
			{member ? (
				<Alert severity="success">
					{t('You are logged in.')} <Button onClick={() => void router.push('/mypage')}>{t('My workspace')}</Button>
				</Alert>
			) : (
				<Stack
					component="form"
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
						name="nick"
						label={t('Nickname')}
						required
						inputProps={{ minLength: 3, maxLength: 20 }}
						autoComplete="username"
					/>
					<TextField
						name="password"
						label={t('Password')}
						type="password"
						required
						inputProps={{ minLength: 8, maxLength: 72 }}
						autoComplete={signup ? 'new-password' : 'current-password'}
					/>
					{signup && (
						<>
							<TextField
								name="phone"
								label={t('Phone')}
								type="tel"
								required
								inputProps={{ minLength: 7, maxLength: 20 }}
								autoComplete="tel"
							/>
							<TextField name="role" label={t('Role')} select defaultValue="USER">
								<MenuItem value="USER">{t('Traveler')}</MenuItem>
								<MenuItem value="AGENT">{t('Travel agent')}</MenuItem>
							</TextField>
						</>
					)}
					<Button type="submit" variant="contained" disabled={action.busy}>
						{t(signup ? 'Register' : 'Login')}
					</Button>
					<Button disabled={action.busy} onClick={() => setSignup(!signup)}>
						{t(signup ? 'Already registered? Login' : 'Create an account')}
					</Button>
				</Stack>
			)}
		</Frame>
	);
}
