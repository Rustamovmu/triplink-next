const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { JSDOM } = require('jsdom');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');
const load = (file, mocks) => {
	const exported = {};
	new Function(
		'require',
		'exports',
		ts.transpileModule(fs.readFileSync(file, 'utf8'), {
			compilerOptions: { module: 1, jsx: 2, esModuleInterop: true },
		}).outputText,
	)((name) => (name in mocks ? mocks[name] : require(name)), exported);
	return exported;
};
const { safeReturnUrl } = load('libs/auth/returnUrl.ts', {});
const policy = load('libs/auth/security.ts', { './runtime': {}, './returnUrl': { safeReturnUrl } });
const t = (key, values = {}) => key.replace(/{{(\w+)}}/g, (_, name) => values[name] ?? '');
async function environment(work) {
	const keys = ['window', 'document', 'FormData', 'IS_REACT_ACT_ENVIRONMENT'];
	const saved = Object.fromEntries(keys.map((k) => [k, Object.getOwnPropertyDescriptor(global, k)]));
	const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/account/join' });
	global.window = dom.window;
	global.document = dom.window.document;
	global.FormData = dom.window.FormData;
	global.IS_REACT_ACT_ENVIRONMENT = true;
	const root = createRoot(document.getElementById('root'));
	const box = ({ children, component = 'div', onSubmit, className }) =>
		React.createElement(component, { onSubmit, className }, children);
	const mui = {
		Stack: box,
		InputAdornment: box,
		Alert: ({ children, action }) => React.createElement('div', { role: 'alert' }, children, action),
		CircularProgress: () => React.createElement('span', { role: 'status' }, 'Loading'),
		Button: ({ children, onClick, disabled, type, ...rest }) =>
			React.createElement('button', { onClick, disabled, type, 'aria-label': rest['aria-label'] }, children),
		IconButton: ({ children, onClick, ...rest }) =>
			React.createElement('button', { onClick, type: 'button', 'aria-label': rest['aria-label'] }, children),
		TextField: ({ id, name, label, type, required, defaultValue, inputProps, autoComplete }) =>
			React.createElement(
				'label',
				null,
				label,
				React.createElement('input', { id, name, type, required, defaultValue, autoComplete, ...inputProps }),
			),
	};
	const shared = {
		react: React,
		'next-i18next': { useTranslation: () => ({ t, i18n: { language: 'en' } }) },
		'@mui/material': mui,
	};
	const useAction = () => {
		const [busy, setBusy] = React.useState(false),
			[error, setError] = React.useState('');
		const lock = React.useRef(false);
		return {
			busy,
			feedback: error ? React.createElement('div', { role: 'alert' }, error) : null,
			run: async (work) => {
				if (lock.current) return;
				lock.current = true;
				setBusy(true);
				setError('');
				try {
					await work();
				} catch (e) {
					setError(e.message);
				} finally {
					setBusy(false);
					lock.current = false;
				}
			},
		};
	};
	const render = (Component, props = {}) => act(async () => root.render(React.createElement(Component, props)));
	const click = (text) =>
		act(async () => {
			const button = [...document.querySelectorAll('button')].find((b) => b.textContent === text);
			assert.ok(button, text);
			button.click();
		});
	const submit = () =>
		act(async () =>
			document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })),
		);
	try {
		await work({ shared, mui, render, click, submit, action: useAction });
	} finally {
		await act(async () => root.unmount());
		dom.window.close();
		for (const [k, d] of Object.entries(saved)) {
			if (d) Object.defineProperty(global, k, d);
			else delete global[k];
		}
	}
}
test('protected login links preserve a safe destination while retaining role restrictions', async () =>
	environment(async ({ shared, render }) => {
		let asPath = '/mypage?category=security',
			member = null;
		const { Access } = load('libs/components/triplink/Session.tsx', {
			...shared,
			'../../auth': { safeReturnUrl },
			'next/router': { useRouter: () => ({ asPath }) },
			'../../../apollo/store': { sessionVar: 'session', memberVar: 'member', sessionErrorVar: 'error' },
			'@apollo/client': {
				useReactiveVar: (key) =>
					key === 'session' ? (member ? 'authenticated' : 'anonymous') : key === 'member' ? member : '',
			},
			'next/link': {
				__esModule: true,
				default: ({ href, children }) =>
					React.createElement(
						'a',
						{
							href: typeof href === 'string' ? href : href.pathname + '?' + new URLSearchParams(href.query),
						},
						children,
					),
			},
		});
		const props = { roles: ['AGENT'], children: 'Protected agent data' };
		await render(Access, props);
		const link = new URL(document.querySelector('a').href);
		assert.equal(link.pathname, '/account/join');
		assert.equal(link.searchParams.get('referrer'), '/mypage?category=security');
		assert.equal(document.body.textContent.includes('Protected agent data'), false);
		asPath = '//untrusted.example';
		await render(Access, props);
		assert.equal(new URL(document.querySelector('a').href).searchParams.get('referrer'), '/');
		member = { memberType: 'USER' };
		await render(Access, props);
		assert.match(document.body.textContent, /You do not have access/);
		member = { memberType: 'AGENT' };
		await render(Access, props);
		assert.equal(document.body.textContent, 'Protected agent data');
	}));
