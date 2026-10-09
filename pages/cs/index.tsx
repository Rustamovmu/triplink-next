import type { GetServerSideProps } from 'next';
export const getServerSideProps: GetServerSideProps = async ({ query, locale }) => {
	const tab = query.tab === 'notice' ? 'notice' : 'faq';
	return {
		redirect: {
			destination: `${locale && locale !== 'en' ? '/' + locale : ''}/help-center?tab=${tab}`,
			permanent: false,
		},
	};
};
export default function LegacyHelpCenter() {
	return null;
}
