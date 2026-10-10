import { useTranslation } from 'next-i18next';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useReactiveVar } from '@apollo/client';
import { Avatar, Button, Stack, Typography } from '@mui/material';
import { AGENTS, MEMBER, FOLLOW_TOGGLE, MEMBER_LIKE } from '../../../apollo/user/triplink';
import { memberVar } from '../../../apollo/store';
import { totalOf } from '../../types/triplink';
import { Frame, imageUrl, Pager, QueryState, usePublicReady, useAction, validId } from './Common';
import { PublicReviews, TourList } from './Tours';
import { Follows } from './Members';
import { refreshCurrentMember } from '../../auth';
import { useRouter } from 'next/router';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
export function AgentDirectory() {
	const { t } = useTranslation('common');

	const [page, setPage] = useState(1);
	const [text, setText] = useState('');
	const ready = usePublicReady();
	const query = useQuery(AGENTS, {
		variables: { input: { page, limit: 12, search: { text }, sort: 'memberFollowers', direction: 'DESC' } },
		skip: !ready,
	});
	const current = useReactiveVar(memberVar);
	const [follow] = useMutation(FOLLOW_TOGGLE);
	const action = useAction();
	const total = totalOf(query.data?.result);
	return (
		<div className="triplink-agents">
			<section className="triplink-agents__hero" aria-labelledby="agents-title">
				<div className="triplink-agents__hero-inner">
					<div className="triplink-agents__intro">
						<h1 id="agents-title">{t('Good journeys begin with good people.')}</h1>
						<p>
							{t(
								'Meet the travel agents behind your next adventure. Explore their tours, get to know their story, and find your kind of guide.',
							)}
						</p>
						<a href="#agent-directory" className="triplink-agents__explore">
							{t('Meet our agents')} <ArrowForwardRoundedIcon aria-hidden="true" />
						</a>
					</div>
				</div>
			</section>
			<section id="agent-directory" className="triplink-agents__directory" aria-labelledby="agent-directory-title">
				<div className="triplink-agents__toolbar">
					<div>
						<h2 id="agent-directory-title">{t('Travel agents')}</h2>
						<p>{t('A personal connection. A different perspective.')}</p>
					</div>
					<div className="triplink-agents__search">
						<SearchRoundedIcon aria-hidden="true" />
						<input
							aria-label={t('Search agents')}
							placeholder={t('Search agents by name')}
							type="search"
							maxLength={100}
							value={text}
							onChange={(e) => {
								setText(e.target.value);
								setPage(1);
							}}
						/>
						{text && (
							<button
								type="button"
								aria-label={t('Clear search')}
								onClick={() => {
									setText('');
									setPage(1);
								}}
							>
								<CloseRoundedIcon />
							</button>
						)}
					</div>
				</div>
				<div className="triplink-agents__results" role="status">
					{!ready || query.loading
						? t('Finding travel agents…')
						: query.error
						? t('Travel agents')
						: `${total} ${t('Travel agents')}`}
				</div>
				{action.feedback}
				<QueryState loading={!ready || query.loading} error={query.error} retry={() => query.refetch()}>
					{!query.data?.result.list.length ? (
						<div className="triplink-agents__empty">
							<SearchRoundedIcon aria-hidden="true" />
							<h3>{t('No agents found')}</h3>
							<p>{t('Try another name or clear your search to see all agents.')}</p>
							{text && (
								<Button
									onClick={() => {
										setText('');
										setPage(1);
									}}
								>
									{t('Clear search')}
								</Button>
							)}
						</div>
					) : (
						<div className="triplink-agents__grid">
							{query.data?.result.list.map((member) => {
								const name = member.memberFullname || member.memberNick;
								const initials = name
									.trim()
									.split(/\s+/)
									.slice(0, 2)
									.map((part) => part[0])
									.join('')
									.toUpperCase();
								return (
									<article className="triplink-agents__card" key={member._id}>
										<div className="triplink-agents__identity">
											<Avatar
												src={member.memberImage ? imageUrl(member.memberImage) : undefined}
												className="triplink-agents__avatar"
											>
												{initials}
											</Avatar>
											<div>
												<h3>
													<Link href={`/agent/detail?agentId=${member._id}`}>{name}</Link>
												</h3>
												{member.memberCountry ? (
													<p className="triplink-agents__location">
														<PlaceOutlinedIcon aria-hidden="true" />
														{member.memberCountry}
													</p>
												) : (
													<p className="triplink-agents__location">{t('Travel agent')}</p>
												)}
											</div>
										</div>
										<p className="triplink-agents__bio">
											{member.memberDesc?.trim() ||
												t('Get to know this agent and explore their tours on their profile.')}
										</p>
										<dl className="triplink-agents__stats">
											<div>
												<dt>{t('Tours')}</dt>
												<dd>{member.memberTours}</dd>
											</div>
											<div>
												<dt>{t('Followers')}</dt>
												<dd>{member.memberFollowers}</dd>
											</div>
										</dl>
										{current && current.memberType !== 'ADMIN' && current._id !== member._id && (
											<Button
												className="triplink-agents__follow"
												variant={member.isFollowing ? 'outlined' : 'contained'}
												disableElevation
												disabled={action.busy}
												aria-label={t(member.isFollowing ? 'Unfollow {{name}}' : 'Follow {{name}}', { name })}
												startIcon={member.isFollowing ? <CheckRoundedIcon /> : <PersonAddAltRoundedIcon />}
												onClick={() =>
													void action.run(async () => {
														await follow({ variables: { memberId: member._id } });
														await refreshCurrentMember();
														await query.refetch();
													}, t(member.isFollowing ? 'Agent unfollowed' : 'Agent followed'))
												}
											>
												{t(member.isFollowing ? 'Unfollow' : 'Follow')}
											</Button>
										)}
										{!current && ready && (
											<Link className="triplink-agents__login" href="/account/join">
												{t('Log in to follow')}
											</Link>
										)}
										<Link
											className="triplink-agents__profile"
											passHref
											href={`/agent/detail?agentId=${member._id}`}
											aria-label={t('View profile of {{name}}', { name })}
										>
											{t('View profile')} <ArrowForwardRoundedIcon aria-hidden="true" />
										</Link>
									</article>
								);
							})}
						</div>
					)}
				</QueryState>
				{!query.loading && !query.error && (
					<div className="triplink-agents__pagination">
						<Pager page={page} total={total} onChange={setPage} />
					</div>
				)}
			</section>
		</div>
	);
}

