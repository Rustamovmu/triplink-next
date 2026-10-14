import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { useQuery } from '@apollo/client';
import { Avatar } from '@mui/material';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { ARTICLES, COMMENTS } from '../../../apollo/user/triplink';
import { Article } from '../../types/triplink';
import { imageUrl, QueryState, usePublicReady } from '../triplink/Common';
import { articleText } from '../triplink/articleFormat';

const articleInput = { page: 1, limit: 3, search: {}, sort: 'createdAt', direction: 'DESC' as const };

function ArticleComments({ article }: { article: Article }) {
	const { t } = useTranslation('common');
	const ready = usePublicReady();
	const query = useQuery(COMMENTS, {
		variables: {
			input: { page: 1, limit: 2, search: { commentRefId: article._id }, sort: 'createdAt', direction: 'DESC' },
		},
		skip: !ready,
		notifyOnNetworkStatusChange: true,
	});
	return (
		<details className="triplink-home-article__comments">
			<summary>{t('Home article comment count', { count: article.articleComments })}</summary>
			<QueryState loading={!ready || query.loading} error={query.error} retry={() => query.refetch()}>
				{query.data?.result.list.length ? (
					<ul>
						{query.data.result.list.map((comment) => (
							<li key={comment._id}>
								<strong>
									{comment.memberData?.memberFullname || comment.memberData?.memberNick || t('Community member')}
								</strong>
								<p>{comment.commentContent}</p>
							</li>
						))}
					</ul>
				) : (
					<p>{t('No comments yet')}</p>
				)}
			</QueryState>
			<Link href={`/community/detail?id=${article._id}`} className="triplink-home-article__link">
				{t('Read all comments')}
			</Link>
		</details>
	);
}

function HomeArticleCard({ article }: { article: Article }) {
	const { t } = useTranslation('common');
	const { locale } = useRouter();
	const [failed, setFailed] = useState(false);
	const author = article.memberData;
	const name = author?.memberFullname || author?.memberNick || t('Community member') || 'Community member';
	const href = `/community/detail?id=${article._id}`;
	const date = new Date(article.createdAt);
	const language = (locale === 'kr' ? 'ko-KR' : locale === 'ru' ? 'ru-RU' : locale === 'uz' ? 'uz-UZ' : 'en-US');
	const number = new Intl.NumberFormat(language);
	const text = articleText(article.articleContent);
	const cjkCharacters = (text.match(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/g) || []).length;
	const words = text.replace(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/g, '').match(/\S+/g)?.length || 0;
	const readingMinutes = Math.max(1, Math.ceil(words / 200 + cjkCharacters / 500));
	const placeholder = '/img/tour-placeholder.svg';
	let photo = placeholder;
	if (!failed && article.articleImage) {
		const source = imageUrl(article.articleImage);
		if (source.startsWith('/') && !source.startsWith('//')) photo = source;
		else {
			try {
				const url = new URL(source);
				const origin = new URL(process.env.REACT_APP_API_URL || 'http://localhost:3007');
				if (url.origin === origin.origin && url.pathname.startsWith('/uploads/article/')) photo = source;
			} catch {
				// Malformed or unsupported image paths keep the safe local fallback.
			}
		}
	}
	return (
		<article data-browse-item={`home:article:${article._id}`} className="triplink-home-article">
			<div className="triplink-home-article__visual">
				<Link href={href} passHref className="triplink-home-article__photo" tabIndex={-1} aria-hidden="true">
					<Image
						src={photo}
						alt={photo === placeholder ? '' : t('Article photo: {{title}}', { title: article.articleTitle })}
						fill
						sizes="(max-width: 767px) calc(100vw - 32px), (max-width: 1023px) calc((100vw - 80px) / 2), (max-width: 1320px) calc((100vw - 160px) / 3), 400px"
						loading="lazy"
						onError={() => setFailed(true)}
					/>
				</Link>
				<span className="triplink-home-article__category">{t(article.articleCategory)}</span>
				<span className="triplink-home-article__reading-time">
					<ScheduleRoundedIcon aria-hidden="true" />
					{t('Estimated {{count}} min read', { count: readingMinutes })}
				</span>
			</div>
			<div className="triplink-home-article__body">
				<h3>
					<Link href={href}>{article.articleTitle}</Link>
				</h3>
				<p className="triplink-home-article__excerpt">{text}</p>
				<div className="triplink-home-article__footnote">
					<div className="triplink-home-article__author">
						<Avatar src={author?.memberImage ? imageUrl(author.memberImage) : undefined} alt="">
							{name.slice(0, 1)}
						</Avatar>
						<div>
							<p>{t('Written by {{name}}', { name })}</p>
							{!Number.isNaN(date.getTime()) && (
								<time dateTime={article.createdAt}>
									{date.toLocaleDateString(language, {
										year: 'numeric',
										month: 'short',
										day: 'numeric',
									})}
								</time>
							)}
						</div>
					</div>
					<div className="triplink-home-article__stats">
						<div>
							<span
								role="img"
								aria-label={t('{{count}} views', {
									count: article.articleViews,
									displayCount: number.format(article.articleViews),
								})}
							>
								<VisibilityOutlinedIcon aria-hidden="true" />
								<span aria-hidden="true">{number.format(article.articleViews)}</span>
							</span>
							<span role="img" aria-label={t('{{count}} comments', { count: article.articleComments })}>
								<ChatBubbleOutlineRoundedIcon aria-hidden="true" />
								<span aria-hidden="true">{number.format(article.articleComments)}</span>
							</span>
						</div>
						<Link
							href={href}
							passHref
							className="triplink-home-article__story"
							aria-label={t('Read story: {{title}}', { title: article.articleTitle })}
						>
							{t('Read story')}
							<ArrowForwardRoundedIcon aria-hidden="true" />
						</Link>
					</div>
				</div>
				<ArticleComments article={article} />
			</div>
		</article>
	);
}

export function HomeArticles() {
	const ready = usePublicReady();
	const query = useQuery(ARTICLES, {
		variables: { input: articleInput },
		skip: !ready,
		notifyOnNetworkStatusChange: true,
	});
	return (
		<QueryState
			loading={!ready || query.loading}
			error={query.error}
			empty={!query.data?.result.list.length}
			retry={() => query.refetch()}
		>
			<div className="triplink-home-articles-grid">
				{query.data?.result.list.map((article) => (
					<HomeArticleCard key={JSON.stringify([article._id, article.articleImage])} article={article} />
				))}
			</div>
		</QueryState>
	);
}
