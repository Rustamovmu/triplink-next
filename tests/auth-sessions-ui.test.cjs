const test = require('node:test'),
	assert = require('node:assert/strict'),
	fs = require('node:fs'),
	ts = require('typescript'),
	React = require('react');
const { JSDOM } = require('jsdom'),
	{ createRoot } = require('react-dom/client'),
	{ act } = require('react-dom/test-utils');
test('session controls list safe device information, confirm revocation, lock requests and retain visible failure recovery', async () => {
	const dom = new JSDOM('<div id="root"></div>'),
		keys = ['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'],
		saved = Object.fromEntries(keys.map((k) => [k, Object.getOwnPropertyDescriptor(global, k)]));
	global.window = dom.window;
	global.document = dom.window.document;
	global.IS_REACT_ACT_ENVIRONMENT = true;
	let list = [
			{
				id: 'one',
				deviceName: 'Mac',
				userAgent: 'Mozilla/5.0 Chrome/150 Safari/537',
				lastUsedAt: '2026-10-13T00:00:00Z',
				isCurrentSession: true,
			},
			{
				id: 'two',
				deviceName: 'iPhone',
				userAgent: 'Mozilla/5.0 Safari/604',
				lastUsedAt: '2026-10-12T00:00:00Z',
				isCurrentSession: false,
			},
		],
		calls = [],
		fail = false,
		loadFails = true,
		pending,
		cleared = 0;
	const box = ({ children }) => React.createElement('div', null, children);
	const mocks = {
		react: React,
		'next-i18next': {
			useTranslation: () => ({ t: (s, v = {}) => s.replace(/{{(\w+)}}/g, (_, k) => v[k]), i18n: { language: 'en' } }),
		},
		'@apollo/client': { useReactiveVar: () => ({ _id: 'user' }) },
		'../../../apollo/store': {},
		'../../auth': { clearLocalSession: () => cleared++ },
		'../../auth/runtime': {
			newAuthVersion() {},
			clearAuthentication: () => cleared++,
			sessionRequest: async (path, method) => {
				calls.push({ path, method });
				if (path === 'sessions') {
					if (loadFails) throw Error('offline');
					return list;
				}
				if (fail) throw Error('offline');
				return new Promise((resolve) => {
					pending = () => {
						if (path === 'logout-all') cleared += 2;
						list = list.filter((s) => path !== `sessions/${s.id}`);
						resolve({ success: true });
					};
				});
			},
		},
		'@mui/material': {
			Alert: ({ children }) => React.createElement('div', { role: 'alert' }, children),
			Button: ({ children, onClick, disabled, ...p }) =>
				React.createElement('button', { onClick, disabled, 'aria-label': p['aria-label'] }, children),
			CircularProgress: () => React.createElement('div', null, 'Loading'),
			Dialog: ({ children, open }) => (open ? React.createElement('div', { role: 'dialog' }, children) : null),
			DialogTitle: box,
			DialogContent: box,
			DialogContentText: box,
			DialogActions: box,
		},
	};
	const exports = {};
	new Function(
		'require',
		'exports',
		ts.transpileModule(fs.readFileSync('libs/components/triplink/ActiveSessions.tsx', 'utf8'), {
			compilerOptions: { module: 1, jsx: 2, esModuleInterop: true },
		}).outputText,
	)((n) => {
		if (!(n in mocks)) throw Error(n);
		return mocks[n];
	}, exports);
	const root = createRoot(document.getElementById('root')),
		click = (label, scope = document) =>
			act(async () =>
				[...scope.querySelectorAll('button')]
					.find((b) => b.textContent === label || b.getAttribute('aria-label') === label)
					.click(),
			);
	try {
		await act(async () => root.render(React.createElement(exports.ActiveSessions)));
		assert.match(document.querySelector('[role=alert]').textContent, /Unable to load/);
		assert.ok(!document.body.textContent.includes('No active sessions.'));
		loadFails = false;
		await click('Refresh');
		assert.equal(document.querySelectorAll('li').length, 2);
		assert.match(document.body.textContent, /This device/);
		assert.match(document.body.textContent, /Chrome/);
		assert.ok(!document.body.textContent.includes('Mozilla'));
		await click(document.querySelectorAll('li button')[1].getAttribute('aria-label'));
		assert.equal(calls.length, 2);
		assert.match(document.querySelector('[role=dialog]').textContent, /Selected session: iPhone, Safari/);
		assert.match(document.querySelector('[role=dialog]').textContent, /You will stay signed in/);
		await click('Cancel');
		assert.equal(document.querySelector('[role=dialog]'), null);
		await click(document.querySelectorAll('li button')[1].getAttribute('aria-label'));
		await click('Sign out', document.querySelector('[role=dialog]'));
		assert.equal(calls.length, 3);
		assert.ok([...document.querySelector('[role=dialog]').querySelectorAll('button')].every((b) => b.disabled));
		await act(async () => pending());
		assert.equal(document.querySelectorAll('li').length, 1);
		assert.equal(cleared, 0);
		await click('Log out from all devices');
		fail = true;
		await click('Sign out', document.querySelector('[role=dialog]'));
		assert.match(document.querySelector('[role=dialog] [role=alert]').textContent, /Unable to sign out/);
		assert.equal(cleared, 0);
		fail = false;
		await click('Sign out', document.querySelector('[role=dialog]'));
		await act(async () => pending());
		assert.equal(cleared, 2);
		assert.equal(document.querySelector('[role=dialog]'), null);
	} finally {
		await act(async () => root.unmount());
		dom.window.close();
		for (const [k, d] of Object.entries(saved)) {
			if (d) Object.defineProperty(global, k, d);
			else delete global[k];
		}
	}
});
