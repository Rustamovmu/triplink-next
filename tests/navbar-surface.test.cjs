const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { JSDOM } = require('jsdom');
const { createRoot } = require('react-dom/client');
const { renderToString } = require('react-dom/server');
const { act } = require('react-dom/test-utils');

function loadHook() {
	const exports = {};
	new Function(
		'require',
		'exports',
		ts.transpileModule(fs.readFileSync('libs/hooks/useNavbarSurface.ts', 'utf8'), {
			compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
		}).outputText,
	)(require, exports);
	return exports.default;
}

function environment({ observerAvailable = true, hero = { top: 0, bottom: 420 }, height = 89 } = {}) {
	const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/agent' });
	const keys = ['window', 'document', 'MutationObserver', 'IntersectionObserver', 'ResizeObserver', 'IS_REACT_ACT_ENVIRONMENT'];
	const saved = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(global, key)]));
	const intersections = [], sizes = [], frames = new Map(), listeners = new Map();
	let frameId = 0;
	const geometry = { hero, height };
	class Intersection {
		constructor(callback, options) {
			this.callback = callback;
			this.options = options;
			intersections.push(this);
		}
		observe(target) { this.target = target; }
		disconnect() { this.disconnected = true; }
	}
	class Resize {
		constructor(callback) { this.callback = callback; sizes.push(this); }
		observe(target) { this.target = target; }
		disconnect() { this.disconnected = true; }
	}
	Object.assign(global, {
		window: dom.window,
		document: dom.window.document,
		MutationObserver: dom.window.MutationObserver,
		IntersectionObserver: observerAvailable ? Intersection : undefined,
		ResizeObserver: Resize,
		IS_REACT_ACT_ENVIRONMENT: true,
	});
	const originalRect = dom.window.HTMLElement.prototype.getBoundingClientRect;
	dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
		if (this.tagName === 'HEADER') return { top: 0, bottom: geometry.height, height: geometry.height };
		if (this.hasAttribute('data-triplink-nav-hero')) return geometry.hero;
		return originalRect.call(this);
	};
	const addListener = dom.window.addEventListener.bind(dom.window);
	const removeListener = dom.window.removeEventListener.bind(dom.window);
	dom.window.addEventListener = (name, callback, options) => {
		if (!listeners.has(name)) listeners.set(name, new Set());
		listeners.get(name).add(callback);
		addListener(name, callback, options);
	};
	dom.window.removeEventListener = (name, callback, options) => {
		listeners.get(name)?.delete(callback);
		removeListener(name, callback, options);
	};
	dom.window.requestAnimationFrame = (callback) => { frames.set(++frameId, callback); return frameId; };
	dom.window.cancelAnimationFrame = (id) => frames.delete(id);
	const useNavbarSurface = loadHook();
	const modes = [];
	function Page({ route = '/agent', hasHero = true, heroKey = 'hero' }) {
		const { ref, mode } = useNavbarSurface(route);
		modes.push(mode);
		return React.createElement('div', { id: 'pc-wrap' },
			React.createElement('header', { ref, 'data-surface': mode }),
			React.createElement('main', null, hasHero && React.createElement('section', {
				key: heroKey, 'data-triplink-nav-hero': '', 'data-key': heroKey,
			})),
		);
	}
	const root = createRoot(document.getElementById('root'));
	return {
		geometry, intersections, sizes, frames, listeners, modes,
		mode: () => document.querySelector('header').dataset.surface,
		wrapper: () => document.getElementById('pc-wrap'),
		render: (props = {}) => act(async () => root.render(React.createElement(Page, props))),
		fireIntersection: (observer = intersections.at(-1)) => act(async () => observer.callback([])),
		fireResize: () => act(async () => sizes.at(-1).callback([])),
		event: (name) => act(async () => dom.window.dispatchEvent(new dom.window.Event(name))),
		mutate: (callback) => act(async () => { callback(); await Promise.resolve(); }),
		flushFrames: () => act(async () => {
			const pending = [...frames.values()];
			frames.clear();
			pending.forEach((callback) => callback());
		}),
		unmount: () => act(async () => root.unmount()),
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

test('server markup exposes automatic surface selection before browser geometry is available', () => {
	const useNavbarSurface = loadHook();
	function Navbar() {
		const { ref, mode } = useNavbarSurface('/agent');
		return React.createElement('header', { ref, 'data-surface': mode });
	}
	assert.match(renderToString(React.createElement(Navbar)), /data-surface="auto"/);
});

test('hero lower edge controls glass and restores clear mode when scrolling upward', async () => {
	const ctx = environment();
	try {
		await ctx.render();
		assert.equal(ctx.mode(), 'clear');
		assert.equal(ctx.wrapper().style.getPropertyValue('--triplink-nav-height'), '89px');
		assert.equal(ctx.intersections.at(-1).target, document.querySelector('[data-triplink-nav-hero]'));
		assert.equal(ctx.listeners.get('scroll')?.size ?? 0, 0, 'IntersectionObserver avoids scroll listeners');
		ctx.geometry.hero = { top: -200, bottom: 220 };
		await ctx.fireIntersection();
		assert.equal(ctx.mode(), 'clear', 'scrolling inside a hero must keep its transparent surface');
		ctx.geometry.hero = { top: -331, bottom: 89 };
		await ctx.fireIntersection();
		assert.equal(ctx.mode(), 'glass', 'hero ending at the navbar lower edge switches to glass');
		ctx.geometry.hero = { top: -330, bottom: 90 };
		await ctx.fireIntersection();
		assert.equal(ctx.mode(), 'clear');
	} finally { await ctx.cleanup(); }
});

test('pages without heroes default to glass and observe heroes inserted or removed by access states', async () => {
	const ctx = environment();
	try {
		await ctx.render({ hasHero: false });
		assert.equal(ctx.mode(), 'glass');
		assert.equal(ctx.intersections.length, 0);
		await ctx.mutate(() => {
			const hero = document.createElement('section');
			hero.setAttribute('data-triplink-nav-hero', '');
			document.querySelector('main').appendChild(hero);
		});
		assert.equal(ctx.mode(), 'clear');
		const observer = ctx.intersections.at(-1);
		await ctx.mutate(() => document.querySelector('[data-triplink-nav-hero]').remove());
		assert.equal(ctx.mode(), 'glass');
		assert.equal(observer.disconnected, true);
	} finally { await ctx.cleanup(); }
});

test('route replacement disconnects old observers and rejects their queued callbacks', async () => {
	const ctx = environment();
	try {
		await ctx.render();
		const oldObserver = ctx.intersections.at(-1), oldResize = ctx.sizes.at(-1);
		ctx.geometry.hero = { top: -500, bottom: -80 };
		const renderIndex = ctx.modes.length;
		await ctx.render({ route: '/community', heroKey: 'community' });
		assert.equal(ctx.modes[renderIndex], 'auto', 'new routes never reuse the preceding route surface');
		assert.equal(ctx.mode(), 'glass');
		assert.equal(oldObserver.disconnected, true);
		assert.equal(oldResize.disconnected, true);
		assert.equal(ctx.intersections.at(-1).target.dataset.key, 'community');
		ctx.geometry.hero = { top: 0, bottom: 400 };
		await ctx.fireIntersection(oldObserver);
		assert.equal(ctx.mode(), 'glass', 'a stale observer cannot overwrite current-route geometry');
		await ctx.fireIntersection();
		assert.equal(ctx.mode(), 'clear');
		await ctx.render({ route: '/account/join', hasHero: false });
		assert.equal(ctx.mode(), 'glass');
	} finally { await ctx.cleanup(); }
});

test('restored scroll positions and pageshow use current geometry immediately', async () => {
	const ctx = environment({ hero: { top: -800, bottom: -380 } });
	try {
		await ctx.render();
		assert.equal(ctx.mode(), 'glass', 'initial observation handles refreshed pages already below a hero');
		ctx.geometry.hero = { top: -100, bottom: 320 };
		await ctx.event('pageshow');
		assert.equal(ctx.mode(), 'clear', 'browser restoration into the hero restores transparency');
		ctx.geometry.hero = { top: 100, bottom: 520 };
		await ctx.fireIntersection();
		assert.equal(ctx.mode(), 'glass', 'a hero below the navbar cannot make its current backdrop transparent');
	} finally { await ctx.cleanup(); }
});

test('navbar and viewport resizing rebuild the boundary without leaving stale observers', async () => {
	const ctx = environment({ hero: { top: 0, bottom: 85 } });
	try {
		await ctx.render();
		assert.equal(ctx.mode(), 'glass');
		const original = ctx.intersections.at(-1);
		ctx.geometry.height = 81;
		await ctx.fireResize();
		assert.equal(ctx.mode(), 'clear');
		assert.equal(original.disconnected, true);
		assert.equal(ctx.wrapper().style.getPropertyValue('--triplink-nav-height'), '81px');
		assert.equal(ctx.intersections.at(-1).options.rootMargin, '-81px 0px -686px 0px');
		const mobileObserver = ctx.intersections.at(-1);
		window.innerHeight = 600;
		await ctx.event('resize');
		assert.equal(mobileObserver.disconnected, true);
		assert.equal(ctx.intersections.at(-1).options.rootMargin, '-81px 0px -518px 0px');
		const wrapper = ctx.wrapper(), current = ctx.intersections.at(-1);
		await ctx.unmount();
		assert.equal(current.disconnected, true);
		assert.equal(ctx.sizes.at(-1).disconnected, true);
		assert.equal(wrapper.style.getPropertyValue('--triplink-nav-height'), '');
		assert.equal(ctx.listeners.get('resize').size, 0);
		assert.equal(ctx.listeners.get('pageshow').size, 0);
		const observerCount = ctx.intersections.length;
		await ctx.fireResize();
		assert.equal(ctx.intersections.length, observerCount, 'queued resize work cannot recreate observers after unmount');
		assert.equal(wrapper.style.getPropertyValue('--triplink-nav-height'), '');
	} finally { await ctx.cleanup(); }
});

test('unsupported IntersectionObserver uses one scroll update per frame and cancels pending work', async () => {
	const ctx = environment({ observerAvailable: false });
	try {
		await ctx.render();
		assert.equal(ctx.mode(), 'clear');
		assert.equal(ctx.listeners.get('scroll').size, 1);
		ctx.geometry.hero = { top: -400, bottom: 20 };
		await ctx.event('scroll');
		await ctx.event('scroll');
		await ctx.event('scroll');
		assert.equal(ctx.frames.size, 1, 'burst scrolling coalesces to one scheduled frame');
		await ctx.flushFrames();
		assert.equal(ctx.mode(), 'glass');
		ctx.geometry.hero = { top: -100, bottom: 320 };
		await ctx.event('scroll');
		await ctx.flushFrames();
		assert.equal(ctx.mode(), 'clear');
		await ctx.event('scroll');
		assert.equal(ctx.frames.size, 1);
		await ctx.unmount();
		assert.equal(ctx.frames.size, 0);
		assert.equal(ctx.listeners.get('scroll').size, 0);
	} finally { await ctx.cleanup(); }
});
