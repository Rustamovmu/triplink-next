import { useTranslation } from 'next-i18next';
import React from 'react';
import useDeviceDetect from '../../hooks/useDeviceDetect';
import Head from 'next/head';
import Top from '../Top';
import Footer from '../Footer';
import { Stack } from '@mui/material';
import HeaderFilter from '../homepage/HeaderFilter';
import ChatTools from '../ChatTools';
// @ts-ignore
import 'swiper/css';
// @ts-ignore
import 'swiper/css/pagination';
// @ts-ignore
import 'swiper/css/navigation';

const withLayoutMain = (Component: any) => {
	return function LayoutMain(props: any) {
		const device = useDeviceDetect();
		const { t } = useTranslation('common');

		if (device == 'mobile') {
			return (
				<>
					<Head>
						<title>{`TripLink · ${t('Travel with TripLink')}`}</title>
						<meta name="description" content={t('Discover tours, connect with travel agents, and share your journeys with TripLink.')} />
						<meta name={'title'} content={`TripLink`} />
					</Head>
					<Stack id="mobile-wrap">
						<Stack id={'top'} className="triplink-home-top">
							<Top />
						</Stack>

						<Stack className={'triplink-home-header'}>
							<HeaderFilter />
						</Stack>
						<Stack id={'main'}>
							<Component {...props} />
						</Stack>

						<ChatTools />
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
						<title>{`TripLink · ${t('Travel with TripLink')}`}</title>
						<meta name="description" content={t('Discover tours, connect with travel agents, and share your journeys with TripLink.')} />
						<meta name={'title'} content={`TripLink`} />
					</Head>
					<Stack id="pc-wrap">
						<Stack id={'top'} className="triplink-home-top">
							<Top />
						</Stack>

						<Stack className={'triplink-home-header'}>
							<HeaderFilter />
						</Stack>

						<Stack id={'main'}>
							<Component {...props} />
						</Stack>

						<ChatTools />

						<Stack id={'footer'}>
							<Footer />
						</Stack>
					</Stack>
				</>
			);
		}
	};
};

export default withLayoutMain;
