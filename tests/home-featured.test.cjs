const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { JSDOM } = require('jsdom');
const { createRoot } = require('react-dom/client');
const { act, Simulate } = require('react-dom/test-utils');

const load = (file, mocks) => {
	const exports = {};
	new Function(
		'require',
		'exports',
		ts.transpileModule(fs.readFileSync(file, 'utf8'), {
			compilerOptions: { module: 1, jsx: 2, esModuleInterop: true },
		}).outputText,
	)((name) => (name in mocks ? mocks[name] : name === '../../triplink/BrowsingMemoryProvider' ? require('./helpers/browsing-memory.cjs')(mocks) : name in mocks ? mocks[name] : require(name)), exports);
	return exports;
};

function environment({ reduced = false, observerAvailable = true } = {}) {
	const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', pretendToBeVisual: true });
	const keys = ['window', 'document', 'HTMLElement', 'getComputedStyle', 'IS_REACT_ACT_ENVIRONMENT', 'Image', 'IntersectionObserver', 'ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame'];
	const saved = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(global, key)]));
	Object.assign(global, {
		window: dom.window,
		document: dom.window.document,
		HTMLElement: dom.window.HTMLElement,
		getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
		IS_REACT_ACT_ENVIRONMENT: true,
	});
	const listeners = new Set(),
		observers = [];
	const preference = {
		matches: reduced,
		addEventListener: (_, fn) => listeners.add(fn),
		removeEventListener: (_, fn) => listeners.delete(fn),
	};
	dom.window.matchMedia = () => preference;
	if (observerAvailable)
		dom.window.IntersectionObserver = class {
			constructor(callback) {
				this.callback = callback;
				observers.push(this);
			}
			observe(target) {
				this.target = target;
			}
			disconnect() {
				this.disconnected = true;
			}
		};
	const root = createRoot(document.getElementById('root'));
	return {
		root,
		dom,
		listeners,
		observers,
		preference,
		render: (node) => act(async () => root.render(node)),
		visible: (value) => act(async () => observers[0].callback([{ isIntersecting: value }])),
		motion: (value) =>
			act(async () => {
				preference.matches = value;
				listeners.forEach((fn) => fn());
			}),
		hidden: (value) =>
			act(async () => {
				Object.defineProperty(document, 'hidden', { configurable: true, value });
				document.dispatchEvent(new window.Event('visibilitychange'));
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

const destinations = ['Iceland', 'Sossusvlei', 'Petra', 'Patagonia', 'Swiss Alps', 'Santorini', 'Cappadocia', 'Dolomites', 'Lofoten', 'Bali'];
const carousel = ogl => load('libs/components/homepage/FlexCarousel.jsx', { react: React, ogl }).default;
const unavailable = { Renderer: class { constructor() { throw new Error('WebGL unavailable'); } } };
async function key(node, value, options = {}) {
	const event = new window.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...options });
	await act(async () => node.dispatchEvent(event));
	return event.defaultPrevented;
}

test('FlexCarousel fallback preserves translated local photos, restored index, keyboard looping and image fallback', async () => {
	const ctx = environment();
	let saved = 4;
	const { IntroGallery } = load('libs/components/homepage/IntroGallery.tsx', {
		react: React,
		'./FlexCarousel': { default: carousel(unavailable), __esModule: true },
		'../../triplink/BrowsingMemoryProvider': { useRememberedState: () => {
			const [index, update] = React.useState(saved);
			return [index, value => { saved = value; update(value); }];
		} },
		'next-i18next': { useTranslation: () => ({ t: (value, options) => options ? value.replace('{{section}}', options.section) : `translated ${value}` }) },
	});
	try {
		await ctx.render(React.createElement(IntroGallery, { title: 'Featured tours' }));
		const node = document.querySelector('[role="region"]');
		assert.equal(node.getAttribute('aria-label'), 'Photo inspiration for translated Featured tours');
		assert.deepEqual([...node.querySelectorAll('button')].map(n => n.getAttribute('aria-label')), destinations.map(d => `translated ${d}`));
		assert.equal(node.querySelectorAll('img').length, 10);
		assert.equal(node.querySelector('[role="status"]').textContent, 'translated Swiss Alps, 5/10');
		assert.ok(node.classList.contains('is-fallback'));
		assert.equal(node.querySelector('canvas'), null);
		await act(async () => node.focus());
		assert.equal(node.querySelector('[role="status"]').getAttribute('aria-live'), 'polite');
		assert.equal(await key(node, 'End'), true);
		assert.equal(saved, 9);
		await key(node, 'ArrowRight');
		assert.equal(saved, 0);
		await key(node, 'ArrowLeft');
		assert.equal(saved, 9);
		await key(node, 'Home');
		assert.equal(saved, 0);
		assert.equal(await key(node, 'ArrowRight', { ctrlKey: true }), false);
		assert.equal(await key(node, 'Tab'), false);
		await act(async () => Simulate.click(node.querySelectorAll('button')[7]));
		assert.equal(saved, 7);
		assert.equal(node.querySelector('[aria-pressed="true"]').getAttribute('aria-label'), 'translated Dolomites');
		const image = node.querySelector('img');
		assert.equal(image.getAttribute('src'), '/img/homepage/featured/iceland.jpg');
		await act(async () => Simulate.error(image));
		assert.equal(image.getAttribute('src'), '/img/tour-placeholder.svg');
		await act(async () => Simulate.error(image));
		assert.equal(image.getAttribute('src'), '/img/tour-placeholder.svg');
		await ctx.render(null);
		await ctx.render(React.createElement(IntroGallery, { title: 'Featured tours' }));
		assert.equal(document.querySelector('[role="status"]').textContent, 'translated Dolomites, 8/10');
	} finally { await ctx.cleanup(); }
});

function gpuHarness(ctx) {
	const frames = new Map(), images = [], programs = [], meshes = [], deleted = [];
	let frameId = 0, now = performance.now();
	global.requestAnimationFrame = fn => { frames.set(++frameId, fn); return frameId; };
	global.cancelAnimationFrame = id => frames.delete(id);
	global.IntersectionObserver = window.IntersectionObserver;
	global.Image = class { constructor() { images.push(this); this.naturalWidth = 800; this.naturalHeight = 600; } };
	ctx.dom.window.HTMLCanvasElement.prototype.getContext = () => null;
	Object.defineProperties(ctx.dom.window.HTMLElement.prototype, {
		clientWidth: { configurable: true, get: () => 1000 },
		clientHeight: { configurable: true, get: () => 560 },
	});
	const gl = {
		canvas: document.createElement('canvas'), clearColor() {}, viewport() {}, clear() {}, generateMipmap() {},
		getExtension: () => ({ loseContext() { deleted.push('context'); } }),
		deleteTexture: () => deleted.push('texture'), deleteFramebuffer: () => deleted.push('framebuffer'),
	};
	class Texture { constructor() { this.texture = {}; } update() {} bind() {} }
	class Geometry { remove() { deleted.push('geometry'); } }
	class Program { constructor(_, options) { this.uniforms = options.uniforms; programs.push(this); } setBlendFunc() {} remove() { deleted.push('program'); } }
	class Mesh { constructor(_, options) { Object.assign(this, options); meshes.push(this); } }
	class RenderTarget { constructor() { this.texture = new Texture(); this.buffer = {}; } setSize(w,h) { this.width=w; this.height=h; } }
	class Renderer { constructor() { this.gl=gl; this.isWebgl2=true; this.dpr=1; } getExtension() { return null; } setSize() {} bindFramebuffer() {} render() {} }
	return {
		Component: carousel({Renderer, Program, Mesh, Triangle: Geometry, Plane: Geometry, Texture, RenderTarget}),
		frames, images, gl, programs, deleted,
		advance: async (count=1) => act(async () => {
			for (let i=0; i<count; i++) { now += 50; const pending=[...frames.values()]; frames.clear(); pending.forEach(fn => fn(now)); }
		}),
		load: async () => act(async () => images.forEach(image => image.onload())),
	};
}

test('FlexCarousel engine restores selection, honors reduced motion, pauses offscreen/hidden, preserves page wheel and falls back after context loss', async () => {
	const ctx = environment({ reduced: true }), gpu = gpuHarness(ctx), changes = [];
	const items = destinations.map(title => ({ title, src: `/${title}.jpg`, fallbackSrc: '/fallback.svg' }));
	try {
		await ctx.render(React.createElement(gpu.Component, { items, activeIndex: 4, captureWheel: false, onChange: index => changes.push(index) }));
		assert.equal(gpu.frames.size, 0);
		await gpu.load();
		await ctx.visible(true);
		await gpu.advance();
		const node = document.querySelector('[role="region"]');
		assert.ok(node.classList.contains('is-ready'));
		assert.equal(node.querySelector('[role="status"]').textContent, 'Swiss Alps, 5/10');
		assert.equal(node.querySelector('.flex-carousel__fallback').getAttribute('aria-hidden'), 'true');
		await key(node, 'End'); await gpu.advance();
		assert.equal(changes.at(-1), 9);
		await key(node, 'ArrowRight'); await gpu.advance();
		assert.equal(changes.at(-1), 0);
		await key(node, 'Enter'); await gpu.advance();
		assert.equal(node.querySelector('.flex-carousel__count').hasAttribute('data-hidden'), true);
		assert.equal(await key(node, 'Escape'), true); await gpu.advance();
		assert.equal(node.querySelector('.flex-carousel__count').hasAttribute('data-hidden'), false);
		const wheel = new window.WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
		await act(async () => node.dispatchEvent(wheel));
		assert.equal(wheel.defaultPrevented, false);
		await ctx.visible(false); assert.equal(gpu.frames.size, 0);
		await ctx.visible(true); assert.equal(gpu.frames.size, 1);
		await ctx.hidden(true); assert.equal(gpu.frames.size, 0);
		await ctx.hidden(false); assert.equal(gpu.frames.size, 1);
		await act(async () => gpu.gl.canvas.dispatchEvent(new window.Event('webglcontextlost', { cancelable: true })));
		assert.ok(node.classList.contains('is-fallback'));
		assert.equal(gpu.frames.size, 0);
		await key(node, 'End');
		assert.equal(node.querySelector('[role="status"]').textContent, 'Bali, 10/10');
	} finally { await ctx.cleanup(); }
	assert.equal(ctx.listeners.size, 0);
	assert.equal(ctx.observers[0].disconnected, true);
	assert.equal(gpu.frames.size, 0);
	assert.equal(gpu.deleted.filter(x => x === 'geometry').length, 2);
	assert.equal(gpu.deleted.filter(x => x === 'program').length, 2);
	assert.equal(gpu.deleted.filter(x => x === 'texture').length, 12);
	assert.ok(gpu.images.every(i => i.onload === null && i.onerror === null));
});

test('featured tour query, one/two/six carousel results, links, translations, prices and image failures remain intact', async () => {
	const ctx = environment();
	let locale = 'en',
		ready = true,
		options,
		retries = 0,
		toggles = [];
	const tours = Array.from({ length: 6 }, (_, index) => ({
		_id: `tour-${index}`,
		tourTitle: index === 0 ? '아주 긴 여행 제목 · Большое путешествие с долгим названием' : `Journey ${index}`,
		tourImages: index === 1 ? [] : [`/img/test-${index}.jpg`],
		tourCategory: 'ADVENTURE',
		tourDestination: 'Patagonia',
		tourDurationDays: 4,
		tourStatus: index === 2 ? 'SOLD_OUT' : 'ACTIVE',
		tourPrice: 1200,
		tourDiscountPrice: index === 0 ? 900 : null,
		tourFavoriteCount: 7,
		tourAverageRating: index === 0 ? 4.8 : 0,
		tourReviewCount: index === 0 ? 19 : 0,
		tourViewCount: index === 0 ? 3142 : 0,
		tourDescription: index === 0 ? 'A real itinerary across Patagonia.' : '',
		agentData: index === 0 ? { memberFullname: 'Patagonia Guide', memberNick: 'guide' } : null,
	}));
	let query = {
		data: { result: { list: tours } },
		loading: false,
		refetch: () => {
			retries++;
		},
	};
	let favorites = {
		saved: new Set(),
		pending: new Set(),
		errors: {},
		error: '',
		eligible: true,
		anonymous: false,
		ready: true,
		toggle: (id, count) => {
			toggles.push([id, count]);
		},
		retry: () => {
			retries++;
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
	const shared = {
		react: React,
		'next-i18next': { useTranslation: () => ({ t, i18n: { language: locale } }) },
		'@mui/material': {
			Alert: ({ children, action }) => React.createElement('div', { role: 'alert' }, children, action),
			Button: ({ children, onClick }) => React.createElement('button', { onClick }, children),
			CircularProgress: () => React.createElement('span', null, 'Loading'),
		},
	};
	const common = load('libs/components/triplink/Common.tsx', {
		...shared,
		'@apollo/client': { useReactiveVar: () => (ready ? 'anonymous' : 'loading') },
		'../../../apollo/store': { sessionVar: {} },
		'../../triplink/errors': { errorMessage: (error) => error.message },
	});
	const { TourSection } = load('libs/components/homepage/HomeSections.tsx', {
		...shared,
		'next/link': {
			__esModule: true,
			default: ({ children, href, passHref, ...props }) => React.createElement('a', { href, ...props }, children),
		},
		'next/router': { useRouter: () => ({ locale }) },
		'@apollo/client': {
			useQuery: (_, input) => {
				options = input;
				return query;
			},
		},
		'../../../apollo/user/triplink': { TOURS: 'tours', AGENTS: 'agents' },
		'../triplink/Common': common,
		'../triplink/TourFavorites': { useTourFavorites: () => favorites },
		'./FeaturedTourSwiper': { FeaturedTourSwiper: ({ items }) => React.createElement('div', { 'data-count': items.length, 'data-tour-swiper': true }, items.map(item => React.createElement(React.Fragment, { key: item.id }, item.content))) },
		'./IntroGallery': { IntroGallery: () => React.createElement('div', { 'data-inspiration': true }) },
		'./IntroCircularCarousel': {},
		'./IntroMedia': {},
		'./AgentsAtlas': {},
		'./HomeArticles': {},
		...Object.fromEntries(
			['FavoriteBorderRounded', 'FavoriteRounded', 'StarRounded', 'OpenInNewRounded'].map((name) => [
				`@mui/icons-material/${name}`,
				{ __esModule: true, default: () => null },
			]),
		),
	});
	const render = () => ctx.render(React.createElement(TourSection, { variant: 'featured' }));
	try {
		await render();
		assert.deepEqual(options.variables.input, { page: 1, limit: 6, search: { featured: true } });
		assert.equal(options.notifyOnNetworkStatusChange, true);
		assert.ok(document.querySelector('[data-tour-swiper]'));
		assert.ok(document.querySelector('[data-inspiration]'));
		assert.deepEqual(
			[...document.querySelectorAll('article h3 a')].map((node) => node.textContent),
			tours.map((tour) => tour.tourTitle),
		);
		assert.deepEqual(
			[...document.querySelectorAll('.triplink-home-tour__cta')].map((node) => node.getAttribute('href')),
			tours.map((tour) => `/tour/detail?id=${tour._id}`),
		);
		assert.equal(document.querySelector('.triplink-home-section__link').getAttribute('href'), '/tour');
		assert.equal(document.querySelector('.triplink-home-price s').textContent, '$1,200');
		assert.equal(document.querySelector('.triplink-home-price strong').textContent, '$900');
		assert.equal(document.querySelector('.triplink-home-tour__sold-out').textContent, t('Sold out'));
		const first = document.querySelector('article');
		assert.equal(first.querySelector('.triplink-home-tour__rating strong').textContent, '4.8');
		assert.match(first.querySelector('.triplink-home-tour__rating').textContent, /19 reviews/);
		assert.match(first.querySelector('.triplink-home-tour__metadata').textContent, /4 days.*Adventure.*3.1K views/);
		assert.ok(first.querySelector('[aria-label="3,142 views"]'));
		assert.equal(first.querySelector('.triplink-home-tour__description').textContent, tours[0].tourDescription);
		assert.match(first.querySelector('.triplink-home-tour__agent').textContent, /Patagonia Guide/);
		assert.equal(
			document.querySelectorAll('article')[1].querySelector('.triplink-home-tour__rating').textContent,
			t('No reviews yet'),
		);
		assert.equal(document.querySelectorAll('article img')[1].getAttribute('src'), '/img/tour-placeholder.svg');
		await act(async () => Simulate.error(document.querySelector('article img')));
		assert.equal(document.querySelector('article img').getAttribute('src'), '/img/tour-placeholder.svg');
		for (const length of [1, 2, 6]) {
			query = { ...query, data: { result: { list: tours.slice(0, length) } } };
			await render();
			assert.equal(document.querySelector('[data-count]').getAttribute('data-count'), String(length));
			assert.equal(document.querySelectorAll('article').length, length);
		}
		await act(async () => document.querySelector('.triplink-home-save').click());
		assert.deepEqual(toggles, [['tour-0', 7]]);
		favorites = { ...favorites, saved: new Set(['tour-0']), pending: new Set(['tour-0']) };
		await render();
		assert.equal(document.querySelector('.triplink-home-save').getAttribute('aria-pressed'), 'true');
		assert.equal(document.querySelector('.triplink-home-save').disabled, true);
		favorites = { ...favorites, pending: new Set(), errors: { 'tour-0': 'Try again' } };
		await render();
		assert.equal(document.querySelector('article [role="alert"]').textContent, 'Try again');
		favorites = { ...favorites, error: 'Saved tours unavailable', ready: false };
		await render();
		assert.equal(document.querySelector('.triplink-home-save').disabled, false);
		await act(async () => document.querySelector('.triplink-home-save').click());
		assert.equal(retries, 1);
		favorites = { ...favorites, anonymous: true };
		await render();
		assert.equal(document.querySelector('.triplink-home-save').getAttribute('href'), '/account/join');
		favorites = { ...favorites, anonymous: false, eligible: false };
		await render();
		assert.equal(document.querySelector('.triplink-home-save'), null);
		for (const language of ['kr', 'ru']) {
			locale = language;
			await render();
			assert.equal(document.querySelector('section').lang, language === 'kr' ? 'ko' : 'ru');
			assert.equal(
				document.querySelector('.triplink-home-section__statement').textContent,
				translations[language]['Make room for a memorable journey.'],
			);
			assert.equal(document.querySelector('.triplink-home-tour__cta').textContent, t('View tour'));
		}
		ready = false;
		await render();
		assert.equal(options.skip, true);
		assert.ok(document.querySelector('[role="status"]'));
		assert.equal(document.querySelector('article'), null);
		ready = true;
		query = { ...query, loading: true };
		await render();
		assert.ok(document.querySelector('[role="status"]'));
		query = { ...query, loading: false, error: new Error('Connection unavailable') };
		await render();
		assert.match(document.querySelector('[role="alert"]').textContent, /Connection unavailable/);
		await act(async () => document.querySelector('button').click());
		assert.equal(retries, 2);
		query = { ...query, error: undefined, data: { result: { list: [] } } };
		await render();
		assert.equal(document.querySelector('[role="alert"]').textContent, t('No results'));
		assert.ok(document.querySelector('[data-inspiration]'));
	} finally {
		await ctx.cleanup();
	}
});
