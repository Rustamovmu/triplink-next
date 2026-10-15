import type { AppProps } from 'next/app';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { light } from '../scss/MaterialTheme';
import { ApolloProvider } from '@apollo/client';
import { useApollo } from '../apollo/client';
import { appWithTranslation } from 'next-i18next';
import nextI18nextConfig from '../next-i18next.config';
import { SessionBootstrap } from '../libs/components/triplink/Session';
import { TourFavoritesProvider } from '../libs/components/triplink/TourFavorites';
import { NavigationMemoryProvider } from '../libs/triplink/BrowsingMemoryProvider';
import { regionalLocale } from '../libs/triplink/locale';
// @ts-ignore
import '../scss/app.scss';
// @ts-ignore
import '../scss/pc/main.scss';
// @ts-ignore
import '../scss/mobile/main.scss';
// @ts-ignore
import '../scss/triplink.scss';

const App = ({ Component, pageProps }: AppProps) => {
	const { locale } = useRouter();
	useEffect(() => {
		document.documentElement.lang = regionalLocale(locale).split('-')[0];
	}, [locale]);
	// @ts-ignore
	const [theme] = useState(createTheme(light));
	const client = useApollo(pageProps.initialApolloState);

	return (
		<ApolloProvider client={client}>
			<ThemeProvider theme={theme}>
				<CssBaseline />
				<SessionBootstrap />
				<TourFavoritesProvider>
					<NavigationMemoryProvider>
						<Component {...pageProps} />
					</NavigationMemoryProvider>
				</TourFavoritesProvider>
			</ThemeProvider>
		</ApolloProvider>
	);
};

export default appWithTranslation(App, nextI18nextConfig);
