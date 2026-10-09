import withLayoutBasic from '../../libs/components/layout/LayoutBasic';
import Join from '../../libs/components/triplink/Join';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
export const getStaticProps = async ({ locale }: { locale: string }) => ({
	props: { ...(await serverSideTranslations(locale, ['common'])) },
});
export default withLayoutBasic(Join);
