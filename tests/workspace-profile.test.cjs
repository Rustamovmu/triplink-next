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
		if (!(name in mocks)) throw new Error(`Missing mock ${name}`);
		return mocks[name];
	}, exported);
	return exported;
};
test('workspace preserves role destinations and grouped profile forms retain update and password validation', async () => {
	const saved = Object.fromEntries(
		['window', 'document', 'FormData', 'IS_REACT_ACT_ENVIRONMENT'].map((k) => [
			k,
			Object.getOwnPropertyDescriptor(global, k),
		]),
	);
	const dom = new JSDOM('<div id="root"></div>');
	global.window = dom.window;
	global.document = dom.window.document;
	global.FormData = dom.window.FormData;
	global.IS_REACT_ACT_ENVIRONMENT = true;
	let current = {
			_id: 'viewer',
			memberNick: 'Nathan',
			memberFullname: '',
			memberType: 'USER',
			memberImage: '',
			memberCountry: '',
			memberDesc: '',
			memberFavoriteDestinations: ['Seoul'],
			updatedAt: '2026-10-10',
		},
		category = 'myProfile',
		requests = [],
		accepted = [];
	const box = ({ children, component = 'div', onSubmit, className }) =>
		React.createElement(component, { onSubmit, className }, children);
	const mui = {
		Avatar: box,
		Stack: box,
		Box: box,
		Typography: box,
		Container: box,
		Card: box,
		CardContent: box,
		CircularProgress: box,
		Pagination: () => null,
		Alert: ({ children }) => React.createElement('div', { role: 'alert' }, children),
		Button: ({ children, component = 'button', onClick, disabled, type }) =>
			React.createElement(component, { onClick, disabled, type }, children),
		TextField: ({ name, defaultValue, type, autoComplete, inputProps }) =>
			React.createElement('input', { name, defaultValue, type, autoComplete, ...inputProps }),
	};
	const shared = {
		react: React,
		'next-i18next': { useTranslation: () => ({ t: (k) => k }) },
		'@mui/material': mui,
		'../../../apollo/store': { memberVar: 'member', sessionVar: 'session' },
		'@apollo/client': {
			useReactiveVar: (v) => (v === 'member' ? current : 'authenticated'),
			useMutation: () => [
				async (options) => {
					requests.push(options.variables.input);
					return { data: { result: { accessToken: 'test-token', member: current } } };
				},
			],
		},
	};
	const common = load('libs/components/triplink/Common.tsx', {
		...shared,
		'../../triplink/errors': { errorMessage: (e) => e.message },
	});
	const { ProfileForm } = load('libs/components/triplink/Members.tsx', {
		...shared,
		'next/link': {},
		'../../../apollo/user/triplink': {},
		'../../auth': { acceptAuth: async (result) => accepted.push(result) },
		'../../types/triplink': {},
		'./Common': common,
		'./Tours': {},
		'../../auth/security': { validNewPassword: value => value.length >= 12 && value.length <= 1024 },
'../../uploads': {},
	});
	const stub = () => React.createElement('div', null, 'Panel');
	const { default: Workspace } = load('libs/components/triplink/Workspace.tsx', {
		...shared,
		'next/router': { useRouter: () => ({ query: { category }, push: async () => {} }) },
		'next/link': {
			__esModule: true,
			default: ({ href, children, ...props }) =>
				React.createElement(
					'a',
					{
						href: typeof href === 'string' ? href : `${href.pathname}?category=${href.query.category}`,
						'aria-current': props['aria-current'],
					},
					children,
				),
		},
		'./Session': { Access: ({ children }) => children },
		'./Common': common,
		'./Community': { ArticlesList: stub, ArticleForm: stub },
		'./Bookings': { BookingsPanel: stub },
		'./Reviews': { ReviewsPanel: stub },
		'./TourManagement': { OwnedTours: stub, TourForm: stub },
		'./SecuritySettings': { SecuritySettings: stub },
'./ActiveSessions': { ActiveSessions: stub },
		'./Members': { ProfileForm: stub, SavedTours: stub, Follows: stub },
	});
	const root = createRoot(document.getElementById('root'));
	const render = (Component) =>
		act(async () => root.render(React.createElement(Component, Component === ProfileForm ? { member: current } : {})));
	const submit = () =>
		act(async () =>
			document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })),
		);
	try {
		await render(Workspace);
		assert.ok(document.querySelector('a[href="/mypage?category=myBookings"]'));
		assert.equal(document.querySelector('a[href="/mypage?category=addTour"]'), null);
		assert.equal(document.querySelector('a[aria-current="page"]').textContent, 'Profile');
		current = { ...current, memberType: 'AGENT' };
		category = 'addProperty';
		await render(Workspace);
		assert.equal(document.querySelector('a[aria-current="page"]').textContent, 'Create tour');
		assert.ok(document.querySelector('a[href="/mypage?category=agentBookings"]'));
		assert.equal(document.querySelector('a[href="/mypage?category=myBookings"]'), null);
		current = { ...current, memberType: 'ADMIN' };
		category = 'myProfile';
		await render(Workspace);
		assert.ok(document.querySelector('a[href="/_admin/users"]'));
		assert.equal(document.querySelector('a[href="/mypage?category=myFavorites"]'), null);
		category = 'myBookings';
		await render(Workspace);
		assert.match(document.querySelector('[role="alert"]').textContent, /do not have access/);
		current = { ...current, memberType: 'USER' };
		await render(ProfileForm);
		assert.equal(document.querySelector('details').open, false);
		assert.ok(document.querySelector('fieldset input[name="memberNick"]'));
		assert.equal(document.querySelector('input[name="currentPassword"]').autocomplete, 'current-password');
		document.querySelector('[name="memberNick"]').value = '  Traveler  ';
		document.querySelector('[name="destinations"]').value = ' Seoul, Bali , ';
		await submit();
		assert.equal(requests.length, 1);
		assert.equal(requests[0].memberNick, 'Traveler');
		assert.deepEqual(requests[0].memberFavoriteDestinations, ['Seoul', 'Bali']);
		assert.equal('passwordChange' in requests[0], false);
		assert.equal(accepted.length, 1);
		document.querySelector('[name="currentPassword"]').value = 'short';
		document.querySelector('[name="newPassword"]').value = '12345678';
		await submit();
		assert.equal(requests.length, 1);
		assert.match(document.querySelector('[role="alert"]').textContent, /at least 12/);
		document.querySelector('[name="currentPassword"]').value = 'current-pass';
		document.querySelector('[name="newPassword"]').value = 'new-password';
		await submit();
		assert.deepEqual(requests[1].passwordChange, { currentPassword: 'current-pass', newPassword: 'new-password' });
		assert.equal(accepted.length, 2);
	} finally {
		await act(async () => root.unmount());
		dom.window.close();
		for (const [k, d] of Object.entries(saved)) {
			if (d) Object.defineProperty(global, k, d);
			else delete global[k];
		}
	}
});
