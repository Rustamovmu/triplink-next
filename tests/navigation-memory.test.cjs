const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { JSDOM } = require('jsdom');
const { createRoot, hydrateRoot } = require('react-dom/client');
const { renderToString } = require('react-dom/server');
const { act, Simulate } = require('react-dom/test-utils');
const loadMemory = require('./helpers/browsing-memory.cjs');
const store = {};
new Function(
	'exports',
	ts.transpileModule(fs.readFileSync('libs/triplink/browsingMemoryStore.ts', 'utf8'), {
		compilerOptions: { module: 1 },
	}).outputText,
)(store);
const { NavigationMemory, browsingRoute, capturePosition, restorePosition, ENTRY_KEY, MEMORY_KEY, MEMORY_TTL } = store;

function environment() {
	const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost:3000', pretendToBeVisual: true });
	const names = [
		'window',
		'document',
		'Node',
		'Element',
		'HTMLElement',
		'MutationObserver',
		'ResizeObserver',
		'IS_REACT_ACT_ENVIRONMENT',
	];
	const previous = Object.fromEntries(names.map((name) => [name, Object.getOwnPropertyDescriptor(global, name)]));
	const frames = new Map(),
		timers = new Map(),
		observers = [];
	let sequence = 0,
		top = 0,
		height = 8000;
	class Resize {
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
	}
	Object.assign(global, {
		window: dom.window,
		document: dom.window.document,
		Node: dom.window.Node,
		Element: dom.window.Element,
		HTMLElement: dom.window.HTMLElement,
		MutationObserver: dom.window.MutationObserver,
		ResizeObserver: Resize,
		IS_REACT_ACT_ENVIRONMENT: true,
	});
	Object.defineProperty(window, 'scrollY', { get: () => top });
	Object.defineProperty(document.documentElement, 'scrollHeight', { get: () => height });
	Object.defineProperty(document.documentElement, 'scrollWidth', { get: () => window.innerWidth });
	window.scrollTo = (...args) => {
		top = typeof args[0] === 'object' ? args[0].top ?? top : args[1];
	};
	window.history.scrollRestoration = 'auto';
	window.requestAnimationFrame = (callback) => {
		frames.set(++sequence, callback);
		return sequence;
	};
	window.cancelAnimationFrame = (id) => frames.delete(id);
	window.setTimeout = (callback, delay) => {
		timers.set(++sequence, { callback, delay });
		return sequence;
	};
	window.clearTimeout = (id) => timers.delete(id);
	dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
		const y = this.matches('.triplink-top') ? 0 : Number(this.dataset.top ?? 0) - top;
		const size = this.matches('.triplink-top') ? 89 : Number(this.dataset.height ?? 400);
		return { top: y, bottom: y + size, height: size, width: 500, left: 0, right: 500 };
	};
	return {
		dom,
		frames,
		timers,
		observers,
		top: () => top,
		setTop: (value) => {
			top = value;
		},
		setHeight: (value) => {
			height = value;
		},
		flush: async () =>
			act(async () => {
				await Promise.resolve();
				const queued = Array.from(frames.values());
				frames.clear();
				queued.forEach((callback) => callback());
			}),
		settle: async () =>
			act(async () => {
				const ready = Array.from(timers.entries()).filter(([, timer]) => timer.delay === 150);
				ready.forEach(([id, timer]) => {
					timers.delete(id);
					timer.callback();
				});
			}),
		close: () => {
			dom.window.close();
			for (const [name, descriptor] of Object.entries(previous)) {
				if (descriptor) Object.defineProperty(global, name, descriptor);
				else delete global[name];
			}
		},
	};
}
function sample(memory, y = 2450) {
	return {
		...memory.active,
		ui: { ...memory.active.ui },
		y,
		item: { key: 'rated:tour:one', offset: 200 },
		section: { key: 'home:rated', offset: -100 },
	};
}