export function MemberProfile() {
	const { t } = useTranslation('common');

	const router = useRouter();
	const id = router.query.agentId ?? router.query.memberId;
	const ready = usePublicReady();
	const current = useReactiveVar(memberVar);
	const [tourPage, setTourPage] = useState(1);
	useEffect(() => setTourPage(1), [id]);
	const query = useQuery(MEMBER, {
		variables: { memberId: typeof id === 'string' ? id : '' },
		skip: !ready || !validId(id),
		fetchPolicy: 'network-only',
	});
	const [follow] = useMutation(FOLLOW_TOGGLE);
	const [like] = useMutation(MEMBER_LIKE);
	const action = useAction();
	const member = query.data?.result;
	if (router.pathname === '/agent/detail') {
		const name = member?.memberFullname || member?.memberNick || String(t('Travel agent'));
		return (
			<div className="triplink-profile">
				<section className="triplink-profile__hero">
					<div className="triplink-profile__hero-inner">
						<Link href="/agent" className="triplink-profile__back">
							{t('All travel agents')}
						</Link>
						<p>{t('A local perspective. A memorable journey.')}</p>
					</div>
				</section>
				<div className="triplink-profile__main">
					<QueryState
						loading={!ready || !router.isReady || query.loading}
						error={query.error ?? (router.isReady && !validId(id) ? new Error('Invalid member ID') : undefined)}
						empty={!member}
						retry={() => query.refetch()}
					>
						{member && (
							<>
								<section className="triplink-profile__summary" aria-labelledby="profile-name">
									<div className="triplink-profile__identity">
										<Avatar
											src={member.memberImage ? imageUrl(member.memberImage) : undefined}
											className="triplink-profile__avatar"
												alt={name}
										>
											{name
												.trim()
												.split(/\s+/)
												.slice(0, 2)
												.map((part) => part[0])
												.join('')
												.toUpperCase()}
										</Avatar>
										<div>
											<h1 id="profile-name">{name}</h1>
											<p className="triplink-profile__location">
												<PlaceOutlinedIcon aria-hidden="true" />
												{member.memberCountry || t('Travel agent')}
											</p>
										</div>
										<div className="triplink-profile__actions">
											{current && current.memberType !== 'ADMIN' && member._id !== current._id && (
												<>
													<Button
														variant={member.isFollowing ? 'outlined' : 'contained'}
														disableElevation
														disabled={action.busy}
														startIcon={member.isFollowing ? <CheckRoundedIcon /> : <PersonAddAltRoundedIcon />}
														onClick={() =>
															void action.run(async () => {
																await follow({ variables: { memberId: member._id } });
																await refreshCurrentMember();
																await query.refetch();
															}, t(member.isFollowing ? 'Agent unfollowed' : 'Agent followed'))
														}
													>
														{t(member.isFollowing ? 'Unfollow' : 'Follow')}
													</Button>
													<Button
														variant="outlined"
														disabled={action.busy}
														startIcon={<FavoriteBorderRoundedIcon />}
														onClick={() =>
															void action.run(async () => {
																await like({ variables: { memberId: member._id } });
																await query.refetch();
															}, t('Profile likes updated'))
														}
													>
														{t('Like / unlike')}
													</Button>
												</>
											)}
											{!current && ready && <Link href="/account/join">{t('Log in to follow')}</Link>}
										</div>
									</div>
									{member.memberDesc?.trim() && <p className="triplink-profile__bio">{member.memberDesc}</p>}
									<dl className="triplink-profile__stats">
										<div>
											<dt>{t('Tours')}</dt>
											<dd>{member.agentTourCount ?? member.memberTours}</dd>
										</div>
										<div>
											<dt>{t('Followers')}</dt>
											<dd>{member.memberFollowers}</dd>
										</div>
										<div>
											<dt>{t('Following')}</dt>
											<dd>{member.memberFollowings}</dd>
										</div>
										<div>
											<dt>{t('Likes')}</dt>
											<dd>{member.memberLikes}</dd>
										</div>
									</dl>
									{action.feedback}
								</section>
								<nav className="triplink-profile__nav" aria-label={t('Agent profile sections')}>
									{member.memberType === 'AGENT' && (
										<>
											<a href="#agent-tours">{t('Tours')}</a>
											<a href="#agent-reviews">{t('Reviews')}</a>
										</>
									)}
									<a href="#agent-connections">{t('Connections')}</a>
								</nav>
								{member.memberType === 'AGENT' && (
									<>
										<section id="agent-tours" className="triplink-profile__section" aria-labelledby="agent-tours-title">
											<div className="triplink-profile__section-header">
												<div>
													<h2 id="agent-tours-title">{t('Tours by {{name}}', { name })}</h2>
													<p>{t('Find a journey that feels right for you.')}</p>
												</div>
												<span className="triplink-profile__rating">
													{(member.agentReviewCount ?? 0) > 0
														? t('Agent rating', {
																rating: member.agentAverageRating ?? 0,
																count: member.agentReviewCount ?? 0,
														  })
														: t('No reviews yet')}
												</span>
											</div>
											<TourList
												key={member._id}
												input={{ page: tourPage, limit: 12, search: { agentId: member._id } }}
												onPage={setTourPage}
											/>
										</section>
										<section id="agent-reviews" className="triplink-profile__section">
											<PublicReviews key={member._id} agentId={member._id} />
										</section>
									</>
								)}
								<section
									id="agent-connections"
									className="triplink-profile__section triplink-profile__network"
									aria-labelledby="agent-connections-title"
								>
									<h2 id="agent-connections-title">{t('Connections')}</h2>
									<div className="triplink-profile__connections">
										<div>
											<h3>{t('Followers')}</h3>
											<Follows key={member._id + 'followers'} memberId={member._id} />
										</div>
										<div>
											<h3>{t('Following')}</h3>
											<Follows key={member._id + 'following'} memberId={member._id} following />
										</div>
									</div>
								</section>
							</>
						)}
					</QueryState>
				</div>
			</div>
		);
	}

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
