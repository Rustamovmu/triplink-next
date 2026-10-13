const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { JSDOM } = require('jsdom');
const { createRoot } = require('react-dom/client');
const { act, Simulate } = require('react-dom/test-utils');
const load = (file, mocks = {}) => {
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
const helpers = load('libs/triplink/chat.ts');
const traveler = { _id: 'traveler', memberNick: 'Mina', memberType: 'USER' };
const agent = { _id: 'agent', memberNick: 'Guide', memberType: 'AGENT' };
const admin = { _id: 'admin', memberNick: 'Admin', memberType: 'ADMIN' };
const message = (id, memberData = traveler, text = 'Hello!') => ({
	_id: id,
	text,
	memberData,
	createdAt: '2026-10-11T10:00:00Z',
});
function environment() {
	const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', pretendToBeVisual: true });
	const keys = [
		'window',
		'document',
		'navigator',
		'WebSocket',
		'Image',
		'IS_REACT_ACT_ENVIRONMENT',
		'requestAnimationFrame',
		'cancelAnimationFrame',
		'setTimeout',
		'clearTimeout',
	];
	const saved = Object.fromEntries(keys.map((k) => [k, Object.getOwnPropertyDescriptor(global, k)]));
	dom.window.HTMLElement.prototype.attachEvent = () => {};
	dom.window.HTMLElement.prototype.detachEvent = () => {};
	let now = 10000,
		timerId = 0;
	const timers = new Map();
	const originalNow = Date.now;
	const ctx = {
		member: traveler,
		token: 'private-token',
		socket: null,
		sockets: [],
		images: [],
		copied: [],
		copyFails: false,
	};
	class Socket {
		static OPEN = 1;
		static CONNECTING = 0;
		static CLOSED = 3;
		readyState = 0;
		sent = [];
		closed = false;
		constructor() {
			ctx.sockets.push(this);
		}
		send(frame) {
			if (this.failSend) throw Error('offline');
			this.sent.push(JSON.parse(frame));
		}
		open() {
			this.readyState = 1;
			this.onopen?.();
		}
		frame(event, data) {
			this.onmessage?.({ data: JSON.stringify({ event, data }) });
		}
		close() {
			this.closed = true;
			this.readyState = 3;
			this.onclose?.();
		}
	}
	Object.defineProperties(global, {
		window: { configurable: true, writable: true, value: dom.window },
		document: { configurable: true, writable: true, value: dom.window.document },
		navigator: {
			configurable: true,
			writable: true,
			value: {
				clipboard: {
					writeText: async (text) => {
						if (ctx.copyFails) throw Error('blocked');
						ctx.copied.push(text);
					},
				},
			},
		},
		WebSocket: { configurable: true, writable: true, value: Socket },
		Image: {
			configurable: true,
			writable: true,
			value: class Image {
				constructor() {
					ctx.images.push(this);
				}
			},
		},
		IS_REACT_ACT_ENVIRONMENT: { configurable: true, writable: true, value: true },
		requestAnimationFrame: { configurable: true, writable: true, value: (callback) => setTimeout(callback, 0) },
		cancelAnimationFrame: { configurable: true, writable: true, value: (id) => clearTimeout(id) },
		setTimeout: {
			configurable: true,
			writable: true,
			value: (callback, delay = 0) => {
				const id = ++timerId;
				timers.set(id, { callback, at: now + delay });
				return id;
			},
		},
		clearTimeout: { configurable: true, writable: true, value: (id) => timers.delete(id) },
	});
	Date.now = () => now;
	ctx.advance = async (ms) => {
		const end = now + ms;
		for (;;) {
			const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
			if (!due) break;
			now = due[1].at;
			timers.delete(due[0]);
			await act(async () => due[1].callback());
		}
		now = end;
	};
	const t = (key, v = {}) => key.replace(/{{(\w+)}}/g, (_, name) => v[name] ?? '');
	const store = {
		memberVar: 'member',
		accessTokenVar: 'token',
		socketVar: (socket) => {
			if (socket !== undefined) ctx.socket = socket;
			else ctx.socket = undefined;
		},
	};
	// Match Apollo reactive-var getter/setter semantics, including explicit undefined cleanup.
	store.socketVar = function (value) {
		if (arguments.length) ctx.socket = value;
		return ctx.socket;
	};
	const hook = load('libs/triplink/useChat.ts', {
		'../../apollo/store': store,
		'./chat': helpers,
		'../auth/token': {
			tokenIdentity: (token) => {
				try {
					return JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).sid || token;
				} catch {
					return token;
				}
			},
		},
		'../auth/runtime': {
			ensureAccessToken: async () => ctx.token,
			refreshAccessToken: async () => ctx.token,
			AuthRequestError: Error,
			clearAuthentication() {},
		},
	});
	const button = React.forwardRef(function TestButton(
		{ children, onClick, disabled, className, type = 'button', ...props },
		ref,
	) {
		return React.createElement(
			'button',
			{
				onClick,
				disabled,
				className,
				type,
				'aria-label': props['aria-label'],
				'aria-expanded': props['aria-expanded'],
				'aria-pressed': props['aria-pressed'],
				ref,
			},
			children,
		);
	});
	const mui = {
		Paper: React.forwardRef(function TestPaper({ children, ...props }, ref) {
			return React.createElement('section', { ...props, ref }, children);
		}),
		Button: button,
		IconButton: button,
		Avatar: require('@mui/material/Avatar').default,
		Alert: ({ children }) => React.createElement('div', { role: 'alert' }, children),
		Tooltip: ({ children }) => children,
		useMediaQuery: (query) => (query.includes('max-width') ? Boolean(ctx.mobile) : false),
		Dialog: ({ open, children, PaperProps }) =>
			open ? React.createElement('section', { ...PaperProps, role: 'dialog', 'aria-modal': true }, children) : null,
		Popover: ({ open, children }) => (open ? React.createElement('div', null, children) : null),
		TextField: ({
			inputRef,
			inputProps,
			value,
			onChange,
			onKeyDown,
			onBlur,
			onCompositionStart,
			onCompositionEnd,
			disabled,
		}) =>
			React.createElement('textarea', {
				...inputProps,
				ref: inputRef,
				value,
				onChange,
				onKeyDown,
				onBlur,
				onCompositionStart,
				onCompositionEnd,
				disabled,
			}),
	};
	const icons = Object.fromEntries(
		[
			'ChatBubbleOutlineRounded',
			'CloseRounded',
			'OpenInFullRounded',
			'CloseFullscreenRounded',
			'SendRounded',
			'SentimentSatisfiedAltRounded',
			'ContentCopyRounded',
			'CheckRounded',
			'KeyboardArrowDownRounded',
		].map((name) => ['@mui/icons-material/' + name, { __esModule: true, default: () => null }]),
	);
	const { default: Chat } = load('libs/components/Chat.tsx', {
		react: React,
		'next/link': {
			__esModule: true,
			default: ({ href, children, onClick }) => React.createElement('a', { href, onClick }, children),
		},
		'next-i18next': { useTranslation: () => ({ t, i18n: { language: 'en' } }) },
		'@apollo/client': { useReactiveVar: (variable) => (variable === 'token' ? ctx.token : ctx.member) },
		'@mui/material': mui,
		'../../apollo/store': store,
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
		'../triplink/chat': helpers,
		'../triplink/useChat': hook,
		...icons,
	});
	const root = createRoot(document.getElementById('root'));
	const { CacheProvider } = require('@emotion/react');
	const cache = require('@emotion/cache').default({ key: 'chat-test', container: document.head });
	ctx.render = () =>
		act(async () => root.render(React.createElement(CacheProvider, { value: cache }, React.createElement(Chat))));
	ctx.click = async (label) =>
		act(async () => {
			const node = [...document.querySelectorAll('button')].find(
				(n) => n.getAttribute('aria-label') === label || n.textContent === label,
			);
			assert.ok(node, 'Missing button ' + label);
			node.click();
		});
	ctx.input = () => document.querySelector('textarea');
	ctx.change = async (value) => act(async () => Simulate.change(ctx.input(), { target: { value } }));
	ctx.authenticate = async () =>
		act(async () => {
			const s = ctx.sockets.at(-1);
			s.open();
			s.frame('authenticated', { memberData: ctx.member, totalClients: 1 });
			s.frame('presence', { list: [ctx.member], totalMembers: 1, totalClients: 1 });
		});
	ctx.frame = async (event, data) => act(async () => ctx.sockets.at(-1).frame(event, data));
	ctx.cleanup = async () => {
		await act(async () => root.unmount());
		dom.window.close();
		Date.now = originalNow;
		for (const [k, d] of Object.entries(saved)) {
			if (d) Object.defineProperty(global, k, d);
			else delete global[k];
		}
	};
	return ctx;
}