test('route identity preserves filters, repeated query values and locale without including hashes', () => {
	assert.deepEqual(browsingRoute('/kr/tour?sort=rating&page=2&category=CITY#results'), {
		route: '/tour?category=CITY&page=2&sort=rating',
		locale: 'kr',
		supported: true,
	});
	assert.equal(browsingRoute('/tour?category=CITY&category=BEACH').route, '/tour?category=CITY&category=BEACH');
	assert.equal(browsingRoute('/mypage').supported, false);
});
test('history visits retain independent UI and scroll state, and explicit returns copy without reusing identities', () => {
	const memory = new NavigationMemory('/');
	const home = sample(memory);
	memory.active = home;
	memory.commit();
	memory.begin('/tour/detail?id=one', 'en');
	memory.commit();
	assert.equal(memory.active.source, home.id);
	assert.equal(memory.active.home, home.id);
	const detail = sample(memory, 600);
	memory.active = detail;
	memory.commit();
	memory.begin('/', 'en', home);
	memory.commit();
	assert.notEqual(memory.active.id, home.id);
	assert.equal(memory.active.y, 2450);
	memory.active.ui['home:season'] = 'Winter';
	assert.equal(home.ui['home:season'], undefined);
	memory.begin(detail.route, 'en', detail, true);
	memory.commit();
	assert.equal(memory.active.id, detail.id);
	assert.equal(memory.active.y, 600);
});
test('unrelated pages and language changes break explicit homepage return context', () => {
	const memory = new NavigationMemory('/');
	memory.commit();
	memory.begin('/tour', 'en');
	memory.commit();
	assert.ok(memory.active.home);
	memory.begin('/about', 'en');
	memory.commit();
	assert.equal(memory.active.home, undefined);
	memory.begin('/tour/detail?id=one', 'en');
	memory.commit();
	assert.equal(memory.active.home, undefined);
	memory.begin('/', 'en');
	memory.commit();
	memory.begin('/kr/tour', 'en');
	memory.commit();
	assert.equal(memory.active.home, undefined);
});
test('storage expires, caps, rejects corrupt/private data and gracefully tolerates denied access', () => {
	const ctx = environment();
	try {
		const memory = new NavigationMemory('/');
		for (let i = 0; i < 55; i++) {
			memory.begin(`/tour?page=${i + 1}`, 'en');
			memory.commit();
		}
		assert.equal(memory.entries.size, 50);
		memory.active.time -= MEMORY_TTL + 1;
		assert.equal(memory.get(memory.active.id), undefined);
		memory.persist(window.sessionStorage);
		const loaded = new NavigationMemory('/');
		loaded.load(window.sessionStorage);
		assert.equal(loaded.entries.size, 49);
		window.sessionStorage.setItem(
			MEMORY_KEY,
			JSON.stringify({
				version: 1,
				entries: [{ ...memory.active, route: '/account/join', time: Date.now(), ui: { password: 'must-not-load' } }],
			}),
		);
		loaded.entries.clear();
		loaded.load(window.sessionStorage);
		assert.equal(loaded.entries.size, 0);
		window.sessionStorage.setItem(MEMORY_KEY, '{');
		loaded.load(window.sessionStorage);
		assert.doesNotThrow(() =>
			loaded.load({
				getItem() {
					throw Error('denied');
				},
			}),
		);
		assert.doesNotThrow(() =>
			loaded.persist({
				setItem() {
					throw Error('quota');
				},
			}),
		);
	} finally {
		ctx.close();
	}
});
test('capture prefers the clicked item within its own section over another occurrence of the same tour', () => {
	const ctx = environment();
	try {
		document.getElementById('root').innerHTML =
			'<header class="triplink-top"></header><section data-browse-section="home:featured"><article data-browse-item="featured:tour:one" data-top="2600"><a>first</a></article></section><section data-browse-section="home:rated" data-top="2700"><article data-browse-item="rated:tour:one" data-top="3000"><a id="chosen">second</a></article></section>';
		ctx.setTop(2800);
		const entry = new NavigationMemory('/').active;
		capturePosition(entry, document.getElementById('root'), document.getElementById('chosen'));
		assert.deepEqual(entry.item, { key: 'rated:tour:one', offset: 200 });
		assert.equal(entry.section.key, 'home:rated');
	} finally {
		ctx.close();
	}
});
test('saving a restored page retains its visible source card instead of switching to a clipped row above it', () => {
	const ctx = environment();
	try {
		const root = document.getElementById('root');
		root.innerHTML =
			'<header class="triplink-top"></header><section data-browse-section="home:rated"><article data-browse-item="rated:tour:earlier" data-top="2650"></article><article data-browse-item="rated:tour:one" data-top="3000"></article></section>';
		ctx.setTop(2800);
		const entry = sample(new NavigationMemory('/'));
		capturePosition(entry, root);
		assert.deepEqual(entry.item, { key: 'rated:tour:one', offset: 200 });
		const cancel = restorePosition(entry, root, () => {});
		assert.equal(ctx.top(), 2800);
		cancel();
		entry.item = { key: 'rated:tour:earlier', offset: -150 };
		const cancelPartial = restorePosition(entry, root, () => {});
		assert.equal(ctx.top(), 2800);
		cancelPartial();
	} finally {
		ctx.close();
	}
});
test('restoration waits for earlier content, follows layout changes and releases scroll ownership once stable', async () => {
	const ctx = environment();
	try {
		const root = document.getElementById('root');
		root.innerHTML =
			'<header class="triplink-top"></header><div data-browse-pending="true"></div><section data-browse-section="home:rated" data-top="1200"></section>';
		const entry = sample(new NavigationMemory('/'));
		let complete = 0;
		restorePosition(entry, root, () => complete++);
		assert.equal(ctx.top(), 0);
		root.querySelector('[data-browse-pending]').remove();
		root.querySelector('section').innerHTML = '<article data-browse-item="rated:tour:one" data-top="3000"></article>';
		await ctx.flush();
		assert.equal(ctx.top(), 2800);
		root.querySelector('article').dataset.top = '3400';
		ctx.observers[0].callback([]);
		await ctx.flush();
		assert.equal(ctx.top(), 3200);
		await ctx.settle();
		assert.equal(complete, 1);
		assert.equal(window.history.scrollRestoration, 'auto');
		assert.equal(ctx.observers[0].disconnected, true);
		assert.equal(ctx.timers.size, 0);
	} finally {
		ctx.close();
	}
});
test('missing items fall back to section then scroll coordinates, and shortened pages clamp safely', async () => {
	const ctx = environment();
	try {
		const root = document.getElementById('root');
		root.innerHTML = '<section data-browse-section="home:rated" data-top="3000"></section>';
		const entry = sample(new NavigationMemory('/'));
		entry.section.offset = 200;
		let cancel = restorePosition(entry, root, () => {});
		assert.equal(ctx.top(), 2800);
		cancel();
		root.innerHTML = '';
		ctx.setHeight(1500);
		cancel = restorePosition(entry, root, () => {});
		assert.equal(ctx.top(), 1500 - window.innerHeight);
		cancel();
	} finally {
		ctx.close();
	}
});
test('wheel, touch, pointer and scroll keys cancel correction and every queued callback', async () => {
	for (const [event, properties] of [
		['wheel', {}],
		['touchstart', {}],
		['pointerdown', {}],
		['keydown', { key: 'PageDown' }],
	]) {
		const ctx = environment();
		try {
			const root = document.getElementById('root');
			root.innerHTML = '<div data-browse-pending="true"></div>';
			let complete = 0;
			restorePosition(sample(new NavigationMemory('/')), root, () => complete++);
			window.dispatchEvent(event === 'keydown' ? new window.KeyboardEvent(event, properties) : new window.Event(event));
			ctx.setTop(77);
			root.innerHTML = '<article data-browse-item="rated:tour:one" data-top="3000"></article>';
			await ctx.flush();
			ctx.observers[0].callback([]);
			await ctx.flush();
			assert.equal(ctx.top(), 77);
			assert.equal(complete, 1);
			assert.equal(ctx.timers.size, 0);
			assert.equal(ctx.frames.size, 0);
		} finally {
			ctx.close();
		}
	}
});
test('five-second deadline bounds a stalled query without leaving observers or listeners', () => {
	const ctx = environment();
	try {
		const root = document.getElementById('root');
		root.innerHTML = '<div data-browse-pending="true"></div>';
		let complete = 0;
		restorePosition(sample(new NavigationMemory('/')), root, () => complete++);
		Array.from(ctx.timers.values())
			.find((timer) => timer.delay === 5000)
			.callback();
		assert.equal(complete, 1);
		assert.equal(ctx.top(), 2450);
		assert.equal(ctx.observers[0].disconnected, true);
	} finally {
		ctx.close();
	}
});

