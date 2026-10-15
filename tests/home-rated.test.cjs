const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { JSDOM } = require('jsdom');
const { createRoot } = require('react-dom/client');
const { act, Simulate } = require('react-dom/test-utils');
const { ImageConfigContext } = require('next/dist/shared/lib/image-config-context.shared-runtime');
const { imageConfigDefault } = require('next/dist/shared/lib/image-config');

const load = (file, mocks) => {
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

async function harness() {
	const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost:3000', pretendToBeVisual: true });
	const keys = ['window', 'document', 'HTMLElement', 'HTMLImageElement', 'IS_REACT_ACT_ENVIRONMENT'];
	const saved = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(global, key)]));
	Object.assign(global, {
		window: dom.window,
		document: dom.window.document,
		HTMLElement: dom.window.HTMLElement,
		HTMLImageElement: dom.window.HTMLImageElement,
		IS_REACT_ACT_ENVIRONMENT: true,
	});
	const mediaListeners = new Set(),
		intervals = new Map();
	const media = {
		matches: true,
		addEventListener: (_, fn) => mediaListeners.add(fn),
		removeEventListener: (_, fn) => mediaListeners.delete(fn),
	};
	window.matchMedia = () => media;
	let intervalId = 0;
	window.setInterval = (callback, delay) => {
		const id = ++intervalId;
		intervals.set(id, { callback, delay });
		return id;
	};
	window.clearInterval = (id) => intervals.delete(id);
	const state = {
		locale: 'en',
		ready: true,
		tours: [],
		articles: [],
		comments: [],
		commentError: undefined,
		commentLoading: false,
		commentOptions: [],
		loading: false,
		error: undefined,
		retries: 0,
		toggles: [],
		options: null,
		favorites: {
			saved: new Set(),
			pending: new Set(),
			errors: {},
			error: '',
			eligible: true,
			anonymous: false,
			ready: true,
		},
	};
	state.favorites.toggle = (id, count) => state.toggles.push([id, count]);
	state.favorites.retry = () => state.retries++;
	const translations = Object.fromEntries(
		['en', 'kr', 'ru'].map((locale) => [
			locale,
			JSON.parse(fs.readFileSync(`public/locales/${locale}/common.json`, 'utf8')),
		]),
	);
	const t = (key, values = {}) => {
		const plural =
			values.count === undefined
				? key
				: `${key}_${new Intl.PluralRules(state.locale === 'kr' ? 'ko' : state.locale).select(values.count)}`;
		return (translations[state.locale][plural] || translations[state.locale][key] || key).replace(
			/{{(\w+)}}/g,
			(_, name) => values[name] ?? '',
		);
	};
	const shared = {
		react: React,
		'next-i18next': { useTranslation: () => ({ t, i18n: { language: state.locale } }) },
		'@mui/material': {
			Avatar: ({ children }) => React.createElement('span', { 'data-avatar': true }, children),
			Alert: ({ children, action }) => React.createElement('div', { role: 'alert' }, children, action),
			Button: ({ children, onClick }) => React.createElement('button', { onClick }, children),
			CircularProgress: () => React.createElement('span', null, 'Loading'),
		},
	};
	const common = load('libs/components/triplink/Common.tsx', {
		...shared,
		'@apollo/client': { useReactiveVar: () => (state.ready ? 'anonymous' : 'loading') },
		'../../../apollo/store': { sessionVar: {} },
		'../../triplink/errors': { errorMessage: (error) => error.message },
	});
	const iconMocks = Object.fromEntries(
		[
			'FavoriteBorderRounded',
			'FavoriteRounded',
			'StarRounded',
			'OpenInNewRounded',
			'LocationOnOutlined',
			'ScheduleRounded',
			'VisibilityOutlined',
			'ChatBubbleOutlineRounded',
			'ArrowForwardRounded',
		].map((name) => [
			`@mui/icons-material/${name}`,
			{ __esModule: true, default: (props) => React.createElement('svg', { ...props, 'data-icon': name }) },
		]),
	);
	const carousel = load('libs/components/homepage/IntroCircularCarousel.tsx', shared);
	const articleFormat = load('libs/components/triplink/articleFormat.ts', {});
	const links = {
		__esModule: true,
		default: ({ children, href, passHref, ...props }) => React.createElement('a', { href, ...props }, children),
	};
	const { HomeArticles } = load('libs/components/homepage/HomeArticles.tsx', {
		...shared,
		...iconMocks,
		'next/link': links,
		'next/router': { useRouter: () => ({ locale: state.locale }) },
		'@apollo/client': {
			useQuery: (operation, options) => {
				if (operation === 'comments') state.commentOptions.push(options);
				else state.options = options;
				return {
					data: { result: { list: operation === 'comments' ? state.comments : state.articles } },
					loading: operation === 'comments' ? state.commentLoading : state.loading,
					error: operation === 'comments' ? state.commentError : state.error,
					refetch: () => state.retries++,
				};
			},
		},
		'../../../apollo/user/triplink': { ARTICLES: 'articles', COMMENTS: 'comments' },
		'../triplink/Common': common,
		'../triplink/articleFormat': articleFormat,
	});
	const { TourSection } = load('libs/components/homepage/HomeSections.tsx', {
		...shared,
		...iconMocks,
		'next/link': {
			__esModule: true,
			default: ({ children, href, passHref, ...props }) => React.createElement('a', { href, ...props }, children),
		},
		'next/router': { useRouter: () => ({ locale: state.locale }) },
		'@apollo/client': {
			useQuery: (_, options) => {
				state.options = options;
				return {
					data: { result: { list: state.tours } },
					loading: state.loading,
					error: state.error,
					refetch: () => state.retries++,
				};
			},
		},
		'../../../apollo/user/triplink': { TOURS: 'tours', AGENTS: 'agents' },
		'../triplink/Common': common,
		'../triplink/TourFavorites': { useTourFavorites: () => state.favorites },
		'./IntroCircularCarousel': carousel,
		'./FeaturedTourSwiper': { FeaturedTourSwiper: ({ items }) => React.createElement('div', { 'data-count': items.length, 'data-tour-swiper': true }, items.map(item => React.createElement(React.Fragment, { key: item.id }, item.content))) },
		'./IntroGallery': {},
		'./IntroMedia': { IntroVideo: () => React.createElement('div', { 'data-video': true }) },
		'./AgentsAtlas': {},
		'./HomeArticles': {},
	});
	const root = createRoot(document.getElementById('root'));
	const config = { ...imageConfigDefault, ...require('../next.config').images };
	return {
		state,
		t,
		media,
		mediaListeners,
		intervals,
		render: (variant = 'rated') =>
			act(async () =>
				root.render(
					React.createElement(
						ImageConfigContext.Provider,
						{ value: config },
						variant === 'articles' ? React.createElement(HomeArticles) : React.createElement(TourSection, { variant }),
					),
				),
			),
		cleanup: async () => {
			await act(async () => root.unmount());
			assert.equal(intervals.size, 0);
			assert.equal(mediaListeners.size, 0);
			dom.window.close();
			for (const [key, descriptor] of Object.entries(saved)) {
				if (descriptor) Object.defineProperty(global, key, descriptor);
				else delete global[key];
			}
		},
	};
}
const tour = (overrides = {}) => ({
	_id: 'tour-a',
	tourTitle: 'A long journey through the mountains',
	tourImages: ['uploads/tour/test.jpg'],
	tourDestination: 'Dolomites',
	tourCategory: 'NATURE',
	tourDurationDays: 3,
	tourPrice: 295,
	tourDiscountPrice: null,
	tourAverageRating: 4.9,
	tourReviewCount: 128,
	tourViewCount: 12543,
	tourFeatured: false,
	tourFavoriteCount: 2,
	tourStatus: 'ACTIVE',
	agentData: { memberFullname: 'Mountain Guide', memberNick: 'guide' },
	...overrides,
});

