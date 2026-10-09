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
const { buildHomeSearch, localDateTimeValue } = require('../libs/triplink/homeSearch.ts');
const values = { text: ' Kyoto ', start: '', end: '', seats: '2' };
test('search preserves supported URL keys and allows dates to be omitted', () => {
	assert.deepEqual(buildHomeSearch(values), { text: 'Kyoto', seats: '2', page: '1' });
});
test('invalid dates and traveler counts do not produce search URLs', () => {
	for (const change of [
		{ start: '2026-10-10' },
		{ end: '2026-10-10' },
		{ start: '2026-10-12', end: '2026-10-10' },
		{ start: '2026-02-30', end: '2026-03-01' },
		{ seats: '0' },
		{ seats: '101' },
		{ seats: '1.5' },
		{ seats: '' },
		{ text: 'a'.repeat(151) },
	])
		assert.throws(() => buildHomeSearch({ ...values, ...change }));
});
test('whole-day ranges preserve local dates and DST boundaries', () => {
	const previous = process.env.TZ;
	try {
		for (const timezone of ['Asia/Seoul', 'America/New_York', 'UTC']) {
			process.env.TZ = timezone;
			for (const day of ['2026-10-10', '2026-03-08', '2026-11-01']) {
				const result = buildHomeSearch({ ...values, start: day, end: day });
				assert.equal(localDateTimeValue(result.start), `${day}T00:00:00.000`);
				assert.equal(localDateTimeValue(result.end), `${day}T23:59:59.999`);
				assert(new Date(result.start) < new Date(result.end));
				if (timezone === 'America/New_York' && day !== '2026-10-10') {
					const hours = day === '2026-03-08' ? 23 : 25;
					assert.equal(new Date(result.end) - new Date(result.start) + 1, hours * 3600000);
				}
			}
		}
	} finally {
		if (previous === undefined) delete process.env.TZ;
		else process.env.TZ = previous;
	}
});
test('legacy local datetime URLs and ISO URLs remain editable', () => {
	const previous = process.env.TZ;
	process.env.TZ = 'Asia/Seoul';
	try {
		assert.equal(localDateTimeValue('2026-10-10T09:30'), '2026-10-10T09:30:00.000');
		assert.equal(localDateTimeValue('2026-10-10T00:30:00.000Z'), '2026-10-10T09:30:00.000');
		assert.equal(localDateTimeValue('invalid'), '');
		assert.equal(localDateTimeValue(''), '');
	} finally {
		if (previous === undefined) delete process.env.TZ;
		else process.env.TZ = previous;
	}
});
