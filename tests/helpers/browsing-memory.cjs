const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Load the real shared layer in the existing source-transpiling component tests.
module.exports = function loadBrowsingMemory(mocks = {}) {
	const load = (filename) => {
		const exported = {};
		new Function(
			'require',
			'exports',
			ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
				compilerOptions: { module: 1, jsx: 2, esModuleInterop: true },
			}).outputText,
		)(
			(name) =>
				name in mocks
					? mocks[name]
					: name === './browsingMemoryStore'
					? load(path.resolve(path.dirname(filename), 'browsingMemoryStore.ts'))
					: require(name),
			exported,
		);
		return exported;
	};
	return load(path.resolve(__dirname, '../../libs/triplink/BrowsingMemoryProvider.tsx'));
};
