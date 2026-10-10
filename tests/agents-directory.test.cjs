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
	new Function('require', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), {
		compilerOptions: { module: 1, jsx: 2, esModuleInterop: true },
	}).outputText)((name) => {
		if (!(name in mocks)) throw new Error(`Missing mock: ${name}`);
		return mocks[name];
	}, exported);
	return exported;
};

test('agent controls use server follow state and counts, lock pending actions, report failures and respect roles', async () => {
	const saved = Object.fromEntries(['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map((key) => [key, Object.getOwnPropertyDescriptor(global, key)]));
	const dom = new JSDOM('<div id="root"></div>');
	global.window = dom.window;
	global.document = dom.window.document;
	global.IS_REACT_ACT_ENVIRONMENT = true;
	let current = { _id: 'traveler', memberType: 'USER' };
	let agent = { _id: 'agent', memberNick: 'Guide', memberFullname: null, memberCountry: 'Korea', memberImage: '', memberDesc: '', memberTours: 4, memberFollowers: 7, isFollowing: false };
	let rejectRequest, resolveRequest, requestCount = 0, refetchCount = 0, hydrationCount = 0, variables;
	const t = (key, values = {}) => key.replace(/{{(\w+)}}/g, (_, name) => values[name] ?? '');
	const box = ({ children, className }) => React.createElement('div', { className }, children);
	const mui = {
		Avatar: box, Container: box, Stack: box, Typography: box,
		Button: ({ children, onClick, disabled, ...props }) => React.createElement('button', { onClick, disabled, 'aria-label': props['aria-label'] }, children),
		Alert: ({ children, action }) => React.createElement('div', { role: 'alert' }, children, action),
		CircularProgress: () => React.createElement('div', { role: 'status' }, 'Loading'),
		Pagination: () => null,
	};
	const shared = {
		react: React,
		'next-i18next': { useTranslation: () => ({ t }) },
		'@mui/material': mui,
		'@apollo/client': {
			useReactiveVar: (variable) => variable === 'member' ? current : 'anonymous',
			useQuery: () => ({ data: { result: { list: [agent], metaCounter: [{ total: 1 }] } }, loading: false, refetch: async () => { refetchCount++; } }),
			useMutation: () => [(options) => { requestCount++; variables = options.variables; return new Promise((resolve, reject) => { resolveRequest = resolve; rejectRequest = reject; }); }],
		},
		'../../../apollo/store': { memberVar: 'member', sessionVar: 'session' },
	};
	const common = load('libs/components/triplink/Common.tsx', { ...shared, '../../triplink/errors': { errorMessage: (error) => error.message } });
	const icon = () => React.createElement('svg');
	const profiles = load('libs/components/triplink/Profiles.tsx', {
		...shared,
		'next/link': { __esModule: true, default: ({ children, href, ...props }) => React.createElement('a', { href, className: props.className, 'aria-label': props['aria-label'] }, children) },
		'next/router': { useRouter: () => ({}) },
		'../../../apollo/user/triplink': { AGENTS: 'agents', FOLLOW_TOGGLE: 'follow' },
		'../../types/triplink': { totalOf: (result) => result?.metaCounter[0]?.total ?? 0 },
		'./Common': common, './Tours': {}, './Members': {},
		'../../auth': { refreshCurrentMember: async () => { hydrationCount++; } },
		...Object.fromEntries(['SearchRounded', 'PlaceOutlined', 'ArrowForwardRounded', 'CloseRounded', 'PersonAddAltRounded', 'CheckRounded', 'FavoriteBorderRounded'].map((name) => [`@mui/icons-material/${name}`, { __esModule: true, default: icon }])),
	});
	const root = createRoot(document.getElementById('root'));
	const render = () => act(async () => root.render(React.createElement(profiles.AgentDirectory)));
	const button = () => document.querySelector('button[aria-label="Follow Guide"], button[aria-label="Unfollow Guide"]');
	try {
		await render();
		assert.equal(button().textContent, 'Follow');
		assert.deepEqual([...document.querySelectorAll('dd')].map((node) => node.textContent), ['4', '7']);
		await act(async () => button().click());
		assert.deepEqual(variables, { memberId: 'agent' });
		assert.equal(button().disabled, true);
		await act(async () => button().click());
		assert.equal(requestCount, 1);
		await act(async () => {
			agent = { ...agent, isFollowing: true, memberFollowers: 8 };
			resolveRequest({ data: { result: { member: agent, followed: true } } });
		});
		assert.equal(button().textContent, 'Unfollow');
		assert.equal(document.querySelectorAll('dd')[1].textContent, '8');
		assert.equal(refetchCount, 1);
		assert.equal(hydrationCount, 1);
		await act(async () => button().click());
		await act(async () => rejectRequest(new Error('Follow request rejected')));
		assert.equal(button().textContent, 'Unfollow');
		assert.equal(button().disabled, false);
		assert.match(document.querySelector('[role="alert"]').textContent, /Follow request rejected/);
		await act(async () => button().click());
		await act(async () => {
			agent = { ...agent, isFollowing: false, memberFollowers: 7 };
			resolveRequest({ data: { result: { member: agent, followed: false } } });
		});
		assert.equal(button().textContent, 'Follow');
		assert.equal(document.querySelectorAll('dd')[1].textContent, '7');
		current = { _id: 'admin', memberType: 'ADMIN' };
		await render();
		assert.equal(button(), null);
		current = { _id: 'agent', memberType: 'AGENT' };
		await render();
		assert.equal(button(), null);
		current = { _id: 'other-agent', memberType: 'AGENT' };
		await render();
		assert.ok(button());
		current = null;
		await render();
		assert.equal(button(), null);
		assert.equal(document.querySelector('a[href="/account/join"]').textContent, 'Log in to follow');
	} finally {
		await act(async () => root.unmount());
		dom.window.close();
		for (const [key, descriptor] of Object.entries(saved)) {
			if (descriptor) Object.defineProperty(global, key, descriptor);
			else delete global[key];
		}
	}
});
