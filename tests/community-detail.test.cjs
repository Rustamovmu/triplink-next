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
 new Function('require', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: 1, jsx: 2, esModuleInterop: true },
 }).outputText)(name => { if (name === '../../triplink/BrowsingMemoryProvider') return require('./helpers/browsing-memory.cjs')(mocks);
		if (!(name in mocks)) throw new Error(`Missing mock ${name}`); return mocks[name]; }, exported);
 return exported;
};

const articleFormat = load('libs/components/triplink/articleFormat.ts', { 'sanitize-html': require('sanitize-html') });
const articleContent = load('libs/components/triplink/ArticleContent.tsx', { react: React, './articleFormat': articleFormat });
const editorMocks = { 'next/dynamic': { __esModule: true, default: () => () => null }, './articleFormat': articleFormat, './ArticleContent': articleContent };

test('article detail preserves safe content, public author links, independent likes and anonymous discussion access', async () => {
 const saved = Object.fromEntries(['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map(k => [k, Object.getOwnPropertyDescriptor(global, k)]));
 const dom = new JSDOM('<div id="root"></div>');
 global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true;
 const id = '6ac66f917bc245028739d705';
 let member = { _id: 'viewer', memberType: 'USER' }, calls = [], resolve, reject;
 let article = { _id: id, articleTitle: 'A real journey', articleContent: '<script>unsafe()</script>\nA traveler’s own words.', articleImage: 'uploads/story.jpg', articleCategory: 'FREE', articleLikes: 1, articleViews: 2, articleComments: 0, meLiked: false, createdAt: '2026-10-10T12:00:00Z', memberData: { _id: 'guide', memberType: 'AGENT', memberNick: 'Guide' } };
 const t = (key, values = {}) => key.replace(/{{(\w+)}}/g, (_, name) => values[name] ?? '');
 const box = ({ children, component = 'div', src, alt, onError, onSubmit, className }) => React.createElement(component, { src, alt, onError, onSubmit, className }, children);
 const mui = { Avatar: box, Box: box, Stack: box, Typography: box, Card: box, CardContent: box, Container: box, CircularProgress: box, Pagination: () => null,
  Button: ({ children, onClick, disabled, type, ...props }) => React.createElement('button', { onClick, disabled, type, 'aria-pressed': props['aria-pressed'] }, children),
  Alert: ({ children }) => React.createElement('div', { role: 'alert' }, children), TextField: () => null, MenuItem: box };
 const shared = { react: React, 'next-i18next': { useTranslation: () => ({ t }) }, '@mui/material': mui,
  '../../../apollo/store': { memberVar: 'member', sessionVar: 'session' },
  '@apollo/client': { useReactiveVar: v => v === 'member' ? member : 'authenticated', useQuery: doc => ({ loading: false, data: { result: doc === 'article' ? article : { list: [], metaCounter: [{ total: 0 }] } }, refetch: async () => {} }),
   useMutation: doc => [options => { calls.push({ doc, variables: options.variables }); return new Promise((yes, no) => { resolve = yes; reject = no; }); }] } };
 const common = load('libs/components/triplink/Common.tsx', { ...shared, '../../triplink/errors': { errorMessage: e => e.message } });
 const { CommunityDetail } = load('libs/components/triplink/Community.tsx', { ...shared, ...editorMocks,
  'next/link': { __esModule: true, default: ({ children, href, className }) => React.createElement('a', { href, className }, children) },
  'next/router': { useRouter: () => ({ locale: 'en', isReady: true, query: { id } }) },
  '../../../apollo/user/triplink': { ARTICLE: 'article', COMMENTS: 'comments', ARTICLE_LIKE: 'like' }, '../../../apollo/admin/triplink': {},
  '../../types/triplink': { totalOf: r => r?.metaCounter?.[0]?.total ?? 0 }, './Common': common, '../../uploads': {} });
 const root = createRoot(document.getElementById('root'));
 const render = () => act(async () => root.render(React.createElement(CommunityDetail)));
 const like = () => document.querySelector('.triplink-journal__engagement button');
 try {
  await render();
  assert.equal(document.querySelector('h1').textContent, article.articleTitle);
  assert.equal(document.querySelector('script'), null);
  assert.equal(document.querySelector('.triplink-journal__text').textContent, article.articleContent);
  assert.equal(document.querySelectorAll('a[href="/agent/detail?agentId=guide"]').length, 2);
  await act(async () => document.querySelector('figure img').dispatchEvent(new window.Event('error')));
  assert.equal(document.querySelector('figure img').getAttribute('src'), '/img/tour-placeholder.svg');
  await act(async () => { like().click(); like().click(); });
  assert.deepEqual(calls, [{ doc: 'like', variables: { articleId: id } }]);
  assert.equal(like().disabled, true);
  await act(async () => { article = { ...article, meLiked: true, articleLikes: 2 }; resolve({ data: { result: article } }); });
  await render(); assert.equal(like().getAttribute('aria-pressed'), 'true');
  assert.equal(document.querySelector('[role="alert"]'), null);
  await act(async () => like().click()); await act(async () => reject(new Error('Like rejected')));
  assert.match(document.querySelector('[role="alert"]').textContent, /Like rejected/);
  assert.equal(like().disabled, false);
  article = { ...article, memberData: { _id: 'traveler', memberType: 'USER', memberNick: 'Traveler' } }; await render();
  assert.equal(document.querySelectorAll('a[href="/member?memberId=traveler"]').length, 2);
  article = { ...article, memberData: null }; member = null; await render();
  assert.match(document.body.textContent, /Unavailable member/);
  assert.equal(document.querySelector('.triplink-journal__profile-link'), null);
  assert.equal(like(), null);
  assert.match(document.querySelector('#story-discussion a').textContent, /Log in to join the conversation/);
  assert.match(document.querySelector('#story-discussion').textContent, /No comments yet/);
 } finally {
  await act(async () => root.unmount()); dom.window.close();
  for (const [k, d] of Object.entries(saved)) { if (d) Object.defineProperty(global, k, d); else delete global[k]; }
 }
});