test('rated cards show real data, conditional badges, optimized images and independent navigation', async () => {
	const ctx = await harness();
	try {
		ctx.state.tours = [
			tour(),
			tour({
				_id: 'tour-b',
				tourReviewCount: 0,
				tourAverageRating: 0,
				tourViewCount: 0,
				tourFeatured: true,
				tourStatus: 'SOLD_OUT',
				tourImages: [],
				agentData: null,
				tourDiscountPrice: 0,
			}),
		];
		await ctx.render();
		assert.deepEqual(ctx.state.options.variables.input, {
			page: 1,
			limit: 6,
			search: {},
			sort: 'tourAverageRating',
			direction: 'DESC',
		});
		const cards = document.querySelectorAll('article');
		assert.equal(cards.length, 2);
		assert.equal(cards[0].querySelector('h3 a').getAttribute('href'), '/tour/detail?id=tour-a');
		assert.equal(cards[0].querySelector('h3').textContent, ctx.state.tours[0].tourTitle);
		assert.equal(cards[0].querySelector('.triplink-home-tour__rating strong').textContent, '4.9');
		assert.match(cards[0].querySelector('.triplink-home-tour__rating').textContent, /128 reviews/);
		assert.match(cards[0].querySelector('.triplink-home-tour__metadata').textContent, /3 days.*Nature.*12.5K views/);
		assert.ok(cards[0].querySelector('[aria-label="12,543 views"]'));
		assert.match(cards[0].querySelector('.triplink-home-tour__agent').textContent, /Mountain Guide/);
		assert.equal(cards[0].querySelector('.triplink-home-tour__featured-badge'), null);
		assert.equal(cards[1].querySelector('.triplink-home-tour__featured-badge').textContent, 'Featured');
		assert.equal(cards[1].querySelector('.triplink-home-tour__rating').textContent, 'No reviews yet');
		assert.equal(cards[1].querySelector('.triplink-home-tour__rating svg'), null);
		assert.ok(cards[1].querySelector('[aria-label="0 views"]'));
		assert.equal(cards[1].querySelector('.triplink-home-tour__agent'), null);
		assert.equal(cards[1].querySelector('.triplink-home-tour__sold-out').textContent, 'Sold out');
		assert.equal(cards[1].querySelector('.triplink-home-price s').textContent, '$295');
		assert.equal(cards[1].querySelector('.triplink-home-price strong').textContent, '$0');
		const image = cards[0].querySelector('img');
		assert.equal(new URL(image.src).pathname, '/_next/image');
		assert.ok(image.getAttribute('srcset'));
		assert.match(image.getAttribute('sizes'), /599px/);
		assert.equal(image.getAttribute('loading'), 'lazy');
		assert.match(image.alt, /Dolomites/);
		assert.equal(new URL(cards[1].querySelector('img').src).pathname, '/img/tour-placeholder.svg');
		assert.equal(document.querySelector('a button'), null);
		await act(async () => cards[0].querySelector('.triplink-home-save').click());
		assert.deepEqual(ctx.state.toggles, [['tour-a', 2]]);
		assert.equal(document.querySelector('.triplink-home-section__link').getAttribute('href'), '/tour');
	} finally {
		await ctx.cleanup();
	}
});

