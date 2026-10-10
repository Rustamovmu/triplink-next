const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { JSDOM } = require('jsdom');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');
const load = (file, mocks) => {
 const exported = {};
 new Function('require', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: 1, jsx: 2, esModuleInterop: true } }).outputText)(name => { if (!(name in mocks)) throw new Error(`Missing mock ${name}`); return mocks[name]; }, exported);
 return exported;
};
test('help topics and notices preserve public filters, pagination reset, safe text and detail dialogs', async () => {
 const saved = Object.fromEntries(['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map(k => [k, Object.getOwnPropertyDescriptor(global, k)]));
 const dom = new JSDOM('<div id="root"></div>');
 global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true;
 let list = [], input, detailInput;
 const entry = { _id: 'notice-id', noticeTitle: 'Travel update', noticeContent: '<script>literal content</script>', createdAt: '2026-10-10T12:00:00Z', faqTopic: 'TOURS' };
 const box = ({ children, id, className }) => React.createElement('div', { id, className }, children);
 const mui = { Stack: box, Typography: box, Accordion: box, AccordionSummary: box, AccordionDetails: box,
  TextField: ({ label, value, onChange }) => React.createElement('button', { 'data-search': true, onClick: () => onChange({ target: { value: value ? '' : '  trip  ' } }) }, label),
  Dialog: ({ children, open }) => open ? React.createElement('div', { role: 'dialog' }, children) : null,
  DialogActions: box, DialogContent: box, DialogTitle: box, Button: ({ children, onClick }) => React.createElement('button', { onClick }, children) };
 const mocks = { react: React, 'next-i18next': { useTranslation: () => ({ t: k => k }) }, '@mui/material': mui,
  '@apollo/client': { useQuery: (doc, options) => { if (doc === 'entries') input = options.variables.input; else detailInput = options;
   return { loading: false, data: { result: doc === 'entries' ? { list, metaCounter: [{ total: 30 }] } : entry }, refetch: async () => {} }; } },
  '../../../apollo/user/triplink': { HELP_ENTRIES: 'entries', HELP_ENTRY: 'entry' }, '../../types/triplink': {},
  '../triplink/Common': { usePublicReady: () => true, QueryState: ({ children }) => React.createElement(React.Fragment, null, children),
   displayDate: s => s, Pager: ({ onChange }) => React.createElement('button', { 'data-next': true, onClick: () => onChange(2) }, 'Next') } };
 for (const name of ['ExpandMore', 'ExploreOutlined', 'EventAvailableOutlined', 'CreditCardOutlined', 'PersonOutline', 'BadgeOutlined', 'ForumOutlined', 'HelpOutline', 'CampaignOutlined']) mocks['@mui/icons-material/' + name] = { __esModule: true, default: () => null };
 const Faq = load('libs/components/cs/Faq.tsx', mocks).default;
 const Notice = load('libs/components/cs/Notice.tsx', mocks).default;
 const root = createRoot(document.getElementById('root'));
 const render = Component => act(async () => root.render(React.createElement(Component)));
 try {
  await render(Faq); assert.deepEqual(input.search, { noticeCategory: 'FAQ' });
  assert.match(document.body.textContent, /No FAQs published yet/);
  await act(async () => document.querySelector('[data-next]').click()); assert.equal(input.page, 2);
  const tours = [...document.querySelectorAll('button')].find(b => b.textContent.startsWith('Tours'));
  await act(async () => tours.click()); assert.equal(input.page, 1); assert.deepEqual(input.search, { noticeCategory: 'FAQ', faqTopic: 'TOURS' });
  assert.equal(tours.getAttribute('aria-pressed'), 'true');
  await act(async () => document.querySelector('[data-search]').click()); assert.equal(input.search.text, 'trip');
  await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === 'Clear filters').click());
  assert.deepEqual(input.search, { noticeCategory: 'FAQ' });
  list = [entry]; await render(Faq); assert.match(document.body.textContent, /literal content/); assert.equal(document.querySelector('script'), null);
  await render(Notice); assert.deepEqual(input.search, { noticeCategory: 'NOTICE' }); assert.equal(detailInput.skip, true);
  await act(async () => document.querySelector('[aria-haspopup="dialog"]').click()); assert.equal(detailInput.skip, false); assert.deepEqual(detailInput.variables, { entryId: entry._id });
  assert.match(document.querySelector('[role="dialog"]').textContent, /Travel update/); assert.equal(document.querySelector('script'), null);
  await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === 'Close').click()); assert.equal(document.querySelector('[role="dialog"]'), null);
  list = []; await render(Notice); assert.match(document.body.textContent, /No notices published yet/);
 } finally { await act(async () => root.unmount()); dom.window.close(); for (const [k,d] of Object.entries(saved)) { if (d) Object.defineProperty(global,k,d); else delete global[k]; } }
});
