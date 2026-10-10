import { useTranslation } from 'next-i18next';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApolloClient, useMutation, useQuery, useReactiveVar } from '@apollo/client';
import { Alert, Avatar, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import {
	FAVORITES,
	VISITED,
	PROFILE_UPDATE,
	MEMBER,
	FOLLOWERS,
	FOLLOWINGS,
	FOLLOW_TOGGLE,
	FAVORITE_TOGGLE,
} from '../../../apollo/user/triplink';
import { memberVar } from '../../../apollo/store';
import { acceptAuth, refreshCurrentMember } from '../../auth';
import { Member, MemberUpdate, totalOf } from '../../types/triplink';
import { imageUrl, Pager, QueryState, useAction, usePublicReady } from './Common';
import { TourGrid } from './Tours';
import { uploadImages } from '../../uploads';
export function ProfileForm({ member }: { member: Member }) {
	const { t } = useTranslation('common');

	const [image, setImage] = useState(member.memberImage);
	const action = useAction();
	const [update] = useMutation(PROFILE_UPDATE);
	const submit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const value = (key: string) => String(form.get(key) ?? '').trim();
		const passwords = {
			currentPassword: String(form.get('currentPassword') ?? ''),
			newPassword: String(form.get('newPassword') ?? ''),
		};
		void action.run(async () => {
			const input: MemberUpdate = {
				memberNick: value('memberNick'),
				memberImage: image,
				memberCountry: value('memberCountry'),
				memberDesc: value('memberDesc'),
				memberFavoriteDestinations: value('destinations')
					.split(',')
					.map((item) => item.trim())
					.filter(Boolean),
			};
			if (value('memberFullname')) input.memberFullname = value('memberFullname');
			if (passwords.currentPassword || passwords.newPassword) {
				if (passwords.currentPassword.length < 8 || passwords.newPassword.length < 8)
					throw new Error('Both passwords must have at least eight characters.');
				input.passwordChange = passwords;
			}
			const response = await update({ variables: { input } });
			if (!response.data?.result) throw new Error('Profile update failed');
			await acceptAuth(response.data.result);
		});
	};
	return (
		<Stack component="form" key={member.updatedAt} spacing={2} onSubmit={submit}>
			{action.feedback}
			<Avatar src={imageUrl(image)} sx={{ width: 80, height: 80 }} />
			<Button component="label" disabled={action.busy}>
				{t('Upload profile image')}
				<input
					type="file"
					accept="image/jpeg,image/png"
					hidden
					onChange={(e) => {
						const files = Array.from(e.target.files ?? []);
						void action.run(async () => setImage((await uploadImages(files, 'member'))[0]));
						e.target.value = '';
					}}
				/>
			</Button>
			{(['memberNick', 'memberFullname', 'memberCountry', 'memberDesc'] as const).map((key) => (
				<TextField
					key={key}
					name={key}
					label={t(key)}
					required={key === 'memberNick'}
					defaultValue={member[key] ?? ''}
					multiline={key === 'memberDesc'}
					inputProps={{
						minLength: key === 'memberNick' ? 3 : key === 'memberFullname' ? 2 : undefined,
						maxLength: key === 'memberDesc' ? 1000 : key === 'memberNick' ? 20 : 100,
					}}
				/>
			))}
			<TextField
				name="destinations"
				label={t('Favorite destinations (comma separated)')}
				defaultValue={member.memberFavoriteDestinations.join(', ')}
			/>
			<TextField
				name="currentPassword"
				label={t('Current password')}
				type="password"
				inputProps={{ maxLength: 72 }}
				autoComplete="current-password"
			/>
			<TextField
				name="newPassword"
				label={t('New password')}
				type="password"
				inputProps={{ maxLength: 72 }}
				autoComplete="new-password"
			/>
			<Button disabled={action.busy} type="submit" variant="contained">
				{t('Save profile')}
			</Button>
		</Stack>
	);
}
export function SavedTours({ visited = false }: { visited?: boolean }) {
	const { t } = useTranslation('common');

	const [page, setPage] = useState(1);
	const query = useQuery(visited ? VISITED : FAVORITES, {
		variables: { input: { page, limit: 12 } },
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
				<TourGrid tours={query.data?.result.list ?? []} />
			</QueryState>
			<Pager page={page} total={totalOf(query.data?.result)} onChange={setPage} />
		</Stack>
	);
}
export function Follows({ memberId, following = false }: { memberId: string; following?: boolean }) {
	const ready = usePublicReady();
	const current = useReactiveVar(memberVar);
	if (!ready) return <QueryState loading>{null}</QueryState>;
	return (
		<FollowsList
			key={`${memberId}-${following}-${current?._id ?? 'anonymous'}`}
			memberId={memberId}
			following={following}
		/>
	);
}
function FollowsList({ memberId, following }: { memberId: string; following: boolean }) {
	const { t } = useTranslation('common');
	const [page, setPage] = useState(1);
	const current = useReactiveVar(memberVar);
	const client = useApolloClient();
	const action = useAction();
	const [toggle] = useMutation(FOLLOW_TOGGLE);
	const query = useQuery(following ? FOLLOWINGS : FOLLOWERS, {
		variables: { input: { page, limit: 12, search: { memberId } } },
		fetchPolicy: 'network-only',
		notifyOnNetworkStatusChange: true,
	});
	return (
		<Stack spacing={2} className="triplink-connections-list">
			{action.feedback}
			<QueryState loading={query.loading} error={query.error} retry={() => query.refetch()}>
				{!query.data?.result.list.length && (
					<Typography>{t(following ? 'Not following anyone yet.' : 'No followers yet.')}</Typography>
				)}
				{query.data?.result.list.map((row) => {
					const person = row.memberData;
					if (!person) return <Typography key={row._id}>{t('Unavailable member')}</Typography>;
					const name = person.memberFullname || person.memberNick;
					const href =
						person.memberType === 'AGENT' ? `/agent/detail?agentId=${person._id}` : `/member?memberId=${person._id}`;
					return (
						<Card variant="outlined" key={row._id}>
							<CardContent className="triplink-connection">
								<Link href={href} passHref className="triplink-connection__person">
									<Avatar src={person.memberImage ? imageUrl(person.memberImage) : undefined} alt={name}>
										{name[0]?.toUpperCase()}
									</Avatar>
									<span>
										<strong>{name}</strong>
										<span>
											{t(person.memberType === 'AGENT' ? 'Travel agent' : 'Traveler')}
											{person.memberCountry ? ` · ${person.memberCountry}` : ''}
										</span>
									</span>
								</Link>
								<div className="triplink-connection__stats">
									<span>{t('Agent follower count', { count: person.memberFollowers })}</span>
									{person.memberType === 'AGENT' && <span>{t('Agent tour count', { count: person.memberTours })}</span>}
								</div>
								{current && ['USER', 'AGENT'].includes(current.memberType) && person._id !== current._id && (
									<Button
										variant={row.isFollowing ? 'outlined' : 'contained'}
										disableElevation
										disabled={action.busy}
										aria-label={t(row.isFollowing ? 'Unfollow {{name}}' : 'Follow {{name}}', { name })}
										aria-pressed={row.isFollowing}
										onClick={() =>
											void action.run(async () => {
												const result = await toggle({ variables: { memberId: person._id } });
												if (!result.data?.result) throw new Error('Follow request failed');
												await refreshCurrentMember();
												await client.refetchQueries({ include: [FOLLOWERS, FOLLOWINGS, MEMBER] });
											}, t(row.isFollowing ? 'Member unfollowed' : 'Member followed'))
										}
									>
										{t(row.isFollowing ? 'Unfollow' : 'Follow')}
									</Button>
								)}
								{!current && <Link href="/account/join">{t('Log in to follow')}</Link>}
							</CardContent>
						</Card>
					);
				})}
			</QueryState>
			<Pager page={page} total={totalOf(query.data?.result)} onChange={setPage} />
		</Stack>
	);
}
export function FavoriteButton({ tourId, onChanged }: { tourId: string; onChanged: () => Promise<unknown> }) {
	const { t } = useTranslation('common');

	const current = useReactiveVar(memberVar);
	const client = useApolloClient();
	const [saved, setSaved] = useState<boolean | null>(null);
	const [error, setError] = useState('');
	const [attempt, setAttempt] = useState(0);
	const action = useAction();
	const [toggle] = useMutation(FAVORITE_TOGGLE);
	useEffect(() => {
		let active = true;
		setSaved(null);
		setError('');
		if (!current?._id || current.memberType === 'ADMIN') return;
		void (async () => {
			try {
				let page = 1;
				let found = false;
				while (true) {
					const { data } = await client.query({
						query: FAVORITES,
						variables: { input: { page, limit: 100 } },
						fetchPolicy: 'network-only',
					});
					if (data.result.list.some((tour) => tour._id === tourId)) {
						found = true;
						break;
					}
					if (page * 100 >= totalOf(data.result) || !data.result.list.length) break;
					page++;
				}
				if (active) setSaved(found);
			} catch (e) {
				if (active) setError(e instanceof Error ? e.message : 'Unable to load favorites');
			}
		})();
		return () => {
			active = false;
		};
	}, [current, client, tourId, attempt]);
	if (!current || current.memberType === 'ADMIN') return null;
	return (
		<Stack spacing={1}>
			{action.feedback}
			{error && (
				<Alert severity="error" action={<Button onClick={() => setAttempt(attempt + 1)}>{t('Retry')}</Button>}>
					{error}
				</Alert>
			)}
			<Button
				variant="outlined"
				disabled={action.busy || saved === null}
				aria-pressed={saved ?? false}
				onClick={() =>
					void action.run(async () => {
						const response = await toggle({ variables: { tourId } });
						if (response.data) setSaved(response.data.result.favorited);
						await onChanged();
					})
				}
			>
				{t(saved ? 'Remove favorite' : 'Save tour')}
			</Button>
		</Stack>
	);
}