test('chat wire validation rejects malformed identities, dates and duplicate presence without linking admins', () => {
	assert.equal(helpers.isChatMessage(message('id')), true);
	assert.equal(helpers.isChatMessage({ ...message('id'), createdAt: 'invalid' }), false);
	assert.equal(helpers.isChatMessage(message('id', { ...traveler, memberType: 'OWNER' })), false);
	assert.equal(helpers.isChatPresence({ list: [traveler, traveler], totalMembers: 2, totalClients: 2 }), false);
	assert.equal(helpers.isChatPresence({ list: [traveler, agent], totalMembers: 2, totalClients: 1 }), false);
	assert.equal(helpers.chatProfile(admin), null);
	assert.equal(helpers.chatRole(traveler.memberType), 'Traveler');
	assert.equal(helpers.chatInitials('😊Guide'), '😊G');
	assert.equal(helpers.isChatMember({ ...agent, memberImage: 42 }), false);
	assert.equal(helpers.isChatMember({ ...agent, memberImage: '' }), true);
	for (const path of [
		undefined,
		'',
		' ',
		'javascript:alert(1)',
		'data:image/png;base64,abc',
		'//other.test/a.png',
		'\\other.test/a.png',
	])
		assert.equal(helpers.chatImageUrl(path), undefined);
	assert.equal(helpers.chatImageUrl('/img/profile/avatar.png'), '/img/profile/avatar.png');
	assert.equal(helpers.chatImageUrl('https://images.example/avatar.png'), 'https://images.example/avatar.png');
	const origin = (process.env.REACT_APP_API_URL || 'http://localhost:3007').replace(/\/$/, '');
	assert.equal(helpers.chatImageUrl('/uploads/member/avatar.png'), `${origin}/uploads/member/avatar.png`);
});

