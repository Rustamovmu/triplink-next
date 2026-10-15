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
function environment() {
	const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', pretendToBeVisual: true });
	const keys = [
		'window',
		'document',
		'navigator',
		'HTMLElement',
		'DocumentFragment',
		'IS_REACT_ACT_ENVIRONMENT',
		'requestAnimationFrame',
		'cancelAnimationFrame',
	];
	const saved = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(global, key)]));
	dom.window.HTMLElement.prototype.attachEvent = () => {};
	dom.window.HTMLElement.prototype.detachEvent = () => {};
	const values = {
		window: dom.window,
		document: dom.window.document,
		navigator: dom.window.navigator,
		HTMLElement: dom.window.HTMLElement,
		DocumentFragment: dom.window.DocumentFragment,
		IS_REACT_ACT_ENVIRONMENT: true,
		requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
		cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
	};
	for (const [key, value] of Object.entries(values))
		Object.defineProperty(global, key, { configurable: true, writable: true, value });
	const ctx = {
		member: { _id: 'traveler' },
		token: 'test-token',
		mobile: false,
		requests: [],
		router: { pathname: '/', query: {} },
	};
	const client = {
		mutate: (options) =>
			new Promise((resolve, reject) => {
				ctx.requests.push({ options, resolve, reject });
				options.context.fetchOptions.signal.addEventListener('abort', () => reject(new Error('aborted')), {
					once: true,
				});
			}),
	};
	const hook = load('libs/triplink/useAiAssistant.ts', {
		'@apollo/client': { useApolloClient: () => client },
		'../../apollo/user/ai': { AI_CHAT: 'AI_CHAT' },
		'../auth/token': {
			getJwtToken: () => ctx.token,
			tokenIdentity: (token) => {
				try {
					return JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).sid || token;
				} catch {
					return token;
				}
			},
		},
		'../types/triplink/ai': { AI_MESSAGE_LIMIT: 1000 },
	});
	const uz = JSON.parse(fs.readFileSync('public/locales/uz/common.json'));
	const t = (key, variables = {}) =>
		(ctx.router.locale === 'uz' ? uz[key] || key : key).replace(/{{(\w+)}}/g, (_, name) => variables[name] ?? '');
	const Assistant = load('libs/components/AiAssistant.tsx', {
		'@apollo/client': { useReactiveVar: (variable) => (variable === 'token' ? ctx.token : ctx.member) },
		'../../apollo/store': { memberVar: 'member', accessTokenVar: 'token' },
		'../auth/token': {
			getJwtToken: () => ctx.token,
			tokenIdentity: (token) => {
				try {
					return JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).sid || token;
				} catch {
					return token;
				}
			},
		},
		'../triplink/useAiAssistant': hook,
		'../types/triplink/ai': { AI_MESSAGE_LIMIT: 1000 },
		'../triplink/tourSearchUrl': {
			parseTourSearchQuery: (query) => {
				if (query.invalid) throw Error();
				return { search: { cities: ['Seoul'] } };
			},
		},
		'next/router': { useRouter: () => ctx.router },
		'next-i18next': { useTranslation: () => ({ t, i18n: { language: ctx.router.locale || 'en' } }) },
		'next/link': {
			__esModule: true,
			default: ({ href, children, onClick }) =>
				React.createElement('a', { href: '/tour/detail?id=' + href.query.id, onClick }, children),
		},
		'@mui/material': {
			...require('@mui/material'),
			useMediaQuery: (query) => query.includes('max-width') && ctx.mobile,
		},
	}).default;
	const { CacheProvider } = require('@emotion/react');
	const cache = require('@emotion/cache').default({ key: 'ai-test', container: document.head });
	const root = createRoot(document.getElementById('root'));
	ctx.render = () =>
		act(async () => root.render(React.createElement(CacheProvider, { value: cache }, React.createElement(Assistant))));
	ctx.click = (label) =>
		act(async () => {
			const button = [...document.querySelectorAll('button')].find(
				(node) => node.getAttribute('aria-label') === label || node.textContent === label,
			);
			assert.ok(button, 'Missing button ' + label);
			button.click();
		});
	ctx.change = (text) =>
		act(async () => Simulate.change(document.querySelector('textarea'), { target: { value: text } }));
	ctx.resolve = (index = ctx.requests.length - 1, text = 'Try this tour.', sources = []) =>
		act(async () => ctx.requests[index].resolve({ data: { result: { text, sources } } }));
	ctx.reject = (code) => act(async () => ctx.requests.at(-1).reject({ graphQLErrors: [{ extensions: { code } }] }));
	ctx.cleanup = async () => {
		await act(async () => root.unmount());
		dom.window.close();
		for (const [key, descriptor] of Object.entries(saved)) {
			if (descriptor) Object.defineProperty(global, key, descriptor);
			else delete global[key];
		}
	};
	return ctx;
}

