const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const load = (file, mocks) => {
	const exports = {};
	new Function(
		'require',
		'exports',
		ts.transpileModule(fs.readFileSync(file, 'utf8'), {
			compilerOptions: { module: 1, jsx: 2, esModuleInterop: true },
		}).outputText,
	)((name) => (name in mocks ? mocks[name] : require(name)), exports);
	return exports;
};
const token = (sid = 'session', expires = 900) =>
	'x.' +
	Buffer.from(JSON.stringify({ sub: 'user', sid, exp: Math.floor(Date.now() / 1000) + expires })).toString(
		'base64url',
	) +
	'.x';
function environment({ broadcast = false, broadcastDelay = 0 } = {}) {
	const keys = ['window', 'navigator', 'localStorage', 'BroadcastChannel', 'SharedWorker', 'fetch', 'crypto'];
	const saved = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(global, key)]));
	const values = new Map([['accessToken', 'old-local-storage-token']]);
	const ports = new Set();
	let tail = Promise.resolve(),
		calls = [],
		response = async () => new Response(JSON.stringify({ accessToken: token() }), { status: 200 });
	const window = new EventTarget();
	let invalidations = 0;
	window.addEventListener('triplink:session-invalid', () => invalidations++);
	Object.defineProperties(global, {
		window: { configurable: true, value: window },
		navigator: {
			configurable: true,
			value: {
				locks: {
					request: (_name, callback) => {
						const result = tail.then(callback);
						tail = result.catch(() => {});
						return result;
					},
				},
			},
		},
		localStorage: {
			configurable: true,
			value: {
				getItem: (key) => values.get(key) ?? null,
				setItem: (key, value) => values.set(key, value),
				removeItem: (key) => values.delete(key),
			},
		},
		crypto: { configurable: true, value: { randomUUID } },
		BroadcastChannel: {
			configurable: true,
			value: broadcast
				? class {
						constructor() {
							ports.add(this);
						}
						postMessage(data) {
							for (const port of ports)
								if (port !== this) {
									if (broadcastDelay) setTimeout(() => port.onmessage?.({ data }), broadcastDelay);
									else queueMicrotask(() => port.onmessage?.({ data }));
								}
						}
				  }
				: undefined,
		},
		fetch: {
			configurable: true,
			value: async (url, options) => {
				calls.push({ url, options });
				return response(url, options);
			},
		},
	});
	const create = (initial = '') => {
		let memory = initial;
		const helpers = {
			getJwtToken: () => memory,
			setJwtToken: (value) => {
				memory = value;
			},
			tokenFresh: (value) => {
				try {
					return JSON.parse(Buffer.from(value.split('.')[1], 'base64url')).exp * 1000 > Date.now() + 30000;
				} catch {
					return false;
				}
			},
			tokenIdentity: (value) => {
				try {
					const claims = JSON.parse(Buffer.from(value.split('.')[1], 'base64url'));
					return claims.sub + ':' + claims.sid;
				} catch {
					return value;
				}
			},
		};
		return {
			runtime: load('libs/auth/runtime.ts', { './token': helpers }),
			helpers,
			get token() {
				return memory;
			},
		};
	};
	return {
		create,
		calls,
		values,
		setResponse: (value) => {
			response = value;
		},
		get invalidations() {
			return invalidations;
		},
		cleanup() {
			for (const [key, descriptor] of Object.entries(saved)) {
				if (descriptor) Object.defineProperty(global, key, descriptor);
				else delete global[key];
			}
		},
	};
}
test('on-demand refresh is single-flight, memory-only and sends credentials plus a stable operation ID', async () => {
	const ctx = environment();
	try {
		const tab = ctx.create(token('session', -1));
		const requests = Array.from({ length: 5 }, () => tab.runtime.refreshAccessToken());
		assert.ok(requests.every((request) => request === requests[0]));
		const results = await Promise.all(requests);
		assert.equal(ctx.calls.length, 1);
		assert.ok(results.every((result) => result === tab.token));
		assert.equal(ctx.calls[0].options.credentials, 'include');
		assert.equal(ctx.calls[0].options.headers['X-TripLink-Auth'], '1');
		assert.match(ctx.calls[0].options.headers['X-Refresh-Request-Id'], /^[a-f0-9-]{36}$/);
		assert.equal(ctx.values.has('accessToken'), false);
		assert.ok(![...ctx.values.values()].includes(tab.token));
		await tab.runtime.ensureAccessToken();
		await new Promise((resolve) => setTimeout(resolve, 20));
		assert.equal(ctx.calls.length, 1);
	} finally {
		ctx.cleanup();
	}
});
test('temporary network failure retains authentication and retries the same rotation operation', async () => {
	const ctx = environment();
	try {
		const old = token('session', -1),
			tab = ctx.create(old);
		ctx.setResponse(async () => {
			throw new Error('offline');
		});
		await assert.rejects(tab.runtime.refreshAccessToken(), /offline/);
		assert.equal(tab.token, old);
		assert.equal(ctx.invalidations, 0);
		const id = ctx.calls[0].options.headers['X-Refresh-Request-Id'];
		ctx.setResponse(async () => new Response(JSON.stringify({ accessToken: token() }), { status: 200 }));
		await tab.runtime.refreshAccessToken();
		assert.equal(ctx.calls[1].options.headers['X-Refresh-Request-Id'], id);
	} finally {
		ctx.cleanup();
	}
});
test('definitive session failure clears state while rate limits and server failures preserve it', async () => {
	const ctx = environment();
	try {
		for (const status of [429, 503]) {
			const tab = ctx.create(token('session', -1));
			ctx.setResponse(async () => new Response(JSON.stringify({ message: 'retry' }), { status }));
			await assert.rejects(tab.runtime.refreshAccessToken());
			assert.ok(tab.token);
			assert.equal(ctx.invalidations, 0);
		}
		const tab = ctx.create(token('session', -1));
		ctx.setResponse(
			async () => new Response(JSON.stringify({ message: 'sign in', authCode: 'SESSION_REVOKED' }), { status: 401 }),
		);
		await assert.rejects(tab.runtime.refreshAccessToken());
		assert.equal(tab.token, '');
		assert.equal(ctx.invalidations, 1);
	} finally {
		ctx.cleanup();
	}
});
test('two tabs share one rotation and logout synchronization never stores credentials', async () => {
	const ctx = environment({ broadcast: true, broadcastDelay: 20 });
	try {
		const expired = token('session', -1);
		const a = ctx.create(expired),
			b = ctx.create(expired);
		a.runtime.startAuthRuntime();
		b.runtime.startAuthRuntime();
		await Promise.all([a.runtime.refreshAccessToken(), b.runtime.refreshAccessToken()]);
		assert.equal(ctx.calls.length, 1);
		assert.equal(a.token, b.token);
		await Promise.all([a.runtime.refreshAccessToken(true), b.runtime.refreshAccessToken(true)]);
		assert.equal(ctx.calls.length, 1, 'late expiry responses reuse the newly published fresh token');
		a.runtime.newAuthVersion('logout');
		a.runtime.clearAuthentication();
		await new Promise((resolve) => setTimeout(resolve, 50));
		assert.equal(a.token, '');
		assert.equal(b.token, '');
		assert.equal(ctx.calls.length, 1);
	} finally {
		ctx.cleanup();
	}
});
test('logout/account changes discard an in-flight refresh response', async () => {
	const ctx = environment();
	try {
		let finish;
		ctx.setResponse(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		);
		const tab = ctx.create(token('session', -1));
		const pending = tab.runtime.refreshAccessToken();
		await new Promise((resolve) => setImmediate(resolve));
		tab.runtime.newAuthVersion('logout');
		tab.runtime.clearAuthentication();
		finish(new Response(JSON.stringify({ accessToken: token() }), { status: 200 }));
		await assert.rejects(pending, (error) => error.code === 'STALE');
		assert.equal(tab.token, '');
	} finally {
		ctx.cleanup();
	}
});
test('SharedWorker fallback serializes refresh and survives a closed requesting tab', async () => {
	let calls = 0;
	const worker = {
		fetch: async () => {
			calls++;
			await new Promise((resolve) => setTimeout(resolve, 5));
			return new Response(JSON.stringify({ accessToken: token() }), { status: 200 });
		},
		AbortController,
		setTimeout,
		clearTimeout,
		atob,
		onconnect: null,
	};
	vm.runInNewContext(fs.readFileSync('public/triplink-auth-worker.js', 'utf8'), worker);
	const port = () => {
		const pending = new Map();
		const port = {
			start() {},
			postMessage(data) {
				if (data.kind === 'prepare') {
					port.onmessage({ data: { kind: 'ready', id: data.id, active: true, version: 'version' } });
					return;
				}
				pending.get(data.id)?.(data);
			},
		};
		worker.onconnect({ ports: [port] });
		return {
			request(id) {
				return new Promise((resolve) => {
					pending.set(id, resolve);
					port.onmessage({
						data: {
							id,
							url: 'http://localhost:3007/auth/refresh',
							options: { method: 'POST' },
							kind: 'refresh',
							version: 'version',
						},
					});
				});
			},
			port,
		};
	};
	const a = port(),
		b = port();
	a.port.onmessage({
		data: {
			id: 'closed-tab',
			url: 'http://localhost:3007/auth/refresh',
			options: { method: 'POST' },
			kind: 'refresh',
			version: 'version',
		},
	});
	const response = await b.request('tab-b');
	assert.equal(response.status, 200);
	assert.ok(JSON.parse(response.body).accessToken);
	assert.equal(calls, 1);
});
test('browsers without Web Locks or SharedWorker fail safely instead of racing rotations', async () => {
	const ctx = environment();
	try {
		Object.defineProperty(global, 'navigator', { configurable: true, value: {} });
		Object.defineProperty(global, 'SharedWorker', { configurable: true, value: undefined });
		const tab = ctx.create();
		await assert.rejects(tab.runtime.refreshAccessToken(), (error) => error.code === 'BROWSER_UNSUPPORTED');
		assert.equal(ctx.calls.length, 0);
	} finally {
		ctx.cleanup();
	}
});
test('Apollo retries an expired operation once and preserves variables and headers', async () => {
	const ctx = environment();
	try {
		const apollo = require('@apollo/client');
		let memory = token('session', -1),
			refreshes = 0;
		ctx.setResponse(async (_url, options) => {
			const body = JSON.parse(options.body);
			assert.deepEqual(body.variables, { id: 'tour' });
			assert.equal(options.headers['x-custom'], 'preserved');
			return new Response(
				JSON.stringify(
					ctx.calls.length === 1
						? {
								data: null,
								errors: [
									{ message: 'expired', extensions: { code: 'UNAUTHENTICATED', authCode: 'ACCESS_TOKEN_EXPIRED' } },
								],
						  }
						: { data: { value: 'ok' } },
				),
				{ status: 200, headers: { 'Content-Type': 'application/json' } },
			);
		});
		const clientModule = load('apollo/client.ts', {
			react: { useMemo: (callback) => callback() },
			'../libs/auth/token': {
				getJwtToken: () => memory,
				tokenFresh: () => true,
				tokenIdentity: (value) => JSON.parse(Buffer.from(value.split('.')[1], 'base64url')).sid,
			},
			'../libs/auth/runtime': {
				ensureAccessToken: async () => memory,
				refreshAccessToken: async () => {
					refreshes++;
					memory = token();
					return memory;
				},
				clearAuthentication() {},
				credentialFetch: fetch,
			},
		});
		const client = clientModule.initializeApollo();
		const result = await client.query({
			query: apollo.gql`query Protected($id: String!) { value(id: $id) }`,
			variables: { id: 'tour' },
			context: { headers: { 'x-custom': 'preserved' } },
			fetchPolicy: 'no-cache',
		});
		assert.equal(result.data.value, 'ok');
		assert.equal(ctx.calls.length, 2);
		assert.equal(refreshes, 1);
		client.stop();
	} finally {
		ctx.cleanup();
	}
});
test('Apollo never refreshes permission errors and never retries expiry twice', async () => {
	const ctx = environment();
	try {
		const apollo = require('@apollo/client');
		let refreshes = 0,
			cleared = 0;
		for (const code of ['FORBIDDEN', 'CREDENTIAL_FORM_ERROR', 'ACCESS_TOKEN_EXPIRED']) {
			ctx.calls.length = 0;
			ctx.setResponse(
				async () =>
					new Response(
						JSON.stringify({
							data: null,
							errors: [
								{
									message: 'denied',
									extensions: {
										code: code === 'FORBIDDEN' ? code : 'UNAUTHENTICATED',
										authCode: code === 'CREDENTIAL_FORM_ERROR' ? undefined : code,
									},
								},
							],
						}),
						{ status: 200, headers: { 'Content-Type': 'application/json' } },
					),
			);
			const module = load('apollo/client.ts', {
				react: { useMemo: (callback) => callback() },
				'../libs/auth/token': {
					getJwtToken: () => token(),
					tokenFresh: () => true,
					tokenIdentity: (value) => JSON.parse(Buffer.from(value.split('.')[1], 'base64url')).sid,
				},
				'../libs/auth/runtime': {
					ensureAccessToken: async () => token(),
					refreshAccessToken: async () => {
						refreshes++;
						return token();
					},
					clearAuthentication() {
						cleared++;
					},
					credentialFetch: fetch,
				},
			});
			const client = module.initializeApollo();
			await assert.rejects(client.query({ query: apollo.gql`query Protected { value }`, fetchPolicy: 'no-cache' }));
			assert.equal(ctx.calls.length, code === 'ACCESS_TOKEN_EXPIRED' ? 2 : 1);
			client.stop();
		}
		assert.equal(refreshes, 1);
		assert.equal(cleared, 0);
	} finally {
		ctx.cleanup();
	}
});

