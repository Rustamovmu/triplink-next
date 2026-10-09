import { useTranslation } from 'next-i18next';
import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useReactiveVar } from '@apollo/client';
import { Avatar, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import { AGENTS, MEMBER, FOLLOW_TOGGLE, MEMBER_LIKE } from '../../../apollo/user/triplink';
import { memberVar } from '../../../apollo/store';
import { totalOf } from '../../types/triplink';
import { Frame, imageUrl, Pager, QueryState, usePublicReady, useAction, validId } from './Common';
import { PublicReviews, TourList } from './Tours';
import { Follows } from './Members';
import { refreshCurrentMember } from '../../auth';
import { useRouter } from 'next/router';
export function AgentDirectory() {
	const { t } = useTranslation('common');

	const [page, setPage] = useState(1);
	const [text, setText] = useState('');
	const ready = usePublicReady();
	const query = useQuery(AGENTS, {
		variables: { input: { page, limit: 12, search: { text }, sort: 'memberFollowers', direction: 'DESC' } },
		skip: !ready,
	});
	return (
		<Frame title={t('Travel agents')}>
			<TextField
				label={t('Search agents')}
				value={text}
				onChange={(e) => {
					setText(e.target.value);
					setPage(1);
				}}
			/>
			<QueryState
				loading={!ready || query.loading}
				error={query.error}
				empty={!query.data?.result.list.length}
				retry={() => query.refetch()}
			>
				<Stack spacing={2}>
					{query.data?.result.list.map((member) => (
						<Card variant="outlined" key={member._id}>
							<CardContent>
								<Stack direction="row" spacing={2}>
									<Avatar src={imageUrl(member.memberImage)} />
									<Stack>
										<Link href={`/agent/detail?agentId=${member._id}`}>
											{member.memberFullname || member.memberNick}
										</Link>
										<Typography>
											{member.memberCountry} · {member.memberTours} {t('tours ·')} {member.memberFollowers}{' '}
											{t('followers')}
										</Typography>
									</Stack>
								</Stack>
							</CardContent>
						</Card>
					))}
				</Stack>
			</QueryState>
			<Pager page={page} total={totalOf(query.data?.result)} onChange={setPage} />
		</Frame>
	);
}
export function MemberProfile() {
	const { t } = useTranslation('common');

	const router = useRouter();
	const id = router.query.agentId ?? router.query.memberId;
	const ready = usePublicReady();
	const current = useReactiveVar(memberVar);
	const [tourPage, setTourPage] = useState(1);
	const query = useQuery(MEMBER, {
		variables: { memberId: typeof id === 'string' ? id : '' },
		skip: !ready || !validId(id),
		fetchPolicy: 'network-only',
	});
	const [follow] = useMutation(FOLLOW_TOGGLE);
	const [like] = useMutation(MEMBER_LIKE);
	const action = useAction();
	const member = query.data?.result;
	return (
		<Frame title={member?.memberFullname || member?.memberNick || 'Member'}>
			{action.feedback}
			<QueryState
				loading={!ready || !router.isReady || query.loading}
				error={query.error ?? (router.isReady && !validId(id) ? new Error('Invalid member ID') : undefined)}
				empty={!member}
				retry={() => query.refetch()}
			>
				{member && (
					<Stack spacing={3}>
						<Avatar src={imageUrl(member.memberImage)} sx={{ width: 100, height: 100 }} />
						<Typography sx={{ whiteSpace: 'pre-wrap' }}>{member.memberDesc}</Typography>
						<Typography>
							{member.memberCountry} · {member.memberFollowers} {t('followers ·')} {member.memberFollowings}{' '}
							{t('following ·')} {member.memberLikes} {t('likes')}
						</Typography>
						{current && current.memberType !== 'ADMIN' && member._id !== current._id && (
							<Stack direction="row" spacing={2}>
								<Button
									disabled={action.busy}
									onClick={() =>
										void action.run(async () => {
											await follow({ variables: { memberId: member._id } });
											await refreshCurrentMember();
											await query.refetch();
										})
									}
								>
									{t(member.isFollowing ? 'Unfollow' : 'Follow')}
								</Button>
								<Button
									disabled={action.busy}
									onClick={() =>
										void action.run(async () => {
											await like({ variables: { memberId: member._id } });
											await query.refetch();
										})
									}
								>
									{t('Toggle like')}
								</Button>
							</Stack>
						)}
						<Typography variant="h5">{t('Followers')}</Typography>
						<Follows key={member._id + 'followers'} memberId={member._id} />
						<Typography variant="h5">{t('Following')}</Typography>
						<Follows key={member._id + 'following'} memberId={member._id} following />
						{member.memberType === 'AGENT' && (
							<>
								<Typography>
									★ {member.agentAverageRating ?? 0} · {member.agentReviewCount ?? 0} {t('reviews ·')}{' '}
									{member.agentTourCount ?? 0} {t('tours')}
								</Typography>
								<TourList input={{ page: tourPage, limit: 12, search: { agentId: member._id } }} onPage={setTourPage} />
								<PublicReviews agentId={member._id} />
							</>
						)}
					</Stack>
				)}
			</QueryState>
		</Frame>
	);
}
