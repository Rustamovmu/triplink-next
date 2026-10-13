import type { AuthPayload } from '../types/triplink';
import { getJwtToken, setJwtToken, tokenFresh, tokenIdentity, tokenClaims } from './token';
const apiOrigin = process.env.REACT_APP_API_URL || 'http://localhost:3007';
const versionKey = 'triplink:auth-version';
const pendingKey = 'triplink:refresh-operation';
let flight: Promise<string> | null = null;
let channel: BroadcastChannel | null = null;
let worker: SharedWorker | null = null;
let initialized = false;
let memoryVersion = '';
let recentToken = '';
let recentTokenAt = 0;
let payloadHandler: ((payload: AuthPayload) => Promise<void>) | undefined;
export const setAuthPayloadHandler = (handler: (payload: AuthPayload) => Promise<void>) => {
	payloadHandler = handler;
};
async function commitCredentialResponse(response: Response, kind: string, expectedVersion: string) {
	if (!response.ok) return;
	if (kind === 'login') {
		const result = await response.clone().json();
		const payload = result.data?.result ?? result;
		if (payload?.accessToken && !result.errors?.length) {
			if (authVersion() !== expectedVersion)
				throw new AuthRequestError('STALE', 'Authentication changed while signing in. Please retry.');
			if (!payloadHandler) throw new AuthRequestError('INVALID_STATE', 'Unable to sign in. Please retry.');
			await payloadHandler(payload);
		}
	}
	if (kind === 'logout') clearAuthentication();
}
const workerRequests = new Map<string, { resolve: (value: Response) => void; reject: (error: Error) => void }>();
export class AuthRequestError extends Error {
	constructor(public code: string, message: string, public definitive = false) {
		super(message);
		Object.setPrototypeOf(this, AuthRequestError.prototype);
		this.name = 'AuthRequestError';
	}
}
const storage = {
	get: (key: string) => {
		try {
			return localStorage.getItem(key) ?? '';
		} catch {
			return '';
		}
	},
	set: (key: string, value: string) => {
		try {
			localStorage.setItem(key, value);
		} catch {
			/* Worker/locks still serialize this browser context. */
		}
	},
	remove: (key: string) => {
		try {
			localStorage.removeItem(key);
		} catch {
			/* No persisted credentials. */
		}
	},
};
const uuid = () => crypto.randomUUID();
const locks = () =>
	(navigator as Navigator & { locks?: { request<T>(name: string, callback: () => Promise<T>): Promise<T> } }).locks;
