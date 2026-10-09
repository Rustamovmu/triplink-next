import React from 'react';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import withAdminLayout from '../../../libs/components/layout/LayoutAdmin';
import { Access } from '../../../libs/components/triplink/Session';
import { Frame } from '../../../libs/components/triplink/Common';
import HelpCenterManager from '../../../libs/components/admin/cs/HelpCenterManager';
export const getStaticProps = async ({ locale }: { locale: string }) => ({
	props: { ...(await serverSideTranslations(locale, ['common'])) },
});
function Page() {
	const { t } = useTranslation('common');
	return (
		<Access roles={['ADMIN']}>
			<Frame title={t('Help Center: FAQs')}>
				<HelpCenterManager kind="FAQ" />
			</Frame>
		</Access>
	);
}
export default withAdminLayout(Page);
