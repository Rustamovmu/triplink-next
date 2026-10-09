import { GetServerSideProps } from 'next';
export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
	redirect: { destination: `${locale && locale !== 'en' ? '/' + locale : ''}/_admin/users`, permanent: false },
});
export default function AdminRedirect() {
	return null;
}
