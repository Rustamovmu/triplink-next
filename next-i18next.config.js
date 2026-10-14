/** @type {import('next-i18next').UserConfig & { trailingSlash: boolean }} */
const config = {
	i18n: {
		defaultLocale: 'en',
		locales: ['en', 'kr', 'ru', 'uz'],
		localeDetection: false,
	},
	trailingSlash: true,
	fallbackLng: 'en',
	reloadOnPrerender: process.env.NODE_ENV === 'development',
	// Phrase keys contain punctuation; treat each as one literal key.
	keySeparator: false,
	nsSeparator: false,
};

module.exports = config;