test('AI prevents duplicate submission, retries one failed turn, and sends six-message bounded context', async () => {
	const ctx = environment();
	try {
		await ctx.render();
		await ctx.click('AI Assistant');
		await ctx.change('First question');
		await act(async () => {
			const form = document.querySelector('form');
			Simulate.submit(form);
			Simulate.submit(form);
		});
		assert.equal(ctx.requests.length, 1);
		assert.match(document.body.textContent, /Thinking about your trip/);
		await ctx.reject('AI_RATE_LIMITED');
		assert.match(document.body.textContent, /Wait a moment/);
		await ctx.click('Retry');
		assert.equal(ctx.requests.length, 2);
		assert.deepEqual(ctx.requests[0].options.variables, ctx.requests[1].options.variables);
		assert.equal(document.querySelectorAll('.is-user').length, 1);
		await ctx.resolve();
		for (let i = 0; i < 4; i++) {
			await ctx.change('Next ' + i);
			await ctx.click('Send to AI assistant');
			await ctx.resolve();
		}
		const options = ctx.requests.at(-1).options;
		assert.equal(options.variables.input.history.length, 5);
		assert.equal(options.fetchPolicy, 'no-cache');
		assert.ok(options.context.fetchOptions.signal instanceof AbortSignal);
	} finally {
		await ctx.cleanup();
	}
});

test('AI supports IME-safe Enter, Shift+Enter, safe text, sources, focus restoration and clear', async () => {
	const ctx = environment();
	try {
		await ctx.render();
		await ctx.click('AI Assistant');
		await ctx.change('한국 여행');
		const input = document.querySelector('textarea');
		await act(async () => {
			Simulate.keyDown(input, { key: 'Enter', shiftKey: true, nativeEvent: {} });
			Simulate.compositionStart(input);
			Simulate.keyDown(input, { key: 'Enter', nativeEvent: { isComposing: true } });
		});
		assert.equal(ctx.requests.length, 0);
		await act(async () => {
			Simulate.compositionEnd(input);
			Simulate.keyDown(input, { key: 'Enter', nativeEvent: {} });
		});
		assert.equal(ctx.requests.length, 1);
		assert.equal(ctx.requests[0].options.variables.input.message, '한국 여행');
		await ctx.resolve(0, '<script>literal answer</script>', [
			{
				tourId: 'a'.repeat(24),
				title: 'Seoul',
				destination: 'Korea',
				price: 75,
				durationDays: 1,
				rating: 4,
				reviewCount: 1,
				status: 'ACTIVE',
			},
		]);
		assert.equal(document.querySelector('script'), null);
		assert.ok(document.querySelector('a[href="/tour/detail?id=' + 'a'.repeat(24) + '"]'));
		await ctx.click('Close AI assistant');
		await act(async () => new Promise((resolve) => setTimeout(resolve, 200)));
		assert.equal(document.querySelector('#triplink-ai-panel'), null);
		assert.equal(document.activeElement.textContent, 'AI Assistant');
		await ctx.click('AI Assistant');
		assert.match(document.body.textContent, /literal answer/);
		await ctx.click('Clear conversation');
		assert.equal(document.querySelectorAll('article').length, 0);
		assert.match(document.body.textContent, /Best-Rated Tours/);
	} finally {
		await ctx.cleanup();
	}
});

test('clear and account/token changes abort pending work and discard stale private responses', async () => {
	const ctx = environment();
	try {
		await ctx.render();
		await ctx.click('AI Assistant');
		await ctx.change('Private question');
		await ctx.click('Send to AI assistant');
		await ctx.click('Clear conversation');
		assert.equal(ctx.requests[0].options.context.fetchOptions.signal.aborted, true);
		await ctx.resolve(0, 'Late private answer');
		assert.doesNotMatch(document.body.textContent, /Late private answer/);
		await ctx.change('Second');
		await ctx.click('Send to AI assistant');
		ctx.member = { _id: 'other' };
		ctx.token = 'other-token';
		await ctx.render();
		assert.equal(ctx.requests[1].options.context.fetchOptions.signal.aborted, true);
		await ctx.click('AI Assistant');
		assert.equal(document.querySelectorAll('article').length, 0);
		ctx.member = null;
		ctx.token = '';
		await ctx.render();
		assert.equal(document.querySelector('button'), null);
	} finally {
		await ctx.cleanup();
	}
});

