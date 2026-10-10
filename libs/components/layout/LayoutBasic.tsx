import React, { useMemo } from 'react';
import { useRouter } from 'next/router';
import useDeviceDetect from '../../hooks/useDeviceDetect';
import Head from 'next/head';
import Top from '../Top';
import Footer from '../Footer';
import { Stack } from '@mui/material';
import Chat from '../Chat';
import { useTranslation } from 'next-i18next';
// @ts-ignore
import 'swiper/css';
// @ts-ignore
import 'swiper/css/pagination';
// @ts-ignore
import 'swiper/css/navigation';

const withLayoutBasic = (Component: any) => {
	return function BasicLayout(props: any) {
		const router = useRouter();
		const { t } = useTranslation('common');
		const device = useDeviceDetect();

		const memoizedValues = useMemo(() => {
			let title = '',
				desc = '',
				bgImage = '';

			switch (router.pathname) {
				case '/tour':
					title = 'Tours';
					desc = 'Find your next journey.';
					bgImage = '/img/banner/tours-alpine-lake.jpg';
					break;
				case '/agent':
					title = 'Agents';
					desc = 'Travel with TripLink';
					bgImage = '/img/banner/agents.webp';
					break;
				case '/agent/detail':
					title = 'Agent Page';
					desc = 'Travel with TripLink';
					bgImage = '/img/banner/header2.svg';
					break;
				case '/mypage':
					title = 'my page';
					desc = 'Travel with TripLink';
					bgImage = '/img/banner/header1.svg';
					break;
				case '/community':
					title = 'Community';
					desc = 'Travel with TripLink';
					bgImage = '/img/banner/header2.svg';
					break;
				case '/community/detail':
					title = 'Community Detail';
					desc = 'Travel with TripLink';
					bgImage = '/img/banner/header2.svg';
					break;
				case '/help-center':
					title = 'Help Center';
					desc = 'Answers and updates for your TripLink journey';
					bgImage = '/img/banner/header2.svg';
					break;
				case '/account/join':
					title = 'Login/Signup';
					desc = 'Travel with TripLink';
					bgImage = '/img/banner/header2.svg';

					break;
				case '/member':
					title = 'Member Page';
					desc = 'Travel with TripLink';
					bgImage = '/img/banner/header1.svg';
					break;
				default:
					break;
			}

			return { title, desc, bgImage };
		}, [router.pathname]);
		const toursBanner = router.pathname === '/tour' && (
			<section className="triplink-tours-banner" aria-labelledby="tours-banner-title">
				<div>
					<h1 id="tours-banner-title">{t('Tours')}</h1>
					<p>{t('Find your next journey.')}</p>
				</div>
			</section>
		);

		if (device == 'mobile') {
			return (
				<>
					<Head>
						<title>{router.pathname === '/help-center' ? `${t('Help Center')} | TripLink` : 'TripLink'}</title>
						<meta
							name="description"
							content={
								router.pathname === '/help-center'
									? t('Answers and updates for your TripLink journey')
									: t('Travel with TripLink')
							}
						/>
						<meta name={'title'} content={`TripLink`} />
					</Head>
					<Stack id="mobile-wrap">
						<Stack id={'top'}>
							<Top />
						</Stack>
						{toursBanner}

						<Stack id={'main'}>
							<Component {...props} />
						</Stack>

						<Chat />
						<Stack id={'footer'}>
							<Footer />
						</Stack>
					</Stack>
				</>
			);
		} else {
			return (
				<>
					<Head>
						<title>{router.pathname === '/help-center' ? `${t('Help Center')} | TripLink` : 'TripLink'}</title>
						<meta
							name="description"
							content={
								router.pathname === '/help-center'
									? t('Answers and updates for your TripLink journey')
									: t('Travel with TripLink')
							}
						/>
						<meta name={'title'} content={`TripLink`} />
					</Head>
					<Stack id="pc-wrap">
						<Stack id={'top'}>
							<Top />
						</Stack>

						{toursBanner}
						{memoizedValues.title &&
							router.pathname !== '/tour' &&
							router.pathname !== '/agent' &&
							router.pathname !== '/agent/detail' &&
							router.pathname !== '/community' &&
							router.pathname !== '/community/detail' && (
								<Stack
									className="header-basic"
									style={{
										backgroundImage: `url(${memoizedValues.bgImage})`,
										backgroundSize: 'cover',
										boxShadow: 'inset 10px 40px 150px 40px rgb(24 22 36)',
									}}
								>
									<Stack className={'container'}>
										<strong>{t(memoizedValues.title)}</strong>
										<span>{t(memoizedValues.desc)}</span>
									</Stack>
								</Stack>
							)}

						<Stack id={'main'}>
							<Component {...props} />
						</Stack>

						<Chat />

						<Stack id={'footer'}>
							<Footer />
						</Stack>
					</Stack>
				</>
			);
		}
	};
};

export default withLayoutBasic;
