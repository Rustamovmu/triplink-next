import withLayoutBasic from '../../libs/components/layout/LayoutBasic';
import { MemberProfile } from '../../libs/components/triplink/Profiles';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
export const getStaticProps = async ({ locale }: { locale: string }) => ({
	props: { ...(await serverSideTranslations(locale, ['common'])) },
});
export default withLayoutBasic(MemberProfile);
