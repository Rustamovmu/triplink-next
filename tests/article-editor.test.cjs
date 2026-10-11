const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { JSDOM } = require('jsdom');
const { createRoot } = require('react-dom/client');
const { act, Simulate } = require('react-dom/test-utils');
const load = (file, mocks) => {
	const exported = {};
	new Function(
		'require',
		'exports',
		ts.transpileModule(fs.readFileSync(file, 'utf8'), {
			compilerOptions: { module: 1, jsx: 2, esModuleInterop: true },
		}).outputText,
	)((name) => (name in mocks ? mocks[name] : require(name)), exported);
	return exported;
};
const format = load('libs/components/triplink/articleFormat.ts', {});
const contentView = load('libs/components/triplink/ArticleContent.tsx', { './articleFormat': format });
const t = (key, values = {}) => key.replace(/{{(\w+)}}/g, (_, name) => values[name] ?? '');
function environment() {
	const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost:3000', pretendToBeVisual: true });
	const globals = [
		'window',
		'document',
		'innerHeight',
		'innerWidth',
		'navigator',
		'Node',
		'Element',
		'HTMLElement',
		'MutationObserver',
		'DOMParser',
		'FormData',
		'getComputedStyle',
		'requestAnimationFrame',
		'cancelAnimationFrame',
		'IS_REACT_ACT_ENVIRONMENT',
	];
	const saved = Object.fromEntries(globals.map((key) => [key, Object.getOwnPropertyDescriptor(global, key)]));
	for (const key of globals)
		Object.defineProperty(global, key, {
			configurable: true,
			writable: true,
			value:
				key === 'IS_REACT_ACT_ENVIRONMENT'
					? true
					: typeof dom.window[key] === 'function' && /AnimationFrame|getComputedStyle/.test(key)
					? dom.window[key].bind(dom.window)
					: dom.window[key],
		});
	const rect = () => ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 });
	dom.window.Range.prototype.getBoundingClientRect = rect;
	dom.window.Range.prototype.getClientRects = () => [];
	dom.window.scrollTo = () => {};
	return {
		dom,
		cleanup: () => {
			dom.window.close();
			for (const [key, descriptor] of Object.entries(saved)) {
				if (descriptor) Object.defineProperty(global, key, descriptor);
				else delete global[key];
			}
		},
	};
}

test('rich article format round-trips marks, tables, tasks and uploads while preserving plain text', () => {
	const plain = '<script>literal text</script>\nA & B';
	assert.equal(format.articleText(plain), plain);
	assert.match(format.readArticleContent(plain).html, /&lt;script&gt;/);
	const html =
		'<h2 style="text-align:center">Seoul &amp; Busan</h2><p><strong>Travel</strong> <u>notes</u> <mark style="background-color:#fff0a8">today</mark></p><table><tbody><tr><td>One</td><td>Two</td></tr></tbody></table><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked></label><div><p>Pack</p></div></li></ul><img src="http://localhost:3007/uploads/article/photo.png" alt="A view">';
	const stored = format.serializeArticleContent(html);
	const result = format.readArticleContent(stored);
	assert.equal(result.rich, true);
	assert.match(result.html, /<strong>Travel<\/strong>/);
	assert.match(result.html, /text-align:center/);
	assert.match(result.html, /<table>/);
	assert.match(result.html, /disabled/);
	assert.match(result.html, /uploads\/article\/photo.png/);
	assert.equal(format.articleText(stored), 'Seoul & Busan Travel notes today One Two Pack');
	assert.equal(format.serializeArticleContent(result.html), stored);
	assert.equal(format.articleContentError(stored), null);
	const unknown = JSON.stringify({ format: 'future-format', html });
	assert.equal(format.readArticleContent(unknown).rich, false);
});

