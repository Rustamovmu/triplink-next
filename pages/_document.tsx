import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
	return (
		<Html lang="en">
			<Head>
				<meta name="robots" content="index,follow" />
				<link rel="icon" type="image/svg+xml" href="/img/logo/favicon.svg" />

				<meta name="keywords" content="TripLink, tours, travel, travel agents" />
				<meta
					name="description"
					content="Discover tours, connect with travel agents, and share your journeys with TripLink."
				/>
			</Head>
			<body>
				<Main />
				<NextScript />
			</body>
		</Html>
	);
}
