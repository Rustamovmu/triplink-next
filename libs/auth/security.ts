import { authResponse, credentialFetch, sessionRequest } from './runtime';
import { safeReturnUrl } from './returnUrl';
export type AuthProvider = 'GOOGLE' | 'TELEGRAM' | 'KAKAO';
export interface SecurityStatus {
	username: string;
	hasPassword: boolean;
	recoveryEmail: string;
	emailVerified: boolean;
	recoveryCodesRemaining: number;
	emailDeliveryAvailable: boolean;
	identities: { provider: AuthProvider; linkedAt: string; lastUsedAt?: string }[];
	events: { action: string; provider?: AuthProvider; createdAt: string }[];
}
const api = process.env.REACT_APP_API_URL || 'http://localhost:3007';
export async function publicAuthRequest(path: string, body?: unknown, kind: 'login' | 'session' = 'session') {
	return authResponse(
		await credentialFetch(
			`${api}/auth/${path}`,
			{
				method: body === undefined ? 'GET' : 'POST',
				...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
			},
			kind,
		),
	);
}
export async function availableProviders(signal?: AbortSignal): Promise<AuthProvider[]> {
	const response = await fetch(`${api}/auth/providers`, { credentials: 'omit', signal });
	if (!response.ok) throw new Error('Unable to load sign-in providers. Please retry.');
	const result: { providers?: unknown } = await response.json();
	if (!Array.isArray(result.providers) || result.providers.some((p) => !['GOOGLE', 'TELEGRAM', 'KAKAO'].includes(p)))
		throw new Error('Unable to load sign-in providers. Please retry.');
	return result.providers;
}
export async function startProvider(provider: AuthProvider, intent: 'LOGIN' | 'LINK' | 'REAUTH', returnTo: unknown) {
	const path = `oauth/${provider.toLowerCase()}/start`;
	const body = { intent, returnTo: safeReturnUrl(returnTo) };
	const response = intent === 'LOGIN' ? await publicAuthRequest(path, body) : await sessionRequest(path, 'POST', body);
	const url = new URL(response.authorizationUrl);
	if (
		url.protocol !== 'https:' ||
		!['accounts.google.com', 'oauth.telegram.org', 'kauth.kakao.com'].includes(url.hostname)
	)
		throw new Error('Unable to start provider sign-in. Please retry.');
	window.location.assign(url.toString());
}
const reserved = new Set([
	'admin',
	'administrator',
	'triplink',
	'support',
	'security',
	'system',
	'root',
	'auth',
	'api',
]);
export function validNewUsername(value: string) {
	return /^[a-zA-Z0-9_.-]{3,30}$/.test(value.trim()) && !reserved.has(value.trim().toLowerCase());
}
export function validNewPassword(value: string) {
	return value.length >= 12 && value.length <= 1024;
}
