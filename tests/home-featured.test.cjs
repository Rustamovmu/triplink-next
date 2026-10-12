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
	)((name) => (name in mocks ? mocks[name] : require(name)), exports);
	return exports;
};

function environment({ reduced = false, observerAvailable = true } = {}) {
	const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', pretendToBeVisual: true });
	const keys = ['window', 'document', 'HTMLElement', 'getComputedStyle', 'IS_REACT_ACT_ENVIRONMENT'];
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

function galleryHarness(ctx) {
	let props, refresh;
	const engine = {
		realIndex: 0,
		destroyed: false,
		autoplay: {
			running: false,
			starts: 0,
			stops: 0,
			start() {
				this.running = true;
				this.starts++;
			},
			stop() {
				this.running = false;
				this.stops++;
			},
		},
		slideToLoop(index) {
			this.realIndex = (index + 10) % 10;
			props.onSlideChange(this);
			refresh();
		},
		slideNext() {
			this.slideToLoop(this.realIndex + 1);
		},
		slidePrev() {
			this.slideToLoop(this.realIndex - 1);
		},
	};
	function Swiper(input) {
		props = input;
		const initialize = React.useRef(input.onSwiper);
		const [, update] = React.useState(0);
		refresh = () => update((value) => value + 1);
		React.useEffect(() => {
			initialize.current(engine);
		}, []);
		return React.createElement(
			'div',
			{ className: 'swiper' },
			React.Children.map(input.children, (child, index) =>
				React.cloneElement(child, { active: index === engine.realIndex }),
			),
		);
	}
	const { IntroGallery } = load('libs/components/homepage/IntroGallery.tsx', {
		react: React,
		swiper: { Autoplay: {} },
		'swiper/react': {
			Swiper,
			SwiperSlide: ({ children, active }) =>
				React.createElement('div', { className: 'swiper-slide' }, children({ isActive: active })),
		},
		'next-i18next': {
			useTranslation: () => ({ t: (key, values) => (values ? key.replace('{{section}}', values.section) : key) }),
		},
	});
	return {
		engine,
		props: () => props,
		render: () => ctx.render(React.createElement(IntroGallery, { title: 'Featured tours' })),
	};
}

test('photo strip preserves ten destinations, loop settings, accessible focus, fallback, and no visible controls', async () => {
	const ctx = environment(),
		gallery = galleryHarness(ctx);
	try {
		await gallery.render();
		assert.deepEqual(
			[...document.querySelectorAll('figcaption')].map((node) => node.textContent),
			[
				'Iceland',
				'Sossusvlei',
				'Petra',
				'Patagonia',
				'Swiss Alps',
				'Santorini',
				'Cappadocia',
				'Dolomites',
				'Lofoten',
				'Bali',
			],
		);
		const props = gallery.props();
		assert.equal(props.loop, true);
		assert.equal(props.centeredSlides, true);
		assert.equal(props.loopedSlides, 3);
		assert.equal(props.slidesPerView, 'auto');
		assert.equal(props.speed, 650);
		assert.deepEqual(props.autoplay, { enabled: false, delay: 5000, disableOnInteraction: true });
		assert.equal(document.querySelector('[role="region"]').tabIndex, 0);
		assert.equal(document.querySelectorAll('button, a, [role="button"], .swiper-pagination').length, 0);
		assert.equal(document.querySelectorAll('figure[aria-hidden="false"]').length, 1);
		assert.equal(gallery.engine.autoplay.running, false);
		await ctx.visible(true);
		assert.equal(gallery.engine.autoplay.running, true);
		await act(async () => Simulate.error(document.querySelector('img')));
		assert.equal(document.querySelector('img').getAttribute('src'), '/img/tour-placeholder.svg');
	} finally {
		await ctx.cleanup();
	}
});

test('autoplay pauses for overlapping hover, focus, drag, hidden and offscreen states and resumes only after all clear', async () => {
	const ctx = environment(),
		gallery = galleryHarness(ctx);
	try {
		await gallery.render();
		await ctx.visible(true);
		const node = document.querySelector('[role="region"]'),
			autoplay = gallery.engine.autoplay;
		await act(async () => Simulate.pointerEnter(node, { pointerType: 'touch' }));
		assert.equal(autoplay.running, true);
		await act(async () => Simulate.pointerEnter(node, { pointerType: 'mouse' }));
		assert.equal(autoplay.running, false);
		await act(async () => node.focus());
		await act(async () => Simulate.pointerLeave(node));
		assert.equal(autoplay.running, false);
		assert.equal(document.querySelector('[role="status"]').getAttribute('aria-live'), 'polite');
		await act(async () => node.blur());
		assert.equal(autoplay.running, true);
		await act(async () => gallery.props().onTouchStart(gallery.engine));
		assert.equal(autoplay.running, false);
		await ctx.hidden(true);
		await act(async () => gallery.props().onTouchEnd());
		assert.equal(autoplay.running, false);
		await ctx.hidden(false);
		assert.equal(autoplay.running, true);
		await ctx.visible(false);
		assert.equal(autoplay.running, false);
		await ctx.visible(true);
		assert.equal(autoplay.running, true);
		await ctx.motion(true);
		assert.equal(autoplay.running, false);
		assert.equal(gallery.props().speed, 0);
		await ctx.motion(false);
		assert.equal(autoplay.running, true);
	} finally {
		await ctx.cleanup();
	}
	assert.equal(gallery.engine.autoplay.running, false);
	assert.equal(ctx.listeners.size, 0);
	assert.equal(ctx.observers[0].disconnected, true);
	assert.doesNotThrow(() => ctx.observers[0].callback([{ isIntersecting: true }]));
});

test('focused keyboard navigation supports loop boundaries and Home/End without taking other keys', async () => {
	const ctx = environment({ reduced: true }),
		gallery = galleryHarness(ctx);
	try {
		await gallery.render();
		await ctx.visible(true);
		const node = document.querySelector('[role="region"]');
		await act(async () => node.focus());
		async function key(value, options = {}) {
			const event = new window.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...options });
			await act(async () => node.dispatchEvent(event));
			return event.defaultPrevented;
		}
		assert.equal(await key('ArrowLeft'), true);
		assert.equal(gallery.engine.realIndex, 9);
		await key('ArrowRight');
		assert.equal(gallery.engine.realIndex, 0);
		await key('End');
		assert.equal(gallery.engine.realIndex, 9);
		await key('Home');
		assert.equal(gallery.engine.realIndex, 0);
		assert.equal(await key('ArrowRight', { ctrlKey: true }), false);
		assert.equal(await key('Tab'), false);
		assert.equal(document.activeElement, node);
		assert.equal(gallery.engine.autoplay.running, false);
		assert.equal(gallery.props().speed, 0);
	} finally {
		await ctx.cleanup();
	}
});

