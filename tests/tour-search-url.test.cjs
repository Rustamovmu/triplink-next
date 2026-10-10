const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) =>
	module._compile(
		ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } })
			.outputText,
		filename,
	);
const {
	parseTourSearchQuery: parse,
	tourSearchQuery: encode,
	normalizeTourInquiry: normalize,
	tourSearchFormValues: form,
	applyTourSearchForm: apply,
} = require('../libs/triplink/tourSearchUrl.ts');
const defaults = { page: 1, limit: 12, sort: 'createdAt', direction: 'DESC', search: {} };
const full = {
	page: 3,
	limit: 9,
	sort: 'tourPrice',
	direction: 'ASC',
	search: {
		agentId: 'abcdef0123456789abcdef01',
		text: 'Seoul & Kyoto + #? / 서울',
		destinations: ['Seoul', 'Kyoto'],
		countries: ['Korea'],
		cities: ['Seoul'],
		categories: ['CITY', 'FOOD'],
		difficulties: ['EASY', 'MODERATE'],
		priceRange: { start: 0, end: 2000 },
		durationRange: { start: 1, end: 365 },
		availableDateRange: { start: '2030-01-01T00:00:00.000Z', end: '2030-02-01T00:00:00.000Z' },
		minimumAvailableSeats: 2,
		minimumRating: 0,
		featured: false,
	},
};
test('JSON URL round trips all supported filters, Unicode and reserved characters', () => {
	const url = new URL('https://triplink.example/tour');
	url.search = new URLSearchParams(encode(full)).toString();
	assert.deepEqual(parse(Object.fromEntries(url.searchParams)), full);
	assert.deepEqual(parse({}), defaults);
	assert.deepEqual(parse({ ...encode(full), text: 'ignored', page: '99' }), full);
});
test('reject malformed JSON, arrays, wrong types, enum values and invalid bounds', () => {
	for (const input of ['{', 'null', '[]', '42']) assert.throws(() => parse({ input }));
	assert.throws(() => parse({ input: [encode(full).input] }));
	for (const change of [
		{ page: 0 },
		{ page: 1.5 },
		{ page: Infinity },
		{ limit: 101 },
		{ limit: '12' },
		{ sort: 'propertyPrice' },
		{ direction: 1 },
		{ search: [] },
	])
		assert.throws(() => normalize({ ...defaults, ...change }));
	for (const search of [
		{ agentId: 'bad' },
		{ text: 'x'.repeat(151) },
		{ destinations: ['x'.repeat(151)] },
		{ countries: Array(31).fill('Korea') },
		{ cities: [1] },
		{ categories: ['APARTMENT'] },
		{ difficulties: ['HARD'] },
		{ featured: 'false' },
		{ minimumAvailableSeats: 1.5 },
		{ minimumAvailableSeats: Infinity },
		{ minimumRating: 5.1 },
		{ priceRange: { start: 100, end: 0 } },
		{ priceRange: { start: 0 } },
		{ durationRange: { start: 1, end: 366 } },
		{ availableDateRange: { start: 'invalid', end: 'invalid' } },
		{ availableDateRange: { start: '2030-01-01T00:00', end: '2030-02-01T00:00' } },
		{ availableDateRange: { start: '2031-01-01T00:00Z', end: '2030-01-01T00:00Z' } },
	])
		assert.throws(() => normalize({ ...defaults, search }));
});
test('unknown URL fields never reach GraphQL and false/zero survive', () => {
	assert.deepEqual(
		normalize({
			...defaults,
			memberId: 'secret',
			search: { text: 'Seoul', memberPassword: 'secret', featured: false, minimumRating: 0 },
		}),
		{ ...defaults, search: { text: 'Seoul', minimumRating: 0, featured: false } },
	);
});
test('readable links and old local datetime links remain supported', () => {
	const old = parse({
		page: '2',
		text: 'Seoul',
		destination: 'Kyoto',
		category: 'CITY',
		difficulty: 'EASY',
		minPrice: '0',
		maxPrice: '2000',
		minDays: '1',
		maxDays: '5',
		seats: '2',
		rating: '0',
		sort: 'tourPrice',
		direction: 'ASC',
	});
	assert.equal(old.page, 2);
	assert.equal(old.limit, 12);
	assert.deepEqual(old.search.priceRange, { start: 0, end: 2000 });
	assert.deepEqual(old.search.destinations, ['Kyoto']);
	for (const query of [
		{ page: 'NaN' },
		{ category: 'INVALID' },
		{ minPrice: '0' },
		{ start: 'invalid', end: 'invalid' },
		{ start: '2030-02-30T00:00Z', end: '2030-03-01T00:00Z' },
		{ seats: 'Infinity' },
		{ text: ['Seoul'] },
	])
		assert.throws(() => parse(query));
	assert.throws(() => parse({ input: 'bad', text: 'Seoul' }));
});
test('form submission resets page and preserves untouched arrays, hidden filters and date instants', () => {
	const values = form(full);
	assert.deepEqual(apply(full, { ...values, text: 'new' }, new Set(['text'])), {
		...full,
		page: 1,
		search: { ...full.search, text: 'new' },
	});
	assert.deepEqual(apply(full, { ...values, category: 'NATURE' }, new Set(['category'])).search.categories, ['NATURE']);
	const cleared = apply(full, { ...values, destination: '' }, new Set(['destination']));
	assert.equal(cleared.search.destinations, undefined);
	assert.deepEqual(cleared.search.countries, ['Korea']);
	assert.throws(() => apply(full, { ...values, minDays: '366' }, new Set(['minDays'])));
});
test('shared dates retain identical instants across recipient timezones', () => {
	const previous = process.env.TZ;
	try {
		for (const timezone of ['Asia/Seoul', 'America/New_York', 'UTC']) {
			process.env.TZ = timezone;
			const restored = parse(encode(full));
			assert.deepEqual(restored.search.availableDateRange, full.search.availableDateRange);
			assert.deepEqual(
				apply(restored, form(restored), new Set()).search.availableDateRange,
				full.search.availableDateRange,
			);
			const local = form(restored);
			assert.deepEqual(
				apply(restored, local, new Set(['start'])).search.availableDateRange,
				full.search.availableDateRange,
			);
		}
	} finally {
		if (previous === undefined) delete process.env.TZ;
		else process.env.TZ = previous;
	}
});

