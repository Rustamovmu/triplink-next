import { useTranslation } from 'next-i18next';
import React, { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { BrowsingBackLink, useRememberedState } from '../../triplink/BrowsingMemoryProvider';
import { useMutation, useQuery, useReactiveVar } from '@apollo/client';
import { Alert, Avatar, Box, Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material';
import {
	ARTICLES,
	ARTICLE,
	ARTICLE_LIKE,
	CREATE_ARTICLE,
	UPDATE_ARTICLE,
	COMMENTS,
	CREATE_COMMENT,
	UPDATE_COMMENT,
} from '../../../apollo/user/triplink';
import {
	ADMIN_ARTICLES,
	ADMIN_ARTICLE_UPDATE,
	ADMIN_ARTICLE_REMOVE,
	ADMIN_COMMENTS,
	ADMIN_COMMENT_UPDATE,
	ADMIN_COMMENT_REMOVE,
} from '../../../apollo/admin/triplink';
import { memberVar } from '../../../apollo/store';
import { Article, ArticleCategory, Comment, totalOf } from '../../types/triplink';
import { Frame, imageUrl, Pager, QueryState, useAction, usePublicReady, validId } from './Common';
import { uploadImages } from '../../uploads';
import { ArticleContent } from './ArticleContent';
import { articleContentError, articleText } from './articleFormat';

const Teditor = dynamic(() => import('./Teditor'), { ssr: false, loading: EditorLoading });
function EditorLoading() {
	const { t } = useTranslation('common');
	return <div className="triplink-editor__loading" role="status">{t('Loading editor…')}</div>;
}
const categories: ArticleCategory[] = ['FREE', 'RECOMMEND', 'NEWS', 'HUMOR'];
export function ArticleForm({ article, onSaved }: { article?: Article; onSaved: () => Promise<unknown> }) {
	const { t } = useTranslation('common');

	const action = useAction();
	const [image, setImage] = useState(article?.articleImage ?? '');
	const [content, setContent] = useState(article?.articleContent ?? '');
	const [contentError, setContentError] = useState('');
	const [editorReady, setEditorReady] = useState(false);
	const [uploadBusy, setUploadBusy] = useState(false);
	const busy = action.busy || uploadBusy;
	const [create] = useMutation(CREATE_ARTICLE);
	const [update] = useMutation(UPDATE_ARTICLE);
	return (
		<Stack
			component="form"
			className="triplink-workspace-form triplink-article-form"
			spacing={2}
			onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
				event.preventDefault();
				if (busy || !editorReady) return;
				const error = articleContentError(content);
				if (error) { setContentError(error); return; }
				setContentError('');
				const data = new FormData(event.currentTarget);
				void action.run(async () => {
					const input = {
						articleCategory: String(data.get('category')) as ArticleCategory,
						articleTitle: String(data.get('title')).trim(),
						articleContent: content.trim(),
						...(image ? { articleImage: image } : {}),
					};
					if (article) await update({ variables: { input: { ...input, _id: article._id } } });
					else await create({ variables: { input } });
					await onSaved();
				});
			}}
		>
			{action.feedback}
			<TextField select name="category" label={t('Category')} defaultValue={article?.articleCategory ?? 'FREE'}>
				{categories.map((value) => (
					<MenuItem key={value} value={value}>
						{t(String(value))}
					</MenuItem>
				))}
			</TextField>
			<TextField
				required
				name="title"
				label={t('Title')}
				defaultValue={article?.articleTitle ?? ''}
				inputProps={{ minLength: 3, maxLength: 50 }}
			/>
			<Teditor key={article?._id ?? 'new'} initialContent={article?.articleContent ?? ''} disabled={action.busy}
				onChange={(value) => { setContent(value); setContentError(''); }} onReady={setEditorReady}
				onUploadBusy={setUploadBusy} onError={setContentError} />
			{contentError && <Alert severity="error">{t(contentError)}</Alert>}
			<Button component="label" variant="outlined" disabled={busy}>
				{t('Upload article image')}
				<input
					type="file"
					accept="image/jpeg,image/png"
					disabled={busy}
					hidden
					onChange={(e) => {
						const files = Array.from(e.target.files ?? []);
						void action.run(async () => setImage((await uploadImages(files, 'article'))[0]));
						e.target.value = '';
					}}
				/>
			</Button>
			{image && (
				<Box
					component="img"
					onError={(event: React.SyntheticEvent<HTMLImageElement>) => {
						const target = event.currentTarget;
						target.onerror = null;
						if (!target.src.endsWith('/img/tour-placeholder.svg')) target.src = '/img/tour-placeholder.svg';
					}}
					src={imageUrl(image)}
					alt={t('Article upload')}
					sx={{ maxWidth: '100%', maxHeight: 250, objectFit: 'contain' }}
				/>
			)}
			<Button type="submit" variant="contained" disabled={busy || !editorReady}>
				{t(article ? 'Save article' : 'Publish article')}
			</Button>
		</Stack>
	);
}
const categoryLabels: Record<ArticleCategory, string> = {
	FREE: 'Travel stories',
	RECOMMEND: 'Tips & recommendations',
	NEWS: 'Travel news',
	HUMOR: 'Just for fun',
};
export function CommunityArticleCard({ article, onChanged }: { article: Article; onChanged: () => Promise<unknown> }) {
	const { t } = useTranslation('common');
	const { locale = 'en' } = useRouter();
	const member = useReactiveVar(memberVar);
	const action = useAction();
	const [like] = useMutation(ARTICLE_LIKE);
	const [failed, setFailed] = useState(false);
	const href = `/community/detail?id=${article._id}`;
	const author = article.memberData;
	const authorName = author?.memberFullname || author?.memberNick || t('Unavailable member');
	const authorHref =
		author && author.memberType !== 'ADMIN'
			? author.memberType === 'AGENT'
				? `/agent/detail?agentId=${author._id}`
				: `/member?memberId=${author._id}`
			: null;
	const date = new Date(article.createdAt);
	return (
		<article data-browse-item={`community:article:${article._id}`} className="triplink-story-card">
			<Link
				href={href}
				passHref
				className={`triplink-story-card__visual triplink-story-card__visual--${article.articleCategory.toLowerCase()}`}
				aria-label={t('Read {{title}}', { title: article.articleTitle })}
			>
				{article.articleImage && !failed ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img
						src={imageUrl(article.articleImage)}
						alt={article.articleTitle}
						width={600}
						height={400}
						loading="lazy"
						onError={() => setFailed(true)}
					/>
				) : (
					<span className="triplink-story-card__cover-text">{t(categoryLabels[article.articleCategory])}</span>
				)}
				<span className="triplink-story-card__badge">{t(categoryLabels[article.articleCategory])}</span>
			</Link>
			<div className="triplink-story-card__body">
				{!Number.isNaN(date.getTime()) && (
					<time dateTime={article.createdAt}>
						{new Intl.DateTimeFormat((locale === 'kr' ? 'ko-KR' : locale === 'ru' ? 'ru-RU' : locale === 'uz' ? 'uz-UZ' : 'en-US'), {
							month: 'short',
							day: 'numeric',
							year: 'numeric',
						}).format(date)}
					</time>
				)}
				<h3>
					<Link href={href}>{article.articleTitle}</Link>
				</h3>
				<p className="triplink-story-card__excerpt">{articleText(article.articleContent)}</p>
				<div className="triplink-story-card__author">
					<Avatar src={author?.memberImage ? imageUrl(author.memberImage) : undefined} alt={String(authorName)}>
						{String(authorName)[0]?.toUpperCase()}
					</Avatar>
					{authorHref ? <Link href={authorHref}>{authorName}</Link> : <span>{authorName}</span>}
				</div>
				<div className="triplink-story-card__footer">
					{member ? (
						<button
							type="button"
							disabled={action.busy}
							aria-pressed={article.meLiked}
							aria-label={t(article.meLiked ? 'Unlike {{title}}' : 'Like {{title}}', { title: article.articleTitle })}
							onClick={() =>
								void action.run(async () => {
									await like({ variables: { articleId: article._id } });
									await onChanged();
								}, null)
							}
						>
							<span aria-hidden="true">{article.meLiked ? '♥' : '♡'}</span>{' '}
							{t('Community like count', { count: article.articleLikes })}
						</button>
					) : (
						<Link href="/account/join" aria-label={t('Login to like {{title}}', { title: article.articleTitle })}>
							♡ {t('Community like count', { count: article.articleLikes })}
						</Link>
					)}
					<span>{t('Home article comment count', { count: article.articleComments })}</span>
					<Link href={href} passHref className="triplink-story-card__read">
						{t('Read story')} <span aria-hidden="true">↗</span>
					</Link>
				</div>
				{action.feedback}
			</div>
		</article>
	);
}
export function ArticlesList({
	mine = false,
	admin = false,
	memberId,
	community = false,
}: {
	mine?: boolean;
	admin?: boolean;
	memberId?: string;
	community?: boolean;
}) {
	const { t } = useTranslation('common');

	const member = useReactiveVar(memberVar);
	const ready = usePublicReady();
	const [page, setPage] = useRememberedState('community:page', 1, community);
	const [category, setCategory] = useRememberedState<ArticleCategory | ''>('community:category', '', community);
	const [status, setStatus] = useState<Article['articleStatus']>('ACTIVE');
	const [editing, setEditing] = useState<Article | null>(null);
	const [commentsFor, setCommentsFor] = useState('');
	const action = useAction();
	const [ownerDelete] = useMutation(UPDATE_ARTICLE);
	const [adminDelete] = useMutation(ADMIN_ARTICLE_UPDATE);
	const [remove] = useMutation(ADMIN_ARTICLE_REMOVE);
	const publicQuery = useQuery(ARTICLES, {
		variables: {
			input: {
				page,
				limit: 12,
				search: {
					...(category ? { articleCategory: category } : {}),
					...(memberId ? { memberId } : mine && member ? { memberId: member._id } : {}),
				},
			},
		},
		skip: !ready || admin || (mine && !member),
		fetchPolicy: community ? 'cache-and-network' : 'network-only',
	});
	const adminQuery = useQuery(ADMIN_ARTICLES, {
		variables: { input: { page, limit: 12, search: { articleStatus: status } } },
		skip: !ready || !admin,
		fetchPolicy: 'network-only',
	});
	const query = admin ? adminQuery : publicQuery;
	if (community)
		return (
			<section
				data-browse-section="community:feed"
				data-browse-pending={!ready || (query.loading && !query.data) ? 'true' : undefined}
				className="triplink-community__feed"
				aria-labelledby="community-feed-title"
			>
				<div className="triplink-community__feed-heading">
					<div>
						<h2 id="community-feed-title">{t('Stories from the community')}</h2>
						<p>{t('Fresh perspectives for your next journey.')}</p>
					</div>
				</div>
				<div className="triplink-community__filters" role="group" aria-label={t('Article categories')}>
					{(['', ...categories] as const).map((value) => (
						<button
							type="button"
							key={value || 'all'}
							aria-pressed={category === value}
							onClick={() => {
								setCategory(value);
								setPage(1);
							}}
						>
							{t(value ? categoryLabels[value] : 'All stories')}
						</button>
					))}
				</div>
				<QueryState
					loading={!ready || (query.loading && !query.data)}
					error={query.error}
					retry={() => query.refetch()}
				>
					{query.data?.result.list.length ? (
						<div className="triplink-community__grid">
							{query.data.result.list.map((article) => (
								<CommunityArticleCard key={article._id} article={article} onChanged={() => query.refetch()} />
							))}
						</div>
					) : (
						<div className="triplink-community__empty">
							<h3>{t('No stories here yet')}</h3>
							<p>{t('Try another category to discover more from the community.')}</p>
						</div>
					)}
				</QueryState>
				<Pager page={page} total={totalOf(query.data?.result)} onChange={setPage} />
			</section>
		);
	if (editing)
		return (
			<Stack spacing={2}>
				<Button onClick={() => setEditing(null)}>{t('Back to articles')}</Button>
				<ArticleForm
					article={editing}
					onSaved={async () => {
						setEditing(null);
						await query.refetch();
					}}
				/>
			</Stack>
		);
	return (
		<Stack spacing={2} className={mine && !admin ? 'triplink-owned-articles' : undefined}>
			{action.feedback}
			<div className={mine && !admin ? 'triplink-owned-articles__toolbar' : undefined}>
				{mine && !admin && query.data && !query.loading && !query.error && (
					<Typography className="triplink-owned-articles__count">
						<strong>{totalOf(query.data.result)}</strong> {t('Articles')}
					</Typography>
				)}
				{admin ? (
					<TextField
						select
						label={t('Status')}
						value={status}
						onChange={(e) => {
							setStatus(e.target.value as Article['articleStatus']);
							setPage(1);
						}}
					>
						{['ACTIVE', 'DELETE'].map((value) => (
							<MenuItem key={value} value={value}>
								{t(String(value))}
							</MenuItem>
						))}
					</TextField>
				) : (
					<TextField
						select
						label={t('Category')}
						value={category}
						SelectProps={{ displayEmpty: true }}
						InputLabelProps={{ shrink: true }}
						onChange={(e) => {
							setCategory(e.target.value as ArticleCategory | '');
							setPage(1);
						}}
					>
						<MenuItem value="">{t('All')}</MenuItem>
						{categories.map((value) => (
							<MenuItem key={value} value={value}>
								{t(String(value))}
							</MenuItem>
						))}
					</TextField>
				)}
			</div>
			<QueryState
				loading={!ready || query.loading}
				error={query.error}
				empty={!query.data?.result.list.length}
				retry={() => query.refetch()}
			>
				{query.data?.result.list.map((article) => (
					<Card
						key={article._id}
						variant="outlined"
						className={mine && !admin ? 'triplink-owned-articles__card' : undefined}
					>
						<CardContent>
							<Stack spacing={2} className={mine && !admin ? 'triplink-owned-articles__row' : undefined}>
								{mine && !admin ? (
									<>
										<div className="triplink-owned-articles__photo">
											<Box
												component="img"
												src={article.articleImage ? imageUrl(article.articleImage) : '/img/tour-placeholder.svg'}
												alt=""
												loading="lazy"
												onError={(event: React.SyntheticEvent<HTMLImageElement>) => {
													if (!event.currentTarget.src.endsWith('/img/tour-placeholder.svg'))
														event.currentTarget.src = '/img/tour-placeholder.svg';
												}}
											/>
										</div>
										<div className="triplink-owned-articles__details">
											<span className="triplink-owned-articles__category" data-category={article.articleCategory}>
												{t(categoryLabels[article.articleCategory])}
											</span>
											<h3>
												{article.articleStatus === 'ACTIVE' ? (
													<Link href={`/community/detail?id=${article._id}`}>{article.articleTitle}</Link>
												) : (
													article.articleTitle
												)}
											</h3>
											<p>{article.memberData?.memberNick ?? t('Unavailable member')}</p>
											<dl className="triplink-owned-articles__metrics">
												<div>
													<dt>{t('Likes')}</dt>
													<dd>{article.articleLikes}</dd>
												</div>
												<div>
													<dt>{t('Comments')}</dt>
													<dd>{article.articleComments}</dd>
												</div>
											</dl>
										</div>
									</>
								) : (
									<>
										{article.articleStatus === 'ACTIVE' ? (
											<Link href={`/community/detail?id=${article._id}`}>{article.articleTitle}</Link>
										) : (
											<Typography>{article.articleTitle}</Typography>
										)}
										<Typography>
											{t(article.articleCategory)} · {article.memberData?.memberNick ?? t('Unavailable member')} ·{' '}
											{article.articleLikes} {t('likes ·')} {article.articleComments} {t('comments')}
										</Typography>
									</>
								)}
								<Stack
									direction="row"
									gap={1}
									flexWrap="wrap"
									className={mine && !admin ? 'triplink-owned-articles__actions' : undefined}
								>
									{!memberId &&
										member &&
										member._id === article.memberId &&
										article.articleStatus === 'ACTIVE' &&
										['AGENT', 'ADMIN'].includes(member.memberType) && (
											<Button
												variant={mine && !admin ? 'contained' : 'text'}
												disabled={action.busy}
												onClick={() => setEditing(article)}
											>
												{t('Edit')}
											</Button>
										)}
									{(admin || mine) && article.articleStatus === 'ACTIVE' && (
										<Button
											variant={mine && !admin ? 'outlined' : 'text'}
											className={mine && !admin ? 'triplink-danger-action' : undefined}
											disabled={action.busy}
											onClick={() =>
												void action.run(async () => {
													if (!window.confirm(t('Delete this article?'))) return;
													if (admin)
														await adminDelete({ variables: { input: { _id: article._id, articleStatus: 'DELETE' } } });
													else
														await ownerDelete({ variables: { input: { _id: article._id, articleStatus: 'DELETE' } } });
													await query.refetch();
												})
											}
										>
											{t('Delete')}
										</Button>
									)}
									{admin && article.articleStatus === 'DELETE' && (
										<Button
											disabled={action.busy}
											onClick={() =>
												void action.run(async () => {
													if (!window.confirm(t('Permanently remove this deleted article and its relationships?')))
														return;
													await remove({ variables: { articleId: article._id } });
													if (commentsFor === article._id) setCommentsFor('');
													await query.refetch();
												})
											}
										>
											{t('Permanently remove')}
										</Button>
									)}
									{admin && <Button onClick={() => setCommentsFor(article._id)}>{t('Moderate comments')}</Button>}
								</Stack>
							</Stack>
						</CardContent>
					</Card>
				))}
			</QueryState>
			<Pager page={page} total={totalOf(query.data?.result)} onChange={setPage} />
			{admin && validId(commentsFor) && <ArticleComments key={commentsFor} articleId={commentsFor} admin />}
		</Stack>
	);
}
function CommentRow({
	comment,
	admin,
	refetch,
}: {
	comment: Comment;
	admin: boolean;
	refetch: () => Promise<unknown>;
}) {
	const { t } = useTranslation('common');

	const member = useReactiveVar(memberVar);
	const action = useAction();
	const [editing, setEditing] = useState(false);
	const [content, setContent] = useState(comment.commentContent);
	const [update] = useMutation(UPDATE_COMMENT);
	const [adminUpdate] = useMutation(ADMIN_COMMENT_UPDATE);
	const [remove] = useMutation(ADMIN_COMMENT_REMOVE);
	return (
		<Card variant="outlined">
			<CardContent>
				<Stack spacing={1}>
					{action.feedback}
					<Typography>
						{comment.memberData?.memberNick ?? t('Unavailable member')} · {t(comment.commentStatus)}
					</Typography>
					<Typography sx={{ whiteSpace: 'pre-wrap' }}>{comment.commentContent}</Typography>
					{!admin && member?._id === comment.memberId && comment.commentStatus === 'ACTIVE' && (
						<>
							{editing && (
								<TextField
									label={t('Comment')}
									value={content}
									onChange={(e) => setContent(e.target.value)}
									inputProps={{ maxLength: 100 }}
								/>
							)}
							<Stack direction="row" spacing={1}>
								<Button
									disabled={action.busy || (editing && !content.trim())}
									onClick={() => {
										if (!editing) {
											setEditing(true);
											return;
										}
										void action.run(async () => {
											await update({ variables: { input: { _id: comment._id, commentContent: content.trim() } } });
											setEditing(false);
											await refetch();
										});
									}}
								>
									{t(editing ? 'Save' : 'Edit')}
								</Button>
								<Button
									disabled={action.busy}
									onClick={() =>
										void action.run(async () => {
											await update({ variables: { input: { _id: comment._id, commentStatus: 'DELETE' } } });
											await refetch();
										})
									}
								>
									{t('Delete')}
								</Button>
							</Stack>
						</>
					)}
					{admin && (
						<Button
							disabled={action.busy}
							onClick={() =>
								void action.run(async () => {
									if (comment.commentStatus === 'ACTIVE')
										await adminUpdate({ variables: { input: { _id: comment._id, commentStatus: 'DELETE' } } });
									else {
										if (!window.confirm(t('Permanently remove this comment?'))) return;
										await remove({ variables: { commentId: comment._id } });
									}
									await refetch();
								})
							}
						>
							{t(comment.commentStatus === 'ACTIVE' ? 'Delete' : 'Permanently remove')}
						</Button>
					)}
				</Stack>
			</CardContent>
		</Card>
	);
}
export function ArticleComments({
	articleId,
	admin = false,
	onChanged,
}: {
	articleId: string;
	admin?: boolean;
	onChanged?: () => Promise<unknown>;
}) {
	const { t } = useTranslation('common');

	const ready = usePublicReady();
	const member = useReactiveVar(memberVar);
	const [page, setPage] = useState(1);
	const [text, setText] = useState('');
	const [create] = useMutation(CREATE_COMMENT);
	const action = useAction();
	const query = useQuery(admin ? ADMIN_COMMENTS : COMMENTS, {
		variables: { input: { page, limit: 12, search: { commentRefId: articleId } } },
		skip: !ready || !validId(articleId),
		fetchPolicy: 'network-only',
	});
	const changed = async () => {
		await query.refetch();
		if (onChanged) await onChanged();
	};
	return (
		<Stack spacing={2}>
			<Typography variant="h5" component="h2">
				{t('Comments')}
			</Typography>
			{action.feedback}
			{member && !admin && (
				<Stack
					component="form"
					spacing={1}
					onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
						event.preventDefault();
						void action.run(async () => {
							await create({ variables: { input: { commentRefId: articleId, commentContent: text.trim() } } });
							setText('');
							setPage(1);
							await changed();
						});
					}}
				>
					<TextField
						required
						multiline
						label={t('Comment (1–100 characters)')}
						value={text}
						onChange={(e) => setText(e.target.value)}
						inputProps={{ maxLength: 100 }}
					/>
					<Button type="submit" disabled={action.busy || !text.trim()}>
						{t('Post comment')}
					</Button>
				</Stack>
			)}
			{!member && !admin && ready && <Link href="/account/join">{t('Log in to join the conversation')}</Link>}
			<QueryState loading={!ready || query.loading} error={query.error} retry={() => query.refetch()}>
				{!query.data?.result.list.length && <Typography>{t('No comments yet. Start the conversation.')}</Typography>}
				{query.data?.result.list.map((comment) => (
					<CommentRow key={comment._id} comment={comment} admin={admin} refetch={changed} />
				))}
			</QueryState>
			<Pager page={page} total={totalOf(query.data?.result)} onChange={setPage} />
		</Stack>
	);
}
export function CommunityPage() {
	const { t } = useTranslation('common');
	const member = useReactiveVar(memberVar);
	return (
		<div className="triplink-community">
			<section data-triplink-nav-hero className="triplink-community__hero">
				<div className="triplink-community__hero-inner">
					<p className="triplink-community__eyebrow">{t('TripLink community')}</p>
					<h1>{t('Every journey has a story.')}</h1>
					<p className="triplink-community__intro">
						{t('Discover travel stories, local tips, and moments worth sharing.')}
					</p>
					<a href="#community-feed-title" className="triplink-community__hero-link">
						{t('Explore the stories')} <span aria-hidden="true">↓</span>
					</a>
				</div>
			</section>
			<div className="triplink-community__main">
				<div className="triplink-community__welcome">
					<p>{t('A place for curious travelers.')}</p>
					{member?.memberType === 'AGENT' && (
						<Link href="/mypage?category=writeArticle" passHref>
							{t('Write article')} <span aria-hidden="true">↗</span>
						</Link>
					)}
				</div>
				<ArticlesList community />
			</div>
		</div>
	);
}
export function CommunityDetail() {
	const { t } = useTranslation('common');
	const router = useRouter();
	const id = router.query.id;
	const ready = usePublicReady();
	const member = useReactiveVar(memberVar);
	const action = useAction();
	const [like] = useMutation(ARTICLE_LIKE);
	const query = useQuery(ARTICLE, {
		variables: { articleId: typeof id === 'string' ? id : '' },
		skip: !ready || !validId(id),
		fetchPolicy: 'network-only',
	});
	const article = query.data?.result;
	const author = article?.memberData;
	const authorName = author?.memberFullname || author?.memberNick || t('Unavailable member');
	const authorHref =
		author && author.memberType !== 'ADMIN'
			? author.memberType === 'AGENT'
				? `/agent/detail?agentId=${author._id}`
				: `/member?memberId=${author._id}`
			: null;
	const date = article ? new Date(article.createdAt) : null;
	const formattedDate =
		date && !Number.isNaN(date.getTime())
			? new Intl.DateTimeFormat((router.locale === 'kr' ? 'ko-KR' : router.locale === 'ru' ? 'ru-RU' : router.locale === 'uz' ? 'uz-UZ' : 'en-US'), {
					month: 'long',
					day: 'numeric',
					year: 'numeric',
			  }).format(date)
			: null;
	return (
		<div className="triplink-journal">
			<section data-triplink-nav-hero className="triplink-journal__hero">
				<div>
					<BrowsingBackLink fallback="/community">← {t('Back to community')}</BrowsingBackLink>
					<p>{t('Stories that take you places.')}</p>
					<span>{t('Travel experiences, shared by our community.')}</span>
				</div>
			</section>
			<div className="triplink-journal__main">
				<QueryState
					loading={!ready || !router.isReady || query.loading}
					error={query.error ?? (router.isReady && !validId(id) ? new Error('Invalid article ID') : undefined)}
					empty={!article}
					retry={() => query.refetch()}
				>
					{article && (
						<div className="triplink-journal__layout">
							<div className="triplink-journal__reading">
								<article className="triplink-journal__article">
									<header>
										<span className="triplink-journal__category">{t(categoryLabels[article.articleCategory])}</span>
										<h1>{article.articleTitle}</h1>
										<div className="triplink-journal__byline">
											<Avatar
												src={author?.memberImage ? imageUrl(author.memberImage) : undefined}
												alt={String(authorName)}
											>
												{String(authorName)[0]?.toUpperCase()}
											</Avatar>
											<div>
												{authorHref ? <Link href={authorHref}>{authorName}</Link> : <span>{authorName}</span>}
												{formattedDate && <time dateTime={article.createdAt}>{formattedDate}</time>}
											</div>
										</div>
									</header>
									{article.articleImage && (
										<figure>
											<Box
												component="img"
												src={imageUrl(article.articleImage)}
												alt={article.articleTitle}
												onError={(event: React.SyntheticEvent<HTMLImageElement>) => {
													event.currentTarget.onerror = null;
													event.currentTarget.src = '/img/tour-placeholder.svg';
												}}
											/>
										</figure>
									)}
									<div className="triplink-journal__text"><ArticleContent content={article.articleContent} /></div>
									<footer className="triplink-journal__engagement">
										{member ? (
											<Button
												variant={article.meLiked ? 'contained' : 'outlined'}
												disableElevation
												disabled={action.busy}
												aria-pressed={article.meLiked}
												onClick={() =>
													void action.run(async () => {
														await like({ variables: { articleId: article._id } });
														await query.refetch();
													}, null)
												}
											>
												{article.meLiked ? '♥' : '♡'} {t(article.meLiked ? 'Unlike' : 'Like')}
											</Button>
										) : (
											<Link href="/account/join">{t('Log in to like this story')}</Link>
										)}
										<span>{t('Community like count', { count: article.articleLikes })}</span>
										<span>
											{t('{{count}} views', { count: article.articleViews, displayCount: article.articleViews })}
										</span>
										<a href="#story-discussion">
											{t('Home article comment count', { count: article.articleComments })}
										</a>
									</footer>
									{action.feedback}
								</article>
								<section id="story-discussion" className="triplink-journal__discussion">
									<ArticleComments key={article._id} articleId={article._id} onChanged={() => query.refetch()} />
								</section>
							</div>
							<aside className="triplink-journal__sidebar" aria-label={t('About the author')}>
								<div className="triplink-journal__author-card">
									<h2>{t('About the author')}</h2>
									<Avatar src={author?.memberImage ? imageUrl(author.memberImage) : undefined} alt={String(authorName)}>
										{String(authorName)[0]?.toUpperCase()}
									</Avatar>
									<h3>{authorName}</h3>
									{author && (
										<p className="triplink-journal__author-role">
											{t(
												author.memberType === 'AGENT'
													? 'Travel agent'
													: author.memberType === 'ADMIN'
													? 'Admin'
													: 'Traveler',
											)}
											{author.memberCountry ? ` · ${author.memberCountry}` : ''}
										</p>
									)}
									{author?.memberDesc?.trim() && <p>{author.memberDesc}</p>}
									{authorHref && (
										<Link href={authorHref} className="triplink-journal__profile-link">
											{t('View profile')} ↗
										</Link>
									)}
								</div>
								<div className="triplink-journal__explore">
									<h2>{t('Keep exploring')}</h2>
									<p>{t('Find more stories and fresh perspectives from fellow travelers.')}</p>
									<Link href="/community">{t('Explore the stories')} ↗</Link>
								</div>
							</aside>
						</div>
					)}
				</QueryState>
			</div>
		</div>
	);
}
