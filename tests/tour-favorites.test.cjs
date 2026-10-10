const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { JSDOM } = require('jsdom');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');

test('favorites respond immediately, reconcile counts, roll back failures and ignore stale sessions', async () => {
	const savedGlobals = Object.fromEntries(
		['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map((key) => [
			key,
			Object.getOwnPropertyDescriptor(global, key),
		]),
	);
	const dom = new JSDOM('<div id="root"></div>');
	global.window = dom.window;
	global.document = dom.window.document;
	global.IS_REACT_ACT_ENVIRONMENT = true;
	let member = { _id: 'user', memberType: 'USER' },
		session = 'authenticated',
		view;
	const mutations = [];
	const client = {
		query: async () => ({ data: { result: { list: [], metaCounter: [] } } }),
		mutate: () => new Promise((resolve, reject) => mutations.push({ resolve, reject })),
	};
	const source = fs.readFileSync('libs/components/triplink/TourFavorites.tsx', 'utf8');
	const mocks = {
		react: React,
		'@apollo/client': {
			useApolloClient: () => client,
			useReactiveVar: (variable) => (variable === 'member' ? member : session),
		},
		'../../../apollo/user/triplink': { FAVORITES: 'favorites', FAVORITE_TOGGLE: 'toggle' },
		'../../../apollo/store': { memberVar: 'member', sessionVar: 'session' },
		'../../types/triplink': { totalOf: (result) => result.metaCounter[0]?.total ?? 0 },
		'../../triplink/errors': { errorMessage: (error) => error.message },
	};
	const exported = {};
	new Function(
		'require',
		'exports',
		ts.transpileModule(source, { compilerOptions: { module: 1, jsx: 2, esModuleInterop: true } }).outputText,
	)((name) => mocks[name], exported);
	function Consumer() {
		view = exported.useTourFavorites();
		return null;
	}
	const tree = () => React.createElement(exported.TourFavoritesProvider, null, React.createElement(Consumer));
	const root = createRoot(document.getElementById('root'));
	const response = (favorited, count) => ({ data: { result: { favorited, tour: { tourFavoriteCount: count } } } });
	let pending;
	try {
		await act(async () => root.render(tree()));
		assert.equal(view.ready, true);
		await act(async () => {
			pending = view.toggle('a', 5);
		});
		assert.equal(view.saved.has('a'), true);
		assert.equal(view.counts.a, 6);
		assert.equal(view.pending.has('a'), true);
		await act(async () => {
			await view.toggle('a', 6);
		});
		assert.equal(mutations.length, 1);
		await act(async () => {
			mutations[0].resolve(response(true, 8));
			await pending;
		});
		assert.equal(view.counts.a, 8);
		assert.equal(view.pending.has('a'), false);
		await act(async () => {
			pending = view.toggle('a', 8);
		});
		assert.equal(view.saved.has('a'), false);
		assert.equal(view.counts.a, 7);
		await act(async () => {
			mutations[1].reject(new Error('Network failed'));
			await pending;
		});
		assert.equal(view.saved.has('a'), true);
		assert.equal(view.counts.a, 8);
		assert.equal(view.errors.a, 'Network failed');
		let first, second;
		await act(async () => {
			first = view.toggle('b', 0);
			second = view.toggle('c', 2);
		});
		assert.equal(view.counts.b, 1);
		assert.equal(view.counts.c, 3);
		await act(async () => {
			mutations[3].resolve(response(true, 4));
			await second;
			mutations[2].reject(new Error('Rejected'));
			await first;
		});
		assert.equal(view.saved.has('b'), false);
		assert.equal(view.counts.b, 0);
		assert.equal(view.saved.has('c'), true);
		assert.equal(view.counts.c, 4);
		await act(async () => {
			pending = view.toggle('c', 4);
		});
		member = null;
		session = 'anonymous';
		await act(async () => root.render(tree()));
		await act(async () => {
			mutations[4].resolve(response(false, 3));
			await pending;
		});
		assert.equal(view.saved.size, 0);
		assert.deepEqual(view.counts, {});
		assert.equal(view.eligible, false);
		await act(async () => {
			await view.toggle('a', 1);
		});
		assert.equal(mutations.length, 5);
	} finally {
		await act(async () => root.unmount());
		dom.window.close();
		for (const [key, descriptor] of Object.entries(savedGlobals)) {
			if (descriptor) Object.defineProperty(global, key, descriptor);
			else delete global[key];
		}
	}
});
