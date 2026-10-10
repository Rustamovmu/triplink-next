import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
export const getStaticProps = async ({ locale }: { locale: string }) => ({
	props: { ...(await serverSideTranslations(locale, ['common'])) },
});
import React from 'react';
import withAdminLayout from '../../../libs/components/layout/LayoutAdmin';
import { Access } from '../../../libs/components/triplink/Session';
import { AdminMembers } from '../../../libs/components/triplink/AdminMembers';
function Page() {
	return (
		<Access roles={['ADMIN']}>
			<AdminMembers />
		</Access>
	);
}
export default withAdminLayout(Page);
