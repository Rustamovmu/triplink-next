const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const i18next = require('i18next');
const { audit, compare, duplicateKeys } = require('../scripts/audit-translations.cjs');
function load(file) {
	const exports = {};
	new Function(
		'exports',
		ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: 1 } }).outputText,
	)(exports);
	return exports;
}
test('all namespaces cover every existing locale key, preserve original translations and contain no missing literal UI keys', () => {
	const report = audit();
	assert.deepEqual(report.errors, []);
	assert.deepEqual(report.preserved, { en: true, kr: true, ru: true });
	assert.equal(report.counts['uz/common.json'], report.counts['ru/common.json']);
});
test('audit rejects empty and missing translations, changed interpolation, nested shape drift, duplicates and Cyrillic Uzbek', () => {
	const source = { nested: { heading: 'Hello {{name}}' } };
	assert.equal(compare(source, { nested: { heading: 'Salom {{name}}' } }, 'uz', true).length, 0);
	assert.equal(compare(source, {}, 'uz').length, 1);
	assert.equal(compare(source, { nested: { heading: '' } }, 'uz').length, 1);
	assert.equal(compare(source, { nested: { heading: 'Salom {{ism}}' } }, 'uz').length, 1);
	assert.equal(compare(source, { nested: { heading: 'Салом {{name}}' } }, 'uz', true).length, 1);
	assert.equal(duplicateKeys('{"outer":{"key":"a","key":"b"}}', 'fixture').length, 1);
});
test('real i18next uses Uzbek counts/interpolation and English fallback through all four language transitions', async () => {
	const i18n = i18next.createInstance();
	const config = require('../next-i18next.config');
	const resources = Object.fromEntries(
		config.i18n.locales.map((locale) => [
			locale,
			{ common: JSON.parse(fs.readFileSync(`public/locales/${locale}/common.json`)) },
		]),
	);
	await i18n.init({ ...config, lng: 'uz', defaultNS: 'common', resources });
	for (const count of [0, 1, 2, 5, 21, 100]) {
		assert.equal(i18n.t('{{count}} days', { count }), `${count} kun`);
		assert.equal(i18n.t('{{count}} travelers', { count }), `${count} sayohatchi`);
		assert.equal(i18n.t('{{count}} comments', { count }), `${count} izoh`);
	}
	assert.equal(i18n.t('Account menu for {{name}}', { name: 'Aziza' }), 'Aziza uchun hisob menyusi');
	resources.en.common['test:fallback'] = 'English fallback';
	i18n.addResource('en', 'common', 'test:fallback', 'English fallback');
	assert.equal(i18n.t('test:fallback'), 'English fallback');
	for (const [locale, tours] of [
		['en', 'Tours'],
		['uz', 'Sayohatlar'],
		['kr', resources.kr.common.Tours],
		['ru', resources.ru.common.Tours],
		['en', 'Tours'],
	]) {
		await i18n.changeLanguage(locale);
		assert.equal(i18n.t('Tours'), tours);
	}
});
test('SSR translation loader reads a full Uzbek dictionary before rendering', async () => {
	const { serverSideTranslations } = require('next-i18next/serverSideTranslations');
	const props = await serverSideTranslations('uz', ['common']);
	assert.equal(props._nextI18Next.initialLocale, 'uz');
	assert.equal(props._nextI18Next.initialI18nStore.uz.common.Tours, 'Sayohatlar');
	assert.equal(props._nextI18Next.initialI18nStore.en.common.Tours, 'Tours');
});
test('Uzbek dates preserve the instant and USD formatting preserves the value and currency', () => {
	const { regionalLocale, formatDate, formatCurrency } = load('libs/triplink/locale.ts');
	assert.equal(regionalLocale('uz'), 'uz-UZ');
	assert.equal(regionalLocale('kr'), 'ko-KR');
	const iso = '2026-10-14T09:00:00.000Z';
	assert.equal(
		formatDate(iso, 'uz'),
		new Intl.DateTimeFormat('uz-UZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)),
	);
	assert.equal(formatDate('invalid', 'uz'), '—');
	assert.equal(formatCurrency(1234.56, 'uz', 'USD'), new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'USD' }).format(1234.56));
	assert.equal(
		new Intl.NumberFormat(regionalLocale('uz'), { style: 'currency', currency: 'USD' }).resolvedOptions().currency,
		'USD',
	);
});
test('Uzbek routes, refresh history and locale changes preserve page controls without mixing language-specific back links', () => {
	const { NavigationMemory, browsingRoute, MEMORY_KEY } = load('libs/triplink/browsingMemoryStore.ts');
	assert.deepEqual(browsingRoute('/uz/tour?text=Seoul&page=2#results'), {
		route: '/tour?page=2&text=Seoul',
		locale: 'uz',
		supported: true,
	});
	const memory = new NavigationMemory('/?text=Seoul');
	memory.active.ui['home:season'] = 'Spring';
	memory.active.y = 1800;
	memory.begin('/uz/?text=Seoul', 'uz');
	memory.commit();
	assert.equal(memory.active.y, 1800);
	assert.equal(memory.active.ui['home:season'], 'Spring');
	assert.equal(memory.active.home, undefined);
	const storage = new Map();
	memory.persist({ setItem: (key, value) => storage.set(key, value) });
	assert.ok(storage.has(MEMORY_KEY));
	const refreshed = new NavigationMemory('/uz/?text=Seoul');
	refreshed.load({ getItem: (key) => storage.get(key) });
	assert.equal(refreshed.get(memory.active.id).locale, 'uz');
	assert.equal(refreshed.get(memory.active.id).ui['home:season'], 'Spring');
});