export const authVersion = () => storage.get(versionKey);
export function publishToken(token: string, broadcast = true) {
	const previous = tokenIdentity(getJwtToken());
	setJwtToken(token);
	if (token && token !== recentToken) {
		recentToken = token;
		recentTokenAt = Date.now();
	}
	memoryVersion = authVersion();
	if (broadcast) channel?.postMessage({ kind: 'token', token, version: authVersion() });
	if (previous !== tokenIdentity(token)) window.dispatchEvent(new Event('triplink:auth-change'));
}
export function clearAuthentication(broadcast = true) {
	if (broadcast) newAuthVersion('logout');
	setJwtToken('');
	recentToken = '';
	recentTokenAt = 0;
	memoryVersion = authVersion();
	storage.remove(pendingKey);
	if (broadcast) channel?.postMessage({ kind: 'logout', version: authVersion() });
	window.dispatchEvent(new Event('triplink:session-invalid'));
}
export function startAuthRuntime() {
	if (initialized || typeof window === 'undefined') return;
	initialized = true;
	// Remove credentials left by the old localStorage implementation. Existing users sign in once.
	storage.remove('accessToken');
	if (!authVersion()) storage.set(versionKey, 'initial:' + uuid());
	if (typeof BroadcastChannel !== 'undefined') {
		channel = new BroadcastChannel('triplink-auth');
		channel.onmessage = ({ data }) => {
			if (!data || data.version !== authVersion()) return;
			if (data.kind === 'request-token' && tokenFresh(getJwtToken()))
				channel?.postMessage({ kind: 'token', token: getJwtToken(), version: authVersion() });
			if (data.kind === 'token' && typeof data.token === 'string' && tokenFresh(data.token))
				publishToken(data.token, false);
			if (data.kind === 'logout') clearAuthentication(false);
		};
	}
	window.addEventListener('storage', (event) => {
		if (event.key === versionKey && event.newValue !== event.oldValue && memoryVersion !== event.newValue) {
			if (event.newValue?.startsWith('logout:')) clearAuthentication(false);
			else {
				setJwtToken('');
				if (channel) channel.postMessage({ kind: 'request-token', version: authVersion() });
				else window.dispatchEvent(new Event('triplink:auth-change'));
			}
		}
	});
}
function fallbackFetch(url: string, options: RequestInit, kind: string, version: string): Promise<Response> {
	if (typeof SharedWorker === 'undefined')
		return Promise.reject(
			new AuthRequestError(
				'BROWSER_UNSUPPORTED',
				'This browser cannot safely coordinate authentication across tabs. Use a current browser.',
			),
		);
	if (!worker) {
		worker = new SharedWorker('/triplink-auth-worker.js', { name: 'triplink-auth' });
		worker.port.start();
		worker.port.onmessage = async ({ data }) => {
			if (data.kind === 'prepare') {
				worker?.port.postMessage({
					kind: 'ready',
					id: data.id,
					version: authVersion(),
					active: workerRequests.has(data.id),
				});
				return;
			}
			const pending = workerRequests.get(data.id);
			if (!pending) {
				if (data.kind === 'login' || data.kind === 'logout')
					worker?.port.postMessage({ kind: 'commit', id: data.id, version: authVersion() });
				return;
			}
			workerRequests.delete(data.id);
			try {
				if (data.error) throw new AuthRequestError('NETWORK', data.error);
				const response = new Response(data.body, { status: data.status, headers: data.headers });
				await commitCredentialResponse(response, data.kind, data.expectedVersion ?? authVersion());
				pending.resolve(response);
			} catch (error) {
				pending.reject(error instanceof Error ? error : new Error('Authentication request failed'));
			} finally {
				if (data.kind === 'login' || data.kind === 'logout')
					worker?.port.postMessage({ kind: 'commit', id: data.id, version: authVersion() });
			}
		};

		worker.onerror = () => {
			workerRequests.forEach((p) =>
				p.reject(new AuthRequestError('NETWORK', 'Authentication coordinator unavailable. Please retry.')),
			);
			workerRequests.clear();
			worker = null;
		};
	}
	return new Promise((resolve, reject) => {
		const id = uuid();
		const timer = setTimeout(() => {
			workerRequests.delete(id);
			reject(new AuthRequestError('NETWORK', 'Authentication request timed out. Please retry.'));
		}, 20000);
		workerRequests.set(id, {
			resolve: (response) => {
				clearTimeout(timer);
				resolve(response);
			},
			reject: (error) => {
				clearTimeout(timer);
				reject(error);
			},
		});
		const { signal: _signal, ...serialized } = options;
		worker!.port.postMessage({
			id,
			url,
			options: { ...serialized, headers: Object.fromEntries(new Headers(options.headers).entries()) },
			kind,
			version,
		});
	});
}
export async function credentialFetch(
	url: string,
	options: RequestInit,
	kind: 'refresh' | 'login' | 'logout' | 'session' = 'session',
): Promise<Response> {
	startAuthRuntime();
	if (!authVersion())
		throw new AuthRequestError(
			'BROWSER_UNSUPPORTED',
			'This browser cannot safely coordinate authentication across tabs. Use a current browser.',
		);
	const version = authVersion();
	const request = {
		...options,
		credentials: 'include' as const,
		headers: { ...Object.fromEntries(new Headers(options.headers).entries()), 'X-TripLink-Auth': '1' },
	};
	const perform = async () => {
		if (kind !== 'login' && version !== authVersion())
			throw new AuthRequestError('STALE', 'Authentication changed while refreshing.');
		const expectedVersion = authVersion();
		const response = await fetch(url, request);
		await commitCredentialResponse(response, kind, expectedVersion);
		return response;
	};
	return typeof locks()?.request === 'function'
		? locks()!.request('triplink-auth-cookie', perform)
		: fallbackFetch(url, request, kind, version);
}
export async function authResponse(response: Response) {
	const result = await response.json();
	if (!response.ok) {
		const code = typeof result.authCode === 'string' ? result.authCode : String(response.status);
		throw new AuthRequestError(
			code,
			typeof result.message === 'string' ? result.message : 'Authentication request failed.',
			[
				'UNAUTHORIZED',
				'SESSION_REVOKED',
				'REFRESH_TOKEN_EXPIRED',
				'SESSION_ABSOLUTE_EXPIRATION',
				'REFRESH_TOKEN_REUSED',
				'ACCOUNT_UNAVAILABLE',
			].includes(code),
		);
	}
	return result;
}
export function refreshAccessToken(force = false): Promise<string> {
	startAuthRuntime();
	if (!authVersion())
		return Promise.reject(
			new AuthRequestError(
				'BROWSER_UNSUPPORTED',
				'This browser cannot safely coordinate authentication across tabs. Use a current browser.',
			),
		);
	// A late expiry frame can arrive after a peer published a newly issued token.
	// Coalesce that work with the recent successful renewal while it is still fresh.
	if (tokenFresh(getJwtToken()) && (!force || (getJwtToken() === recentToken && Date.now() - recentTokenAt < 25000)))
		return Promise.resolve(getJwtToken());
	if (flight) return flight;
	const previous = getJwtToken();
	const version = authVersion();
	flight = (async () => {
		// A newly opened tab can reuse a valid access token held only in a peer's memory.
		channel?.postMessage({ kind: 'request-token', version });
		if (channel && !previous) await new Promise((resolve) => setTimeout(resolve, 80));
		if (tokenFresh(getJwtToken()) && getJwtToken() !== previous) return getJwtToken();
		const rotate = async () => {
			// Broadcast delivery may lag behind lock handoff. Ask the prior owner
			// for its in-memory credential before starting another rotation.
			if (channel && getJwtToken() === previous) {
				channel.postMessage({ kind: 'request-token', version });
				await new Promise((resolve) => setTimeout(resolve, 80));
			}
			if (version !== authVersion()) throw new AuthRequestError('STALE', 'Authentication changed while refreshing.');
			if (getJwtToken() !== previous && tokenFresh(getJwtToken())) return getJwtToken();
			// Persist only the operation identifier, never a credential. Retries can recover a lost rotation response.
			let pending: { id: string; at: number; version: string } | null = null;
			try {
				pending = JSON.parse(storage.get(pendingKey) || 'null');
			} catch {
				/* Replace malformed coordination metadata. */
			}
			if (!pending || pending.version !== version || Date.now() - pending.at >= 25000)
				pending = { id: uuid(), at: Date.now(), version };
			storage.set(pendingKey, JSON.stringify(pending));
			const options = {
				method: 'POST',
				credentials: 'include' as const,
				headers: { 'X-TripLink-Auth': '1', 'X-Refresh-Request-Id': pending.id },
			};
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 15000);
			let response: Response;
			try {
				response =
					typeof locks()?.request === 'function'
						? await fetch(`${apiOrigin}/auth/refresh`, { ...options, signal: controller.signal })
						: await fallbackFetch(`${apiOrigin}/auth/refresh`, options, 'refresh', version);
			} finally {
				clearTimeout(timeout);
			}
			let result;
			try {
				result = await authResponse(response);
			} catch (error) {
				if (version === authVersion() && error instanceof AuthRequestError && error.definitive) clearAuthentication();
				throw error;
			}
			if (version !== authVersion()) throw new AuthRequestError('STALE', 'Authentication changed while refreshing.');
			if (typeof result.accessToken !== 'string' || !tokenFresh(result.accessToken))
				throw new AuthRequestError('INVALID_RESPONSE', 'Unable to restore your session. Please retry.');
			// Retain only coordination metadata for the bounded recovery window.
			publishToken(result.accessToken);
			return result.accessToken as string;
		};
		return typeof locks()?.request === 'function' ? locks()!.request('triplink-auth-cookie', rotate) : rotate();
	})()
		.catch((error) => {
			if (version === authVersion() && error instanceof AuthRequestError && error.definitive) clearAuthentication();
			throw error;
		})
		.finally(() => {
			flight = null;
		});
	return flight;
}
export async function ensureAccessToken() {
	return tokenFresh(getJwtToken()) ? getJwtToken() : refreshAccessToken();
}
export function newAuthVersion(kind: 'login' | 'logout' = 'login') {
	storage.set(versionKey, kind + ':' + uuid());
	storage.remove(pendingKey);
}
export async function sessionRequest(path: string, method = 'GET', body?: unknown) {
	const token = await ensureAccessToken();
	const kind =
		path === 'logout-all' || (method === 'DELETE' && path === `sessions/${tokenClaims(token).sid}`)
			? 'logout'
			: 'session';
	let response = await credentialFetch(
		`${apiOrigin}/auth/${path}`,
		{
			method,
			headers: {
				Authorization: `Bearer ${token}`,
				...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
			},
			...(body !== undefined ? { body: JSON.stringify(body) } : {}),
		},
		kind,
	);
	if (response.status === 401) {
		const detail = await response.clone().json();
		if (detail.authCode === 'ACCESS_TOKEN_EXPIRED') {
			if (tokenIdentity(getJwtToken()) !== tokenIdentity(token))
				throw new AuthRequestError('STALE', 'Authentication changed. Please retry.');
			const renewed =
				getJwtToken() !== token && tokenFresh(getJwtToken()) ? getJwtToken() : await refreshAccessToken(true);
			if (tokenIdentity(getJwtToken()) !== tokenIdentity(token))
				throw new AuthRequestError('STALE', 'Authentication changed. Please retry.');
			response = await credentialFetch(
				`${apiOrigin}/auth/${path}`,
				{
					method,
					headers: {
						Authorization: `Bearer ${renewed}`,
						...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
					},
					...(body !== undefined ? { body: JSON.stringify(body) } : {}),
				},
				kind,
			);
		}
	}
	if (tokenIdentity(token) !== tokenIdentity(getJwtToken()))
		throw new AuthRequestError('STALE', 'Authentication changed. Please retry.');
	try {
		return await authResponse(response);
	} catch (error) {
		if (tokenIdentity(token) === tokenIdentity(getJwtToken()) && error instanceof AuthRequestError && error.definitive)
			clearAuthentication();
		throw error;
	}
}