test('rated pricing, image failure/replacement and translated metadata handle edge cases', async () => {
	const ctx = await harness();
	try {
		for (const [discount, price, original] of [
			[null, '$295', false],
			[295, '$295', false],
			[310, '$295', false],
			[225, '$225', true],
			[0, '$0', true],
		]) {
			ctx.state.tours = [tour({ tourDiscountPrice: discount })];
			await ctx.render();
			assert.equal(document.querySelector('.triplink-home-price strong').textContent, price);
			assert.equal(Boolean(document.querySelector('.triplink-home-price s')), original);
		}
		await act(async () => Simulate.error(document.querySelector('article img')));
		assert.equal(new URL(document.querySelector('article img').src).pathname, '/img/tour-placeholder.svg');
		ctx.state.tours = [tour({ tourImages: ['uploads/tour/replaced.jpg'] })];
		await ctx.render();
		assert.match(document.querySelector('article img').getAttribute('src'), /replaced/);
		for (const locale of ['kr', 'ru']) {
			ctx.state.locale = locale;
			ctx.state.tours = [
				tour({
					tourTitle: '아주 긴 여행 제목 · Большое путешествие с долгим названием',
					tourDurationDays: 1,
					tourReviewCount: 1,
					agentData: { memberFullname: null, memberNick: 'Guide' },
				}),
			];
			await ctx.render();
			assert.equal(document.querySelector('section').lang, locale === 'kr' ? 'ko' : locale);
			assert.equal(document.querySelector('article h3').textContent, ctx.state.tours[0].tourTitle);
			assert.match(
				document.querySelector('.triplink-home-tour__metadata').textContent,
				new RegExp(ctx.t('{{count}} days', { count: 1 })),
			);
			assert.match(document.querySelector('.triplink-home-tour__agent').textContent, /Guide/);
			assert.equal(
				document.querySelector('article img').alt,
				ctx.t('Tour photo: {{title}} in {{destination}}', {
					title: ctx.state.tours[0].tourTitle,
					destination: 'Dolomites',
				}),
			);
		}
		ctx.state.tours = [tour({ tourImages: ['uploads/member/unrelated.jpg'] })];
		await ctx.render();
		assert.equal(new URL(document.querySelector('article img').src).pathname, '/img/tour-placeholder.svg');
	} finally {
		await ctx.cleanup();
	}
});

