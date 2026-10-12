import React from 'react';
import { useRouter } from 'next/router';
import { Tabs, Tab } from '@mui/material';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import withLayoutBasic from '../../libs/components/layout/LayoutBasic';
import Faq from '../../libs/components/cs/Faq';
import Notice from '../../libs/components/cs/Notice';
export const getStaticProps = async ({ locale }: { locale: string }) => ({
	props: { ...(await serverSideTranslations(locale, ['common'])) },
});
function HelpCenter() {
	const { t } = useTranslation('common');
	const router = useRouter();
	const tab = router.query.tab === 'notice' ? 'notice' : 'faq';
	return (
		<div className="triplink-support">
			<section data-triplink-nav-hero className="triplink-support__hero">
				<div>
					<h1>{t('How can we help?')}</h1>
					<p>{t('Answers and updates for your TripLink journey')}</p>
					<a href="#help-panel">{t('Browse the Help Center')}</a>
				</div>
			</section>
			<div className="triplink-support__main">
				<Tabs
					value={tab}
					onChange={(_, value) =>
						router.replace({ pathname: '/help-center', query: { tab: value } }, undefined, { shallow: true })
					}
					aria-label={t('Help Center')}
				>
					<Tab value="faq" label={t('FAQs')} id="faq-tab" aria-controls="help-panel" />
					<Tab value="notice" label={t('Notices')} id="notice-tab" aria-controls="help-panel" />
				</Tabs>
				<div role="tabpanel" id="help-panel" aria-labelledby={tab + '-tab'}>
					{tab === 'faq' ? <Faq /> : <Notice />}
				</div>
			</div>
		</div>
	);
}
export default withLayoutBasic(HelpCenter);
