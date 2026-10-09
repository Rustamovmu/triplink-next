import withLayoutBasic from '../../libs/components/layout/LayoutBasic';
import { CommunityPage } from '../../libs/components/triplink/Community';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
export const getStaticProps = async ({ locale }: { locale: string }) => ({
	props: { ...(await serverSideTranslations(locale, ['common'])) },
});
export default withLayoutBasic(CommunityPage);