test('top-rated badges require real reviews and an unrounded rating of at least 4.5', async () => {
	const ctx = await harness();
	try {
		for (const [reviews, rating, visible] of [
			[0, 5, false],
			[1, 4.49, false],
			[1, 4.5, true],
			[128, 4.9, true],
		]) {
			ctx.state.tours = [tour({ tourReviewCount: reviews, tourAverageRating: rating })];
			await ctx.render();
			assert.equal(Boolean(document.querySelector('.triplink-home-tour__rated-badge')), visible);
			if (!reviews)
				assert.equal(document.querySelector('.triplink-home-tour__rating').textContent, ctx.t('No reviews yet'));
		}
	} finally {
		await ctx.cleanup();
	}
});

test('top tours retain view-ranked query, actual metrics and per-tour detail routes', async () => {
	const ctx = await harness();
	try {
		ctx.state.tours = [
			tour({ tourDescription: 'Walk the mountain trails.' }),
			tour({ _id: 'tour-b', tourViewCount: 0, tourReviewCount: 0, agentData: null }),
		];
		await ctx.render('top');
		assert.deepEqual(ctx.state.options.variables.input, {
			page: 1,
			limit: 6,
			search: {},
			sort: 'tourViewCount',
			direction: 'DESC',
		});
		const cards = [...document.querySelectorAll('article')];
		assert.deepEqual(
			cards.map((card) => card.querySelector('.triplink-home-tour__rank').textContent),
			['01', '02'],
		);
		assert.deepEqual(
			cards.map((card) => card.querySelector('.triplink-home-tour__cta').getAttribute('href')),
			['/tour/detail?id=tour-a', '/tour/detail?id=tour-b'],
		);
		assert.match(cards[0].querySelector('.triplink-home-tour__rating').textContent, /4.9.*128 reviews/);
		assert.ok(cards[0].querySelector('[aria-label="12,543 views"]'));
		assert.equal(cards[0].querySelector('.triplink-home-tour__description').textContent, 'Walk the mountain trails.');
		assert.ok(cards[1].querySelector('[aria-label="0 views"]'));
		assert.equal(cards[1].querySelector('.triplink-home-tour__rating').textContent, ctx.t('No reviews yet'));
		assert.equal(cards[1].querySelector('.triplink-home-tour__agent'), null);
		assert.equal(document.querySelector('a button'), null);
	} finally {
		await ctx.cleanup();
	}
});