test('unavailable visibility observer still permits autoplay and visibility listener is removed on unmount', async () => {
	const ctx = environment({ observerAvailable: false }),
		gallery = galleryHarness(ctx);
	const removals = [],
		originalRemove = document.removeEventListener.bind(document);
	document.removeEventListener = (name, callback) => {
		removals.push(name);
		originalRemove(name, callback);
	};
	await gallery.render();
	assert.equal(gallery.engine.autoplay.running, true);
	await ctx.cleanup();
	assert.ok(removals.includes('visibilitychange'));
	assert.equal(gallery.engine.autoplay.running, false);
});

test('installed Swiper advances after five seconds, loops in both directions and cleans its timers after interaction pauses', async (t) => {
	const ctx = environment();
	t.mock.timers.enable({ apis: ['setTimeout'] });
	let engine;
	const actual = require('swiper/react');
	// JSDOM retains translate3d strings instead of browser-computed transform matrices.
	ctx.dom.window.WebKitCSSMatrix = class {
		constructor(transform) {
			const values = transform.match(/translate3d\(([-\d.]+)px, ([-\d.]+)px/);
			this.m41 = values ? Number(values[1]) : 0;
			this.m42 = values ? Number(values[2]) : 0;
		}
	};
	const { IntroGallery } = load('libs/components/homepage/IntroGallery.tsx', {
		react: React,
		'swiper/react': {
			...actual,
			Swiper: (props) =>
				React.createElement(actual.Swiper, {
					...props,
					width: 1000,
					onSwiper: (instance) => {
						engine = instance;
						props.onSwiper(instance);
					},
				}),
		},
		'next-i18next': { useTranslation: () => ({ t: (key) => key }) },
	});
	const style = document.createElement('style');
	style.textContent = '.swiper-slide { width:580px; box-sizing:border-box; padding:0; margin:0; border:0; }';
	document.head.appendChild(style);
	const advance = (milliseconds) => act(async () => t.mock.timers.tick(milliseconds));
	const finish = () =>
		act(async () =>
			document.querySelector('.swiper-wrapper').dispatchEvent(new window.Event('transitionend', { bubbles: true })),
		);
	try {
		await ctx.render(React.createElement(IntroGallery, { title: 'Featured tours' }));
		await ctx.visible(true);
		assert.equal(engine.realIndex, 0);
		assert.equal(engine.autoplay.running, true);
		await advance(4999);
		assert.equal(engine.realIndex, 0);
		await advance(1);
		assert.equal(engine.realIndex, 1);
		assert.equal(engine.params.speed, 650);
		// Hide while a transition is paused: showing the tab must start a fresh cycle.
		await ctx.hidden(true);
		await finish();
		await advance(10000);
		assert.equal(engine.realIndex, 1);
		await ctx.hidden(false);
		await advance(5000);
		assert.equal(engine.realIndex, 2);
		await finish();
		const node = document.querySelector('[role="region"]');
		await act(async () => node.focus());
		await advance(10000);
		assert.equal(engine.realIndex, 2);
		await act(async () => node.blur());
		for (let next = 3; next <= 10; next++) {
			await advance(5000);
			assert.equal(engine.realIndex, next % 10);
			await finish();
		}
		await ctx.motion(true);
		await act(async () => engine.slidePrev());
		assert.equal(engine.realIndex, 9);
		await act(async () => engine.slideNext());
		assert.equal(engine.realIndex, 0);
		await act(async () => engine.slideToLoop(9));
		assert.equal(engine.realIndex, 9);
		await act(async () => engine.slideToLoop(0));
		assert.equal(engine.realIndex, 0);
		await advance(10000);
		assert.equal(engine.realIndex, 0);
	} finally {
		await ctx.cleanup();
		t.mock.timers.tick(10000);
		t.mock.timers.reset();
	}
	assert.equal(engine.destroyed, true);
	assert.equal(ctx.listeners.size, 0);
	assert.equal(ctx.observers[0].disconnected, true);
});

test('featured tour query, one/two/six result layouts, links, translations, prices and image failures remain intact', async () => {
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