test('signup requires confirmation, optional email and no phone or elevated role; login preserves return path', async () =>
	environment(async ({ shared, render, click, submit, action }) => {
		const requests = [],
			redirects = [];
		const icon = () => React.createElement('svg');
		const { default: Join } = load('libs/components/triplink/Join.tsx', {
			...shared,
			'next/image': { __esModule: true, default: () => null },
			'next/link': { __esModule: true, default: ({ href, children }) => React.createElement('a', { href }, children) },
			'next/router': {
				useRouter: () => ({
					query: { referrer: '/tour/detail?id=fixture' },
					push: async (path) => redirects.push(path),
				}),
			},
			'@apollo/client': { useReactiveVar: () => null },
			'../../../apollo/store': {},
			'../../auth': {
				safeReturnUrl,
				logIn: async (...args) => requests.push(['login', ...args]),
				signUp: async (...args) => requests.push(['signup', ...args]),
			},
			'./Common': { useAction: action },
			'./ProviderButtons': { ProviderButtons: () => null },
			'../../auth/security': policy,
			'@mui/icons-material': {
				VisibilityOutlined: icon,
				VisibilityOffOutlined: icon,
				LandscapeOutlined: icon,
				LockOutlined: icon,
			},
		});
		await render(Join);
		await click('Register');
		assert.equal(document.querySelector('[name="phone"]'), null);
		assert.equal(document.querySelector('[name="role"]'), null);
		assert.equal(document.querySelector('[name="email"]').required, false);
		document.querySelector('[name="nick"]').value = 'Traveler';
		document.querySelector('[name="password"]').value = 'A travel passphrase!';
		document.querySelector('[name="confirmPassword"]').value = 'does not match';
		await submit();
		assert.equal(requests.length, 0);
		assert.match(document.body.textContent, /Passwords do not match/);
		document.querySelector('[name="confirmPassword"]').value = 'A travel passphrase!';
		await submit();
		assert.deepEqual(requests[0], ['signup', 'Traveler', 'A travel passphrase!', '', '']);
		assert.equal(redirects[0], '/tour/detail?id=fixture');
		await click('Login');
		document.querySelector('[name="nick"]').value = 'Legacy Name';
		document.querySelector('[name="password"]').value = 'legacy-pass';
		await submit();
		assert.deepEqual(requests[1], ['login', 'Legacy Name', 'legacy-pass']);
		assert.ok(document.querySelector('a[href="/account/recovery"]'));
	}));
