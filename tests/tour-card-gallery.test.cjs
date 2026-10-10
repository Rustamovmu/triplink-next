const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { JSDOM } = require('jsdom');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');

test('tour card photo strips track swipes, arrows and reduced motion with safe image fallbacks', async () => {
	const saved = Object.fromEntries(['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map((key) => [key, Object.getOwnPropertyDescriptor(global, key)]));
	const dom = new JSDOM('<div id="root"></div>');
	global.window = dom.window;
	global.document = dom.window.document;
	global.IS_REACT_ACT_ENVIRONMENT = true;
	let reducedMotion = false;
	window.matchMedia = () => ({ matches: reducedMotion });
	const t = (key, values = {}) => key.replace(/{{(\w+)}}/g, (_, name) => values[name] ?? '');
	const box = ({ children, className }) => React.createElement('div', { className }, children);
	const icon = () => React.createElement('svg');
	const mocks = {
		react: React,
		'next/link': { __esModule: true, default: ({ children, href, className, tabIndex }) => React.createElement('a', { href, className, tabIndex }, children) },
		'next/router': { useRouter: () => ({ locale: 'en' }) },
		'next-i18next': { useTranslation: () => ({ t }) },
		'@mui/material': { Card: box, CardContent: box, Stack: box, Typography: box, Rating: () => null },
		'@apollo/client': {}, '../../../apollo/user/triplink': {}, '../../types/triplink': {},
		'./Common': { imageUrl: (path) => '/uploads/' + path },
		'./TourFavorites': { useTourFavorites: () => ({ saved: new Set(), counts: {}, errors: {}, anonymous: true }) },
		...Object.fromEntries(['ChevronLeftRounded', 'ChevronRightRounded', 'PlaceOutlined', 'FavoriteBorderRounded', 'FavoriteRounded', 'VisibilityOutlined'].map((name) => [`@mui/icons-material/${name}`, { __esModule: true, default: icon }])),
	};
	const exported = {};
	new Function('require', 'exports', ts.transpileModule(fs.readFileSync('libs/components/triplink/Tours.tsx', 'utf8'), { compilerOptions: { module: 1, jsx: 2, esModuleInterop: true } }).outputText)((name) => {
		if (!(name in mocks)) throw new Error(`Missing mock: ${name}`);
		return mocks[name];
	}, exported);
	let tour = { _id: 'tour1', tourTitle: 'City tour', tourImages: ['first.jpg', 'second.jpg'], tourCategory: 'CITY', tourDestination: 'Seoul', tourDurationDays: 1, tourReviewCount: 0, tourFavoriteCount: 2, tourViewCount: 3, tourPrice: 100, tourDiscountPrice: 80 };
	const root = createRoot(document.getElementById('root'));
	const render = () => act(async () => root.render(React.createElement(exported.TourCard, { tour })));
	try {
		await render();
		const track = document.querySelector('.triplink-tour-card__slides');
		Object.defineProperty(track, 'clientWidth', { value: 300 });
		const moves = [];
		track.scrollTo = (options) => {
			moves.push(options);
			track.scrollLeft = options.left;
			track.dispatchEvent(new window.Event('scroll', { bubbles: true }));
		};
		assert.equal(track.children.length, 2);
		assert.equal(track.children[0].tabIndex, 0);
		assert.equal(track.children[1].tabIndex, -1);
		await act(async () => document.querySelector('button[aria-label="Next photo of City tour"]').click());
		assert.deepEqual(moves[0], { left: 300, behavior: 'smooth' });
		assert.match(document.querySelector('[role="status"]').textContent, /2\/2/);
		assert.equal(track.children[1].tabIndex, 0);
		// A native touch swipe is represented by a scroll event, rather than a mutation.
		await act(async () => { track.scrollLeft = 0; track.dispatchEvent(new window.Event('scroll', { bubbles: true })); });
		assert.match(document.querySelector('[role="status"]').textContent, /1\/2/);
		reducedMotion = true;
		await act(async () => document.querySelector('button[aria-label="Previous photo of City tour"]').click());
		assert.deepEqual(moves[1], { left: 300, behavior: 'auto' });
		await act(async () => track.querySelectorAll('img')[1].dispatchEvent(new window.Event('error')));
		assert.equal(track.querySelectorAll('img')[1].getAttribute('src'), '/img/tour-placeholder.svg');
		assert.equal(track.querySelector('a').getAttribute('href'), '/tour/detail?id=tour1');
		assert.match(document.querySelector('.triplink-tour-card__stats').textContent, /Tour likes/);
		assert.doesNotMatch(document.querySelector('.triplink-tour-card__stats').textContent, /saves/);
		assert.equal(document.querySelector('s').textContent, '$100');
		assert.equal(document.querySelector('strong').textContent, '$80');
		tour = { ...tour, tourImages: ['only.jpg'] };
		await render();
		assert.equal(document.querySelector('.triplink-tour-card__gallery'), null);
		tour = { ...tour, tourImages: [] };
		await render();
		assert.equal(document.querySelector('img').getAttribute('src'), '/img/tour-placeholder.svg');
		assert.equal(document.querySelector('.triplink-tour-card__gallery'), null);
	} finally {
		await act(async () => root.unmount());
		dom.window.close();
		for (const [key, descriptor] of Object.entries(saved)) {
			if (descriptor) Object.defineProperty(global, key, descriptor);
			else delete global[key];
		}
	}
});
