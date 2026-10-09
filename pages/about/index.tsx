import React from 'react';
import { Typography } from '@mui/material';
import withLayoutBasic from '../../libs/components/layout/LayoutBasic';
import { Frame } from '../../libs/components/triplink/Common';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
export const getStaticProps = async ({ locale }: { locale: string }) => ({
	props: { ...(await serverSideTranslations(locale, ['common'])) },
});
function About() {
	const { t } = useTranslation('common');
	return (
		<Frame title={t('About TripLink')}>
			<Typography>{t('Discover tours, follow travel agents, and share your journeys.')}</Typography>
			<Typography>{t('Payments are simulated. Chat history contains the latest five messages.')}</Typography>
		</Frame>
	);
}
export default withLayoutBasic(About);
