/** @type {import('next-i18next').UserConfig & { trailingSlash: boolean }} */
const config = {
	i18n: {
		defaultLocale: 'en',
		locales: ['en', 'kr', 'ru'],
		localeDetection: false,
	},
	trailingSlash: true,
};

module.exports = config;
