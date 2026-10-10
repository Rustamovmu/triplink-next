import React from 'react';
import withLayoutHome from '../libs/components/layout/LayoutHome';
import HomeSections from '../libs/components/homepage/HomeSections';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
export const getStaticProps = async ({ locale }: { locale: string }) => ({
	props: { ...(await serverSideTranslations(locale, ['common'])) },
});
function Home() {
	return <HomeSections />;
}
export default withLayoutHome(Home);
