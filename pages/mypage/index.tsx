import withLayoutBasic from '../../libs/components/layout/LayoutBasic';
import Workspace from '../../libs/components/triplink/Workspace';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
export const getStaticProps = async ({ locale }: { locale: string }) => ({
	props: { ...(await serverSideTranslations(locale, ['common'])) },
});
export default withLayoutBasic(Workspace);
