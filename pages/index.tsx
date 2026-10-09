import React from 'react';
import { Typography } from '@mui/material';
import withLayoutHome from '../libs/components/layout/LayoutHome';
import { Container, Stack } from '@mui/material';
import { TourList } from '../libs/components/triplink/Tours';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
export const getStaticProps = async ({ locale }: { locale: string }) => ({
	props: { ...(await serverSideTranslations(locale, ['common'])) },
});
function Home() {
	const { t } = useTranslation('common');
	return (
		<Container maxWidth="lg" sx={{ py: { xs: 3, md: 6 }, minHeight: '50vh' }}>
			<Stack spacing={3}>
				<Typography variant="h4" component="h2">
					{t('Explore with TripLink')}
				</Typography>
				<Typography variant="h5">{t('Featured tours')}</Typography>
				<TourList input={{ page: 1, limit: 6, search: { featured: true } }} />
				<Typography variant="h5">{t('Best rated')}</Typography>
				<TourList input={{ page: 1, limit: 6, search: {}, sort: 'tourAverageRating', direction: 'DESC' }} />
				<Typography variant="h5">{t('Popular tours')}</Typography>
				<TourList input={{ page: 1, limit: 6, search: {}, sort: 'tourBookingCount', direction: 'DESC' }} />
			</Stack>
		</Container>
	);
}
export default withLayoutHome(Home);
