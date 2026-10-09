import { GetServerSideProps } from 'next';
export const getServerSideProps: GetServerSideProps = async ({ query, locale }) => {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (typeof value === 'string') params.set(key, value);
	}
	return {
		redirect: {
			destination: `${locale && locale !== 'en' ? '/' + locale : ''}/tour/detail${
				params.size ? '?' + params.toString() : ''
			}`,
			permanent: false,
		},
	};
};
export default function LegacyRedirect() {
	return null;
}
