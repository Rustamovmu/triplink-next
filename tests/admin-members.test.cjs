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
	)((name) => {
		if (name in mocks) return mocks[name];
		throw new Error(`Missing mock ${name}`);
	}, exported);
	return exported;
};
test('admin directory keeps server filters, paging, profile eligibility and independent edit protections', async () => {
	const saved = Object.fromEntries(
		['window', 'document', 'navigator', 'IS_REACT_ACT_ENVIRONMENT'].map((k) => [
			k,
			Object.getOwnPropertyDescriptor(global, k),
		]),
	);
	const dom = new JSDOM('<div id="root"></div>');
	global.window = dom.window;
	global.document = dom.window.document;
	global.IS_REACT_ACT_ENVIRONMENT = true;
	let copies = [],
		requests = [],
		variables,
		refreshes = 0;
	Object.defineProperty(global, 'navigator', {
		configurable: true,
		value: { clipboard: { writeText: async (id) => copies.push(id) } },
	});
	const member = {
		_id: 'viewer',
		memberNick: 'Admin',
		memberType: 'ADMIN',
		memberStatus: 'ACTIVE',
		memberTours: 0,
		memberReviews: 0,
		createdAt: '2026-10-10',
		updatedAt: '1',
	};
	const agent = { ...member, _id: 'agent', memberNick: 'Guide', memberType: 'AGENT', memberTours: 4 };
	const members = [
		member,
		agent,
		{ ...agent, _id: 'pending', memberStatus: 'PENDING' },
		{ ...agent, _id: 'user', memberType: 'USER' },
	];
	const box = ({ children }) => React.createElement('div', null, children);
	const mui = {
		Avatar: box,
		Card: box,
		CardContent: box,
		Stack: box,
		Typography: box,
		MenuItem: ({ children, value }) => React.createElement('option', { value }, children),
		Button: ({ children, onClick, disabled, ...props }) =>
			React.createElement('button', { onClick, disabled, 'aria-expanded': props['aria-expanded'] }, children),
		TextField: ({ label, select, value, onChange, disabled, children }) =>
			React.createElement(
				select ? 'select' : 'input',
				{
					'aria-label': label,
					value,
					onChange: select ? onChange : undefined,
					onInput: select ? undefined : onChange,
					disabled,
				},
				children,
			),
	};
	const common = {
		imageUrl: (v) => v,
		QueryState: ({ children }) => children,
		Pager: ({ onChange, limit }) =>
			React.createElement('button', { 'data-limit': limit, onClick: () => onChange(2) }, 'Next page'),
		useAction: () => ({ busy: false, run: async (callback) => callback(), feedback: null }),
	};
	const { AdminMembers, MemberRow } = load('libs/components/triplink/AdminMembers.tsx', {
		react: React,
		'next-i18next': { useTranslation: () => ({ t: (k) => k, i18n: { language: 'en' } }) },
		'@mui/material': mui,
		'next/link': { __esModule: true, default: ({ href, children }) => React.createElement('a', { href }, children) },
		'@mui/icons-material/RefreshOutlined': { __esModule: true, default: () => null },
		'@mui/icons-material/SearchOutlined': { __esModule: true, default: () => null },
		'@apollo/client': {
			useReactiveVar: () => member,
			useQuery: (_, options) => {
				variables = options.variables;
				return {
					data: { result: { list: members, metaCounter: [{ total: 30 }] } },
					refetch: async () => {
						refreshes++;
					},
				};
			},
			useMutation: () => [async (options) => requests.push(options.variables.input)],
		},
		'../../../apollo/admin/triplink': {},
		'../../../apollo/store': {},
		'../../types/triplink': { totalOf: (r) => r?.metaCounter[0]?.total || 0 },
		'./Common': common,
	});
	const root = createRoot(document.getElementById('root'));
	const click = (label) =>
		act(async () =>
			Array.from(document.querySelectorAll('button'))
				.find((b) => b.textContent === label)
				.click(),
		);
	const set = async (label, value) =>
		act(async () => {
			const node = document.querySelector(`[aria-label="${label}"]`);
			Object.getOwnPropertyDescriptor(
				node.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype,
				'value',
			).set.call(node, value);
			node.dispatchEvent(new window.Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
		});
	try {
		await act(async () => root.render(React.createElement(AdminMembers)));
		assert.deepEqual(variables.input, { page: 1, limit: 12, search: { text: '' } });
		assert.equal(document.querySelectorAll('a').length, 2);
		assert.ok(document.querySelector('a[href="/agent/detail?agentId=agent"]'));
		assert.ok(document.querySelector('a[href="/member?memberId=user"]'));
		await click('Next page');
		assert.equal(variables.input.page, 2);
		await click('Pending review');
		assert.equal(variables.input.page, 1);
		assert.equal(variables.input.search.memberStatus, 'PENDING');
		await set('Role', 'AGENT');
		assert.equal(variables.input.search.memberType, 'AGENT');
		await set('Rows per page', '24');
		assert.equal(variables.input.limit, 24);
		await set('Search members', 'Guide');
		assert.equal(variables.input.search.text, 'Guide');
		await click('Clear filters');
		assert.deepEqual(variables.input.search, { text: '' });
		await click('Refresh');
		assert.equal(refreshes, 1);
		await click('Copy ID');
		assert.deepEqual(copies, ['viewer']);
		await click('Edit member');
		assert.equal(document.querySelector('button[aria-expanded=true]').textContent, 'Close');
		assert.equal(document.querySelector('[aria-label="Role"]').disabled, false);
		const selectors = document.querySelectorAll('[aria-label="Role"]');
		assert.equal(selectors[1].disabled, true);
		await act(async () =>
			root.render(React.createElement(MemberRow, { member: agent, refetch: async () => refreshes++ })),
		);
		await set('Role', 'USER');
		await click('Save member');
		assert.equal(requests[0].memberType, 'USER');
		assert.equal(requests[0].memberStatus, 'ACTIVE');
		assert.equal(requests[0].memberId, 'agent');
		await set('Nickname', 'Changed');
		await click('Reset changes');
		assert.equal(document.querySelector('[aria-label="Nickname"]').value, 'Guide');
		await act(async () =>
			root.render(React.createElement(MemberRow, { key: 'self', member, refetch: async () => {} })),
		);
		assert.equal(document.querySelector('[aria-label="Role"]').disabled, true);
		assert.equal(document.querySelector('[aria-label="Status"]').disabled, true);
		await set('Nickname', ' NewAdmin ');
		await click('Save member');
		assert.deepEqual(requests[1], { memberId: 'viewer', memberNick: 'NewAdmin' });
	} finally {
		await act(async () => root.unmount());
		dom.window.close();
		for (const [k, d] of Object.entries(saved)) {
			if (d) Object.defineProperty(global, k, d);
			else delete global[k];
		}
	}
});
