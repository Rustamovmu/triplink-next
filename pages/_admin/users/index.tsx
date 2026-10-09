import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
export const getStaticProps = async ({ locale }: { locale: string }) => ({
	props: { ...(await serverSideTranslations(locale, ['common'])) },
});
import React from 'react';
import withAdminLayout from '../../../libs/components/layout/LayoutAdmin';
import { Access } from '../../../libs/components/triplink/Session';
import { Frame } from '../../../libs/components/triplink/Common';
import { AdminMembers } from '../../../libs/components/triplink/AdminMembers';
function Page() {
	const { t } = useTranslation('common');
	return (
		<Access roles={['ADMIN']}>
			<Frame title={t('Member management')}>
				<AdminMembers />
			</Frame>
		</Access>
	);
}
export default withAdminLayout(Page);
