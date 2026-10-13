import { initializeApollo } from '../../apollo/client';
import { memberVar, sessionVar, sessionErrorVar, socketVar } from '../../apollo/store';
import { CURRENT_MEMBER, LOGIN, SIGNUP } from '../../apollo/user/triplink';
import { AuthPayload, Member } from '../types/triplink';
import { getJwtToken, setJwtToken, tokenClaims, tokenIdentity } from './token';
import {
	AuthRequestError,
	authResponse,
	authVersion,
	credentialFetch,
	newAuthVersion,
	publishToken,
	refreshAccessToken,
	startAuthRuntime,
	setAuthPayloadHandler,
} from './runtime';
export { getJwtToken, setJwtToken } from './token';
let generation = 0;
let restoration: Promise<void> | null = null;
let bootstrapped = false;
let hydratedIdentity = '';
setAuthPayloadHandler(acceptAuth);
export function hydrateMember(member: Member) {
	memberVar(member);
	hydratedIdentity = tokenIdentity(getJwtToken());
	sessionVar('authenticated');
	sessionErrorVar('');
}
export const updateStorage = ({ jwtToken }: { jwtToken: string }) => publishToken(jwtToken);
export async function acceptAuth(payload: AuthPayload) {
	startAuthRuntime();
	const changed = tokenIdentity(getJwtToken()) !== tokenIdentity(payload.accessToken);
	const current = ++generation;
	const expectedVersion = authVersion();
	if (changed) {
		await initializeApollo().clearStore();
		if (current !== generation || expectedVersion !== authVersion()) return;
		newAuthVersion();
		socketVar()?.close();
		socketVar(undefined);
	}
	// Hydrate first: local token notification does not need a redundant profile request.
	hydrateMember(payload.member);
	hydratedIdentity = tokenIdentity(payload.accessToken);
	publishToken(payload.accessToken);
	bootstrapped = true;
}
export const logIn = async (nick: string, password: string) => {
	setAuthPayloadHandler(acceptAuth);
	const response = await initializeApollo().mutate({
		mutation: LOGIN,
		variables: { input: { memberNick: nick.trim(), memberPassword: password } },
	});
	if (!response.data?.result) throw new Error('Login failed');
	// The transport commits the new account while it still owns the cookie lock.
};
export const signUp = async (nick: string, password: string, email = '', fullname = '') => {
	setAuthPayloadHandler(acceptAuth);
	const response = await initializeApollo().mutate({
		mutation: SIGNUP,
		variables: {
			input: {
				memberNick: nick.trim(),
				memberPassword: password,
				...(email.trim() ? { memberEmail: email.trim() } : {}),
				...(fullname.trim() ? { memberFullname: fullname.trim() } : {}),
				memberType: 'USER',
			},
		},
	});
	if (!response.data?.result) throw new Error('Signup failed');
	// The transport commits the new account while it still owns the cookie lock.
};
export function clearLocalSession() {
	generation++;
	setJwtToken('');
	memberVar(null);
	sessionVar('anonymous');
	sessionErrorVar('');
	socketVar()?.close();
	socketVar(undefined);
	void initializeApollo().clearStore();
}
export async function logOut() {
	const response = await credentialFetch(
		`${process.env.REACT_APP_API_URL || 'http://localhost:3007'}/auth/logout`,
		{ method: 'POST' },
		'logout',
	);
	await authResponse(response);
	// The transport already cleared local and peer state before releasing the cookie lock.
}
export function restoreSession(force = false): Promise<void> {
	startAuthRuntime();
	if (restoration) return restoration;
	if (!force && bootstrapped && sessionVar() !== 'error') return Promise.resolve();
	const current = generation;
	const version = authVersion();
	sessionVar('loading');
	if (!memberVar() || memberVar()?._id !== tokenClaims(getJwtToken()).sub) {
		memberVar(null);
		socketVar()?.close();
		socketVar(undefined);
		void initializeApollo().clearStore();
	}
	restoration = (async () => {
		try {
			await refreshAccessToken();
			if (current !== generation || version !== authVersion()) return;
			const identity = tokenIdentity(getJwtToken());
			const { data } = await initializeApollo().query({ query: CURRENT_MEMBER, fetchPolicy: 'network-only' });
			if (current === generation && identity === tokenIdentity(getJwtToken())) hydrateMember(data.result);
		} catch (error: unknown) {
			if (current !== generation || version !== authVersion()) return;
			const api = error as { graphQLErrors?: { extensions?: { code?: string } }[] };
			if (
				(error instanceof AuthRequestError && error.definitive) ||
				api.graphQLErrors?.some((e) => ['UNAUTHENTICATED', 'FORBIDDEN'].includes(e.extensions?.code ?? ''))
			)
				clearLocalSession();
			else {
				sessionVar('error');
				sessionErrorVar(
					error instanceof AuthRequestError && error.code === 'BROWSER_UNSUPPORTED'
						? error.message
						: 'Unable to restore your session. Please retry.',
				);
			}
		} finally {
			bootstrapped = true;
		}
	})().finally(() => {
		restoration = null;
	});
	return restoration;
}
export async function synchronizeSession() {
	const claims = tokenClaims(getJwtToken());
	if (
		memberVar()?._id === claims.sub &&
		hydratedIdentity === tokenIdentity(getJwtToken()) &&
		sessionVar() === 'authenticated'
	)
		return;
	generation++;
	memberVar(null);
	socketVar()?.close();
	socketVar(undefined);
	await initializeApollo().clearStore();
	bootstrapped = false;
	await restoration;
	return restoreSession(true);
}
export async function refreshCurrentMember() {
	const current = generation;
	const identity = tokenIdentity(getJwtToken());
	const { data } = await initializeApollo().query({ query: CURRENT_MEMBER, fetchPolicy: 'network-only' });
	if (current === generation && identity === tokenIdentity(getJwtToken())) hydrateMember(data.result);
}
export const updateUserInfo = (_token: string) => restoreSession(true);
export { safeReturnUrl } from './returnUrl';
