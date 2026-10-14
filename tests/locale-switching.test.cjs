const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { JSDOM } = require('jsdom');
const { createRoot } = require('react-dom/client');
const { act, Simulate } = require('react-dom/test-utils');
function load(file, mocks = {}) {
	const exports = {};
	new Function(
		'require',
		'exports',
		ts.transpileModule(fs.readFileSync(file, 'utf8'), {
			compilerOptions: { module: 1, jsx: 2, esModuleInterop: true },
		}).outputText,
	)((name) => (name in mocks ? mocks[name] : require(name)), exports);
	return exports;
}
test('navbar switches all languages on a filtered detail route, persists one preference and never calls logout', async () => {
	const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost:3000' });
	const keys = ['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'];
	const saved = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(global, key)]));
	global.window = dom.window;
	global.document = dom.window.document;
	global.IS_REACT_ACT_ENVIRONMENT = true;
	window.matchMedia = () => ({ addEventListener() {}, removeEventListener() {} });
	const requests = [];
	const router = {
		pathname: '/tour/detail',
		query: { id: 'a'.repeat(24), tab: 'reviews', tag: ['city', 'food'] },
		asPath: '/tour/detail?id=' + 'a'.repeat(24) + '&tab=reviews&tag=city&tag=food#reviews',
		locale: 'en',
	};
	let outcome = true,
		logout = 0;
	router.push = async (...args) => {
		requests.push(args);
		if (outcome) router.locale = args[2].locale;
		return outcome;
	};
	const member = { _id: 'member', memberNick: 'Aziza', memberType: 'USER' };
	const blank = () => null;
	const uz = JSON.parse(fs.readFileSync('public/locales/uz/common.json'));
	const Top = load('libs/components/Top.tsx', {
		react: React,
		'next/router': { useRouter: () => router },
		'next-i18next': { useTranslation: () => ({ t: (key) => (router.locale === 'uz' ? uz[key] || key : key) }) },
		'next/link': {
			__esModule: true,
			default: ({ href, children, passHref, ...props }) => React.createElement('a', { ...props, href }, children),
		},
		'./BrandLogo': { __esModule: true, default: blank },
		'@mui/material': {
			Avatar: ({ children }) => React.createElement('span', null, children),
			Divider: blank,
			Drawer: blank,
			Menu: blank,
			MenuItem: blank,
		},
		'@apollo/client': { useReactiveVar: (variable) => (variable === 'member' ? member : 'authenticated') },
		'../../apollo/store': { memberVar: 'member', sessionVar: 'session' },
		'../auth': { logOut: async () => logout++ },
		'./triplink/Common': { imageUrl: (value) => value },
		'../hooks/useNavbarSurface': { __esModule: true, default: () => ({ ref: null, mode: 'glass' }) },
		'../triplink/BrowsingMemoryProvider': { useHomeNavigation: () => () => {} },
	}).default;
	const root = createRoot(document.getElementById('root'));
	try {
		await act(async () => root.render(React.createElement(Top)));
		assert.deepEqual(
			[...document.querySelector('select').options].map((option) => [option.value, option.text]),
			[
				['en', 'English'],
				['kr', '한국어'],
				['ru', 'Русский'],
				['uz', 'O‘zbekcha'],
			],
		);
		for (const locale of ['uz', 'kr', 'ru', 'en']) {
			await act(async () => Simulate.change(document.querySelector('select'), { target: { value: locale } }));
			await act(async () => root.render(React.createElement(Top)));
			const [url, as, options] = requests.at(-1);
			assert.deepEqual(url, { pathname: router.pathname, query: router.query });
			assert.equal(as, router.asPath);
			assert.deepEqual(options, { locale, scroll: false });
			assert.match(document.cookie, new RegExp('NEXT_LOCALE=' + locale));
			assert.equal(document.querySelector('select').value, locale);
		}
		outcome = false;
		await act(async () => Simulate.change(document.querySelector('select'), { target: { value: 'uz' } }));
		assert.match(document.cookie, /NEXT_LOCALE=en/);
		assert.equal(logout, 0);
		assert.equal(member.memberNick, 'Aziza');
	} finally {
		await act(async () => root.unmount());
		dom.window.close();
		for (const [key, descriptor] of Object.entries(saved)) {
			if (descriptor) Object.defineProperty(global, key, descriptor);
			else delete global[key];
		}
	}
});
test('locale middleware restores callbacks before SSR, preserving queries and respecting explicit locale routes', () => {
	const { NextRequest } = require('next/server');
	const { middleware } = load('middleware.ts');
	const config = require('../next-i18next.config');
	const request = (url, cookie) =>
		new NextRequest('http://localhost:3000' + url, { headers: { cookie }, nextConfig: { i18n: config.i18n } });
	assert.equal(
		middleware(request('/account/complete?security=1', 'NEXT_LOCALE=uz')).headers.get('location'),
		'http://localhost:3000/uz/account/complete?security=1',
	);
	assert.equal(middleware(request('/', 'NEXT_LOCALE=uz')).headers.get('location'), 'http://localhost:3000/uz');
	assert.equal(middleware(request('/ru/account/complete?security=1', 'NEXT_LOCALE=uz')).headers.get('location'), null);
	assert.equal(middleware(request('/account/complete', 'NEXT_LOCALE=invalid')).headers.get('location'), null);
	assert.equal(middleware(request('/', 'NEXT_LOCALE=en')).headers.get('location'), null);
});

test('action notices follow the active language and unknown backend details remain private', async () => {
	const dom = new JSDOM('<div id="root"></div>');
	const saved = Object.fromEntries(
		['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map((k) => [k, Object.getOwnPropertyDescriptor(global, k)]),
	);
	global.window = dom.window;
	global.document = dom.window.document;
	global.IS_REACT_ACT_ENVIRONMENT = true;
	let locale = 'en',
		action;
	const resources = Object.fromEntries(
		['en', 'uz'].map((l) => [l, JSON.parse(fs.readFileSync(`public/locales/${l}/common.json`))]),
	);
	const box = ({ children }) => React.createElement('div', null, children);
	const { useAction } = load('libs/components/triplink/Common.tsx', {
		react: React,
		'../../triplink/errors': { errorMessage: (e) => e.message },
		'../../../apollo/store': {},
		'@apollo/client': {},
		'@mui/material': { Alert: box },
		'next-i18next': {
			useTranslation: () => ({ t: (key, options = {}) => resources[locale][key] || options.defaultValue || key }),
		},
	});
	function Probe() {
		action = useAction();
		return action.feedback;
	}
	const root = createRoot(document.getElementById('root'));
	try {
		await act(async () => root.render(React.createElement(Probe)));
		await act(async () => action.run(async () => {}));
		assert.equal(document.body.textContent, 'Saved');
		locale = 'uz';
		await act(async () => root.render(React.createElement(Probe)));
		assert.equal(document.body.textContent, 'Saqlandi');
		await act(async () =>
			action.run(async () => {
				throw Error('private internal database error');
			}),
		);
		assert.equal(document.body.textContent, 'Xatolik yuz berdi!');
		assert.equal(document.body.textContent.includes('database'), false);
	} finally {
		await act(async () => root.unmount());
		dom.window.close();
		for (const [k, d] of Object.entries(saved)) {
			if (d) Object.defineProperty(global, k, d);
			else delete global[k];
		}
	}
});