test('cookie-changing login requests publish account state before releasing the cross-tab lock', async () => {
	const ctx = environment({ broadcast: true });
	try {
		const a = ctx.create(),
			b = ctx.create();
		a.runtime.startAuthRuntime();
		b.runtime.startAuthRuntime();
		let issued = 0;
		ctx.setResponse(
			async () =>
				new Response(
					JSON.stringify({ data: { result: { accessToken: token('login-' + ++issued), member: { _id: 'user' } } } }),
					{ status: 200 },
				),
		);
		for (const tab of [a, b])
			tab.runtime.setAuthPayloadHandler(async (payload) => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				tab.runtime.newAuthVersion();
				tab.runtime.publishToken(payload.accessToken);
			});
		const first = a.runtime.credentialFetch('http://localhost:3007/graphql', { method: 'POST' }, 'login');
		const second = b.runtime.credentialFetch('http://localhost:3007/graphql', { method: 'POST' }, 'login');
		const staleLogout = a.runtime.credentialFetch('http://localhost:3007/auth/logout', { method: 'POST' }, 'logout');
		const rejected = assert.rejects(staleLogout, /Authentication changed/);
		await Promise.all([first, second, rejected]);
		await new Promise((resolve) => setImmediate(resolve));
		assert.equal(ctx.calls.length, 2);
		assert.equal(a.token, b.token);
		assert.equal(JSON.parse(Buffer.from(a.token.split('.')[1], 'base64url')).sid, 'login-2');
	} finally {
		ctx.cleanup();
	}
});