function application(ctx, { strict = false, persisted, navigationType } = {}) {
	const callbacks = new Map();
	let beforePop = () => true,
		backCalls = 0,
		root,
		memoryModule;
	const events = {
		on(name, cb) {
			const set = callbacks.get(name) ?? new Set();
			set.add(cb);
			callbacks.set(name, set);
		},
		off(name, cb) {
			callbacks.get(name)?.delete(cb);
		},
		emit(name, ...args) {
			callbacks.get(name)?.forEach((cb) => cb(...args));
		},
	};
	let router = {
		asPath: '/',
		pathname: '/',
		locale: 'en',
		isReady: true,
		events,
		beforePopState(cb) {
			beforePop = cb;
		},
		push: (url, _, options = {}) => navigate(url, options),
		back: () => {
			backCalls++;
		},
	};
	window.history.replaceState(
		{ __N: true, key: 'next-original', options: { locale: 'en' }, ...(persisted ? { [ENTRY_KEY]: persisted.id } : {}) },
		'',
	);
	if (persisted)
		window.sessionStorage.setItem(
			MEMORY_KEY,
			JSON.stringify({ version: 1, active: persisted.id, entries: [persisted] }),
		);
	const originalPerformance = global.performance;
	if (navigationType) global.performance = { getEntriesByType: () => [{ type: navigationType }] };
	memoryModule = loadMemory({
		'next/router': { useRouter: () => router },
		'next-i18next': { useTranslation: () => ({ t: (value) => value }) },
		'next/link': {
			__esModule: true,
			default: ({ href, children, onClick, className }) =>
				React.createElement('a', { href, onClick, className }, children),
		},
	});
	function Page() {
		const [season, setSeason] = memoryModule.useRememberedState('home:season', 'All seasons');
		const home = memoryModule.useHomeNavigation();
		if (ctx.body) return ctx.body(router, memoryModule);
		return React.createElement(
			React.Fragment,
			null,
			React.createElement(
				'header',
				{ className: 'triplink-top' },
				React.createElement('a', { href: '/', id: 'home', onClick: home }, 'Home'),
			),
			router.pathname === '/'
				? React.createElement(
						'section',
						{ 'data-browse-section': 'home:rated', 'data-top': 2500 },
						React.createElement('button', { id: 'season', onClick: () => setSeason('Winter') }, season),
						React.createElement(
							'article',
							{ 'data-browse-item': 'rated:tour:one', 'data-top': 3000 },
							React.createElement('a', { href: '/tour/detail?id=one', id: 'tour' }, 'Tour'),
						),
				  )
				: React.createElement(memoryModule.BrowsingBackLink, { fallback: '/tour', className: 'back' }, 'Back to tours'),
		);
	}
	const tree = () =>
		React.createElement(
			strict ? React.StrictMode : React.Fragment,
			null,
			React.createElement(
				memoryModule.NavigationMemoryProvider,
				null,
				React.createElement(Page, { key: router.pathname }),
			),
		);
	const render = async () =>
		act(async () => {
			root.render(tree());
		});
	async function navigate(url, options = {}, state) {
		if (state) {
			window.history.replaceState(state, '', url);
			const nextState = { as: url, options: { ...state.options } };
			beforePop(nextState);
			options = nextState.options;
		}
		events.emit('routeChangeStart', url);
		if (!state)
			window.history.pushState({ __N: true, key: 'next-' + window.history.length, options: { ...options } }, '', url);
		const destination = browsingRoute(url, options.locale ?? router.locale);
		router = {
			...router,
			asPath: destination.route,
			pathname: destination.route.split('?')[0],
			locale: destination.locale,
		};
		if (options.scroll !== false) window.scrollTo({ top: 0 });
		ctx.beforeCommit?.();
		await render();
		events.emit('routeChangeComplete', url);
		return true;
	}
	return {
		callbacks,
		module: memoryModule,
		tree,
		navigate,
		render,
		backCalls: () => backCalls,
		emit: (name, ...args) => events.emit(name, ...args),
		mount: async () => {
			root = createRoot(document.getElementById('root'));
			await render();
		},
		hydrate: async (markup) =>
			act(async () => {
				document.getElementById('root').innerHTML = markup;
				root = hydrateRoot(document.getElementById('root'), tree());
			}),
		click: (selector, extra = {}) =>
			act(async () => Simulate.click(document.querySelector(selector), { button: 0, ...extra })),
		close: async () => {
			await act(async () => root?.unmount());
			global.performance = originalPerformance;
		},
	};
}
test('provider coordinates browser Back/Forward, remembered state, Home, repeat Home and explicit Back without extra history entries', async () => {
	const ctx = environment(),
		app = application(ctx);
	try {
		await app.mount();
		const homeState = { ...window.history.state };
		assert.equal(homeState.key, 'next-original');
		await app.click('#season');
		ctx.setTop(2800);
		await app.navigate('/tour/detail?id=one');
		const detailState = { ...window.history.state };
		ctx.setTop(500);
		assert.equal(document.querySelector('.back').textContent, 'Back to home');
		await app.click('.back');
		assert.equal(app.backCalls(), 1);
		await app.navigate('/', {}, homeState);
		await ctx.flush();
		await ctx.settle();
		assert.equal(ctx.top(), 2800);
		assert.equal(document.querySelector('#season').textContent, 'Winter');
		await app.navigate('/tour/detail?id=one', {}, detailState);
		await ctx.flush();
		await ctx.settle();
		assert.equal(ctx.top(), 500);
		const length = window.history.length;
		await app.click('#home');
		await ctx.flush();
		await ctx.settle();
		assert.equal(window.history.length, length + 1, 'one normal Home navigation, no restoration-only entry');
		assert.equal(ctx.top(), 2800);
		await app.click('#home');
		assert.equal(ctx.top(), 0);
	} finally {
		await app.close();
		ctx.close();
	}
});
test('fresh tabs ignore copied storage, while reload restores controls without overriding native scroll', async () => {
	for (const type of ['navigate', 'reload']) {
		const ctx = environment();
		const entry = sample(new NavigationMemory('/'));
		entry.ui['home:season'] = 'Winter';
		const app = application(ctx, { persisted: entry, navigationType: type });
		try {
			ctx.setTop(900);
			await app.mount();
			assert.equal(ctx.top(), 900);
			assert.equal(document.querySelector('#season').textContent, type === 'reload' ? 'Winter' : 'All seasons');
		} finally {
			await app.close();
			ctx.close();
		}
	}
});
test('reload restores controls even when Next replaces the history field during document initialization', async () => {
	const ctx = environment();
	const entry = sample(new NavigationMemory('/'));
	entry.ui['home:season'] = 'Winter';
	const app = application(ctx, { persisted: entry, navigationType: 'reload' });
	try {
		window.history.replaceState({ __N: true, key: 'new-next-key', options: {} }, '');
		ctx.setTop(900);
		await app.mount();
		assert.equal(document.querySelector('#season').textContent, 'Winter');
		assert.equal(ctx.top(), 900);
		assert.equal(window.history.state.key, 'new-next-key');
	} finally {
		await app.close();
		ctx.close();
	}
});
test('a cancelled older route cannot discard a newer return restoration', async () => {
	const ctx = environment(),
		app = application(ctx);
	try {
		await app.mount();
		ctx.setTop(2800);
		await app.navigate('/tour/detail?id=one');
		ctx.beforeCommit = () => app.emit('routeChangeError', Error('cancelled old route'), '/tour/detail?id=older');
		await app.click('#home');
		await ctx.flush();
		await ctx.settle();
		assert.equal(ctx.top(), 2800);
		assert.equal(ctx.timers.size, 0);
	} finally {
		await app.close();
		ctx.close();
	}
});
test('Back to the default language restores the correct entry even when the visible asPath is unchanged', async () => {
	const ctx = environment(),
		app = application(ctx);
	try {
		await app.mount();
		await app.click('#season');
		const english = { ...window.history.state };
		ctx.setTop(2800);
		await app.navigate('/kr', { locale: 'kr' });
		ctx.setTop(1800);
		await app.navigate('/', {}, english);
		await ctx.flush();
		await ctx.settle();
		assert.equal(ctx.top(), 2800);
		assert.equal(document.querySelector('#season').textContent, 'Winter');
	} finally {
		await app.close();
		ctx.close();
	}
});
test('section-only browsing preserves an intentionally scrolled hero instead of forcing the section to its top', () => {
	const ctx = environment();
	try {
		const root = document.getElementById('root');
		root.innerHTML =
			'<header class="triplink-top"></header><section data-browse-section="home:hero" data-height="768" data-top="0"></section>';
		ctx.setTop(180);
		const entry = new NavigationMemory('/').active;
		capturePosition(entry, root);
		assert.equal(entry.item, undefined);
		ctx.setTop(0);
		const cancel = restorePosition(entry, root, () => {});
		assert.equal(ctx.top(), 180);
		cancel();
	} finally {
		ctx.close();
	}
});
test('Strict Mode cleans routing, correction and page lifecycle subscriptions on unmount', async () => {
	const ctx = environment(),
		app = application(ctx, { strict: true });
	try {
		await app.mount();
		assert.equal(app.callbacks.get('routeChangeStart').size, 1);
		ctx.setTop(2800);
		await app.navigate('/tour/detail?id=one');
		await app.click('#home');
		await app.close();
		assert.equal(app.callbacks.get('routeChangeStart').size, 0);
		assert.equal(ctx.timers.size, 0);
		assert.equal(ctx.frames.size, 0);
	} finally {
		ctx.close();
	}
});
test('hydration begins with the same default controls and then restores reload state without mismatch', async () => {
	const ctx = environment();
	const entry = sample(new NavigationMemory('/'));
	entry.ui['home:season'] = 'Winter';
	const app = application(ctx, { persisted: entry, navigationType: 'reload' });
	const errors = [];
	const original = console.error;
	console.error = (...args) => errors.push(args.join(' '));
	try {
		const markup = renderToString(app.tree());
		await app.hydrate(markup);
		assert.equal(document.querySelector('#season').textContent, 'Winter');
		assert.equal(
			errors.some((message) => /did not match|hydration failed|server HTML/i.test(message)),
			false,
		);
	} finally {
		console.error = original;
		await app.close();
		ctx.close();
	}
});
test('the real agent directory restores search and pagination before constructing query variables', async () => {
	const ctx = environment(),
		app = application(ctx),
		queries = [];
	const box = ({ children, ...props }) => React.createElement('div', { className: props.className }, children);
	const mocks = {
		react: React,
		'../../triplink/BrowsingMemoryProvider': app.module,
		'next-i18next': { useTranslation: () => ({ t: (value) => value }) },
		'next/link': {
			__esModule: true,
			default: ({ children, href, className }) => React.createElement('a', { href, className }, children),
		},
		'next/router': {},
		'@apollo/client': {
			useQuery: (_, options) => {
				queries.push(options.variables.input);
				return { data: { result: { list: [] } }, loading: false };
			},
			useReactiveVar: () => null,
			useMutation: () => [() => {}],
		},
		'@mui/material': { Avatar: box, Button: box, Stack: box, Typography: box },
		'../../../apollo/user/triplink': {},
		'../../../apollo/store': {},
		'../../types/triplink': { totalOf: () => 30 },
		'./Common': {
			usePublicReady: () => true,
			useAction: () => ({}),
			QueryState: box,
			Pager: ({ onChange }) => React.createElement('button', { id: 'page2', onClick: () => onChange(2) }, 'Page 2'),
		},
		'./Tours': {},
		'./Members': {},
		'./Community': {},
		'../../auth': {},
	};
	const exported = {};
	new Function(
		'require',
		'exports',
		ts.transpileModule(fs.readFileSync('libs/components/triplink/Profiles.tsx', 'utf8'), {
			compilerOptions: { module: 1, jsx: 2, esModuleInterop: true },
		}).outputText,
	)((name) => {
		if (name.startsWith('@mui/icons-material/')) return { __esModule: true, default: () => null };
		if (!(name in mocks)) throw Error(`Missing ${name}`);
		return mocks[name];
	}, exported);
	ctx.body = (router) =>
		router.pathname === '/agent'
			? React.createElement(exported.AgentDirectory)
			: React.createElement('div', null, 'Detail');
	try {
		await app.mount();
		await app.navigate('/agent');
		await act(async () =>
			Simulate.change(document.querySelector('input[type="search"]'), { target: { value: 'Angel' } }),
		);
		await app.click('#page2');
		const state = { ...window.history.state };
		await app.navigate('/agent/detail?agentId=one');
		queries.length = 0;
		await app.navigate('/agent', {}, state);
		assert.equal(document.querySelector('input').value, 'Angel');
		assert.ok(queries.length > 0);
		assert.ok(queries.every((query) => query.page === 2 && query.search.text === 'Angel'));
	} finally {
		await app.close();
		ctx.close();
	}
});
test('a return interrupted before the destination commits never starts a later correction', async () => {
	const ctx = environment(),
		app = application(ctx);
	try {
		await app.mount();
		ctx.setTop(2800);
		await app.navigate('/tour/detail?id=one');
		// Start a valid Home return, then wheel before its React commit.
		const originalRoot = document.querySelector('[data-browse-root]');
		ctx.beforeCommit = () => {
			window.dispatchEvent(new window.Event('wheel'));
			ctx.setTop(77);
		};
		await app.click('#home');
		await ctx.flush();
		assert.equal(document.querySelector('[data-browse-root]'), originalRoot);
		assert.equal(ctx.top(), 77);
		assert.equal(ctx.timers.size, 0);
	} finally {
		await app.close();
		ctx.close();
	}
});
