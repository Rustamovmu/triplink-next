const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { JSDOM } = require('jsdom');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');

const load = (file, mocks = {}) => {
	const exports = {};
	new Function(
		'require',
		'exports',
		ts.transpileModule(fs.readFileSync(file, 'utf8'), {
			compilerOptions: { module: 1, jsx: 2, esModuleInterop: true },
		}).outputText,
	)((name) => (name === '../../triplink/BrowsingMemoryProvider' ? require('./helpers/browsing-memory.cjs')(mocks) : name in mocks ? mocks[name] : require(name)), exports);
	return exports;
};

function environment({ reduced = false, observerAvailable = true } = {}) {
	const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
	const saved = Object.fromEntries(
		['window', 'document', 'Image', 'IS_REACT_ACT_ENVIRONMENT'].map((key) => [
			key,
			Object.getOwnPropertyDescriptor(global, key),
		]),
	);
	const observers = [],
		images = [],
		listeners = new Set();
	const preference = {
		matches: reduced,
		addEventListener: (_, fn) => listeners.add(fn),
		removeEventListener: (_, fn) => listeners.delete(fn),
	};
	dom.window.matchMedia = () => preference;
	class Observer {
		constructor(callback, options) {
			this.callback = callback;
			this.options = options;
			observers.push(this);
		}
		observe(target) {
			this.target = target;
		}
		disconnect() {
			this.disconnected = true;
		}
	}
	if (observerAvailable) dom.window.IntersectionObserver = Observer;
	Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
	Object.defineProperty(global, 'Image', {
		configurable: true,
		value: class Image {
			constructor() {
				images.push(this);
			}
		},
	});
	const atlas = load('libs/components/homepage/AgentsAtlas.tsx', { react: React });
	const root = createRoot(document.getElementById('root'));
	return {
		atlas,
		root,
		observers,
		images,
		listeners,
		preference,
		render: (component) => act(async () => root.render(component)),
		changeMotion: (matches) =>
			act(async () => {
				preference.matches = matches;
				listeners.forEach((fn) => fn());
			}),
		cleanup: async () => {
			await act(async () => root.unmount());
			dom.window.close();
			for (const [key, descriptor] of Object.entries(saved)) {
				if (descriptor) Object.defineProperty(global, key, descriptor);
				else delete global[key];
			}
		},
	};
}