test('an expired operation is never replayed under a newly signed-in session', async () => {
	const ctx = environment();
	try {
		const apollo = require('@apollo/client');
		let memory = token('old-session'),
			refreshes = 0;
		ctx.setResponse(async () => {
			memory = token('new-session');
			return new Response(
				JSON.stringify({
					data: null,
					errors: [{ message: 'expired', extensions: { code: 'UNAUTHENTICATED', authCode: 'ACCESS_TOKEN_EXPIRED' } }],
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } },
			);
		});
		const module = load('apollo/client.ts', {
			react: { useMemo: (callback) => callback() },
			'../libs/auth/token': {
				getJwtToken: () => memory,
				tokenFresh: () => true,
				tokenIdentity: (value) => JSON.parse(Buffer.from(value.split('.')[1], 'base64url')).sid,
			},
			'../libs/auth/runtime': {
				ensureAccessToken: async () => memory,
				refreshAccessToken: async () => {
					refreshes++;
					return memory;
				},
				clearAuthentication() {
					throw Error('must retain new session');
				},
				credentialFetch: fetch,
			},
		});
		const client = module.initializeApollo();
		await assert.rejects(
			client.query({ query: apollo.gql`query Protected { value }`, fetchPolicy: 'no-cache' }),
			/Authentication changed/,
		);
		assert.equal(ctx.calls.length, 1);
		assert.equal(refreshes, 0);
		client.stop();
	} finally {
		ctx.cleanup();
	}
});
