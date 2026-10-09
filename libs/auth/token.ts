export const getJwtToken = (): string =>
	typeof window === 'undefined' ? '' : localStorage.getItem('accessToken') ?? '';
export const setJwtToken = (token: string) => {
	if (typeof window !== 'undefined') localStorage.setItem('accessToken', token);
};
