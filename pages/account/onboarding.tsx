import withLayoutBasic from '../../libs/components/layout/LayoutBasic';
import { SocialOnboarding } from '../../libs/components/triplink/SocialAccount';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
export const getStaticProps = async ({ locale }: { locale: string }) => ({
	props: { ...(await serverSideTranslations(locale, ['common'])) },
});
export default withLayoutBasic(SocialOnboarding);
