const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToString } = require('react-dom/server');
const { hydrateRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');
const { JSDOM } = require('jsdom');

// Isolate router readiness from Apollo and Material UI; exercise real React hydration.
let router;
let listInputs = [];
const originalLoad = Module._load;
const element =
	(tag, omit = []) =>
	({ children, ...props }) => {
		for (const key of omit) delete props[key];
		return React.createElement(tag, props, children);
	};
Module._load = function (name, parent, ...args) {
	if (name === 'next/router') return { useRouter: () => router };
	if (name === 'next-i18next') return { useTranslation: () => ({ t: (key) => key }) };
	if (name === './Common' && parent.filename.endsWith('/TourSearch.tsx'))
		return {
			Frame: ({ title, children }) =>
				React.createElement('div', null, React.createElement('h1', null, title), children),
		};
	if (name === './Tours' && parent.filename.endsWith('/TourSearch.tsx'))
		return {
			TourList: ({ input }) => {
				listInputs.push(input);
				return React.createElement('div', { 'data-list': true });
			},
		};
	if (name === '@mui/material')
		return {
			Alert: element('div', ['severity']),
			Button: element('button', ['variant']),
			Box: ({ component = 'div', sx, ...props }) => React.createElement(component, props),
			Stack: element('div', ['direction', 'spacing']),
			MenuItem: element('option'),
			TextField: ({ select, label, inputProps, InputLabelProps, children, ...props }) =>
				React.createElement(select ? 'select' : 'input', { ...props, ...inputProps, 'aria-label': label }, children),
		};
	return originalLoad.call(this, name, parent, ...args);
};
for (const extension of ['.ts', '.tsx'])
	require.extensions[extension] = (module, filename) =>
		module._compile(
			ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
				compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
			}).outputText,
			filename,
		);
const TourSearch = require('../libs/components/triplink/TourSearch.tsx').default;
Module._load = originalLoad;

test('static tour search hydrates with ready or delayed router, preserving URL filters and invalid-link handling', async () => {
	const previous = Object.fromEntries(
		['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map((key) => [
			key,
			Object.getOwnPropertyDescriptor(global, key),
		]),
	);
	try {
		for (const scenario of [
			{ query: {}, ready: true },
			{ query: { text: 'Seoul', seats: '2' }, ready: true },
			{ query: { text: 'Kyoto' }, ready: false },
			{ query: { input: '{invalid' }, ready: true, invalid: true },
		]) {
			router = { isReady: false, query: {}, asPath: '/tour', push: async () => true };
			listInputs = [];
			const markup = renderToString(React.createElement(TourSearch));
			assert.match(markup, /Loading/);
			assert.equal(listInputs.length, 0);
			const dom = new JSDOM(`<div id="root">${markup}</div>`, { url: 'http://localhost/tour' });
			global.window = dom.window;
			global.document = dom.window.document;
			global.IS_REACT_ACT_ENVIRONMENT = true;
			router = { ...router, isReady: scenario.ready, query: scenario.query };
			const errors = [];
			let root;
			try {
				await act(async () => {
					root = hydrateRoot(document.getElementById('root'), React.createElement(TourSearch), {
						onRecoverableError: (error) => errors.push(error.message),
					});
				});
				assert.deepEqual(errors, [], 'initial browser markup must match the static server markup');
				if (!scenario.ready) {
					assert.equal(document.querySelector('form'), null);
					assert.equal(listInputs.length, 0);
					router.isReady = true;
					await act(async () => root.render(React.createElement(TourSearch)));
				}
				if (scenario.invalid) {
					assert.equal(document.querySelector('form'), null);
					assert.match(document.body.textContent, /search link is invalid/);
					assert.equal(listInputs.length, 0);
				} else {
					assert.ok(document.querySelector('form'));
					assert.equal(document.querySelector('[name="text"]').value, scenario.query.text ?? '');
					assert.equal(listInputs.at(-1).search.text, scenario.query.text);
					if (scenario.query.seats) assert.equal(listInputs.at(-1).search.minimumAvailableSeats, 2);
				}
			} finally {
				if (root) await act(async () => root.unmount());
				dom.window.close();
			}
		}
	} finally {
		for (const [key, descriptor] of Object.entries(previous)) {
			if (descriptor) Object.defineProperty(global, key, descriptor);
			else delete global[key];
		}
	}
});