test('rich display strips active content, unsafe URLs, external images and unsafe styles', async () => {
	const env = environment();
	const root = createRoot(document.getElementById('root'));
	try {
		const unsafe = JSON.stringify({
			format: 'triplink-rich-text-v1',
			html: '<script>bad()</script><iframe src="https://evil.test"></iframe><p onclick="bad()" style="color:#123456;position:fixed;background-image:url(https://evil.test)">Safe words</p><a href="javascript:bad()">bad link</a><a href="https://example.com">good link</a><img onerror="bad()" src="https://evil.test/tracker.png"><img src="data:image/svg+xml,bad"><img src="http://localhost:3007/uploads/article/ok.png" onerror="bad()"><input type="text" value="secret">',
		});
		await act(async () => root.render(React.createElement(contentView.ArticleContent, { content: unsafe })));
		assert.equal(document.querySelector('script,iframe,input'), null);
		assert.equal(document.querySelector('p').getAttribute('onclick'), null);
		assert.equal(document.querySelector('p').style.position, '');
		assert.equal(document.querySelectorAll('img').length, 1);
		assert.equal(document.querySelector('img').getAttribute('onerror'), null);
		assert.equal(document.querySelectorAll('a')[0].getAttribute('href'), null);
		assert.equal(document.querySelectorAll('a')[1].rel, 'noopener noreferrer nofollow');
		await act(async () =>
			root.render(React.createElement(contentView.ArticleContent, { content: '<script>literal</script>' })),
		);
		assert.equal(document.querySelector('script'), null);
		assert.equal(document.querySelector('.triplink-plain-content').textContent, '<script>literal</script>');
	} finally {
		await act(async () => root.unmount());
		env.cleanup();
	}
});

test('article validation rejects blank markup and enforces the actual stored payload limit', () => {
	for (const html of ['<p></p>', '<p>  </p>', '<p>ab</p>', '<img src="uploads/article/ok.png">'])
		assert.match(format.articleContentError(format.serializeArticleContent(html)), /at least 3/);
	assert.equal(format.articleContentError('x'.repeat(2000)), null);
	assert.match(format.articleContentError('x'.repeat(2001)), /too long/);
	const prefix = format.serializeArticleContent('<p></p>').length;
	assert.equal(
		format.articleContentError(format.serializeArticleContent('<p>' + 'x'.repeat(2000 - prefix) + '</p>')),
		null,
	);
	assert.match(
		format.articleContentError(format.serializeArticleContent('<p>' + 'x'.repeat(2001 - prefix) + '</p>')),
		/too long/,
	);
	assert.equal(format.safeArticleImage('http://localhost:3007/uploads/article/ok.png'), true);
	assert.equal(format.safeArticleImage('//evil.test/uploads/article/ok.png'), false);
	assert.equal(format.safeArticleImage('/uploads/tour/ok.png'), false);
});

