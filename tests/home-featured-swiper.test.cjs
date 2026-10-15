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


test('previous Swiper loops real tour cards after five seconds, supports keyboard/controls and pauses for interaction, visibility and reduced motion', async (t) => {
	const ctx = environment();
	t.mock.timers.enable({ apis: ['setTimeout'] });
	let engine;
	const actual = require('swiper/react');
	window.WebKitCSSMatrix = class {
		constructor(transform) { const values = transform.match(/translate3d\(([-\d.]+)px, ([-\d.]+)px/); this.m41=values ? Number(values[1]) : 0; this.m42=values ? Number(values[2]) : 0; }
	};
	const { FeaturedTourSwiper } = load('libs/components/homepage/FeaturedTourSwiper.tsx', {
		react: React,
		'next-i18next': { useTranslation: () => ({ t: key => key }) },
		'../../triplink/BrowsingMemoryProvider': { useRememberedState: (_, value) => React.useState(value) },
		'swiper/react': { ...actual, Swiper: props => React.createElement(actual.Swiper, { ...props, width: 1000, onSwiper: instance => { engine=instance; props.onSwiper(instance); } }) },
	});
	const items = Array.from({length:6}, (_,index) => ({id:`tour-${index}`,title:`Journey ${index}`,content:React.createElement('article',null,React.createElement('a',{href:`/tour/detail?id=tour-${index}`},`Journey ${index}`))}));
	const style=document.createElement('style'); style.textContent='.swiper-slide {width:580px;box-sizing:border-box;padding:0;margin:0;border:0;}'; document.head.appendChild(style);
	const advance = ms => act(async () => t.mock.timers.tick(ms));
	const finish = () => act(async () => document.querySelector('.swiper-wrapper').dispatchEvent(new window.Event('transitionend',{bubbles:true})));
	const key = async (value,extra={}) => { const event=new window.KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true,...extra}); await act(async () => document.querySelector('[role="region"]').dispatchEvent(event)); return event.defaultPrevented; };
	const render = count => ctx.render(React.createElement(FeaturedTourSwiper,{items:items.slice(0,count)}));
	try {
		await render(6);
		const node=document.querySelector('[role="region"]');
		assert.equal(engine.params.centeredSlides,true);
		assert.equal(engine.params.slidesPerView,'auto');
		assert.equal(engine.params.loop,true);
		assert.equal(engine.autoplay.running,false);
		await ctx.visible(true);
		assert.equal(engine.autoplay.running,true);
		await advance(4999); assert.equal(engine.realIndex,0);
		await advance(1); assert.equal(engine.realIndex,1);
		await finish();
		await act(async () => Simulate.pointerEnter(node,{pointerType:'mouse'}));
		await advance(10000); assert.equal(engine.realIndex,1);
		await act(async () => node.focus());
		await act(async () => Simulate.pointerLeave(node));
		assert.equal(engine.autoplay.running,false);
		assert.equal(node.querySelector('[role="status"]').getAttribute('aria-live'),'polite');
		await ctx.motion(true);
		await key('End'); assert.equal(engine.realIndex,5);
		await key('ArrowRight'); assert.equal(engine.realIndex,0);
		await key('ArrowLeft'); assert.equal(engine.realIndex,5);
		await key('Home'); assert.equal(engine.realIndex,0);
		assert.equal(await key('ArrowRight',{ctrlKey:true}),false);
		assert.equal(await key('Tab'),false);
		await act(async () => document.querySelector('[aria-label="Next slide"]').click()); assert.equal(engine.realIndex,1);
		assert.ok(document.querySelector('a[href="/tour/detail?id=tour-1"]'));
		await ctx.motion(false);
		await act(async () => node.blur());
		assert.equal(engine.autoplay.running,true);
		await ctx.hidden(true); assert.equal(engine.autoplay.running,false);
		await ctx.hidden(false); assert.equal(engine.autoplay.running,true);
		await ctx.visible(false); assert.equal(engine.autoplay.running,false);
		await ctx.visible(true); assert.equal(engine.autoplay.running,true);
		await act(async () => document.querySelector('[aria-label="Pause slideshow"]').click());
		assert.equal(engine.autoplay.running,false);
		await ctx.visible(false); await ctx.visible(true);
		assert.equal(engine.autoplay.running,false);
		await render(2);
		assert.equal(engine.params.loop,false);
		assert.equal(engine.params.rewind,true);
		await ctx.motion(true);
		await key('End'); assert.equal(engine.realIndex,1);
		await key('ArrowRight'); assert.equal(engine.realIndex,0);
		await render(1);
		assert.equal(engine.params.allowTouchMove,false);
		assert.equal(document.querySelector('.triplink-featured-swiper__controls'),null);
		assert.equal(engine.autoplay.running,false);
	} finally { await ctx.cleanup(); t.mock.timers.tick(10000); t.mock.timers.reset(); }
	assert.equal(engine.destroyed,true);
	assert.equal(ctx.listeners.size,0);
	assert.equal(ctx.observers[0].disconnected,true);
});
