const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { JSDOM } = require('jsdom');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');

function load(path, mocks = {}) {
	const exports = {};
	new Function(
		'require',
		'exports',
		ts.transpileModule(fs.readFileSync(path, 'utf8'), {
			compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
		}).outputText,
	)((name) => mocks[name] ?? require(name), exports);
	return exports;
}

const { errorMessage } = load('libs/triplink/errors.ts');
const restriction = 'This tour has confirmed bookings and cannot be resubmitted for approval.';
const conflict = (message) => ({ graphQLErrors: [{ message, extensions: { code: 'CONFLICT' } }] });

test('confirmed-booking conflicts explain the restriction while unrelated conflicts retain retry guidance', () => {
	assert.equal(errorMessage(conflict('Cannot resubmit a tour with confirmed bookings.')), restriction);
	assert.equal(errorMessage(conflict('UPDATE_FAILED')), 'This record changed. Refresh and try again.');
	assert.equal(errorMessage({ networkError: new Error('offline') }), 'Unable to reach the server. Please retry.');
	for (const locale of ['en', 'kr', 'uz']) {
		const dictionary = JSON.parse(fs.readFileSync(`public/locales/${locale}/common.json`, 'utf8'));
		for (const key of [
			restriction,
			'Resubmit for approval',
			'Resubmitting returns this tour to Pending for admin approval. Tours with confirmed bookings cannot be resubmitted.',
			'Resubmit this tour for admin approval? It will be hidden from public listings. Tours with confirmed bookings cannot be resubmitted.',
		]) assert.equal(typeof dictionary[key], 'string', `${locale}: ${key}`);
	}
});

test('owned-tour resubmission explains its effect and renders a booking restriction without changing the tour', async () => {
	const original = Object.fromEntries(
		['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map((key) => [key, Object.getOwnPropertyDescriptor(global, key)]),
	);
	const dom = new JSDOM('<div id="root"></div>');
	global.window = dom.window;
	global.document = dom.window.document;
	global.IS_REACT_ACT_ENVIRONMENT = true;
	const confirmations = [];
	window.confirm = (message) => {
		confirmations.push(message);
		return true;
	};
	const t = (key, variables = {}) => key.replace(/\{\{(\w+)\}\}/g, (_, name) => variables[name] ?? '');
	const container = (tag) => function TestContainer({ children }) {
		return React.createElement(tag, null, children);
	};
	const mui = {
		Stack: container('div'), Box: container('div'), Card: container('article'), CardContent: container('div'),
		Typography: container('p'), Container: container('div'),
		Alert: ({ children }) => React.createElement('div', { role: 'alert' }, children),
		Button: ({ children, disabled, onClick }) => React.createElement('button', { disabled, onClick }, children),
		TextField: ({ value, onChange, children }) => React.createElement('select', { value, onChange }, children),
		MenuItem: ({ value, children }) => React.createElement('option', { value }, children),
	};
	const mutations = [];
	let fail = true;
	let refetches = 0;
	let status = 'ACTIVE';
	const tour = {
		_id: 'tour-id', tourTitle: 'Booked tour', tourAvailableSeats: 23, tourBookingCount: 1,
		tourFeatured: false, tourImages: ['photo.jpg'], tourAvailableDates: [{}], tourItinerary: [{}],
	};
	const apollo = {
		useMutation: (operation) => [async ({ variables }) => {
			mutations.push({ operation, variables });
			if (fail) throw conflict('Cannot resubmit a tour with confirmed bookings.');
		}],
		useQuery: () => ({
			loading: false, data: { result: { list: [{ ...tour, tourStatus: status }], metaCounter: [{ total: 1 }] } },
			refetch: async () => { refetches++; },
		}),
	};
	const common = load('libs/components/triplink/Common.tsx', {
		react: React, '@mui/material': mui, '@apollo/client': apollo,
		'next-i18next': { useTranslation: () => ({ t }) },
		'../../triplink/errors': { errorMessage }, '../../../apollo/store': {},
	});
	const { OwnedTours } = load('libs/components/triplink/TourManagement.tsx', {
		'next/image': function TestImage() { return null; },
		react: React, '@mui/material': mui, '@apollo/client': apollo,
		'next-i18next': { useTranslation: () => ({ t }) }, './Common': common,
		'../../../apollo/user/triplink': { UPDATE_TOUR: 'owner-update' },
		'../../../apollo/admin/triplink': { ADMIN_TOUR_UPDATE: 'admin-update' },
		'../../types/triplink': { totalOf: (value) => value?.metaCounter[0]?.total ?? 0 }, '../../uploads': {},
	});
	const root = createRoot(document.getElementById('root'));
	const button = (text) => [...document.querySelectorAll('button')].find((node) => node.textContent === text);
	const click = async (node) => act(async () => {
		node.click();
		await new Promise((resolve) => setImmediate(resolve));
	});
	try {
		await act(async () => root.render(React.createElement(OwnedTours)));
		assert(button('Resubmit for approval'));
		assert.equal(button('PENDING'), undefined);
		assert.match(document.body.textContent, /Tours with confirmed bookings cannot be resubmitted/);
		await click(button('Resubmit for approval'));
		assert.match(confirmations[0], /hidden from public listings/);
		assert.equal(document.querySelector('[role="alert"]').textContent, restriction);
		assert.equal(refetches, 0);
		assert.deepEqual(mutations[0], {
			operation: 'owner-update', variables: { input: { tourId: 'tour-id', tourStatus: 'PENDING' } },
		});
		assert.equal(document.querySelector('[data-status]').textContent, 'ACTIVE');
		assert.equal(document.querySelector('dd').textContent, '23');
		assert(button('Cancel tour'));

		// A historical booking count is not a confirmed-booking count; the API still decides eligibility.
		fail = false;
		await click(button('Resubmit for approval'));
		assert.equal(refetches, 1);
		assert.equal(document.querySelector('[role="alert"]').textContent, 'Saved');

		status = 'DRAFT';
		await act(async () => root.render(React.createElement(OwnedTours)));
		assert(button('Submit for approval'));
		assert.equal(button('Resubmit for approval'), undefined);
		await click(button('Submit for approval'));
		assert.equal(confirmations.at(-1), 'Change this tour to PENDING?');

		status = 'ACTIVE';
		await act(async () => root.render(React.createElement(OwnedTours, { admin: true })));
		assert.equal(button('Resubmit for approval'), undefined);
		assert(button('SOLD_OUT'));
		assert(button('COMPLETED'));
		assert(!document.body.textContent.includes('Tours with confirmed bookings cannot be resubmitted'));
	} finally {
		await act(async () => root.unmount());
		dom.window.close();
		for (const [key, descriptor] of Object.entries(original)) {
			if (descriptor) Object.defineProperty(global, key, descriptor);
			else delete global[key];
		}
	}
});