test('real editor toolbar formats text, handles undo/table operations, locks uploads and preserves content on failure', async () => {
	const env = environment();
	let instance,
		changes = [],
		ready,
		uploadBusy,
		resolve,
		reject,
		calls = 0,
		error;
	const tiptap = require('@tiptap/react');
	const box = ({ children }) => React.createElement('div', null, children);
	const editorModule = load('libs/components/triplink/Teditor.tsx', {
		'@tiptap/react': {
			...tiptap,
			useEditor: (options) => {
				instance = tiptap.useEditor(options);
				return instance;
			},
		},
		'next-i18next': { useTranslation: () => ({ t }) },
		'./articleFormat': format,
		'./Common': { imageUrl: (path) => `http://localhost:3007/${path}` },
		'../../uploads': {
			uploadImages: () => {
				calls++;
				return new Promise((yes, no) => {
					resolve = yes;
					reject = no;
				});
			},
		},
		'@mui/material': {
			Button: ({ children, onClick, disabled }) => React.createElement('button', { onClick, disabled }, children),
			Dialog: ({ open, children }) => (open ? box({ children }) : null),
			DialogActions: box,
			DialogContent: box,
			DialogTitle: box,
			TextField: ({ label, value, onChange, helperText }) =>
				React.createElement(
					'div',
					null,
					React.createElement('input', { 'aria-label': label, value, onChange }),
					React.createElement('p', null, helperText),
				),
		},
	}).default;
	const props = {
		initialContent: '',
		disabled: false,
		onChange: (value) => changes.push(value),
		onReady: (value) => {
			ready = value;
		},
		onUploadBusy: (value) => {
			uploadBusy = value;
		},
		onError: (value) => {
			error = value;
		},
	};
	const root = createRoot(document.getElementById('root'));
	const button = (label) => document.querySelector(`button[aria-label="${label}"]`);
	try {
		await act(async () => root.render(React.createElement(editorModule, props)));
		assert.equal(ready, true);
		assert.equal(changes.length, 0);
		assert.equal(document.querySelector('[role="textbox"]').getAttribute('aria-required'), 'true');
		await act(async () => {
			button('Bold').click();
			instance.commands.insertContent('A Seoul journey');
		});
		assert.match(format.readArticleContent(changes.at(-1)).html, /<strong>A Seoul journey<\/strong>/);
		await act(async () => button('Undo').click());
		assert.equal(format.articleText(changes.at(-1)), '');
		await act(async () => button('Redo').click());
		assert.equal(format.articleText(changes.at(-1)), 'A Seoul journey');
		await act(async () => {
			instance.commands.selectAll();
			button('Add link').click();
		});
		const apply = () => [...document.querySelectorAll('button')].find((b) => b.textContent === 'Apply link');
		await act(async () =>
			Simulate.change(document.querySelector('input[aria-label="Link URL"]'), {
				target: { value: 'javascript:bad()' },
			}),
		);
		await act(async () => apply().click());
		assert.match(document.body.textContent, /Enter a valid/);
		await act(async () =>
			Simulate.change(document.querySelector('input[aria-label="Link URL"]'), {
				target: { value: 'https://example.com/seoul' },
			}),
		);
		await act(async () => apply().click());
		assert.equal(document.querySelector('.tiptap a').getAttribute('href'), 'https://example.com/seoul');
		await act(async () => button('Remove link').click());
		assert.equal(document.querySelector('.tiptap a'), null);
		await act(async () => {
			instance.commands.focus('end');
			button('Insert table').click();
		});
		assert.ok(document.querySelector('table'));
		assert.ok(button('Delete table'));
		await act(async () => button('Delete table').click());
		assert.equal(document.querySelector('table'), null);
		const image = document.querySelector('input[aria-label="Insert image"]');
		const file = new window.File(['png'], 'seoul.png', { type: 'image/png' });
		await act(async () => Simulate.change(image, { target: { files: [file], value: '' } }));
		assert.equal(uploadBusy, true);
		assert.equal(button('Bold').disabled, true);
		assert.equal(instance.isEditable, false);
		await act(async () => Simulate.change(image, { target: { files: [file], value: '' } }));
		assert.equal(calls, 1);
		await act(async () => resolve(['uploads/article/seoul.png']));
		assert.equal(uploadBusy, false);
		assert.match(format.readArticleContent(changes.at(-1)).html, /uploads\/article\/seoul.png/);
		const before = changes.at(-1);
		await act(async () => Simulate.change(image, { target: { files: [file], value: '' } }));
		await act(async () => reject(new Error('Upload rejected')));
		assert.equal(error, 'Upload rejected');
		assert.equal(changes.at(-1), before);
		assert.equal(instance.isEditable, true);
		await act(async () => root.render(React.createElement(editorModule, { ...props, disabled: true })));
		assert.equal(button('Bold').disabled, true);
		assert.equal(instance.isEditable, false);
		changes = [];
		await act(async () =>
			root.render(
				React.createElement(editorModule, { ...props, key: 'plain', initialContent: '<b>Existing literal words</b>' }),
			),
		);
		assert.equal(changes.length, 0);
		assert.equal(document.querySelector('.tiptap').textContent, '<b>Existing literal words</b>');
		assert.equal(document.querySelector('.tiptap b'), null);
		await act(async () =>
			root.render(
				React.createElement(editorModule, {
					...props,
					key: 'rich',
					initialContent: format.serializeArticleContent(
						'<h2>Existing title</h2><p><strong>Existing journey</strong></p>',
					),
				}),
			),
		);
		assert.equal(document.querySelector('.tiptap h2').textContent, 'Existing title');
		assert.equal(document.querySelector('.tiptap strong').textContent, 'Existing journey');
		assert.equal(changes.length, 0);
	} finally {
		await act(async () => root.unmount());
		env.cleanup();
	}
});

