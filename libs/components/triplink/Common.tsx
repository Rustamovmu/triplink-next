import { errorMessage } from '../../triplink/errors';
import React, { ReactNode, useRef, useState } from 'react';
import { Alert, Button, CircularProgress, Container, Pagination, Stack, Typography } from '@mui/material';
import { useReactiveVar } from '@apollo/client';
import { sessionVar } from '../../../apollo/store';
import { useTranslation } from 'next-i18next';
export function Frame({ title, children }: { title: string; children: ReactNode }) {
	useTranslation('common');

	return (
		<Container maxWidth="lg" sx={{ py: { xs: 3, md: 6 }, minHeight: '50vh' }}>
			<Stack spacing={3}>
				<Typography variant="h4" component="h1">
					{title}
				</Typography>
				{children}
			</Stack>
		</Container>
	);
}
export function QueryState({
	loading,
	error,
	empty,
	retry,
	children,
}: {
	loading: boolean;
	error?: Error;
	empty?: boolean;
	retry?: () => unknown;
	children: ReactNode;
}) {
	const { t } = useTranslation('common');
	if (loading)
		return (
			<div role="status" data-browse-pending="true" style={{ padding: 32, textAlign: 'center' }}>
				<CircularProgress aria-label={t('Loading')} />
			</div>
		);
	if (error)
		return (
			<Alert severity="error" action={retry && <Button onClick={() => retry()}>{t('Retry')}</Button>}>
				{t(errorMessage(error), { defaultValue: t('Something went wrong!') })}
			</Alert>
		);
	if (empty) return <Alert severity="info">{t('No results')}</Alert>;
	return <>{children}</>;
}
export function Pager({
	total,
	page,
	limit = 12,
	onChange,
}: {
	total: number;
	page: number;
	limit?: number;
	onChange: (page: number) => void;
}) {
	const { t } = useTranslation('common');

	return total > limit ? (
		<Pagination
			aria-label={t('Pages')}
			getItemAriaLabel={(type, page) =>
				type === 'page'
					? t('Go to page {{page}}', { page })
					: t({ first: 'First page', last: 'Last page', next: 'Next page', previous: 'Previous page' }[type])
			}
			count={Math.ceil(total / limit)}
			page={page}
			onChange={(_, value) => onChange(value)}
		/>
	) : null;
}
export function useAction() {
	const lock = useRef(false);
	const [busy, setBusy] = useState(false);
	const [notice, setNotice] = useState<{ severity: 'error' | 'success'; text: string } | null>(null);
	const { t } = useTranslation('common');
	const run = async (action: () => Promise<unknown>, success: string | null = 'Saved') => {
		if (lock.current) return;
		lock.current = true;
		setBusy(true);
		setNotice(null);
		try {
			await action();
			if (success !== null) setNotice({ severity: 'success', text: success });
		} catch (error: unknown) {
			setNotice({ severity: 'error', text: errorMessage(error) });
		} finally {
			lock.current = false;
			setBusy(false);
		}
	};
	return {
		busy,
		run,
		feedback: notice && (
			<Alert severity={notice.severity} onClose={() => setNotice(null)}>
				{t(notice.text, { defaultValue: t('Something went wrong!') })}
			</Alert>
		),
	};
}
export const usePublicReady = () => ['authenticated', 'anonymous'].includes(useReactiveVar(sessionVar));
export const imageUrl = (path?: string | null) =>
	!path
		? '/img/profile/defaultUser.svg'
		: path.startsWith('/') && !path.startsWith('/uploads/')
		? path
		: `${process.env.REACT_APP_API_URL || 'http://localhost:3007'}/${path.replace(/^\//, '')}`;
export const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
export const displayDate = (iso?: string | null, locale = 'en') =>
	!iso || Number.isNaN(Date.parse(iso))
		? '—'
		: new Intl.DateTimeFormat(locale === 'kr' ? 'ko-KR' : locale === 'uz' ? 'uz-UZ' : locale, {
				dateStyle: 'medium',
				timeStyle: 'short',
		  }).format(new Date(iso));