test('Top agents preserves server order, links, statistics, localized copy, and portrait fallbacks', async () => {
	const ctx = environment({ reduced: true });
	let locale = 'en',
		ready = true,
		refetches = 0,
		queryOptions;
	const agents = [
		{
			_id: 'first',
			memberFullname: 'Mina',
			memberNick: 'mina',
			memberCountry: 'South Korea',
			memberImage: '/uploads/mina.jpg',
			memberTours: 4,
			memberFollowers: 9,
		},
		{
			_id: 'second',
			memberFullname: null,
			memberNick: 'Александр',
			memberCountry: 'Russia',
			memberImage: '',
			memberTours: 0,
			memberFollowers: 7,
		},
		{
			_id: 'third',
			memberFullname: '여행 가이드',
			memberNick: 'guide',
			memberCountry: null,
			memberImage: '/uploads/missing.jpg',
			memberTours: 3,
			memberFollowers: 2,
		},
		{
			_id: 'fourth',
			memberFullname: 'A very long agent name with a journey to remember',
			memberNick: 'long',
			memberCountry: 'New Zealand',
			memberImage: '/img/profile/local.jpg',
			memberTours: 8,
			memberFollowers: 1,
		},
	];
	let query = {
		data: { result: { list: agents } },
		loading: false,
		refetch: () => {
			refetches++;
		},
	};
	const translations = Object.fromEntries(
		['en', 'kr', 'ru'].map((language) => [
			language,
			JSON.parse(fs.readFileSync(`public/locales/${language}/common.json`, 'utf8')),
		]),
	);
	const t = (key, values = {}) => {
		const plural = values.count === undefined ? key : `${key}_${values.count === 1 ? 'one' : 'other'}`;
		return (translations[locale][plural] || translations[locale][key] || key).replace(
			/{{(\w+)}}/g,
			(_, name) => values[name] ?? '',
		);
	};
	const box = ({ children }) => React.createElement('div', null, children);
	const mui = {
		Avatar: require('@mui/material/Avatar').default,
		Alert: ({ children, action }) => React.createElement('div', { role: 'alert' }, children, action),
		Button: ({ children, onClick }) => React.createElement('button', { onClick }, children),
		CircularProgress: () => React.createElement('span', null, 'Loading'),
		Box: box,
		Container: box,
		Stack: box,
		Typography: box,
		Pagination: box,
	};
	const shared = {
		react: React,
		'next-i18next': { useTranslation: () => ({ t, i18n: { language: locale } }) },
		'@mui/material': mui,
	};
	const common = load('libs/components/triplink/Common.tsx', {
		...shared,
		'@apollo/client': { useReactiveVar: () => (ready ? 'anonymous' : 'loading') },
		'../../../apollo/store': { sessionVar: {} },
		'../../triplink/errors': { errorMessage: (error) => error.message },
	});
	const { TopAgents } = load('libs/components/homepage/HomeSections.tsx', {
		...shared,
		'next/link': {
			__esModule: true,
			default: ({ children, href, ...props }) => React.createElement('a', { href, ...props }, children),
		},
		'next/router': { useRouter: () => ({ locale }) },
		'@apollo/client': {
			useQuery: (_, options) => {
				queryOptions = options;
				return query;
			},
		},
		'../../../apollo/user/triplink': { AGENTS: 'agents', TOURS: 'tours' },
		'../triplink/Common': common,
		'../triplink/TourFavorites': {},
		'./AgentsAtlas': ctx.atlas,
		'./HomeArticles': {},
		'./IntroMedia': {},
		'./FeaturedTourSwiper': { FeaturedTourSwiper: ({ items }) => React.createElement('div', { 'data-count': items.length, 'data-tour-swiper': true }, items.map(item => React.createElement(React.Fragment, { key: item.id }, item.content))) },
		'./IntroGallery': {},
		'./IntroCircularCarousel': {},
		...Object.fromEntries(
			['FavoriteBorderRounded', 'FavoriteRounded', 'StarRounded', 'OpenInNewRounded'].map((name) => [
				`@mui/icons-material/${name}`,
				{ __esModule: true, default: () => null },
			]),
		),
	});
	const { CacheProvider } = require('@emotion/react');
	const cache = require('@emotion/cache').default({ key: 'atlas-test', container: document.head });
	const render = () => ctx.render(React.createElement(CacheProvider, { value: cache }, React.createElement(TopAgents)));
	try {
		await render();
		assert.deepEqual(queryOptions.variables.input, {
			page: 1,
			limit: 4,
			search: {},
			sort: 'memberFollowers',
			direction: 'DESC',
		});
		assert.equal(queryOptions.skip, false);
		assert.deepEqual(
			[...document.querySelectorAll('article h3 a')].map((node) => node.textContent),
			agents.map((agent) => agent.memberFullname || agent.memberNick),
		);
		assert.deepEqual(
			[...document.querySelectorAll('article .triplink-home-agent__link')].map((node) => node.getAttribute('href')),
			agents.map((agent) => `/agent/detail?agentId=${agent._id}`),
		);
		assert.equal(document.querySelector('.triplink-home-section__link').getAttribute('href'), '/agent');
		assert.equal(document.querySelectorAll('.triplink-home-agent__country').length, 3);
		assert.match(document.querySelector('.triplink-home-agent__stats').textContent, /4 tours.*9 followers/);
		assert.equal(document.querySelector('[aria-hidden="true"] img').alt, '');
		// Missing saved portrait uses the existing default image; failed loads show initials.
		assert.ok(ctx.images.some((image) => image.src === '/img/profile/defaultUser.svg'));
		await act(async () => ctx.images.forEach((image) => image.onerror?.()));
		assert.deepEqual(
			[...document.querySelectorAll('.triplink-home-agent__portrait')].map((node) => node.textContent),
			['M', 'А', '여', 'A'],
		);
		for (const language of ['kr', 'ru']) {
			locale = language;
			await render();
			assert.equal(document.querySelector('section').lang, language === 'kr' ? 'ko' : 'ru');
			assert.equal(
				document.querySelector('.triplink-home-section__statement').textContent,
				translations[language]['Meet the people behind your next adventure.'],
			);
		}
		ready = false;
		await render();
		assert.equal(queryOptions.skip, true);
		assert.ok(document.querySelector('[role="status"]'));
		assert.equal(document.querySelectorAll('article').length, 0);
		ready = true;
		query = { ...query, loading: true };
		await render();
		assert.ok(document.querySelector('[role="status"]'));
		query = { ...query, loading: false, error: new Error('Connection unavailable') };
		await render();
		assert.match(document.querySelector('[role="alert"]').textContent, /Connection unavailable/);
		await act(async () => document.querySelector('button').click());
		assert.equal(refetches, 1);
		query = { ...query, error: undefined, data: { result: { list: [] } } };
		await render();
		assert.equal(document.querySelector('[role="alert"]').textContent, t('No results'));
		assert.ok(document.querySelector('.triplink-agents-atlas'));
	} finally {
		await ctx.cleanup();
	}
});

