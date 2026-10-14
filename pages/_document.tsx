import { Html, Head, Main, NextScript, DocumentProps } from 'next/document';

export default function Document({ __NEXT_DATA__ }: DocumentProps) {
	return (
		<Html lang={__NEXT_DATA__.locale === 'kr' ? 'ko' : __NEXT_DATA__.locale || 'en'}>
			<Head>
				<link rel="icon" type="image/svg+xml" href="/img/logo/favicon.svg" />
			</Head>
			<body>
				<Main />
				<NextScript />
			</body>
		</Html>
	);
}
