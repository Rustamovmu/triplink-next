import { serverSideTranslations as loadTranslations } from 'next-i18next/serverSideTranslations';

type TranslationStore = Record<string, Record<string, Record<string, unknown>>>;

export async function serverSideTranslations(locale: string, namespaces: string[] = ['common']) {
	const props = await loadTranslations(locale, namespaces);
	const data = props._nextI18Next;
	// This optimization relies on TripLink's flat phrase keys and English fallback.
	if (locale === 'en' || !data || data.userConfig?.keySeparator !== false || data.userConfig?.fallbackLng !== 'en') {
		return props;
	}

	const store = data.initialI18nStore as TranslationStore;
	const english = Object.fromEntries(
		Object.entries(store.en || {}).map(([namespace, translations]) => {
			const current = store[locale]?.[namespace] || {};
			return [
				namespace,
				Object.fromEntries(
					Object.entries(translations).filter(([key]) => {
						const value = current[key];
						return !Object.prototype.hasOwnProperty.call(current, key) || typeof value !== 'string' || value === '';
					}),
				),
			];
		}),
	);
	// Never prune the shared server resource cache: other pages still use the full dictionaries.
	return {
		...props,
		_nextI18Next: { ...data, initialI18nStore: { ...store, en: english } },
	};
}