test('atlas draws once on visibility and cleans observers and preference listeners', async () => {
	const ctx = environment();
	try {
		await ctx.render(React.createElement(ctx.atlas.AgentsAtlas));
		assert.equal(ctx.observers.length, 1);
		const observer = ctx.observers[0];
		assert.equal(observer.options.threshold, 0.2);
		assert.equal(document.querySelectorAll('path').length, 3);
		await act(async () => observer.callback([{ isIntersecting: false }]));
		assert.equal(document.querySelector('.is-animated'), null);
		await act(async () => observer.callback([{ isIntersecting: true }]));
		assert.ok(document.querySelector('.is-animated'));
		assert.equal(observer.disconnected, true);
		await ctx.changeMotion(true);
		assert.equal(document.querySelector('.is-animated'), null);
		await ctx.changeMotion(false);
		await act(async () => observer.callback([{ isIntersecting: true }]));
		assert.equal(document.querySelector('.is-animated'), null);
		assert.equal(ctx.observers.length, 1);
	} finally {
		await ctx.cleanup();
	}
	assert.equal(ctx.listeners.size, 0);
	assert.ok(ctx.observers.every((observer) => observer.disconnected));
});

test('reduced motion and unavailable observer keep a complete static decorative atlas', async () => {
	for (const options of [{ reduced: true }, { observerAvailable: false }]) {
		const ctx = environment(options);
		try {
			await ctx.render(React.createElement(ctx.atlas.AgentsAtlas));
			assert.equal(ctx.observers.length, 0);
			assert.equal(document.querySelector('.is-animated'), null);
			assert.equal(document.querySelectorAll('path').length, 3);
			assert.equal(document.querySelectorAll('circle').length, 4);
			assert.equal(document.querySelector('svg').getAttribute('focusable'), 'false');
			assert.equal(document.querySelector('.triplink-agents-atlas').getAttribute('aria-hidden'), 'true');
		} finally {
			await ctx.cleanup();
		}
	}
});

test('queued visibility work is ignored after unmount', async () => {
	const ctx = environment();
	await ctx.render(React.createElement(ctx.atlas.AgentsAtlas));
	const observer = ctx.observers[0];
	await ctx.cleanup();
	assert.doesNotThrow(() => observer.callback([{ isIntersecting: true }]));
	assert.equal(observer.disconnected, true);
	assert.equal(ctx.listeners.size, 0);
});
