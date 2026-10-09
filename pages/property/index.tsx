import { GetServerSideProps } from 'next';
export const getServerSideProps: GetServerSideProps = async ({ query, locale }) => {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (typeof value === 'string' && key !== 'input') params.set(key, value);
	}
	if (typeof query.input === 'string') {
		try {
			const legacy = JSON.parse(query.input);
			if (Number.isInteger(legacy.page) && legacy.page > 0) params.set('page', String(legacy.page));
			if (typeof legacy.search?.text === 'string') params.set('text', legacy.search.text);
			if (Number.isFinite(legacy.search?.pricesRange?.start) && Number.isFinite(legacy.search?.pricesRange?.end)) {
				params.set('minPrice', String(legacy.search.pricesRange.start));
				params.set('maxPrice', String(legacy.search.pricesRange.end));
			}
			const sortMap: Record<string, string> = {
				createdAt: 'createdAt',
				propertyPrice: 'tourPrice',
				propertyViews: 'tourViewCount',
			};
			if (sortMap[legacy.sort]) params.set('sort', sortMap[legacy.sort]);
			if (['ASC', 'DESC'].includes(legacy.direction)) params.set('direction', legacy.direction);
		} catch {
			/* Invalid legacy filters fall back to the public tour list. */
		}
	}
	return {
		redirect: {
			destination: `${locale && locale !== 'en' ? '/' + locale : ''}/tour${params.size ? '?' + params.toString() : ''}`,
			permanent: false,
		},
	};
};
export default function LegacyRedirect() {
	return null;
}
