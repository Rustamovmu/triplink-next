import { useTranslation } from 'next-i18next';
import React, { useState } from 'react';
import { useMutation, useQuery, useReactiveVar } from '@apollo/client';
import { Avatar, Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material';
import Link from 'next/link';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import { ADMIN_MEMBERS, ADMIN_MEMBER_UPDATE } from '../../../apollo/admin/triplink';
import { memberVar } from '../../../apollo/store';
import { Member, Role, MemberStatus, totalOf } from '../../types/triplink';
import { imageUrl, Pager, QueryState, useAction } from './Common';
export function MemberRow({ member, refetch }: { member: Member; refetch: () => Promise<unknown> }) {
	const { t } = useTranslation('common');

	const current = useReactiveVar(memberVar);
	const action = useAction();
	const [role, setRole] = useState(member.memberType);
	const [status, setStatus] = useState(member.memberStatus);
	const [nick, setNick] = useState(member.memberNick);
	const [update] = useMutation(ADMIN_MEMBER_UPDATE);
	return (
		<Card variant="outlined" className="admin-member-editor">
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

					<div className="admin-editor-footer">
						<Button
							onClick={() => {
								setNick(member.memberNick);
								setRole(member.memberType);
								setStatus(member.memberStatus);
							}}
							disabled={action.busy}
						>
							{t('Reset changes')}
						</Button>
						<Button
							variant="contained"
							disabled={
								action.busy ||
								nick.trim().length < 3 ||
								nick.trim().length > 20 ||
								(nick.trim() === member.memberNick && role === member.memberType && status === member.memberStatus)
							}
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
					</div>
				</Stack>
			</CardContent>
		</Card>
	);
}
export function AdminMembers() {
	const { t, i18n } = useTranslation('common');
	const [page, setPage] = useState(1);
	const [text, setText] = useState('');
	const [role, setRole] = useState<Role | ''>('');
	const [status, setStatus] = useState<MemberStatus | ''>('');
	const [limit, setLimit] = useState(12);
	const [editing, setEditing] = useState<string | null>(null);
	const tools = useAction();
	const query = useQuery(ADMIN_MEMBERS, {
		variables: {
			input: {
				page,
				limit,
				search: { text, ...(role ? { memberType: role } : {}), ...(status ? { memberStatus: status } : {}) },
			},
		},
		fetchPolicy: 'network-only',
		notifyOnNetworkStatusChange: true,
	});
	const members = query.data?.result.list || [];
	const total = totalOf(query.data?.result);
	const clear = () => {
		setText('');
		setRole('');
		setStatus('');
		setPage(1);
		setEditing(null);
	};
	const date = (value: string) => {
		const parsed = new Date(value);
		return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString(i18n.language);
	};
	return (
		<section className="admin-members">
			<header className="admin-members-heading">
				<div>
					<h1>{t('Member management')}</h1>
					<p>{t('Manage accounts, permissions, and community access.')}</p>
				</div>
				<Button
					variant="outlined"
					startIcon={<RefreshOutlined />}
					disabled={query.loading || tools.busy}
					onClick={() => void tools.run(() => query.refetch(), null)}
				>
					{t('Refresh')}
				</Button>
			</header>
			<div className="admin-member-summary">
				<div>
					<strong>{query.loading ? '—' : total}</strong>
					<span>{t('Matching members')}</span>
				</div>
				<div>
					<strong>{query.loading ? '—' : members.filter((m) => m.memberType === 'AGENT').length}</strong>
					<span>{t('Agents on this page')}</span>
				</div>
				<div>
					<strong>{query.loading ? '—' : members.filter((m) => m.memberStatus === 'PENDING').length}</strong>
					<span>{t('Pending on this page')}</span>
				</div>
				<p>{t('Review member access before changing a role or status.')}</p>
			</div>
			<div className="admin-member-directory">
				<div className="admin-member-filters">
					<TextField
						label={t('Search members')}
						value={text}
						InputProps={{ startAdornment: <SearchOutlined sx={{ mr: 1, color: '#69818a' }} /> }}
						onChange={(e) => {
							setText(e.target.value);
							setPage(1);
						}}
					/>
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
								{t(value)}
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
								{t(value)}
							</MenuItem>
						))}
					</TextField>
					<Button disabled={!text && !role && !status} onClick={clear}>
						{t('Clear filters')}
					</Button>
				</div>
				<div className="admin-member-quickfilters">
					<span>{t('Quick filters')}</span>
					{[
						['', 'All'],
						['PENDING', 'Pending review'],
						['BLOCK', 'Blocked'],
						['SUSPENDED', 'Suspended'],
					].map(([value, label]) => (
						<button
							key={value}
							type="button"
							aria-pressed={status === value}
							onClick={() => {
								setStatus(value as MemberStatus | '');
								setPage(1);
							}}
						>
							{t(label)}
						</button>
					))}
				</div>
				{tools.feedback}
				<QueryState loading={query.loading} error={query.error} empty={!members.length} retry={() => query.refetch()}>
					<div className="admin-member-table-scroll">
						<table className="admin-member-table">
							<caption className="admin-sr-only">{t('Member management')}</caption>
							<thead>
								<tr>
									{['Member', 'Role', 'Status', 'Activity', 'Joined', 'Actions'].map((label) => (
										<th key={label} scope="col">
											{t(label)}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{members.map((member) => (
									<React.Fragment key={member._id + member.updatedAt}>
										<tr>
											<td>
												<div className="admin-member-identity">
													<Avatar src={member.memberImage ? imageUrl(member.memberImage) : undefined} alt="">
														{member.memberNick.slice(0, 2).toUpperCase()}
													</Avatar>
													<div>
														<strong>{member.memberFullname || member.memberNick}</strong>
														<span>@{member.memberNick}</span>
														<small>{member.memberCountry || '—'}</small>
													</div>
												</div>
											</td>
											<td>
												<span className="admin-role">{t(member.memberType)}</span>
											</td>
											<td>
												<span className={`admin-status admin-status-${member.memberStatus.toLowerCase()}`}>
													{t(member.memberStatus === 'BLOCK' ? 'Blocked' : member.memberStatus)}
												</span>
											</td>
											<td>
												<div className="admin-member-activity">
													<span>
														{member.memberTours} {t('Tours')}
													</span>
													<span>
														{member.memberReviews} {t('Reviews')}
													</span>
												</div>
											</td>
											<td>{date(member.createdAt)}</td>
											<td>
												<div className="admin-member-actions">
													<Button
														variant="outlined"
														size="small"
														aria-expanded={editing === member._id}
														aria-controls={`editor-${member._id}`}
														onClick={() => setEditing(editing === member._id ? null : member._id)}
													>
														{t(editing === member._id ? 'Close' : 'Edit member')}
													</Button>
													{member.memberType !== 'ADMIN' && member.memberStatus === 'ACTIVE' && (
														<Link
															href={
																member.memberType === 'AGENT'
																	? `/agent/detail?agentId=${member._id}`
																	: `/member?memberId=${member._id}`
															}
														>
															{t('View profile')}
														</Link>
													)}
													<Button
														size="small"
														onClick={() =>
															void tools.run(() => navigator.clipboard.writeText(member._id), t('Member ID copied'))
														}
													>
														{t('Copy ID')}
													</Button>
												</div>
											</td>
										</tr>
										{editing === member._id && (
											<tr>
												<td colSpan={6}>
													<div id={`editor-${member._id}`}>
														<MemberRow member={member} refetch={() => query.refetch()} />
													</div>
												</td>
											</tr>
										)}
									</React.Fragment>
								))}
							</tbody>
						</table>
					</div>
				</QueryState>
				<footer className="admin-member-pagination">
					<span>
						{t('Showing members')}{' '}
						{query.loading || !total ? '—' : `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} / ${total}`}
					</span>
					<TextField
						select
						size="small"
						label={t('Rows per page')}
						value={limit}
						onChange={(e) => {
							setLimit(Number(e.target.value));
							setPage(1);
						}}
					>
						{[12, 24, 48].map((value) => (
							<MenuItem key={value} value={value}>
								{value}
							</MenuItem>
						))}
					</TextField>
					<Pager page={page} limit={limit} total={total} onChange={setPage} />
				</footer>
			</div>
		</section>
	);
}
