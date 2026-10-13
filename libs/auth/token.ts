import { accessTokenVar } from '../../apollo/store';
export const getJwtToken = (): string => (typeof window === 'undefined' ? '' : accessTokenVar());
export const setJwtToken = (token: string) => accessTokenVar(token);
export function tokenClaims(token: string): { sub?: string; sid?: string; exp?: number } {
	try {
		const payload = token.split('.')[1];
		return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
	} catch {
		return {};
	}
}
export const tokenIdentity = (token: string) => {
	const claims = tokenClaims(token);
	return claims.sid ? `${claims.sub}:${claims.sid}` : token;
};
export const tokenFresh = (token: string) => !!token && (tokenClaims(token).exp ?? 0) * 1000 > Date.now() + 30000;
