import withLayoutBasic from '../../libs/components/layout/LayoutBasic';
import AccountRecovery from '../../libs/components/triplink/AccountRecovery';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
export const getStaticProps = async ({ locale }: { locale: string }) => ({
	props: { ...(await serverSideTranslations(locale, ['common'])) },
});
export default withLayoutBasic(AccountRecovery);
