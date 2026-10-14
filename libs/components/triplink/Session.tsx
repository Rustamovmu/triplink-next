import { useTranslation } from 'next-i18next';
import React, { useEffect, ReactNode } from 'react';
import { Alert, Button, CircularProgress, Stack } from '@mui/material';
import { useReactiveVar } from '@apollo/client';
import { memberVar, sessionVar, sessionErrorVar } from '../../../apollo/store';
import { restoreSession, clearLocalSession, synchronizeSession, safeReturnUrl } from '../../auth';
import { Role } from '../../types/triplink';
import Link from 'next/link';
import { useRouter } from 'next/router';
export function SessionBootstrap() {
	const { t } = useTranslation('common');

	const status = useReactiveVar(sessionVar);
	const error = useReactiveVar(sessionErrorVar);
	useEffect(() => {
		void restoreSession();
		const invalidate = () => clearLocalSession();
		const sync = () => {
			void synchronizeSession();
		};
		window.addEventListener('triplink:session-invalid', invalidate);
		window.addEventListener('triplink:auth-change', sync);
		return () => {
			window.removeEventListener('triplink:session-invalid', invalidate);
			window.removeEventListener('triplink:auth-change', sync);
		};
	}, []);
	return status === 'error' ? (
		<Alert severity="error" action={<Button onClick={() => void restoreSession(true)}>{t('Retry')}</Button>}>
			{t(error, { defaultValue: t('Something went wrong!') })}
		</Alert>
	) : null;
}
export function Access({ roles, children }: { roles?: Role[]; children: ReactNode }) {
	const { t } = useTranslation('common');
	const router = useRouter();

	const session = useReactiveVar(sessionVar);
	const member = useReactiveVar(memberVar);
	const error = useReactiveVar(sessionErrorVar);
	if (session === 'loading')
		return (
			<Stack alignItems="center" p={4}>
				<CircularProgress aria-label={t('Restoring session')} />
			</Stack>
		);
	if (session === 'error')
		return (
			<Alert severity="error" action={<Button onClick={() => void restoreSession(true)}>{t('Retry')}</Button>}>
				{t(error, { defaultValue: t('Something went wrong!') })}
			</Alert>
		);
	if (!member)
		return (
			<Alert severity="info">
				<Link href={{ pathname: '/account/join', query: { referrer: safeReturnUrl(router.asPath) } }}>
					{t('Login to continue')}
				</Link>
			</Alert>
		);
	if (roles && !roles.includes(member.memberType))
		return <Alert severity="warning">{t('You do not have access to this page.')}</Alert>;
	return <>{children}</>;
}