test('article form validates before mutations and saves only editor content and allowed API fields', async () => {
	const env = environment();
	let calls = [],
		saved = 0;
	const box = ({ children, component = 'div', onSubmit, className }) =>
		React.createElement(component, { onSubmit, className }, children);
	const button = ({ children, type, onClick, disabled, component = 'button' }) =>
		React.createElement(component, { type, onClick, disabled }, children);
	const FakeEditor = ({ initialContent, onChange, onReady }) => {
		React.useEffect(() => {
			onReady(true);
			return () => onReady(false);
		}, [onReady]);
		return React.createElement('textarea', {
			'aria-label': 'Editor',
			defaultValue: initialContent,
			onChange: (event) => onChange(event.target.value),
		});
	};
	const mui = {
		Stack: box,
		Alert: ({ children }) => React.createElement('div', { role: 'alert' }, children),
		Button: button,
		TextField: ({ name, defaultValue, select, children }) =>
			select
				? React.createElement('select', { name, defaultValue }, children)
				: React.createElement('input', { name, defaultValue }),
		MenuItem: ({ value, children }) => React.createElement('option', { value }, children),
		Box: box,
	};
	const common = load('libs/components/triplink/Common.tsx', {
		'next-i18next': { useTranslation: () => ({ t }) },
		'@mui/material': mui,
		'@apollo/client': {},
		'../../../apollo/store': {},
		'../../triplink/errors': { errorMessage: (e) => e.message },
	});
	const { ArticleForm } = load('libs/components/triplink/Community.tsx', {
		'next-i18next': { useTranslation: () => ({ t }) },
		'next/link': { __esModule: true, default: box },
		'next/router': {},
		'next/dynamic': { __esModule: true, default: () => FakeEditor },
		'@mui/material': mui,
		'@apollo/client': { useMutation: (doc) => [async (options) => calls.push({ doc, ...options })] },
		'../../../apollo/user/triplink': { CREATE_ARTICLE: 'create', UPDATE_ARTICLE: 'update' },
		'../../../apollo/admin/triplink': {},
		'../../../apollo/store': {},
		'../../types/triplink': {},
		'./Common': common,
		'../../uploads': {},
		'./ArticleContent': contentView,
		'./articleFormat': format,
	});
	const root = createRoot(document.getElementById('root'));
	const submit = () =>
		act(async () =>
			document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })),
		);
	const change = (value) => act(async () => Simulate.change(document.querySelector('textarea'), { target: { value } }));
	try {
		await act(async () =>
			root.render(
				React.createElement(ArticleForm, {
					onSaved: async () => {
						saved++;
					},
				}),
			),
		);
		document.querySelector('input[name="title"]').value = ' Seoul notes ';
		await submit();
		assert.equal(calls.length, 0);
		assert.match(document.querySelector('[role="alert"]').textContent, /at least 3/);
		await change(format.serializeArticleContent('<p>' + 'x'.repeat(2000) + '</p>'));
		await submit();
		assert.equal(calls.length, 0);
		assert.match(document.querySelector('[role="alert"]').textContent, /too long/);
		const stored = format.serializeArticleContent('<p><strong>A real story</strong></p>');
		await change(stored);
		await submit();
		assert.deepEqual(calls[0], {
			doc: 'create',
			variables: { input: { articleCategory: 'FREE', articleTitle: 'Seoul notes', articleContent: stored } },
		});
		assert.equal(saved, 1);
		const article = {
			_id: 'a'.repeat(24),
			articleContent: 'Existing plain words',
			articleTitle: 'Existing story',
			articleCategory: 'NEWS',
			articleImage: 'uploads/article/cover.png',
		};
		await act(async () =>
			root.render(
				React.createElement(ArticleForm, {
					key: article._id,
					article,
					onSaved: async () => {
						saved++;
					},
				}),
			),
		);
		await submit();
		assert.equal(calls[1].doc, 'update');
		assert.deepEqual(calls[1].variables.input, {
			_id: article._id,
			articleCategory: 'NEWS',
			articleTitle: 'Existing story',
			articleContent: 'Existing plain words',
			articleImage: 'uploads/article/cover.png',
		});
		await change(stored);
		await submit();
		assert.equal(calls[2].variables.input.articleContent, stored);
	} finally {
		await act(async () => root.unmount());
		env.cleanup();
	}
});
