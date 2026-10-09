import { useTranslation } from 'next-i18next';
import React, { useState } from 'react';
import { useApolloClient, useMutation, useQuery, useReactiveVar } from '@apollo/client';
import { Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { MY_REVIEWS, AGENT_REVIEWS, UPDATE_REVIEW, REMOVE_REVIEW } from '../../../apollo/user/triplink';
import { ADMIN_REVIEWS, ADMIN_REVIEW_UPDATE } from '../../../apollo/admin/triplink';
import { memberVar } from '../../../apollo/store';
import { Review, totalOf } from '../../types/triplink';
import { Pager, QueryState, useAction } from './Common';
function ReviewRow({ review, admin, refetch }: { review: Review; admin: boolean; refetch: () => Promise<unknown> }) {
	const { t } = useTranslation('common');

	const member = useReactiveVar(memberVar);
	const client = useApolloClient();
	const action = useAction();
	const [text, setText] = useState(review.reviewComment);
	const [rating, setRating] = useState(review.reviewRating);
	const [reason, setReason] = useState('');
	const [update] = useMutation(UPDATE_REVIEW);
	const [remove] = useMutation(REMOVE_REVIEW);
	const [moderate] = useMutation(ADMIN_REVIEW_UPDATE);
	const finish = async () => {
		await refetch();
		await client.refetchQueries({ include: ['TOUR', 'TOURS', 'TOUR_REVIEWS', 'PUBLIC_AGENT_REVIEWS', 'MEMBER'] });
	};
	return (
		<Card variant="outlined">
			<CardContent>
				<Stack spacing={2}>
					{action.feedback}
					<Typography>
						{review.tourData?.tourTitle ?? 'Tour unavailable'} · {t(review.reviewStatus)} · ★ {review.reviewRating}
					</Typography>
					<Typography sx={{ whiteSpace: 'pre-wrap' }}>{review.reviewComment}</Typography>
					{!admin && member?.memberType === 'USER' && review.reviewStatus === 'ACTIVE' && (
						<>
							<TextField select label={t('Rating')} value={rating} onChange={(e) => setRating(Number(e.target.value))}>
								{[1, 2, 3, 4, 5].map((value) => (
									<MenuItem key={value} value={value}>
										{t(String(value))}
									</MenuItem>
								))}
							</TextField>
							<TextField
								label={t('Review')}
								multiline
								value={text}
								onChange={(e) => setText(e.target.value)}
								inputProps={{ maxLength: 2000 }}
							/>
							<Stack direction="row" spacing={2}>
								<Button
									disabled={action.busy || text.trim().length < 3}
									onClick={() =>
										void action.run(async () => {
											await update({
												variables: {
													input: { reviewId: review._id, reviewRating: rating, reviewComment: text.trim() },
												},
											});
											await finish();
										})
									}
								>
									{t('Save review')}
								</Button>
								<Button
									disabled={action.busy}
									onClick={() =>
										void action.run(async () => {
											if (!window.confirm(t('Remove this review?'))) return;
											await remove({ variables: { reviewId: review._id } });
											await finish();
										})
									}
								>
									{t('Remove review')}
								</Button>
							</Stack>
						</>
					)}
					{admin && review.reviewStatus !== 'DELETE' && (
						<>
							<TextField
								label={t('Moderation reason')}
								value={reason}
								onChange={(e) => setReason(e.target.value)}
								inputProps={{ maxLength: 500 }}
							/>
							<Stack direction="row" spacing={1}>
								{(['ACTIVE', 'HIDDEN'] as const)
									.filter((status) => status !== review.reviewStatus)
									.map((status) => (
										<Button
											key={t(status)}
											disabled={action.busy || reason.trim().length < 3}
											onClick={() =>
												void action.run(async () => {
													await moderate({
														variables: {
															input: { reviewId: review._id, reviewStatus: status, moderationReason: reason.trim() },
														},
													});
													await finish();
												})
											}
										>
											{t(status)}
										</Button>
									))}
							</Stack>
						</>
					)}
				</Stack>
			</CardContent>
		</Card>
	);
}
export function ReviewsPanel({ admin = false }: { admin?: boolean }) {
	const { t } = useTranslation('common');

	const member = useReactiveVar(memberVar);
	const [page, setPage] = useState(1);
	const query = useQuery(admin ? ADMIN_REVIEWS : member?.memberType === 'AGENT' ? AGENT_REVIEWS : MY_REVIEWS, {
		variables: { input: { page, limit: 12, search: {} } },
		skip: !member,
		fetchPolicy: 'network-only',
	});
	return (
		<Stack spacing={2}>
			<QueryState
				loading={query.loading}
				error={query.error}
				empty={!query.data?.result.list.length}
				retry={() => query.refetch()}
			>
				{query.data?.result.list.map((review) => (
					<ReviewRow key={review._id} review={review} admin={admin} refetch={() => query.refetch()} />
				))}
			</QueryState>
			<Pager page={page} total={totalOf(query.data?.result)} onChange={setPage} />
		</Stack>
	);
}
