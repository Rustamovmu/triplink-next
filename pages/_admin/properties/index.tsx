import { GetServerSideProps } from 'next';
export const getServerSideProps: GetServerSideProps = async () => ({
	redirect: { destination: '/_admin/tours', permanent: false },
});
export default function LegacyRedirect() {
	return null;
}
