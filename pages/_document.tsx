import { Html, Head, Main, NextScript, DocumentProps } from 'next/document';

export default function Document({ __NEXT_DATA__ }: DocumentProps) {
	return (
		<Html lang={__NEXT_DATA__.locale === 'kr' ? 'ko' : __NEXT_DATA__.locale || 'en'}>
			<Head>
				<meta name="robots" content="index,follow" />
				<link rel="icon" type="image/svg+xml" href="/img/logo/favicon.svg" />

				<meta name="keywords" content="TripLink, tours, travel, travel agents" />
			</Head>
			<body>
				<Main />
				<NextScript />
			</body>
		</Html>
	);
}