test('chat uses profile photos for every role, current presence for older messages, and initials on image failure', async () => {
	const ctx = environment();
	try {
		const people = [
			{ ...traveler, memberImage: '/img/profile/traveler.png' },
			{ ...agent, memberImage: 'uploads/member/agent.png' },
			{ ...admin, memberImage: '/img/profile/admin.png' },
		];
		ctx.member = people[0];
		await ctx.render();
		await ctx.authenticate();
		await ctx.click('Shared chat');
		await ctx.frame('presence', { list: people, totalMembers: 3, totalClients: 3 });
		await ctx.frame('getMessages', {
			list: [message('own'), message('guide', people[1]), message('admin', people[2])],
		});
		const avatars = () => [...document.querySelectorAll('.triplink-chat__avatar')];
		const sources = () => avatars().map((avatar) => avatar.querySelector('img')?.getAttribute('src'));
		const expected = people.map((person) => helpers.chatImageUrl(person.memberImage));
		assert.deepEqual(sources(), expected);
		assert.equal(avatars()[0].textContent, '');
		await act(async () => ctx.images.find((image) => image.src === expected[2]).onerror());
		assert.equal(avatars()[2].querySelector('img'), null);
		assert.equal(avatars()[2].textContent, 'AD');
		// A changed or removed profile image overrides retained message snapshots.
		const updated = [
			people[0],
			{ ...people[1], memberImage: '/img/profile/new-guide.png' },
			{ ...people[2], memberImage: '' },
		];
		await ctx.frame('presence', { list: updated, totalMembers: 3, totalClients: 3 });
		assert.deepEqual(sources(), [expected[0], updated[1].memberImage, undefined]);
		await ctx.click('People3');
		assert.deepEqual(sources(), [expected[0], updated[1].memberImage, undefined]);
		assert.equal(avatars()[2].textContent, 'AD');
		assert.equal(document.querySelector('a[href*="admin"]'), null);
		await ctx.click('Messages');
		await ctx.frame('presence', { list: [people[0]], totalMembers: 1, totalClients: 1 });
		// Offline senders retain the photo captured in their message.
		assert.deepEqual(sources(), expected);
		await ctx.frame('presence', { list: people, totalMembers: 3, totalClients: 3 });
		await ctx.frame('message', message('new-guide', updated[1]));
		assert.equal(sources()[1], updated[1].memberImage);
		await ctx.frame('typing', { memberData: updated[2], isTyping: true });
		assert.equal(sources()[2], undefined);
		await ctx.click('People3');
		assert.deepEqual(sources(), [expected[0], updated[1].memberImage, undefined]);
	} finally {
		await ctx.cleanup();
	}
});

