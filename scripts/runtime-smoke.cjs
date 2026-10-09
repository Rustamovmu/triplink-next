const fs = require('node:fs'),
	path = require('node:path'),
	assert = require('node:assert/strict');
const frontend = path.resolve(__dirname, '..');
const root = process.env.TRIPLINK_BACKEND_ROOT || path.resolve(frontend, '../trip-link');
require(root + '/node_modules/dotenv').config({ path: root + '/.env' });
if (process.env.NODE_ENV === 'production') throw Error('Cannot test in production');
require(root + '/node_modules/ts-node').register({
	transpileOnly: true,
	project: root + '/tsconfig.json',
	compilerOptions: { module: 'CommonJS', moduleResolution: 'node', resolvePackageJsonExports: false },
});
require(root + '/node_modules/reflect-metadata');
const { Types } = require(root + '/node_modules/mongoose');
const name = 'tl_fe_e2e_' + new Types.ObjectId().toHexString();
assert.ok(name.length <= 38, 'Disposable database name exceeds provider limit');
const mongo = new URL(process.env.MONGO_DEV);
mongo.pathname = '/' + name;
process.env.MONGO_DEV = mongo.toString();
process.env.PORT_API = process.env.TRIPLINK_TEST_PORT || '0';
const tmp = '/private/tmp/' + name;
fs.mkdirSync(tmp);
process.chdir(tmp);
const { NestFactory } = require(root + '/node_modules/@nestjs/core');
const { getConnectionToken, getModelToken } = require(root + '/node_modules/@nestjs/mongoose');
let app, connection;
const originalCreate = NestFactory.create.bind(NestFactory);
const ts = require(frontend + '/node_modules/typescript');
const originalLoader = require.extensions['.ts'];
require.extensions['.ts'] = (module, filename) => {
	if (filename.startsWith(frontend + '/'))
		module._compile(
			ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
				compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
			}).outputText,
			filename,
		);
	else originalLoader(module, filename);
};
const user = require(frontend + '/apollo/user/triplink.ts');
const admin = require(frontend + '/apollo/admin/triplink.ts');
const { print } = require(frontend + '/node_modules/graphql');
async function call(document, variables = {}, token, code) {
	const response = await fetch('http://127.0.0.1:' + app.getHttpServer().address().port + '/graphql', {
		method: 'POST',
		signal: AbortSignal.timeout(30000),
		headers: {
			'Content-Type': 'application/json',
			'Apollo-Require-Preflight': 'true',
			...(token ? { Authorization: 'Bearer ' + token } : {}),
		},
		body: JSON.stringify({ query: print(document), variables }),
	});
	const body = await response.json();
	if (code) {
		assert.equal(body.errors?.[0]?.extensions?.code, code);
		return;
	}
	assert.equal(body.errors, undefined, JSON.stringify(body.errors));
	console.log('PASS:', document.definitions[0].name.value);
	return body.data.result;
}
async function fixtures() {
	const password = 'Disposable123!';
	const actors = {};
	for (const [role, nick, phone] of [
		['USER', 'tl_browser_user', '01011112222'],
		['AGENT', 'tl_browser_agent', '01022223333'],
	])
		actors[role] = await call(user.SIGNUP, {
			input: {
				memberNick: nick,
				memberPassword: password,
				memberPhone: phone,
				memberType: role,
				memberAuthType: 'PHONE',
			},
		});
	const { AuthService } = require(root + '/apps/trip-link/src/components/auth/auth.service.ts');
	const auth = app.get(AuthService);
	await app.get(getModelToken('Member')).create({
		memberNick: 'tl_browser_admin',
		memberType: 'ADMIN',
		memberStatus: 'ACTIVE',
		memberPassword: await auth.hashPassword(password),
	});
	actors.ADMIN = await call(user.LOGIN, { input: { memberNick: 'tl_browser_admin', memberPassword: password } });
	for (const actor of Object.values(actors)) {
		const current = await call(user.CURRENT_MEMBER, {}, actor.accessToken);
		assert.equal(current._id, actor.member._id);
	}
	const u = actors.USER.accessToken,
		a = actors.AGENT.accessToken,
		d = actors.ADMIN.accessToken;
	let input = require(frontend + '/scripts/contract-fixtures.cjs').find((x) => x[1] === 'TourInput')[2];
	input = { ...input, tourImages: ['uploads/tour/disposable.jpg'] };
	await call(user.CREATE_TOUR, { input }, u, 'FORBIDDEN');
	let tour = await call(user.CREATE_TOUR, { input }, a);
	tour = await call(user.UPDATE_TOUR, { input: { tourId: tour._id, tourStatus: 'PENDING' } }, a);
	tour = await call(
		admin.ADMIN_TOUR_UPDATE,
		{ input: { tourId: tour._id, tourStatus: 'ACTIVE', tourFeatured: true } },
		d,
	);
	assert.equal((await call(user.TOURS, { input: { page: 1, limit: 12, search: {} } })).list.length, 1);
	assert.equal((await call(user.FAVORITE_TOGGLE, { tourId: tour._id }, u)).favorited, true);
	assert.equal((await call(user.FAVORITES, { input: { page: 1, limit: 12 } }, u)).list.length, 1);
	await call(user.FOLLOW_TOGGLE, { memberId: actors.AGENT.member._id }, u);
	assert.equal(
		(await call(user.FOLLOWINGS, { input: { page: 1, limit: 12, search: { memberId: actors.USER.member._id } } }, u))
			.list.length,
		1,
	);
	const profile = await call(
		user.PROFILE_UPDATE,
		{ input: { memberFullname: 'Disposable Traveler', memberCountry: 'Korea' } },
		u,
	);
	assert.equal(profile.member.memberFullname, 'Disposable Traveler');
	const booking = await call(
		user.CREATE_BOOKING,
		{ input: { tourId: tour._id, tourDateId: tour.tourAvailableDates[0]._id, numberOfPeople: 2 } },
		u,
	);
	await call(
		user.CREATE_REVIEW,
		{ input: { bookingId: booking._id, reviewRating: 5, reviewComment: 'Synthetic review' } },
		u,
		'NOT_FOUND',
	);
	await call(user.CONFIRM_BOOKING, { bookingId: booking._id }, a);
	assert.equal((await call(user.PAY_BOOKING, { bookingId: booking._id }, u)).paymentStatus, 'PAID');
	// Time travel only the test-owned snapshot, never a development record.
	await connection
		.collection('bookings')
		.updateOne(
			{ _id: new Types.ObjectId(booking._id) },
			{ $set: { selectedDate: new Date('2020-01-01'), selectedEndDate: new Date('2020-01-02') } },
		);
	await call(user.COMPLETE_BOOKING, { bookingId: booking._id }, a);
	const review = await call(
		user.CREATE_REVIEW,
		{ input: { bookingId: booking._id, reviewRating: 5, reviewComment: 'Synthetic review' } },
		u,
	);
	await call(
		user.UPDATE_REVIEW,
		{ input: { reviewId: review._id, reviewRating: 4, reviewComment: 'Updated synthetic review' } },
		u,
	);
	const article = await call(
		user.CREATE_ARTICLE,
		{
			input: {
				articleCategory: 'FREE',
				articleTitle: 'Disposable travel notes',
				articleContent: 'Plain text notes for frontend contract testing.',
			},
		},
		a,
	);
	await call(user.CREATE_COMMENT, { input: { commentRefId: article._id, commentContent: 'Helpful travel notes' } }, u);
	await call(user.ARTICLE_LIKE, { articleId: article._id }, u);
	const help = await call(
		admin.CREATE_HELP_ENTRY,
		{
			input: {
				noticeCategory: 'FAQ',
				faqTopic: 'BOOKINGS',
				noticeTitle: 'Disposable seats question',
				noticeContent: 'Seats are reserved after confirmation.',
			},
		},
		d,
	);
	assert.equal(
		(await call(user.HELP_ENTRIES, { input: { page: 1, limit: 12, search: { noticeCategory: 'FAQ' } } })).list.length,
		0,
	);
	assert.equal(
		(
			await call(
				admin.ADMIN_HELP_ENTRIES,
				{
					input: { page: 1, limit: 12, search: { noticeCategory: 'FAQ', noticeStatus: 'HOLD', faqTopic: 'BOOKINGS' } },
				},
				d,
			)
		).list[0]._id,
		help._id,
	);
	await call(user.HELP_ENTRY, { entryId: help._id }, undefined, 'NOT_FOUND');
	await call(admin.UPDATE_HELP_ENTRY, { input: { entryId: help._id, noticeStatus: 'ACTIVE' } }, d);
	assert.equal((await call(user.HELP_ENTRY, { entryId: help._id })).noticeStatus, 'ACTIVE');
	await call(
		admin.UPDATE_HELP_ENTRY,
		{ input: { entryId: help._id, noticeContent: 'Updated disposable plain text answer.' } },
		d,
	);
	await call(admin.UPDATE_HELP_ENTRY, { input: { entryId: help._id, noticeStatus: 'HOLD' } }, d);
	await call(user.HELP_ENTRY, { entryId: help._id }, undefined, 'NOT_FOUND');
	await call(admin.REMOVE_HELP_ENTRY, { entryId: help._id }, u, 'FORBIDDEN');
	assert.equal(await call(admin.REMOVE_HELP_ENTRY, { entryId: help._id }, d), true);
	await call(user.HELP_ENTRY, { entryId: help._id }, undefined, 'NOT_FOUND');
	if (process.env.TRIPLINK_BROWSER_FIXTURES === '1') {
		await call(
			admin.CREATE_HELP_ENTRY,
			{
				input: {
					noticeCategory: 'FAQ',
					faqTopic: 'TOURS',
					noticeTitle: 'Disposable browser FAQ',
					noticeContent: 'Browse tours in this disposable test environment.',
					noticeStatus: 'ACTIVE',
				},
			},
			d,
		);
		await call(
			admin.CREATE_HELP_ENTRY,
			{
				input: {
					noticeCategory: 'NOTICE',
					noticeTitle: 'Disposable browser notice',
					noticeContent: 'Plain text notice.\nSecond line.',
					noticeStatus: 'ACTIVE',
				},
			},
			d,
		);
	}
	console.log('PASS: frontend operation lifecycle including Help Center on a verified disposable database');
	if (process.env.TRIPLINK_BROWSER_FIXTURES === '1')
		console.log(
			'READY: port ' +
				app.getHttpServer().address().port +
				'; disposable accounts tl_browser_user, tl_browser_agent, tl_browser_admin',
		);
	else await cleanup();
}
let closing = false;
async function cleanup() {
	if (closing) return;
	closing = true;
	try {
		if (connection) {
			assert.equal(connection.name, name);
			assert.match(name, /^tl_fe_e2e_[a-f0-9]{24}$/);
			await connection.dropDatabase();
		}
	} catch (error) {
		console.error('Database cleanup failed:', error.message);
		process.exitCode = 1;
	} finally {
		try {
			if (app) await app.close();
			fs.rmSync(tmp, { recursive: true, force: true });
			if (!process.exitCode) console.log('CLEANED: task-owned database, uploads and backend');
		} catch (error) {
			console.error('Application cleanup failed:', error.message);
			process.exitCode = 1;
		}
		process.exit(process.exitCode || 0);
	}
}
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('unhandledRejection', async (error) => {
	console.error(error.message);
	process.exitCode = 1;
	await cleanup();
});
NestFactory.create = async (module) => {
	app = await originalCreate(module, { logger: false, abortOnError: false });
	connection = app.get(getConnectionToken());
	assert.equal(connection.name, name);
	app.getHttpServer().once('listening', async () => {
		try {
			await fixtures();
		} catch (error) {
			console.error('SMOKE FAILED:', error.message);
			process.exitCode = 1;
			await cleanup();
		}
	});
	return app;
};
require(root + '/apps/trip-link/src/main.ts');
