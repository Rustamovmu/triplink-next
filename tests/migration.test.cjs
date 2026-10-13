const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
for (const extension of ['.ts', '.tsx'])
	require.extensions[extension] = (module, filename) =>
		module._compile(
			ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
				compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
			}).outputText,
			filename,
		);
const { bookingActions, bookingCapacity } = require('../libs/triplink/rules.ts');
const { safeReturnUrl } = require('../libs/auth/returnUrl.ts');
const { mergeMessages } = require('../libs/triplink/chat.ts');
const { setJwtToken } = require('../libs/auth/token.ts');
const { uploadImages } = require('../libs/uploads/index.ts');
const now = Date.parse('2026-10-09T00:00:00Z');
const tour = {
	tourStatus: 'ACTIVE',
	tourMaxGroupSize: 4,
	tourAvailableSeats: 6,
	tourAvailableDates: [
		{ _id: 'departure', startDate: '2099-01-01T00:00:00Z', endDate: '2099-01-02T00:00:00Z', availableSeats: 3 },
	],
};
const booking = {
	selectedDate: '2099-01-01T00:00:00Z',
	selectedEndDate: '2099-01-02T00:00:00Z',
	tourDateId: 'departure',
	bookingStatus: 'PENDING',
	paymentStatus: 'UNPAID',
	tourData: tour,
};
test('booking request capacity uses the selected future departure and every capacity constraint', () => {
	assert.equal(bookingCapacity(tour, 'departure', now), 3);
	assert.equal(bookingCapacity({ ...tour, tourAvailableSeats: 1 }, 'departure', now), 1);
	assert.equal(bookingCapacity({ ...tour, tourStatus: 'SOLD_OUT' }, 'departure', now), 0);
	assert.equal(bookingCapacity(tour, 'missing', now), 0);
	assert.equal(bookingCapacity(tour, 'departure', Date.parse('2100-01-01')), 0);
});
test('traveler cancellation and payment follow independent booking/payment states', () => {
	assert.equal(bookingActions(booking, 'USER', now).cancel, true);
	assert.equal(bookingActions(booking, 'USER', now).pay, false);
	const confirmed = { ...booking, bookingStatus: 'CONFIRMED' };
	assert.equal(bookingActions(confirmed, 'USER', now).pay, true);
	assert.equal(bookingActions({ ...confirmed, paymentStatus: 'PAID' }, 'USER', now).cancel, false);
	assert.equal(bookingActions({ ...confirmed, tourData: null }, 'USER', now).pay, false);
	assert.equal(bookingActions(confirmed, 'AGENT', now).pay, false);
});
test('completion and reviews require elapsed paid trips and the correct role', () => {
	const finished = {
		...booking,
		bookingStatus: 'CONFIRMED',
		paymentStatus: 'PAID',
		selectedDate: '2026-01-01T00:00:00Z',
		selectedEndDate: '2026-01-02T00:00:00Z',
	};
	assert.equal(bookingActions(finished, 'AGENT', now).complete, true);
	assert.equal(
		bookingActions({ ...finished, tourData: { ...tour, tourStatus: 'CANCELLED' } }, 'AGENT', now).complete,
		false,
	);
	assert.equal(bookingActions(finished, 'USER', now).review, false);
	assert.equal(bookingActions({ ...finished, bookingStatus: 'COMPLETED' }, 'USER', now).review, true);
	assert.equal(
		bookingActions({ ...finished, bookingStatus: 'COMPLETED', paymentStatus: 'REFUNDED' }, 'USER', now).review,
		false,
	);
});
test('admin refunds preserve distinct future, departed, and completed eligibility', () => {
	const paid = { ...booking, bookingStatus: 'CONFIRMED', paymentStatus: 'PAID' };
	assert.equal(bookingActions(paid, 'ADMIN', now).refund, true);
	const departed = { ...paid, selectedDate: '2026-01-01T00:00:00Z' };
	assert.equal(bookingActions(departed, 'ADMIN', now).refund, false);
	assert.equal(
		bookingActions({ ...departed, tourData: { ...tour, tourStatus: 'CANCELLED' } }, 'ADMIN', now).refund,
		true,
	);
	assert.equal(bookingActions({ ...paid, bookingStatus: 'COMPLETED' }, 'ADMIN', now).refund, false);
	assert.equal(
		bookingActions(
			{ ...paid, bookingStatus: 'COMPLETED', tourData: { ...tour, tourStatus: 'CANCELLED' } },
			'ADMIN',
			now,
		).refund,
		true,
	);
	assert.equal(bookingActions({ ...departed, paymentStatus: 'UNPAID' }, 'ADMIN', now).expire, true);
});
test('return paths prevent external and malformed redirects', () => {
	for (const value of ['https://example.com', '//example.com', '/\\example.com', '/\nexample.com', ['/tour'], null])
		assert.equal(safeReturnUrl(value), '/');
	assert.equal(safeReturnUrl('/tour/detail?id=abc'), '/tour/detail?id=abc');
});
test('chat history merges stable IDs and retains only the latest 50', () => {
	const messages = Array.from({ length: 52 }, (_, i) => ({
		_id: String(i),
		text: 'message ' + i,
		createdAt: new Date(Date.parse('2026-10-09T00:00:00Z') + i * 1000).toISOString(),
		memberData: { _id: 'user', memberNick: 'traveler', memberType: 'USER' },
	}));
	const result = mergeMessages(messages.slice(0, 5), messages.slice(3));
	assert.deepEqual(
		result.map((item) => item._id),
		Array.from({ length: 50 }, (_, i) => String(i + 2)),
	);
	assert.equal(mergeMessages(result, result).length, 50);
});
test('multipart uploads map exactly the selected file count without a boundary override', async () => {
	const originals = { window: global.window, localStorage: global.localStorage, fetch: global.fetch };
	let calls = 0;
	global.window = { dispatchEvent() {} };
	global.localStorage = { getItem: () => null };
	setJwtToken(
		'test.' +
			Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 900 })).toString('base64url') +
			'.token',
	);
	global.fetch = async (_url, options) => {
		calls++;
		assert.match(options.headers.Authorization, /^Bearer test\./);
		assert.equal(options.headers['Apollo-Require-Preflight'], 'true');
		assert.equal(options.headers['Content-Type'], undefined);
		assert.deepEqual(JSON.parse(options.body.get('map')), { 0: ['variables.files.0'], 1: ['variables.files.1'] });
		assert.deepEqual(JSON.parse(options.body.get('operations')).variables, { files: [null, null], target: 'tour' });
		return { ok: true, json: async () => ({ data: { imagesUploader: ['uploads/tour/a.png', 'uploads/tour/b.png'] } }) };
	};
	try {
		const files = [
			new File(['png'], 'a.png', { type: 'image/png' }),
			new File(['png'], 'b.png', { type: 'image/png' }),
		];
		assert.equal((await uploadImages(files, 'tour')).length, 2);
		await assert.rejects(uploadImages([new File(['bad'], 'bad.txt', { type: 'text/plain' })], 'tour'));
		await assert.rejects(uploadImages(Array(11).fill(files[0]), 'tour'));
		assert.equal(calls, 1);
	} finally {
		Object.assign(global, originals);
	}
});
test('every migrated locale includes core marketplace and lifecycle translations', () => {
	for (const locale of ['en', 'kr', 'ru']) {
		const dictionary = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/locales', locale, 'common.json')));
		for (const key of [
			'Tours',
			'Bookings',
			'Reviews',
			'Saved',
			'Simulate payment',
			'Post comment',
			'Login',
			'DRAFT',
			'SOLD_OUT',
		])
			assert.equal(typeof dictionary[key], 'string');
	}
});
test('API feedback distinguishes authorization, concurrency, validation, and network failures', () => {
	const { errorMessage } = require('../libs/triplink/errors.ts');
	const error = (code, message = 'Server detail') => ({ graphQLErrors: [{ message, extensions: { code } }] });
	assert.equal(errorMessage(error('UNAUTHENTICATED')), 'Please login again.');
	assert.equal(errorMessage(error('FORBIDDEN')), 'You do not have permission for this action.');
	assert.equal(errorMessage(error('CONFLICT')), 'This record changed. Refresh and try again.');
	assert.equal(errorMessage(error('BAD_REQUEST', 'Invalid seats')), 'Invalid seats');
	assert.equal(errorMessage({ networkError: new Error('offline') }), 'Unable to reach the server. Please retry.');
	assert.equal(errorMessage(new Error('Choose a departure')), 'Choose a departure');
});
test('session restoration clears private state and ignores late account responses after logout', async () => {
	const clientPath = require.resolve('../apollo/client.ts');
	const previous = require.cache[clientPath];
	let resolveQuery;
	const fakeClient = {
		clearStore: async () => {},
		query: () =>
			new Promise((resolve) => {
				resolveQuery = resolve;
			}),
	};
	require.cache[clientPath] = {
		id: clientPath,
		filename: clientPath,
		loaded: true,
		exports: { initializeApollo: () => fakeClient },
	};
	const runtimePath = require.resolve('../libs/auth/runtime.ts');
	const previousRuntime = require.cache[runtimePath];
	require.cache[runtimePath] = {
		id: runtimePath,
		filename: runtimePath,
		loaded: true,
		exports: {
			startAuthRuntime() {},
			setAuthPayloadHandler() {},
			authVersion: () => 'fixture',
			refreshAccessToken: async () => 'synthetic-token',
			AuthRequestError: Error,
		},
	};
	const originalStorage = global.localStorage;
	const values = new Map([['accessToken', 'synthetic-token']]);
	global.localStorage = {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, value),
		removeItem: (key) => values.delete(key),
	};
	const originalWindow = global.window;
	global.window = { localStorage: global.localStorage };
	const authPath = require.resolve('../libs/auth/index.ts');
	delete require.cache[authPath];
	try {
		const { restoreSession, clearLocalSession } = require(authPath);
		setJwtToken('synthetic-token');
		const { memberVar, sessionVar } = require('../apollo/store.ts');
		memberVar({ _id: 'previous-account' });
		const pending = restoreSession();
		await new Promise((resolve) => setImmediate(resolve));
		assert.equal(memberVar(), null);
		assert.equal(sessionVar(), 'loading');
		clearLocalSession();
		resolveQuery({ data: { result: { _id: 'stale-account' } } });
		await pending;
		assert.equal(memberVar(), null);
		assert.equal(sessionVar(), 'anonymous');
		assert.equal(require('../libs/auth/token.ts').getJwtToken(), '');
	} finally {
		delete require.cache[authPath];
		if (previousRuntime) require.cache[runtimePath] = previousRuntime;
		else delete require.cache[runtimePath];
		if (previous) require.cache[clientPath] = previous;
		else delete require.cache[clientPath];
		global.localStorage = originalStorage;
		global.window = originalWindow;
	}
});