test('chat renders real identities and distinct people, sends multiline text with IME protection, copies and scrolls', async () => {
	const ctx = environment();
	try {
		await ctx.render();
		await ctx.click('Shared chat');
		assert.equal(ctx.input().disabled, true);
		await ctx.authenticate();
		assert.deepEqual(ctx.sockets[0].sent[0], { event: 'authenticate', data: { token: 'private-token' } });
		await ctx.frame('presence', { list: [traveler, agent, admin], totalMembers: 3, totalClients: 4 });
		await ctx.frame('getMessages', {
			list: [message('own'), message('other', agent, '<script>literal</script>'), message('admin', admin)],
		});
		assert.equal(document.querySelectorAll('.is-own').length, 1);
		assert.match(document.body.textContent, /Traveler/);
		assert.match(document.body.textContent, /Agent/);
		assert.match(document.body.textContent, /Admin/);
		assert.match(document.body.textContent, /You/);
		assert.equal(document.querySelector('script'), null);
		assert.equal(document.querySelectorAll('time').length, 3);
		assert.ok(document.querySelector('a[href="/agent/detail?agentId=agent"]'));
		assert.equal(document.querySelector('a[href*="admin"]'), null);
		await ctx.click('People3');
		assert.match(document.body.textContent, /4 active connections/);
		assert.equal(document.querySelectorAll('.triplink-chat__person').length, 3);
		await ctx.click('Messages');
		await ctx.change('First\nSecond');
		await act(async () => Simulate.keyDown(ctx.input(), { key: 'Enter', shiftKey: true, nativeEvent: {} }));
		await act(async () => Simulate.compositionStart(ctx.input()));
		await act(async () => Simulate.keyDown(ctx.input(), { key: 'Enter', nativeEvent: { isComposing: true } }));
		assert.equal(ctx.sockets[0].sent.filter((f) => f.event === 'message').length, 0);
		await act(async () => Simulate.compositionEnd(ctx.input()));
		await act(async () => Simulate.keyDown(ctx.input(), { key: 'Enter', nativeEvent: {} }));
		assert.deepEqual(
			ctx.sockets[0].sent.find((f) => f.event === 'message'),
			{ event: 'message', data: 'First\nSecond' },
		);
		assert.equal(ctx.input().value, '');
		await ctx.click('Copy message by Guide');
		assert.deepEqual(ctx.copied, ['<script>literal</script>']);
		assert.match(document.body.textContent, /Message copied/);
		ctx.copyFails = true;
		await ctx.click('Copy message by Admin');
		assert.match(document.body.textContent, /Could not copy/);
		const feed = document.querySelector('.triplink-chat__feed');
		Object.defineProperties(feed, {
			scrollHeight: { configurable: true, value: 1200 },
			clientHeight: { configurable: true, value: 200 },
		});
		feed.scrollTop = 100;
		await act(async () => Simulate.scroll(feed));
		await ctx.frame('message', message('new', agent));
		assert.equal(feed.scrollTop, 100);
		assert.match(document.body.textContent, /Jump to latest/);
		await ctx.click('Jump to latest');
		assert.equal(feed.scrollTop, 1200);
		await ctx.click('Expand chat');
		assert.ok(document.querySelector('.is-expanded'));
		await act(async () =>
			document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
		);
		assert.equal(document.querySelector('.triplink-chat'), null);
		assert.equal(document.activeElement.textContent, 'Shared chat');
	} finally {
		await ctx.cleanup();
	}
});

