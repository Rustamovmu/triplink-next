import sanitizeHtml from 'sanitize-html';

const format = 'triplink-rich-text-v1';
export const ARTICLE_CONTENT_LIMIT = 2000;
const color = /^(?:#[\da-f]{3,8}|rgba?\([\d\s.,%]+\))$/i;

export function safeArticleImage(src: string): boolean {
	try {
		const origin = process.env.REACT_APP_API_URL || 'http://localhost:3007';
		const url = new URL(src, `${origin}/`);
		return (
			url.origin === new URL(origin).origin &&
			/^\/uploads\/article\/[\w-]+\.(?:jpe?g|png)$/.test(url.pathname) &&
			!url.search &&
			!url.hash
		);
	} catch {
		return false;
	}
}

export function sanitizeArticleHtml(html: string): string {
	return sanitizeHtml(html, {
		allowedTags: [
			'p',
			'br',
			'h1',
			'h2',
			'h3',
			'h4',
			'h5',
			'h6',
			'strong',
			'em',
			'u',
			's',
			'span',
			'mark',
			'blockquote',
			'ul',
			'ol',
			'li',
			'pre',
			'code',
			'hr',
			'a',
			'img',
			'table',
			'thead',
			'tbody',
			'tr',
			'th',
			'td',
			'colgroup',
			'col',
			'label',
			'input',
			'div',
		],
		allowedAttributes: {
			p: ['style'],
			h1: ['style'],
			h2: ['style'],
			h3: ['style'],
			h4: ['style'],
			h5: ['style'],
			h6: ['style'],
			span: ['style'],
			mark: ['style', 'data-color'],
			a: ['href', 'target', 'rel'],
			img: ['src', 'alt', 'title'],
			ul: ['data-type'],
			ol: ['start'],
			li: ['data-type', 'data-checked'],
			input: ['type', 'checked', 'disabled'],
			th: ['colspan', 'rowspan', 'colwidth'],
			td: ['colspan', 'rowspan', 'colwidth'],
			col: ['style'],
		},
		allowedStyles: {
			'*': {
				'text-align': [/^(left|center|right|justify)$/],
				color: [color],
				'background-color': [color],
				width: [/^\d{1,4}px$/],
			},
		},
		allowedSchemes: ['http', 'https', 'mailto'],
		allowProtocolRelative: false,
		transformTags: {
			a: (tagName, attribs) => ({
				tagName,
				attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer nofollow' },
			}),
			input: (tagName, attribs) => ({
				tagName,
				attribs: { type: attribs.type, ...(attribs.checked !== undefined ? { checked: '' } : {}), disabled: '' },
			}),
		},
		exclusiveFilter: (frame) =>
			(frame.tag === 'img' && !safeArticleImage(frame.attribs.src || '')) ||
			(frame.tag === 'input' && frame.attribs.type !== 'checkbox'),
	});
}

export function readArticleContent(content: string): { rich: boolean; html: string } {
	if (!content) return { rich: false, html: '' };
	try {
		const value: unknown = JSON.parse(content);
		if (value && typeof value === 'object') {
			const record = value as Record<string, unknown>;
			if (record.format === format && typeof record.html === 'string')
				return { rich: true, html: sanitizeArticleHtml(record.html) };
		}
	} catch {
		// Existing articles contain plain text, which must never be interpreted as HTML.
	}
	return {
		rich: false,
		html: content
			.split(/\r?\n/)
			.map((line) => `<p>${escapeArticleText(line) || '<br>'}</p>`)
			.join(''),
	};
}

function escapeArticleText(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function articleText(content: string): string {
	const value = readArticleContent(content);
	if (!value.rich) return content;
	return htmlText(value.html);
}

function htmlText(html: string): string {
	return sanitizeHtml(html.replace(/<\/(?:p|h[1-6]|li|tr|td|th|blockquote|pre)>|<br\s*\/?\s*>/gi, '$& '), {
		allowedTags: [],
		allowedAttributes: {},
	})
		.replace(
			/&(?:amp|lt|gt|quot|apos|nbsp);/g,
			(entity) =>
				({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' }[entity] || entity),
		)
		.replace(/\s+/g, ' ')
		.trim();
}

export function serializeArticleContent(html: string): string {
	return JSON.stringify({ format, html: sanitizeArticleHtml(html) });
}

export function articleContentError(content: string): string | null {
	if (articleText(content).trim().length < 3) return 'Write at least 3 characters of article text.';
	if (content.trim().length > ARTICLE_CONTENT_LIMIT)
		return 'Your article is too long. Shorten the text or remove some formatting.';
	return null;
}