for (const provider of ['GOOGLE', 'KAKAO'])
	test(`only enabled ${provider} buttons render and repeated clicks cannot start two authorizations`, async () =>
		environment(async ({ shared, render }) => {
			let calls = 0,
				reject;
			const icon = () => React.createElement('svg');
			const { ProviderButtons } = load('libs/components/triplink/ProviderButtons.tsx', {
				...shared,
				'react-icons/fc': { FcGoogle: icon },
				'react-icons/fa': { FaTelegramPlane: icon },
				'react-icons/si': { SiKakaotalk: icon },
				'../../auth/security': {
					availableProviders: async () => [provider],
					startProvider: () => {
						calls++;
						return new Promise((_, no) => {
							reject = no;
						});
					},
				},
			});
			await render(ProviderButtons, { returnTo: '/tour' });
			const buttons = [...document.querySelectorAll('button')];
			assert.equal(buttons.length, 1);
			assert.equal(buttons[0].textContent, `Continue with ${provider === 'GOOGLE' ? 'Google' : 'Kakao'}`);
			await act(async () => {
				buttons[0].click();
				buttons[0].click();
			});
			assert.equal(calls, 1);
			assert.equal(buttons[0].disabled, true);
			await act(async () => reject(new Error('provider offline')));
			assert.equal(buttons[0].disabled, false);
			assert.match(document.body.textContent, /Unable to start provider/);
		}));
test('security controls prevent final-provider unlinking, display recovery codes once and clear them on account changes', async () =>
	environment(async ({ shared, render, click }) => {
		let member = { _id: 'one' },
			status = {
				username: 'fixture',
				hasPassword: false,
				recoveryEmail: '',
				emailVerified: false,
				recoveryCodesRemaining: 0,
				emailDeliveryAvailable: false,
				identities: [{ provider: 'TELEGRAM' }],
				events: [],
			};
		const requests = [];
		class AuthRequestError extends Error {}
		const { SecuritySettings } = load('libs/components/triplink/SecuritySettings.tsx', {
			...shared,
			'@apollo/client': { useReactiveVar: () => member, useMutation: () => [async () => {}] },
			'../../../apollo/store': {},
			'../../../apollo/user/triplink': {},
			'../../auth': {},
			'../../auth/runtime': {
				AuthRequestError,
				sessionRequest: async (path, method, body) => {
					requests.push({ path, method, body });
					return path === 'security'
						? status
						: path === 'recovery-codes/generate'
						? { codes: ['fixture-once-only-code-12'] }
						: {};
				},
			},
			'../../auth/security': {
				availableProviders: async () => ['TELEGRAM', 'GOOGLE'],
				startProvider: async () => {},
				validNewPassword: policy.validNewPassword,
			},
			'./ActiveSessions': { ActiveSessions: () => null },
			'./ProviderButtons': { ProviderIcon: () => null },
		});
		await render(SecuritySettings);
		assert.equal(
			[...document.querySelectorAll('button')].find((b) => b.textContent === 'Disconnect Telegram').disabled,
			true,
		);
		assert.match(document.body.textContent, /Email delivery is not configured/);
		await click('Generate new recovery codes');
		assert.match(document.body.textContent, /fixture-once-only-code/);
		await click('I saved my codes');
		assert.doesNotMatch(document.body.textContent, /fixture-once-only-code/);
		await click('Generate new recovery codes');
		member = { _id: 'two' };
		await render(SecuritySettings);
		assert.doesNotMatch(document.body.textContent, /fixture-once-only-code/);
		assert.equal(requests.filter((r) => r.path === 'recovery-codes/generate').length, 2);
	}));