test('articles retain actual counts, detail routes, safe image fallbacks and collapsible comment previews', async () => {
	const ctx = await harness();
	const article = {
		_id: 'article-a',
		articleTitle: 'A real journey',
		articleContent: JSON.stringify({
			format: 'triplink-rich-text-v1',
			html: '<p>Travel <strong>with care</strong>.</p>',
		}),
		articleImage: 'uploads/article/test.jpg',
		articleCategory: 'TRAVEL',
		articleViews: 3214,
		articleComments: 7,
		createdAt: '2026-10-10T09:00:00.000Z',
		memberData: { memberFullname: 'Travel Writer', memberNick: 'writer' },
	};
	try {
		ctx.state.articles = [article];
		ctx.state.comments = [{ _id: 'comment-a', commentContent: 'Useful story.', memberData: { memberNick: 'Reader' } }];
		await ctx.render('articles');
		assert.deepEqual(ctx.state.options.variables.input, {
			page: 1,
			limit: 3,
			search: {},
			sort: 'createdAt',
			direction: 'DESC',
		});
		assert.deepEqual(ctx.state.commentOptions[0].variables.input, {
			page: 1,
			limit: 2,
			search: { commentRefId: 'article-a' },
			sort: 'createdAt',
			direction: 'DESC',
		});
		assert.equal(ctx.state.commentOptions[0].notifyOnNetworkStatusChange, true);
		const card = document.querySelector('article');
		assert.equal(card.querySelector('h3 a').getAttribute('href'), '/community/detail?id=article-a');
		assert.equal(
			card.querySelector('.triplink-home-article__story').getAttribute('href'),
			'/community/detail?id=article-a',
		);
		assert.ok(card.querySelector('[role="img"][aria-label="3,214 views"]'));
		assert.ok(card.querySelector('[role="img"][aria-label="7 comments"]'));
		assert.equal(card.querySelector('.triplink-home-article__excerpt').textContent, 'Travel with care.');
		assert.match(card.querySelector('.triplink-home-article__author').textContent, /Travel Writer/);
		assert.equal(card.querySelector('time').getAttribute('datetime'), article.createdAt);
		assert.equal(card.querySelector('details').open, false);
		assert.equal(card.querySelector('summary').textContent, ctx.t('Home article comment count', { count: 7 }));
		assert.match(card.querySelector('details li').textContent, /Reader.*Useful story/);
		assert.equal(card.querySelector('details a').getAttribute('href'), '/community/detail?id=article-a');
		const image = card.querySelector('img');
		assert.equal(new URL(image.src).pathname, '/_next/image');
		assert.equal(image.alt, ctx.t('Article photo: {{title}}', { title: article.articleTitle }));
		await act(async () => Simulate.error(image));
		assert.equal(new URL(document.querySelector('article img').src).pathname, '/img/tour-placeholder.svg');
		ctx.state.articles = [
			{ ...article, articleImage: 'uploads/article/replaced.jpg', createdAt: 'invalid', memberData: null },
		];
		await ctx.render('articles');
		assert.match(document.querySelector('article img').getAttribute('src'), /replaced/);
		assert.equal(document.querySelector('time'), null);
		assert.match(
			document.querySelector('.triplink-home-article__author').textContent,
			new RegExp(ctx.t('Community member')),
		);
		for (const imagePath of ['', 'uploads/member/unrelated.jpg', 'https://example.com/remote.jpg']) {
			ctx.state.articles = [{ ...article, articleImage: imagePath }];
			await ctx.render('articles');
			assert.equal(new URL(document.querySelector('article img').src).pathname, '/img/tour-placeholder.svg');
		}
		ctx.state.comments = [];
		await ctx.render('articles');
		assert.match(document.querySelector('details').textContent, new RegExp(ctx.t('No comments yet')));
		ctx.state.commentError = new Error('Comments unavailable');
		await ctx.render('articles');
		assert.match(document.querySelector('details [role="alert"]').textContent, /Comments unavailable/);
		await act(async () => document.querySelector('details button').click());
		assert.equal(ctx.state.retries, 1);
		ctx.state.commentError = undefined;
		for (const locale of ['kr', 'ru']) {
			ctx.state.locale = locale;
			await ctx.render('articles');
			assert.equal(document.querySelector('summary').textContent, ctx.t('Home article comment count', { count: 7 }));
			assert.equal(document.querySelector('.triplink-home-article__story').textContent, ctx.t('Read story'));
			assert.ok(document.querySelector(`[role="img"][aria-label="${ctx.t('{{count}} comments', { count: 7 })}"]`));
		}
		ctx.state.commentError = undefined;
		ctx.state.commentLoading = true;
		await ctx.render('articles');
		assert.ok(document.querySelector('details [role="status"]'));
		ctx.state.ready = false;
		await ctx.render('articles');
		assert.equal(ctx.state.options.skip, true);
		assert.equal(document.querySelector('article'), null);
		ctx.state.ready = true;
		ctx.state.commentLoading = false;
		ctx.state.articles = [];
		await ctx.render('articles');
		assert.equal(document.querySelector('[role="alert"]').textContent, ctx.t('No results'));
	} finally {
		await ctx.cleanup();
	}
});

