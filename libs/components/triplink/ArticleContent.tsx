import React from 'react';
import { readArticleContent } from './articleFormat';

export function ArticleContent({ content }: { content: string }) {
	const value = readArticleContent(content);
	return value.rich ? (
		<div className="triplink-rich-content" dangerouslySetInnerHTML={{ __html: value.html }} />
	) : (
		<div className="triplink-plain-content">{content}</div>
	);
}
