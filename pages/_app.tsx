import type { AppProps } from 'next/app';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import React, { useState } from 'react';
import { light } from '../scss/MaterialTheme';
import { ApolloProvider } from '@apollo/client';
import { useApollo } from '../apollo/client';
import { appWithTranslation } from 'next-i18next';
import nextI18nextConfig from '../next-i18next.config';
import { SessionBootstrap } from '../libs/components/triplink/Session';
import { TourFavoritesProvider } from '../libs/components/triplink/TourFavorites';
import { NavigationMemoryProvider } from '../libs/triplink/BrowsingMemoryProvider';
// @ts-ignore
import '../scss/app.scss';
// @ts-ignore
import '../scss/pc/main.scss';
// @ts-ignore
import '../scss/mobile/main.scss';
// @ts-ignore
import '../scss/triplink.scss';

const App = ({ Component, pageProps }: AppProps) => {
	// @ts-ignore
	const [theme, setTheme] = useState(createTheme(light));
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
