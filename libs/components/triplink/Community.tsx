import { useTranslation } from 'next-i18next';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useMutation, useQuery, useReactiveVar } from '@apollo/client';
import { Alert, Box, Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material';
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
const categories: ArticleCategory[] = ['FREE', 'RECOMMEND', 'NEWS', 'HUMOR'];
export function ArticleForm({ article, onSaved }: { article?: Article; onSaved: () => Promise<unknown> }) {
	const { t } = useTranslation('common');

	const action = useAction();
	const [image, setImage] = useState(article?.articleImage ?? '');
	const [create] = useMutation(CREATE_ARTICLE);
	const [update] = useMutation(UPDATE_ARTICLE);
	return (
		<Stack
			component="form"
			spacing={2}
			onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
				event.preventDefault();
				const data = new FormData(event.currentTarget);
				void action.run(async () => {
					const input = {
						articleCategory: String(data.get('category')) as ArticleCategory,
						articleTitle: String(data.get('title')).trim(),
						articleContent: String(data.get('content')).trim(),
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
			<TextField
				required
				multiline
				minRows={5}
				name="content"
				label={t('Article (plain text)')}
				defaultValue={article?.articleContent ?? ''}
				inputProps={{ minLength: 3, maxLength: 2000 }}
			/>
			<Button component="label" disabled={action.busy}>
				{t('Upload article image')}
				<input
					type="file"
					accept="image/jpeg,image/png"
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
			<Button type="submit" variant="contained" disabled={action.busy}>
				{t(article ? 'Save article' : 'Publish article')}
			</Button>
		</Stack>
	);
}
export function ArticlesList({
	mine = false,
	admin = false,
	memberId,
}: {
	mine?: boolean;
	admin?: boolean;
	memberId?: string;
}) {
	const { t } = useTranslation('common');

	const member = useReactiveVar(memberVar);
	const ready = usePublicReady();
	const [page, setPage] = useState(1);
	const [category, setCategory] = useState<ArticleCategory | ''>('');
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
		fetchPolicy: 'network-only',
	});
	const adminQuery = useQuery(ADMIN_ARTICLES, {
		variables: { input: { page, limit: 12, search: { articleStatus: status } } },
		skip: !ready || !admin,
		fetchPolicy: 'network-only',
	});
	const query = admin ? adminQuery : publicQuery;
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
		<Stack spacing={2}>
			{action.feedback}
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
			<QueryState
				loading={!ready || query.loading}
				error={query.error}
				empty={!query.data?.result.list.length}
				retry={() => query.refetch()}
			>
				{query.data?.result.list.map((article) => (
					<Card key={article._id} variant="outlined">
						<CardContent>
							<Stack spacing={2}>
								{article.articleStatus === 'ACTIVE' ? (
									<Link href={`/community/detail?id=${article._id}`}>{article.articleTitle}</Link>
								) : (
									<Typography>{article.articleTitle}</Typography>
								)}
								<Typography>
									{article.articleCategory} · {article.memberData?.memberNick ?? 'Unavailable member'} ·{' '}
									{article.articleLikes} {t('likes ·')} {article.articleComments} {t('comments')}
								</Typography>
								<Stack direction="row" gap={1} flexWrap="wrap">
									{!memberId &&
										member &&
										member._id === article.memberId &&
										article.articleStatus === 'ACTIVE' &&
										['AGENT', 'ADMIN'].includes(member.memberType) && (
											<Button disabled={action.busy} onClick={() => setEditing(article)}>
												{t('Edit')}
											</Button>
										)}
									{(admin || mine) && article.articleStatus === 'ACTIVE' && (
										<Button
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
						{comment.memberData?.memberNick ?? 'Unavailable member'} · {t(comment.commentStatus)}
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
			<Typography variant="h5">{t('Comments')}</Typography>
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
			<QueryState
				loading={!ready || query.loading}
				error={query.error}
				empty={!query.data?.result.list.length}
				retry={() => query.refetch()}
			>
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
	return (
		<Frame title={t('TripLink community')}>
			<ArticlesList />
		</Frame>
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
	return (
		<Frame title={article?.articleTitle ?? 'Article'}>
			{action.feedback}
			<QueryState
				loading={!ready || !router.isReady || query.loading}
				error={query.error ?? (router.isReady && !validId(id) ? new Error('Invalid article ID') : undefined)}
				empty={!article}
				retry={() => query.refetch()}
			>
				{article && (
					<Stack spacing={3}>
						<Typography>
							{article.articleCategory} · {article.memberData?.memberNick ?? 'Unavailable member'}
						</Typography>
						{article.articleImage && (
							<Box
								component="img"
								onError={(event: React.SyntheticEvent<HTMLImageElement>) => {
									const target = event.currentTarget;
									target.onerror = null;
									if (!target.src.endsWith('/img/tour-placeholder.svg')) target.src = '/img/tour-placeholder.svg';
								}}
								src={imageUrl(article.articleImage)}
								alt={article.articleTitle}
								sx={{ maxWidth: '100%', maxHeight: 400, objectFit: 'contain' }}
							/>
						)}
						<Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{article.articleContent}</Typography>
						<Typography>
							{article.articleLikes} {t('likes ·')} {article.articleViews} {t('views ·')} {article.articleComments}{' '}
							{t('comments')}
						</Typography>
						{member && (
							<Button
								disabled={action.busy}
								aria-pressed={article.meLiked}
								onClick={() =>
									void action.run(async () => {
										await like({ variables: { articleId: article._id } });
										await query.refetch();
									})
								}
							>
								{t(article.meLiked ? 'Unlike' : 'Like')}
							</Button>
						)}
						<ArticleComments articleId={article._id} onChanged={() => query.refetch()} />
					</Stack>
				)}
			</QueryState>
		</Frame>
	);
}
