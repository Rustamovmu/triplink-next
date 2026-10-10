import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { useQuery } from '@apollo/client';
import { Avatar } from '@mui/material';
import { ARTICLES, COMMENTS } from '../../../apollo/user/triplink';
import { Article } from '../../types/triplink';
import { imageUrl, QueryState, usePublicReady } from '../triplink/Common';

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
		<div className="triplink-home-article__comments">
			<h4>{t('Home article comment count', { count: article.articleComments })}</h4>
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
		</div>
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
	return (
		<article className="triplink-home-article">
			<Link href={href} passHref className="triplink-home-article__photo" tabIndex={-1} aria-hidden="true">
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img
					src={!failed && article.articleImage ? imageUrl(article.articleImage) : '/img/tour-placeholder.svg'}
					alt=""
					width={640}
					height={400}
					loading="lazy"
					decoding="async"
					onError={() => setFailed(true)}
				/>
			</Link>
			<div className="triplink-home-article__body">
				<span className="triplink-home-article__category">{t(article.articleCategory)}</span>
				<h3>
					<Link href={href}>{article.articleTitle}</Link>
				</h3>
				<p className="triplink-home-article__excerpt">{article.articleContent}</p>
				<div className="triplink-home-article__author">
					<Avatar src={author?.memberImage ? imageUrl(author.memberImage) : undefined} alt="">
						{name.slice(0, 1)}
					</Avatar>
					<div>
						<p>{t('Written by {{name}}', { name })}</p>
						{!Number.isNaN(date.getTime()) && (
							<time dateTime={article.createdAt}>
								{date.toLocaleDateString(locale === 'kr' ? 'ko-KR' : locale === 'ru' ? 'ru-RU' : 'en-US', {
									year: 'numeric',
									month: 'short',
									day: 'numeric',
								})}
							</time>
						)}
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
