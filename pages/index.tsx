import React from 'react';
import { Container } from '@mui/material';
import withLayoutHome from '../libs/components/layout/LayoutHome';
import HomeSections from '../libs/components/homepage/HomeSections';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
export const getStaticProps = async ({ locale }: { locale: string }) => ({
	props: { ...(await serverSideTranslations(locale, ['common'])) },
});
function Home() {
	return (
		<Container maxWidth="lg" sx={{ py: { xs: 4, md: 7 }, minHeight: '50vh' }}>
			<HomeSections />
		</Container>
	);
}
export default withLayoutHome(Home);