test('rated favorites preserve roles, pending locks, retries and errors; query states retain carousel', async () => {
	const ctx = await harness();
	try {
		ctx.state.tours = [tour()];
		ctx.state.favorites.saved.add('tour-a');
		ctx.state.favorites.pending.add('tour-a');
		await ctx.render();
		assert.equal(document.querySelector('.triplink-home-save').getAttribute('aria-pressed'), 'true');
		assert.equal(document.querySelector('.triplink-home-save').disabled, true);
		ctx.state.favorites.pending.clear();
		ctx.state.favorites.errors['tour-a'] = 'Try again';
		await ctx.render();
		assert.match(document.querySelector('article [role="alert"]').textContent, /Try again/);
		ctx.state.favorites.error = 'Saved tours unavailable';
		ctx.state.favorites.ready = false;
		await ctx.render();
		assert.equal(document.querySelector('.triplink-home-save').disabled, false);
		await act(async () => document.querySelector('.triplink-home-save').click());
		assert.equal(ctx.state.retries, 1);
		ctx.state.favorites.anonymous = true;
		await ctx.render();
		assert.equal(document.querySelector('.triplink-home-save').getAttribute('href'), '/account/join');
		ctx.state.favorites.anonymous = false;
		ctx.state.favorites.eligible = false;
		await ctx.render();
		assert.equal(document.querySelector('.triplink-home-save'), null);
		ctx.state.ready = false;
		await ctx.render();
		assert.equal(ctx.state.options.skip, true);
		assert.ok(document.querySelector('[role="status"]'));
		ctx.state.ready = true;
		ctx.state.loading = true;
		await ctx.render();
		assert.ok(document.querySelector('[role="status"]'));
		ctx.state.loading = false;
		ctx.state.error = new Error('Connection unavailable');
		await ctx.render();
		assert.match(document.querySelector('[role="alert"]').textContent, /Connection unavailable/);
		await act(async () => document.querySelector('[role="alert"] button').click());
		assert.equal(ctx.state.retries, 2);
		ctx.state.error = undefined;
		ctx.state.tours = [];
		await ctx.render();
		assert.equal(document.querySelector('[role="alert"]').textContent, ctx.t('No results'));
		assert.ok(document.querySelector('.triplink-circular-carousel'));
	} finally {
		await ctx.cleanup();
	}
});

test('existing circular carousel retains photos, five-second autoplay, controls, drag and keyboard behavior', async () => {
	const ctx = await harness();
	try {
		await ctx.render();
		assert.equal(document.querySelectorAll('.triplink-circular-carousel__card img').length, 13);
		assert.equal(ctx.intervals.size, 0);
		await act(async () => {
			ctx.media.matches = false;
			ctx.mediaListeners.forEach((fn) => fn());
		});
		assert.equal(ctx.intervals.size, 1);
		assert.equal([...ctx.intervals.values()][0].delay, 5000);
		await act(async () => [...ctx.intervals.values()][0].callback());
		assert.match(document.querySelector('.triplink-circular-carousel__stage').getAttribute('aria-label'), /Seoul, 2/);
		await act(async () => document.querySelector('[aria-label="Previous photo in Best rated"]').click());
		assert.match(document.querySelector('.triplink-circular-carousel__stage').getAttribute('aria-label'), /Kyoto, 1/);
		assert.equal(ctx.intervals.size, 0);
		await act(async () => document.querySelector('[aria-label="Play slideshow"]').click());
		assert.equal(ctx.intervals.size, 1);
		await act(async () => Simulate.pointerEnter(document.querySelector('.triplink-circular-carousel')));
		assert.equal(ctx.intervals.size, 0);
		await act(async () => Simulate.pointerLeave(document.querySelector('.triplink-circular-carousel')));
		assert.equal(ctx.intervals.size, 1);
		const stage = document.querySelector('.triplink-circular-carousel__stage');
		await act(async () => Simulate.keyDown(stage, { key: 'End' }));
		assert.match(stage.getAttribute('aria-label'), /Bali, 13/);
		await act(async () => Simulate.keyDown(stage, { key: 'ArrowRight' }));
		assert.match(stage.getAttribute('aria-label'), /Kyoto, 1/);
		stage.setPointerCapture = () => {};
		await act(async () =>
			Simulate.pointerDown(stage, { isPrimary: true, button: 0, pointerId: 1, clientX: 100, clientY: 50 }),
		);
		await act(async () => Simulate.pointerUp(stage, { pointerId: 1, clientX: 40, clientY: 50 }));
		assert.match(stage.getAttribute('aria-label'), /Seoul, 2/);
		await act(async () => {
			ctx.media.matches = true;
			ctx.mediaListeners.forEach((fn) => fn());
		});
		assert.equal(document.querySelector('[aria-label="Play slideshow"]'), null);
	} finally {
		await ctx.cleanup();
	}
});
