import React from 'react';
import { Typography } from '@mui/material';
import withLayoutHome from '../libs/components/layout/LayoutHome';
import { Frame } from '../libs/components/triplink/Common';
import { TourList } from '../libs/components/triplink/Tours';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
export const getStaticProps = async ({ locale }: { locale: string }) => ({
	props: { ...(await serverSideTranslations(locale, ['common'])) },
});
function Home() {
	const { t } = useTranslation('common');
	return (
		<Frame title={t('Explore with TripLink')}>
			<Typography variant="h5">{t('Featured tours')}</Typography>
			<TourList input={{ page: 1, limit: 6, search: { featured: true } }} />
			<Typography variant="h5">{t('Best rated')}</Typography>
			<TourList input={{ page: 1, limit: 6, search: {}, sort: 'tourAverageRating', direction: 'DESC' }} />
			<Typography variant="h5">{t('Popular tours')}</Typography>
			<TourList input={{ page: 1, limit: 6, search: {}, sort: 'tourBookingCount', direction: 'DESC' }} />
		</Frame>
	);
}
export default withLayoutHome(Home);
