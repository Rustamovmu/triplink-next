import { useTranslation } from 'next-i18next';
import React, { useState } from 'react';
import { useMutation, useQuery, useReactiveVar } from '@apollo/client';
import { Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { ADMIN_MEMBERS, ADMIN_MEMBER_UPDATE } from '../../../apollo/admin/triplink';
import { memberVar } from '../../../apollo/store';
import { Member, Role, MemberStatus, totalOf } from '../../types/triplink';
import { Pager, QueryState, useAction } from './Common';
function MemberRow({ member, refetch }: { member: Member; refetch: () => Promise<unknown> }) {
	const { t } = useTranslation('common');

	const current = useReactiveVar(memberVar);
	const action = useAction();
	const [role, setRole] = useState(member.memberType);
	const [status, setStatus] = useState(member.memberStatus);
	const [nick, setNick] = useState(member.memberNick);
	const [update] = useMutation(ADMIN_MEMBER_UPDATE);
	return (
		<Card variant="outlined">
			<CardContent>
				<Stack spacing={2}>
					{action.feedback}
					<Typography>
						{member.memberFullname || member.memberNick} · {member.memberTours} {t('tours ·')} {member.memberReviews}{' '}
						{t('reviews')}
					</Typography>
					<TextField
						label={t('Nickname')}
						value={nick}
						onChange={(e) => setNick(e.target.value)}
						inputProps={{ minLength: 3, maxLength: 20 }}
					/>
					<Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
						<TextField
							select
							label={t('Role')}
							value={role}
							disabled={current?._id === member._id}
							onChange={(e) => setRole(e.target.value as Role)}
						>
							{['USER', 'AGENT', 'ADMIN'].map((value) => (
								<MenuItem key={value} value={value}>
									{t(String(value))}
								</MenuItem>
							))}
						</TextField>
						<TextField
							select
							label={t('Status')}
							value={status}
							disabled={current?._id === member._id}
							onChange={(e) => setStatus(e.target.value as MemberStatus)}
						>
							{['PENDING', 'ACTIVE', 'BLOCK', 'SUSPENDED', 'DELETE'].map((value) => (
								<MenuItem key={value} value={value}>
									{t(String(value))}
								</MenuItem>
							))}
						</TextField>
					</Stack>
					<Button
						disabled={action.busy || nick.trim().length < 3}
						onClick={() =>
							void action.run(async () => {
								await update({
									variables: {
										input: {
											memberId: member._id,
											memberNick: nick.trim(),
											...(member._id !== current?._id ? { memberType: role, memberStatus: status } : {}),
										},
									},
								});
								await refetch();
							})
						}
					>
						{t('Save member')}
					</Button>
				</Stack>
			</CardContent>
		</Card>
	);
}
export function AdminMembers() {
	const { t } = useTranslation('common');

	const [page, setPage] = useState(1);
	const [text, setText] = useState('');
	const [role, setRole] = useState<Role | ''>('');
	const [status, setStatus] = useState<MemberStatus | ''>('');
	const query = useQuery(ADMIN_MEMBERS, {
		variables: {
			input: {
				page,
				limit: 12,
				search: { text, ...(role ? { memberType: role } : {}), ...(status ? { memberStatus: status } : {}) },
			},
		},
		fetchPolicy: 'network-only',
	});
	return (
		<Stack spacing={2}>
			<TextField
				label={t('Search members')}
				value={text}
				onChange={(e) => {
					setText(e.target.value);
					setPage(1);
				}}
			/>
			<Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
				<TextField
					select
					label={t('Role')}
					value={role}
					onChange={(e) => {
						setRole(e.target.value as Role | '');
						setPage(1);
					}}
				>
					<MenuItem value="">{t('All')}</MenuItem>
					{['USER', 'AGENT', 'ADMIN'].map((value) => (
						<MenuItem key={value} value={value}>
							{t(String(value))}
						</MenuItem>
					))}
				</TextField>
				<TextField
					select
					label={t('Status')}
					value={status}
					onChange={(e) => {
						setStatus(e.target.value as MemberStatus | '');
						setPage(1);
					}}
				>
					<MenuItem value="">{t('All')}</MenuItem>
					{['PENDING', 'ACTIVE', 'BLOCK', 'SUSPENDED', 'DELETE'].map((value) => (
						<MenuItem key={value} value={value}>
							{t(String(value))}
						</MenuItem>
					))}
				</TextField>
			</Stack>
			<QueryState
				loading={query.loading}
				error={query.error}
				empty={!query.data?.result.list.length}
				retry={() => query.refetch()}
			>
				{query.data?.result.list.map((member) => (
					<MemberRow key={member._id + member.updatedAt} member={member} refetch={() => query.refetch()} />
				))}
			</QueryState>
			<Pager page={page} total={totalOf(query.data?.result)} onChange={setPage} />
		</Stack>
	);
}
