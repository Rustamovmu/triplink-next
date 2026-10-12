const tourImageOrigin = new URL(process.env.REACT_APP_API_URL || 'http://localhost:3007');

/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	images: {
		remotePatterns: [
			{
				protocol: tourImageOrigin.protocol.replace(':', ''),
				hostname: tourImageOrigin.hostname,
				port: tourImageOrigin.port,
				pathname: '/uploads/tour/**',
			},
			{
				protocol: tourImageOrigin.protocol.replace(':', ''),
				hostname: tourImageOrigin.hostname,
				port: tourImageOrigin.port,
				pathname: '/uploads/article/**',
			},
		],
	},
	env: {
		REACT_APP_API_URL: process.env.REACT_APP_API_URL || 'http://localhost:3007',
		REACT_APP_API_GRAPHQL_URL: process.env.REACT_APP_API_GRAPHQL_URL || 'http://localhost:3007/graphql',
		REACT_APP_API_WS: process.env.REACT_APP_API_WS || 'ws://localhost:3007/chat',
	},
};

const { i18n } = require('./next-i18next.config');
nextConfig.i18n = i18n;

module.exports = nextConfig;