test('emoji inserts at the selection, preserves focus and respects the server character limit', async () => {
	const ctx = environment();
	try {
		await ctx.render();
		await ctx.authenticate();
		await ctx.click('Shared chat');
		await ctx.change('ab');
		assert.equal(ctx.input().value, 'ab');
		ctx.input().setSelectionRange(1, 2);
		await ctx.click('Add emoji');
		await ctx.click('Smiling face');
		await ctx.advance(0);
		assert.equal(ctx.input().value, 'a😊');
		assert.equal(document.activeElement, ctx.input());
		assert.equal(ctx.input().selectionStart, 3);
		await ctx.change('x'.repeat(999));
		await ctx.click('Add emoji');
		await ctx.click('Smiling face');
		assert.equal(ctx.input().value.length, 999);
		assert.match(document.body.textContent, /Message limit reached/);
		await ctx.change('x'.repeat(1000));
		await ctx.click('Send');
		assert.equal(ctx.sockets[0].sent.filter((f) => f.event === 'message').at(-1).data.length, 1000);
		assert.equal(document.querySelector('textarea').getAttribute('maxlength'), '1000');
	} finally {
		await ctx.cleanup();
	}
});

test('typing refreshes are throttled, idle and remote indicators expire, and authorization prevents reconnect loops', async () => {
	const ctx = environment();
	try {
		await ctx.render();
		await ctx.authenticate();
		await ctx.click('Shared chat');
		await ctx.change('H');
		await ctx.change('He');
		assert.equal(ctx.sockets[0].sent.filter((f) => f.event === 'typing' && f.data.isTyping).length, 1);
		await ctx.advance(2000);
		await ctx.change('Hello');
		assert.equal(ctx.sockets[0].sent.filter((f) => f.event === 'typing' && f.data.isTyping).length, 2);
		await ctx.frame('typing', { memberData: agent, isTyping: true });
		assert.match(document.body.textContent, /Guide is typing/);
		await ctx.advance(3000);
		assert.equal(ctx.sockets[0].sent.at(-1).data.isTyping, false);
		await ctx.advance(2000);
		assert.doesNotMatch(document.body.textContent, /Guide is typing/);
		await ctx.frame('typing', { memberData: agent, isTyping: true });
		await ctx.frame('presence', { list: [traveler], totalMembers: 1, totalClients: 1 });
		assert.doesNotMatch(document.body.textContent, /Guide is typing/);
		await ctx.frame('error', { code: 'FORBIDDEN', message: 'This account is not available' });
		assert.equal(ctx.sockets[0].closed, true);
		assert.equal(ctx.input().disabled, true);
		assert.match(document.body.textContent, /Login again/);
		assert.equal(
			[...document.querySelectorAll('button')].some((n) => n.textContent === 'Reconnect'),
			false,
		);
		await ctx.advance(20000);
		assert.equal(ctx.sockets.length, 1);
	} finally {
		await ctx.cleanup();
	}
});

