const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createRequire } = require('node:module');

test('anonymous reads wait for cache clearing and stale cleanup cannot override a newer sign-in', async () => {
	const savedWindow = global.window;
	global.window = {};
	const modules = new Map();
	const load = (filename) => {
		if (modules.has(filename)) return modules.get(filename);
		const exported = {};
		modules.set(filename, exported);
		const localRequire = createRequire(filename);
		new Function(
			'require',
			'exports',
			ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
				compilerOptions: { module: 1, esModuleInterop: true },
			}).outputText,
		)((name) => {
			if (filename.endsWith('/libs/auth/index.ts') && name === '../../apollo/client')
				return { initializeApollo: () => client };
			if (filename.endsWith('/libs/auth/index.ts') && name === './runtime') return runtime;
			if (name.startsWith('.')) {
				const target = path.resolve(path.dirname(filename), name);
				if (fs.existsSync(target + '.ts')) return load(target + '.ts');
			}
			return localRequire(name);
		}, exported);
		return exported;
	};
	const clearances = [];
	const client = { clearStore: () => new Promise((resolve, reject) => clearances.push({ resolve, reject })) };
	const runtime = {
		setAuthPayloadHandler() {},
		startAuthRuntime() {},
		authVersion: () => 'fixture-version',
		newAuthVersion() {},
		publishToken: (token) => tokens.setJwtToken(token),
		tokenIdentity: (token) => token,
	};
	const root = path.resolve(__dirname, '..');
	const tokens = load(root + '/libs/auth/token.ts');
	const { memberVar, sessionVar } = load(root + '/apollo/store.ts');
	const { clearLocalSession, acceptAuth } = load(root + '/libs/auth/index.ts');
	try {
		tokens.setJwtToken('old-token');
		memberVar({ _id: 'old-account' });
		clearLocalSession();
		clearLocalSession();
		assert.equal(tokens.getJwtToken(), '');
		assert.equal(memberVar(), null);
		assert.equal(sessionVar(), 'loading');
		clearances[0].resolve();
		await Promise.resolve();
		assert.equal(sessionVar(), 'loading');
		clearances[1].resolve();
		await Promise.resolve();
		assert.equal(sessionVar(), 'anonymous');
		clearLocalSession();
		const signIn = acceptAuth({ accessToken: 'new-token', member: { _id: 'new-account', memberType: 'USER' } });
		clearances[3].resolve();
		await signIn;
		assert.equal(sessionVar(), 'authenticated');
		clearances[2].resolve();
		await Promise.resolve();
		assert.equal(sessionVar(), 'authenticated');
		assert.equal(memberVar()._id, 'new-account');
		clearLocalSession();
		clearances[4].reject(Error('cache cleanup failed'));
		await Promise.resolve();
		assert.equal(sessionVar(), 'error');
	} finally {
		global.window = savedWindow;
	}
});
