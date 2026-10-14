import React from 'react';
import Head from 'next/head';
import withLayoutHome from '../libs/components/layout/LayoutHome';
import HomeSections from '../libs/components/homepage/HomeSections';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
export const getStaticProps = async ({ locale }: { locale: string }) => ({
	props: { ...(await serverSideTranslations(locale, ['common'])) },
});
function Home() {
	return (
		<>
			<Head>
				<title>TripLink — Explore Tours, Travel Agents &amp; Experiences</title>
				<meta
					name="description"
					content="Discover TripLink, a travel platform where you can explore tours, connect with travel agents, discover events, read travel articles, and share experiences with a community of travelers."
				/>
				<meta name="robots" content="index, follow" />
			</Head>
			<HomeSections />
		</>
	);
}
export default withLayoutHome(Home);
