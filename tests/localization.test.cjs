const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const i18next = require('i18next');
const { audit, compare, duplicateKeys } = require('../scripts/audit-translations.cjs');
function load(file, requireModule = require) {
	const exports = {};
	new Function(
		'exports',
		'require',
		ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: 1 } }).outputText,
	)(exports, requireModule);
	return exports;
}
test('all namespaces cover every existing locale key, preserve original translations and contain no missing literal UI keys', () => {
	const report = audit();
	assert.deepEqual(report.errors, []);
	assert.deepEqual(report.preserved, { en: true, kr: true });
	assert.ok(report.counts['uz/common.json'] >= report.counts['en/common.json']);
	assert.deepEqual(report.locales, ['en', 'kr', 'uz']);
	assert.deepEqual(fs.readdirSync('public/locales').sort(), ['en', 'kr', 'uz']);
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
test('real i18next uses Uzbek counts/interpolation and English fallback through all three language transitions', async () => {
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
test('homepage translations stay below the page-data budget with identical translations in all three locales', async () => {
	const { serverSideTranslations: originalLoader } = require('next-i18next/serverSideTranslations');
	const { serverSideTranslations } = load('libs/triplink/serverSideTranslations.ts');
	const config = require('../next-i18next.config');
	assert.ok(fs.readFileSync('pages/index.tsx', 'utf8').includes("from '../libs/triplink/serverSideTranslations'"));
	for (const locale of config.i18n.locales) {
		const original = await originalLoader(locale, ['common']);
		const compact = await serverSideTranslations(locale, ['common']);
		const resources = compact._nextI18Next.initialI18nStore;
		assert.deepEqual(resources[locale], original._nextI18Next.initialI18nStore[locale]);
		assert.deepEqual(compact._nextI18Next.userConfig, original._nextI18Next.userConfig);
		const pageData = {
			props: { pageProps: compact, __N_SSG: true }, page: '/', query: {}, buildId: 'test-build',
			isFallback: false, gsp: true, locale, locales: config.i18n.locales, defaultLocale: 'en',
		};
		assert.ok(Buffer.byteLength(JSON.stringify(pageData)) < 100 * 1024, `${locale} exceeds the homepage budget`);
		if (locale !== 'en') {
			assert.ok(Buffer.byteLength(JSON.stringify(original)) - Buffer.byteLength(JSON.stringify(compact)) > 50000);
		}
		const baseline = i18next.createInstance();
		const optimized = i18next.createInstance();
		await baseline.init({ ...config, lng: locale, defaultNS: 'common', resources: original._nextI18Next.initialI18nStore });
		await optimized.init({ ...config, lng: locale, defaultNS: 'common', resources });
		const keys = new Set([...Object.keys(resources[locale].common), ...Object.keys(original._nextI18Next.initialI18nStore.en.common)]);
		for (const key of keys) {
			for (const count of [0, 1, 2, 5, 21, 100]) {
				const options = { count, displayCount: String(count), name: 'Aziza', total: 12, current: 2 };
				assert.equal(optimized.t(key, options), baseline.t(key, options), `${locale}: ${key}, count=${count}`);
			}
		}
		const nextRequest = await originalLoader(locale, ['common']);
		assert.deepEqual(nextRequest, original, 'compaction must not modify the shared server resources');
	}
});
test('homepage loader retains missing, empty and null English fallbacks without mutating shared dictionaries', async () => {
	const config = require('../next-i18next.config');
	const original = {
		_nextI18Next: {
			initialLocale: 'uz', ns: ['common'], userConfig: config,
			initialI18nStore: {
				uz: { common: { Tours: 'Sayohatlar', Empty: '', Null: null } },
				en: { common: {
					Tours: 'Tours', Empty: 'Empty fallback', Null: 'Null fallback',
					'Missing {{name}}': 'Welcome {{name}}',
					'Fallback count_one': '{{count}} item', 'Fallback count_other': '{{count}} items',
				} },
			},
		},
	};
	const snapshot = JSON.stringify(original);
	Object.freeze(original._nextI18Next.initialI18nStore.en.common);
	const { serverSideTranslations } = load('libs/triplink/serverSideTranslations.ts', (name) => {
		assert.equal(name, 'next-i18next/serverSideTranslations');
		return { serverSideTranslations: async () => original };
	});
	const compact = await serverSideTranslations('uz', ['common']);
	assert.equal(JSON.stringify(original), snapshot);
	assert.equal(compact._nextI18Next.initialI18nStore.en.common.Tours, undefined);
	const i18n = i18next.createInstance();
	await i18n.init({
		...config, lng: 'uz', defaultNS: 'common', returnNull: false, returnEmptyString: false,
		resources: compact._nextI18Next.initialI18nStore,
	});
	assert.equal(i18n.t('Tours'), 'Sayohatlar');
	assert.equal(i18n.t('Empty'), 'Empty fallback');
	assert.equal(i18n.t('Null'), 'Null fallback');
	assert.equal(i18n.t('Missing {{name}}', { name: 'Aziza' }), 'Welcome Aziza');
	for (const count of [0, 1, 2, 5, 21, 100]) {
		assert.equal(i18n.t('Fallback count', { count }), `${count} ${count === 1 ? 'item' : 'items'}`);
	}
	assert.strictEqual(await serverSideTranslations('en', ['common']), original);
});
test('About and Help Center loaders use only supported locales and stay below 128 kB', async () => {
	const { i18n } = require('../next-i18next.config');
	for (const file of ['pages/about/index.tsx', 'pages/help-center/index.tsx']) {
		const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
		// Execute the page's actual data loader without loading its client components.
		const source = ast.statements.filter((statement) =>
			(ts.isImportDeclaration(statement) && statement.moduleSpecifier.text.endsWith('/serverSideTranslations')) ||
			(ts.isVariableStatement(statement) && statement.declarationList.declarations.some((d) => d.name.getText(ast) === 'getStaticProps')),
		).map((statement) => statement.getText(ast)).join('\n');
		const exports = {};
		new Function('require', 'exports', ts.transpileModule(source, { compilerOptions: { module: 1 } }).outputText)(require, exports);
		for (const locale of i18n.locales) {
			const { props } = await exports.getStaticProps({ locale });
			assert.equal(props._nextI18Next.initialLocale, locale);
			assert.deepEqual(Object.keys(props._nextI18Next.initialI18nStore).sort(), [...new Set([locale, 'en'])].sort());
			assert.ok(Object.keys(props._nextI18Next.initialI18nStore[locale].common).length >= 1027);
			assert.ok(Buffer.byteLength(JSON.stringify(props)) + 1024 < 128 * 1024, `${file}: ${locale} exceeds the page-data budget`);
		}
	}
});
test('browsing memory discards obsolete Russian entries and keeps supported-language entries', () => {
	const { NavigationMemory, browsingRoute, MEMORY_KEY } = load('libs/triplink/browsingMemoryStore.ts');
	const memory = new NavigationMemory('/tour', 'uz');
	const supported = memory.active;
	const obsolete = memory.create('/tour', 'ru');
	const stored = JSON.stringify({ version: 1, active: obsolete.id, entries: [supported, obsolete] });
	memory.load({ getItem: (key) => key === MEMORY_KEY ? stored : null });
	assert.equal(memory.get(obsolete.id), undefined);
	assert.equal(memory.get(supported.id).locale, 'uz');
	assert.equal(browsingRoute('/ru/tour').supported, false);
});
test('Uzbek dates preserve the instant and USD formatting preserves the value and currency', () => {
	const { regionalLocale, formatDate, formatCurrency } = load('libs/triplink/locale.ts');
	assert.equal(regionalLocale('uz'), 'uz-UZ');
	assert.equal(regionalLocale('kr'), 'ko-KR');
	assert.equal(regionalLocale('ru'), 'en-US');
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