test('manual reconnect preserves drafts; account and token changes close old sockets and clear private state', async () => {
	const ctx = environment();
	try {
		await ctx.render();
		await ctx.authenticate();
		await ctx.click('Shared chat');
		await ctx.change('draft');
		await ctx.frame('message', message('old'));
		await act(async () => ctx.sockets[0].close());
		await ctx.click('Reconnect');
		await ctx.authenticate();
		assert.equal(ctx.input().value, 'draft');
		assert.equal(ctx.sockets.length, 2);
		ctx.token = 'new-token';
		await ctx.render();
		assert.equal(ctx.sockets[1].closed, true);
		await ctx.authenticate();
		await ctx.click('Shared chat');
		assert.equal(ctx.input().value, '');
		assert.doesNotMatch(document.body.textContent, /Hello!/);
		ctx.member = agent;
		await ctx.render();
		assert.equal(ctx.sockets[2].closed, true);
		await ctx.authenticate();
		await ctx.click('Shared chat');
		assert.equal(ctx.input().value, '');
		await ctx.frame('getMessages', {
			list: [{ ...message('bad'), memberData: { ...traveler, memberType: 'HACKER' } }],
		});
		assert.match(document.body.textContent, /Invalid chat response/);
		assert.equal(document.querySelectorAll('article').length, 0);
		ctx.member = null;
		ctx.token = '';
		await ctx.render();
		assert.equal(ctx.sockets[3].closed, true);
		assert.equal(ctx.socket, undefined);
		assert.equal(document.querySelector('button'), null);
	} finally {
		await ctx.cleanup();
	}
});

test('mobile chat follows the visual viewport when the keyboard opens and retains a close control', async () => {
	const ctx = environment();
	ctx.mobile = true;
	const viewport = new window.EventTarget();
	viewport.height = 600;
	Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
	try {
		await ctx.render();
		await ctx.authenticate();
		await ctx.click('Shared chat');
		const panel = document.querySelector('[role="dialog"]');
		assert.equal(panel.getAttribute('aria-modal'), 'true');
		assert.equal(panel.style.height, '600px');
		viewport.height = 360;
		await act(async () => viewport.dispatchEvent(new window.Event('resize')));
		assert.equal(panel.style.height, '360px');
		assert.equal(
			[...document.querySelectorAll('button')].some((button) => button.getAttribute('aria-label') === 'Expand chat'),
			false,
		);
		assert.match(document.body.textContent, /Everyone in this room can see your messages/);
		await ctx.click('Close chat');
		assert.equal(document.querySelector('[role="dialog"]'), null);
		assert.equal(document.activeElement.textContent, 'Shared chat');
	} finally {
		await ctx.cleanup();
	}
});

test('access renewal in the same session reauthenticates one socket and preserves the draft', async () => {
	const ctx = environment();
	const credential = (n) =>
		'x.' + Buffer.from(JSON.stringify({ sid: 'same-session', exp: n })).toString('base64url') + '.x';
	try {
		ctx.token = credential(1);
		await ctx.render();
		await act(async () => {
			ctx.sockets[0].open();
		});
		await act(async () => {
			ctx.sockets[0].frame('authenticated', { memberData: traveler });
		});
		await ctx.click('Shared chat');
		await ctx.change('Keep this draft');
		ctx.token = credential(2);
		await ctx.render();
		assert.equal(ctx.sockets.length, 1);
		assert.equal(ctx.sockets[0].closed, false);
		assert.equal(document.querySelector('textarea').value, 'Keep this draft');
		assert.equal(ctx.sockets[0].sent.at(-1).event, 'reauthenticate');
	} finally {
		await ctx.cleanup();
	}
});