for (const operation of [
	'revoke others',
	'change password',
	'add password',
	'disconnect provider',
	'rejected revocation',
]) {
	test(`security session list updates after ${operation} without manual refresh`, async () =>
		environment(async ({ shared, mui, render, click }) => {
			const stamp = '2026-10-13T00:00:00.000Z';
			let sessions = ['Current browser', 'Other browser'].map((deviceName, index) => ({
				id: String(index),
				deviceName,
				userAgent: 'Chrome/123',
				lastUsedAt: stamp,
				createdAt: stamp,
				isCurrentSession: index === 0,
			}));
			let loads = 0;
			const status = {
				username: 'fixture',
				hasPassword: operation !== 'add password',
				recoveryEmail: '',
				emailVerified: false,
				recoveryCodesRemaining: 0,
				emailDeliveryAvailable: false,
				identities: [{ provider: 'TELEGRAM' }],
				events: [],
			};
			const revoke = () => {
				sessions = sessions.slice(0, 1);
			};
			const sessionRequest = async (path) => {
				if (path === 'security') return status;
				if (path === 'sessions') {
					loads++;
					return sessions;
				}
				if (operation === 'rejected revocation') throw new Error('Confirm your identity again.');
				revoke();
				return {};
			};
			const apollo = {
				useReactiveVar: () => ({ _id: 'synthetic-member' }),
				useMutation: () => [
					async () => {
						revoke();
						return { data: { result: { accessToken: 'synthetic' } } };
					},
				],
			};
			const box = ({ children }) => React.createElement('div', null, children);
			const { ActiveSessions } = load('libs/components/triplink/ActiveSessions.tsx', {
				...shared,
				'@mui/material': {
					...mui,
					Dialog: ({ open, children }) => (open ? box({ children }) : null),
					DialogActions: box,
					DialogContent: box,
					DialogContentText: box,
					DialogTitle: box,
				},
				'@apollo/client': apollo,
				'../../../apollo/store': {},
				'../../auth/runtime': { sessionRequest },
			});
			class AuthRequestError extends Error {}
			const { SecuritySettings } = load('libs/components/triplink/SecuritySettings.tsx', {
				...shared,
				'@apollo/client': apollo,
				'../../../apollo/store': {},
				'../../../apollo/user/triplink': {},
				'../../auth': { acceptAuth: async () => {} },
				'../../auth/runtime': { sessionRequest, AuthRequestError },
				'../../auth/security': { availableProviders: async () => [], validNewPassword: policy.validNewPassword },
				'./ActiveSessions': { ActiveSessions },
				'./ProviderButtons': { ProviderIcon: () => null },
			});
			await render(SecuritySettings);
			assert.match(document.body.textContent, /Other browser/);
			assert.equal(loads, 1);
			if (operation.includes('password')) {
				document.querySelector('[name="newPassword"]').value = 'A synthetic long passphrase';
				document.querySelector('[name="confirmPassword"]').value = 'A synthetic long passphrase';
				const form = document.querySelector('[name="newPassword"]').closest('form');
				await act(async () => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
			} else if (operation === 'disconnect provider') {
				await click('Disconnect Telegram');
				await click('Confirm disconnect');
			} else await click('Log out all other devices');
			assert.match(document.body.textContent, /Current browser/);
			if (operation === 'rejected revocation') {
				assert.match(document.body.textContent, /Other browser/);
				assert.match(document.body.textContent, /Confirm your identity again/);
				assert.equal(loads, 1);
			} else {
				assert.doesNotMatch(document.body.textContent, /Other browser/);
				assert.equal(loads, 2);
			}
		}));
}
test('reauthentication-required responses preserve the current session rather than signing the member out', async () => {
	const runtime = load('libs/auth/runtime.ts', { './token': {} });
	try {
		await runtime.authResponse(
			new Response(JSON.stringify({ message: 'Confirm identity', authCode: 'REAUTHENTICATION_REQUIRED' }), {
				status: 403,
			}),
		);
		assert.fail('Expected rejection');
	} catch (error) {
		assert.equal(error.code, 'REAUTHENTICATION_REQUIRED');
		assert.equal(error.definitive, false);
	}
});
test('safe return paths preserve encoded query text and reject external, encoded or callback destinations', () => {
	for (const value of [
		'//evil.test',
		'/%2fevil.test',
		'/%5cevil.test',
		'/%0aevil.test',
		'/account/complete',
		'/auth/oauth/google/callback',
	])
		assert.equal(safeReturnUrl(value), '/');
	assert.equal(safeReturnUrl('/tour?search=Seoul%20City'), '/tour?search=Seoul%20City');
});