test('editing one date endpoint preserves the other during a repeated DST hour', () => {
	const previous = process.env.TZ;
	try {
		process.env.TZ = 'America/New_York';
		const input = {
			...defaults,
			search: { availableDateRange: { start: '2026-11-01T06:30:00.000Z', end: '2026-11-01T07:30:00.000Z' } },
		};
		const values = { ...form(input), end: '2026-11-01T03:30:00.000' };
		assert.deepEqual(apply(input, values, new Set(['end'])).search.availableDateRange, {
			start: '2026-11-01T06:30:00.000Z',
			end: '2026-11-01T08:30:00.000Z',
		});
	} finally {
		if (previous === undefined) delete process.env.TZ;
		else process.env.TZ = previous;
	}
});

test('calendar date endpoints include entire local days across DST and reject invalid dates', () => {
	const { calendarDateInstant } = require('../libs/triplink/tourSearchUrl.ts');
	const original = process.env.TZ;
	try {
		process.env.TZ = 'America/New_York';
		const start = calendarDateInstant('2027-03-14');
		const end = calendarDateInstant('2027-03-14', true);
		assert.equal(start, '2027-03-14T05:00:00.000Z');
		assert.equal(end, '2027-03-15T03:59:59.999Z');
		for (const invalid of ['2027-02-30', '2027-13-01', '2027-00-01', '2027-12-00', '2027-12-01T09:00'])
			assert.throws(() => calendarDateInstant(invalid));
	} finally {
		if (original === undefined) delete process.env.TZ;
		else process.env.TZ = original;
	}
});
