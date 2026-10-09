import React from 'react';
import Link from 'next/link';
import { Stack, Typography } from '@mui/material';
import { useTranslation } from 'next-i18next';
export default function Footer() {
	const { t } = useTranslation('common');
	return (
		<Stack component="footer" spacing={2} sx={{ p: 4, background: '#172c3b', color: 'white' }}>
			<Typography variant="h6">TripLink</Typography>
			<Typography>{t('Discover tours, follow travel agents, and share your journeys.')}</Typography>
			<Stack direction="row" spacing={3}>
				<Link href="/tour">{t('Tours')}</Link>
				<Link href="/agent">{t('Agents')}</Link>
				<Link href="/community">{t('Community')}</Link>
			</Stack>
			<Typography variant="caption">© TripLink {new Date().getFullYear()}</Typography>
		</Stack>
	);
}
