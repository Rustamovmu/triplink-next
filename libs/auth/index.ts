import { initializeApollo } from '../../apollo/client';
import { memberVar, sessionVar, sessionErrorVar, socketVar } from '../../apollo/store';
import { CURRENT_MEMBER, LOGIN, SIGNUP } from '../../apollo/user/triplink';
import { AuthPayload, Member } from '../types/triplink';
import { getJwtToken, setJwtToken } from './token';
export { getJwtToken, setJwtToken } from './token';
let generation = 0;
export function hydrateMember(member: Member) {
	memberVar(member);
	sessionVar('authenticated');
	sessionErrorVar('');
}
export const updateStorage = ({ jwtToken }: { jwtToken: string }) => {
	setJwtToken(jwtToken);
	localStorage.setItem('login', Date.now().toString());
};
export async function acceptAuth(payload: AuthPayload) {
	const current = ++generation;
	await initializeApollo().clearStore();
	if (current !== generation) return;
	updateStorage({ jwtToken: payload.accessToken });
	hydrateMember(payload.member);
	socketVar()?.close();
	socketVar(undefined);
}
export const logIn = async (nick: string, password: string) => {
	const response = await initializeApollo().mutate({
		mutation: LOGIN,
		variables: { input: { memberNick: nick.trim(), memberPassword: password } },
	});
	if (!response.data?.result) throw new Error('Login failed');
	await acceptAuth(response.data.result);
};
export const signUp = async (nick: string, password: string, phone: string, type: string) => {
	if (type !== 'USER' && type !== 'AGENT') throw new Error('Choose USER or AGENT');
	const response = await initializeApollo().mutate({
		mutation: SIGNUP,
		variables: {
			input: {
				memberNick: nick.trim(),
				memberPassword: password,
				memberPhone: phone.trim(),
				memberType: type,
				memberAuthType: 'PHONE',
			},
		},
	});
	if (!response.data?.result) throw new Error('Signup failed');
	await acceptAuth(response.data.result);
};
export function logOut() {
	generation++;
	localStorage.removeItem('accessToken');
	localStorage.setItem('logout', Date.now().toString());
	memberVar(null);
	sessionVar('anonymous');
	sessionErrorVar('');
	socketVar()?.close();
	socketVar(undefined);
	void initializeApollo().clearStore();
}
export async function restoreSession() {
	const token = getJwtToken();
	const current = ++generation;
	sessionVar('loading');
	memberVar(null);
	socketVar()?.close();
	socketVar(undefined);
	await initializeApollo().clearStore();
	if (current !== generation || token !== getJwtToken()) return;
	if (!token) {
		memberVar(null);
		sessionVar('anonymous');
		return;
	}
	try {
		const { data } = await initializeApollo().query({ query: CURRENT_MEMBER, fetchPolicy: 'network-only' });
		if (current === generation && token === getJwtToken()) hydrateMember(data.result);
	} catch (error: unknown) {
		if (current !== generation) return;
		const codes = (error as { graphQLErrors?: { extensions?: { code?: string } }[] }).graphQLErrors?.map(
			(item) => item.extensions?.code,
		);
		if (codes?.some((code) => code === 'UNAUTHENTICATED' || code === 'FORBIDDEN')) logOut();
		else {
			memberVar(null);
			sessionVar('error');
			sessionErrorVar('Unable to restore your session. Please retry.');
		}
	}
}
export async function refreshCurrentMember() {
	const token = getJwtToken();
	const current = generation;
	const { data } = await initializeApollo().query({ query: CURRENT_MEMBER, fetchPolicy: 'network-only' });
	if (current === generation && token === getJwtToken()) hydrateMember(data.result);
}
export const updateUserInfo = (_token: string) => restoreSession();
export { safeReturnUrl } from './returnUrl';