test('tour context uses valid IDs, quick actions preserve search filters, and explicit detail is sent', async () => {
	const ctx = environment();
	try {
		ctx.router = { pathname: '/tour/detail', query: { id: 'a'.repeat(24) } };
		await ctx.render();
		await ctx.click('AI Assistant');
		await ctx.change('What is included?');
		await act(async () => document.querySelector('input[type="checkbox"]').click());
		await ctx.click('Send to AI assistant');
		assert.equal(ctx.requests[0].options.variables.input.tourId, 'a'.repeat(24));
		assert.equal(ctx.requests[0].options.variables.input.detailed, true);
		await ctx.resolve();
		await ctx.click('Clear conversation');
		await ctx.click('Best-Rated Tours');
		assert.equal(ctx.requests.at(-1).options.variables.input.intent, 'BEST_RATED');
		assert.equal(ctx.requests.at(-1).options.variables.input.tourId, undefined);
		await ctx.resolve();
		ctx.router = { pathname: '/tour', query: {} };
		await ctx.render();
		await ctx.change('Find tours');
		await ctx.click('Send to AI assistant');
		assert.deepEqual(ctx.requests.at(-1).options.variables.input.search, { cities: ['Seoul'] });
	} finally {
		await ctx.cleanup();
	}
});

test('session errors stop retries and mobile panel follows keyboard viewport', async () => {
	const ctx = environment();
	ctx.mobile = true;
	const viewport = new window.EventTarget();
	viewport.height = 600;
	Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
	try {
		await ctx.render();
		await ctx.click('AI Assistant');
		assert.equal(document.querySelector('#triplink-ai-panel').style.height, '600px');
		viewport.height = 360;
		await act(async () => viewport.dispatchEvent(new window.Event('resize')));
		assert.equal(document.querySelector('#triplink-ai-panel').style.height, '360px');
		await ctx.change('Hello');
		await ctx.click('Send to AI assistant');
		await ctx.reject('FORBIDDEN');
		assert.match(document.body.textContent, /sign in again/);
		assert.equal(document.querySelector('textarea').disabled, true);
		assert.equal(
			[...document.querySelectorAll('button')].some((button) => button.textContent === 'Retry'),
			false,
		);
		await ctx.click('Close AI assistant');
	} finally {
		await ctx.cleanup();
	}
});

test('access renewal in the same session retains Gemini history and accepts an in-flight response', async () => {
	const ctx = environment();
	const credential = (n) =>
		'x.' + Buffer.from(JSON.stringify({ sid: 'same-session', exp: n })).toString('base64url') + '.x';
	try {
		ctx.token = credential(1);
		await ctx.render();
		await ctx.click('AI Assistant');
		await ctx.change('Keep this conversation');
		await ctx.click('Send to AI assistant');
		const signal = ctx.requests[0].options.context.fetchOptions.signal;
		ctx.token = credential(2);
		await ctx.render();
		assert.equal(signal.aborted, false);
		await ctx.resolve();
		assert.match(document.body.textContent, /Keep this conversation/);
		assert.equal(document.querySelectorAll('article').length, 2);
	} finally {
		await ctx.cleanup();
	}
});

test('Uzbek AI UI sends selected locale, preserves original conversation text across language changes and retries the original context', async () => {
	const ctx = environment();
	try {
		ctx.router = { pathname: '/', query: {}, locale: 'uz' };
		await ctx.render();
		await ctx.click('AI yordamchi');
		assert.match(document.body.textContent, /Qayerga sayohat qilishni xohlaysiz/);
		await ctx.change('Please answer in English about Seoul');
		await ctx.click('AI yordamchiga yuborish');
		assert.equal(ctx.requests[0].options.variables.input.locale, 'uz');
		assert.equal(ctx.requests[0].options.variables.input.message, 'Please answer in English about Seoul');
		await ctx.reject('AI_UNAVAILABLE');
		ctx.router.locale = 'en';
		await ctx.render();
		assert.match(document.body.textContent, /Please answer in English about Seoul/);
		await ctx.click('Retry');
		assert.equal(ctx.requests[1].options.variables.input.locale, 'uz');
		await ctx.resolve(1, 'Original English answer');
		assert.match(document.body.textContent, /Original English answer/);
	} finally {
		await ctx.cleanup();
	}
});
