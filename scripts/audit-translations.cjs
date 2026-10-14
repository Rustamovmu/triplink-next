const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const locales = require('../next-i18next.config').i18n.locales;
const variables = (value) => [...value.matchAll(/{{\s*([^}]+?)\s*}}/g)].map((m) => m[1]).sort();

function flatten(value, prefix = '', result = {}) {
	for (const [key, entry] of Object.entries(value)) {
		const full = prefix ? `${prefix}.${key}` : key;
		if (entry && typeof entry === 'object' && !Array.isArray(entry)) flatten(entry, full, result);
		else result[full] = entry;
	}
	return result;
}
function duplicateKeys(source, filename) {
	const errors = [];
	const ast = ts.parseJsonText(filename, source);
	function visit(node) {
		if (ts.isObjectLiteralExpression(node)) {
			const seen = new Set();
			for (const property of node.properties) {
				const key = property.name?.text;
				if (seen.has(key)) errors.push(`${filename}: duplicate key ${key}`);
				seen.add(key);
			}
		}
		ts.forEachChild(node, visit);
	}
	visit(ast);
	return errors;
}
function compare(reference, translated, label, latin = false) {
	const errors = [];
	const source = flatten(reference),
		target = flatten(translated);
	for (const [key, value] of Object.entries(source)) {
		if (!(key in target)) errors.push(`${label}: missing ${key}`);
		else if (typeof target[key] !== 'string' || !target[key].trim()) errors.push(`${label}: empty or invalid ${key}`);
		else if (JSON.stringify(variables(value)) !== JSON.stringify(variables(target[key])))
			errors.push(`${label}: interpolation mismatch ${key}`);
	}
	if (latin)
		for (const [key, value] of Object.entries(target)) {
			if (typeof value === 'string' && /\p{Script=Cyrillic}/u.test(value))
				errors.push(`${label}: Cyrillic value ${key}`);
		}
	return errors;
}
function files(directory, extension) {
	return fs.readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
		const name = path.join(directory, item.name);
		return item.isDirectory() ? files(name, extension) : extension.test(name) ? [name] : [];
	});
}
function audit() {
	const errors = [],
		preserved = {},
		counts = {},
		unchangedUzbek = [];
	const namespaces = fs.readdirSync(path.join(root, 'public/locales/en')).filter((file) => file.endsWith('.json'));
	const dictionaries = {};
	for (const namespace of namespaces) {
		const all = {};
		for (const locale of locales) {
			const name = `public/locales/${locale}/${namespace}`;
			try {
				const source = fs.readFileSync(path.join(root, name), 'utf8');
				errors.push(...duplicateKeys(source, name));
				all[locale] = JSON.parse(source);
				counts[`${locale}/${namespace}`] = Object.keys(flatten(all[locale])).length;
				if (locale !== 'uz') {
					const original = JSON.parse(
						cp.execFileSync('git', ['show', `HEAD:${name}`], { cwd: root, encoding: 'utf8' }),
					);
					const changed = Object.keys(original).filter(
						(key) => JSON.stringify(original[key]) !== JSON.stringify(all[locale][key]),
					);
					preserved[locale] = changed.length === 0;
					errors.push(...changed.map((key) => `${locale}: existing translation changed ${key}`));
				}
			} catch (error) {
				errors.push(`${name}: ${error.message}`);
			}
		}
		if (!all.en || !all.uz) continue;
		for (const locale of locales)
			if (all[locale]) errors.push(...compare(all.en, all[locale], `${locale}/${namespace}`, locale === 'uz'));
		// Include extra plural forms present in the other existing languages.
		for (const locale of ['kr', 'ru'])
			if (all[locale]) errors.push(...compare(all[locale], all.uz, `uz matching ${locale}/${namespace}`, true));
		for (const [key, value] of Object.entries(all.uz)) {
			if (
				value === all.en[key] &&
				![
					'Bali',
					'Lofoten',
					'Santorini',
					'Petra',
					'Istanbul',
					'Sossusvlei',
					'Oktoberfest',
					'TripLink AI',
					'Agent',
				].includes(value)
			)
				unchangedUzbek.push(key);
		}
		dictionaries[namespace.replace('.json', '')] = all.en;
	}
	const sourceKeys = new Set(),
		dynamicCalls = [];
	for (const file of [...files(path.join(root, 'libs'), /\.tsx?$/), ...files(path.join(root, 'pages'), /\.tsx?$/)]) {
		const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
		function literalKeys(node) {
			if (ts.isStringLiteralLike(node)) return [node.text];
			if (ts.isConditionalExpression(node)) return [...literalKeys(node.whenTrue), ...literalKeys(node.whenFalse)];
			return [];
		}
		function visit(node) {
			if (ts.isCallExpression(node) && node.expression.getText(ast) === 't' && node.arguments[0]) {
				const keys = literalKeys(node.arguments[0]);
				if (!keys.length)
					dynamicCalls.push(path.relative(root, file) + ':' + (ast.getLineAndCharacterOfPosition(node.pos).line + 1));
				for (const key of keys) {
					sourceKeys.add(key);
					if (!Object.values(dictionaries).some((dictionary) => key in dictionary))
						errors.push(`${path.relative(root, file)}: missing source key ${key}`);
				}
			}
			ts.forEachChild(node, visit);
		}
		visit(ast);
	}
	if (unchangedUzbek.length) errors.push(...unchangedUzbek.map((key) => `uz: unchanged English value ${key}`));
	return {
		namespaces,
		locales,
		counts,
		preserved,
		literalSourceKeys: sourceKeys.size,
		dynamicCalls,
		unchangedUzbek,
		errors,
	};
}
module.exports = { audit, compare, duplicateKeys };
if (require.main === module) {
	const report = audit();
	const output = JSON.stringify(report, null, 2) + '\n';
	const target = process.argv.indexOf('--report');
	if (target >= 0) fs.writeFileSync(process.argv[target + 1], output);
	console.log(output);
	process.exitCode = report.errors.length ? 1 : 0;
}
