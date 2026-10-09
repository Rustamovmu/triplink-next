import React from 'react';
import Link from 'next/link';
import { Button, MenuItem, Select, Stack, Typography } from '@mui/material';
import { useReactiveVar } from '@apollo/client';
import { memberVar, sessionVar } from '../../apollo/store';
import { logOut } from '../auth';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
export default function Top() {
	const member = useReactiveVar(memberVar);
	const session = useReactiveVar(sessionVar);
	const router = useRouter();
	const { t } = useTranslation('common');
	return (
		<Stack
			component="nav"
			aria-label={t('Main navigation')}
			direction={{ xs: 'column', sm: 'row' }}
			spacing={2}
			alignItems="center"
			justifyContent="space-between"
			sx={{ px: { xs: 2, md: 4 }, py: 2, background: '#172c3b', color: 'white' }}
		>
			<Link href="/" passHref>
				<Typography variant="h5">TripLink</Typography>
			</Link>
			<Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
				{[
					['/', 'Home'],
					['/tour', 'Tours'],
					['/agent', 'Agents'],
					['/community', 'Community'],
					['/about', 'About'],
				].map(([url, title]) => (
					<Link key={url} href={url}>
						{t(title)}
					</Link>
				))}
				{member && <Link href="/mypage">{t('My Page')}</Link>}
				{member?.memberType === 'ADMIN' && <Link href="/_admin/users">{t('Admin')}</Link>}
			</Stack>
			<Stack direction="row" spacing={1} alignItems="center">
				{member ? (
					<Button color="inherit" onClick={logOut}>
						{t('Logout')}
					</Button>
				) : (
					session !== 'loading' && (
						<Link href="/account/join">
							{t('Login')} / {t('Register')}
						</Link>
					)
				)}
				<Select
					size="small"
					value={router.locale ?? 'en'}
					inputProps={{ 'aria-label': t('Language') }}
					sx={{ background: 'white', color: '#172c3b', minWidth: 110, '& .MuiSvgIcon-root': { color: '#172c3b' } }}
					onChange={(e) => void router.push(router.asPath, router.asPath, { locale: e.target.value })}
				>
					{[
						['en', 'English'],
						['kr', '한국어'],
						['ru', 'Русский'],
					].map(([locale, label]) => (
						<MenuItem key={locale} value={locale}>
							{label}
						</MenuItem>
					))}
				</Select>
			</Stack>
		</Stack>
	);
}
