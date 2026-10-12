import { useTranslation } from 'next-i18next';
import React from 'react';
import { useRouter } from 'next/router';
import { useReactiveVar } from '@apollo/client';
import { Alert, Avatar } from '@mui/material';
import Link from 'next/link';
import { memberVar } from '../../../apollo/store';
import { Access } from './Session';
import { imageUrl } from './Common';
import { ArticlesList, ArticleForm } from './Community';
import { BookingsPanel } from './Bookings';
import { ReviewsPanel } from './Reviews';
import { TourForm, OwnedTours } from './TourManagement';
import { ProfileForm, SavedTours, Follows } from './Members';
function WorkspaceContent() {
	const { t } = useTranslation('common');

	const router = useRouter();
	const member = useReactiveVar(memberVar);
	if (!member) return null;
	const raw = typeof router.query.category === 'string' ? router.query.category : 'myProfile';
	const category = ({ addProperty: 'addTour', myProperties: 'myTours' } as Record<string, string>)[raw] ?? raw;
	const choices = [
		...(['AGENT', 'ADMIN'].includes(member.memberType)
			? [
					['myArticles', 'My articles'],
					['writeArticle', 'Write article'],
			  ]
			: []),
		...(member.memberType === 'USER'
			? [
					['myBookings', 'My bookings'],
					['myReviews', 'My reviews'],
			  ]
			: member.memberType === 'AGENT'
			? [
					['agentBookings', 'Tour bookings'],
					['agentReviews', 'Tour reviews'],
			  ]
			: []),
		...(member.memberType === 'AGENT'
			? [
					['myTours', 'My tours'],
					['addTour', 'Create tour'],
			  ]
			: []),
		['myProfile', 'Profile'],
		...(member.memberType !== 'ADMIN'
			? [
					['myFavorites', 'Favorites'],
					['recentlyVisited', 'Recently visited'],
					['followers', 'Followers'],
					['followings', 'Following'],
			  ]
			: []),
	];
	return (
		<div className="triplink-workspace">
			<section data-triplink-nav-hero className="triplink-workspace__hero">
				<div>
					<h1>{t('My workspace')}</h1>
					<p>{t('Your trips, connections, and profile in one place.')}</p>
				</div>
			</section>
			<div className="triplink-workspace__layout">
				<aside className="triplink-workspace__sidebar">
					<div className="triplink-workspace__account">
						<Avatar src={member.memberImage ? imageUrl(member.memberImage) : undefined} alt={member.memberNick}>
							{member.memberNick[0]?.toUpperCase()}
						</Avatar>
						<strong>{member.memberFullname || member.memberNick}</strong>
						<span>
							{t(member.memberType === 'AGENT' ? 'Travel agent' : member.memberType === 'ADMIN' ? 'Admin' : 'Traveler')}
						</span>
					</div>
					<nav aria-label={t('Workspace sections')}>
						{choices.map(([key, label]) => (
							<Link
								key={key}
								href={{ pathname: '/mypage', query: { category: key } }}
								aria-current={category === key ? 'page' : undefined}
								scroll={false}
							>
								{t(label)}
							</Link>
						))}
						{member.memberType === 'ADMIN' && <Link href="/_admin/users">{t('Admin management')}</Link>}
					</nav>
				</aside>
				<section className="triplink-workspace__content" aria-labelledby="workspace-section-title">
					<h2 id="workspace-section-title">{t(choices.find(([key]) => key === category)?.[1] || 'My workspace')}</h2>
					{['AGENT', 'ADMIN'].includes(member.memberType) && category === 'myArticles' ? (
						<ArticlesList mine />
					) : ['AGENT', 'ADMIN'].includes(member.memberType) && category === 'writeArticle' ? (
						<ArticleForm
							onSaved={async () => {
								await router.push('/mypage?category=myArticles');
							}}
						/>
					) : member.memberType !== 'ADMIN' &&
					  category === (member.memberType === 'AGENT' ? 'agentBookings' : 'myBookings') ? (
						<BookingsPanel />
					) : member.memberType !== 'ADMIN' &&
					  category === (member.memberType === 'AGENT' ? 'agentReviews' : 'myReviews') ? (
						<ReviewsPanel />
					) : member.memberType === 'AGENT' && category === 'myTours' ? (
						<OwnedTours />
					) : member.memberType === 'AGENT' && category === 'addTour' ? (
						<TourForm
							onSaved={async () => {
								await router.push('/mypage?category=myTours');
							}}
						/>
					) : category === 'myProfile' ? (
						<ProfileForm member={member} />
					) : member.memberType !== 'ADMIN' && category === 'myFavorites' ? (
						<SavedTours />
					) : member.memberType !== 'ADMIN' && category === 'recentlyVisited' ? (
						<SavedTours visited />
					) : member.memberType !== 'ADMIN' && ['followers', 'followings'].includes(category) ? (
						<Follows memberId={member._id} following={category === 'followings'} />
					) : (
						<Alert severity="info">{t('You do not have access to this section.')}</Alert>
					)}
				</section>
			</div>
		</div>
	);
}
export default function Workspace() {
	return (
		<Access>
			<WorkspaceContent />
		</Access>
	);
}
