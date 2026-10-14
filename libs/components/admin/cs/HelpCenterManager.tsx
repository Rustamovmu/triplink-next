import React, { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import {
	Button,
	Chip,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	MenuItem,
	Paper,
	Stack,
	TextField,
	Typography,
} from '@mui/material';
import { useTranslation } from 'next-i18next';
import {
	ADMIN_HELP_ENTRIES,
	CREATE_HELP_ENTRY,
	UPDATE_HELP_ENTRY,
	REMOVE_HELP_ENTRY,
} from '../../../../apollo/admin/triplink';
import { FaqTopic, HelpEntry, HelpKind, HelpStatus } from '../../../types/triplink';
import { displayDate, Pager, QueryState, useAction } from '../../triplink/Common';
import { topicLabels, topics } from '../../cs/Faq';
export default function HelpCenterManager({ kind }: { kind: HelpKind }) {
	const { t, i18n } = useTranslation('common');
	const action = useAction();
	const [page, setPage] = useState(1);
	const [text, setText] = useState('');
	const [status, setStatus] = useState<HelpStatus | ''>('');
	const [filterTopic, setFilterTopic] = useState<FaqTopic | ''>('');
	const [editing, setEditing] = useState<HelpEntry | 'new' | null>(null);
	const [deleting, setDeleting] = useState<HelpEntry | null>(null);
	const [title, setTitle] = useState('');
	const [content, setContent] = useState('');
	const [topic, setTopic] = useState<FaqTopic>('OTHER');
	const [publication, setPublication] = useState<HelpStatus>('HOLD');
	const query = useQuery(ADMIN_HELP_ENTRIES, {
		variables: {
			input: {
				page,
				limit: 12,
				search: {
					noticeCategory: kind,
					...(status ? { noticeStatus: status } : {}),
					...(filterTopic ? { faqTopic: filterTopic } : {}),
					...(text.trim() ? { text: text.trim() } : {}),
				},
			},
		},
		fetchPolicy: 'network-only',
	});
	const [create] = useMutation(CREATE_HELP_ENTRY);
	const [update] = useMutation(UPDATE_HELP_ENTRY);
	const [remove] = useMutation(REMOVE_HELP_ENTRY);
	const open = (entry: HelpEntry | 'new') => {
		setEditing(entry);
		setTitle(entry === 'new' ? '' : entry.noticeTitle);
		setContent(entry === 'new' ? '' : entry.noticeContent);
		setTopic(entry === 'new' ? 'OTHER' : entry.faqTopic || 'OTHER');
		setPublication(entry === 'new' ? 'HOLD' : entry.noticeStatus);
	};
	const refresh = () => {
		setPage(1);
		void query.refetch().catch(() => {});
	};
	const save = () =>
		action.run(async () => {
			const fields = {
				noticeTitle: title.trim(),
				noticeContent: content.trim(),
				noticeStatus: publication,
				...(kind === 'FAQ' ? { faqTopic: topic } : {}),
			};
			if (editing === 'new') await create({ variables: { input: { noticeCategory: kind, ...fields } } });
			else if (editing) await update({ variables: { input: { entryId: editing._id, ...fields } } });
			setEditing(null);
			refresh();
		});
	return (
		<Stack spacing={2} className="triplink-help-center">
			{action.feedback}
			<Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
				<TextField
					label={t('Search Help Center')}
					value={text}
					inputProps={{ maxLength: 100 }}
					onChange={(e) => {
						setText(e.target.value);
						setPage(1);
					}}
				/>
				<TextField
					select
					label={t('Publication status')}
					value={status}
					sx={{ minWidth: 180 }}
					onChange={(e) => {
						setStatus(e.target.value as HelpStatus | '');
						setPage(1);
					}}
				>
					<MenuItem value="">{t('All statuses')}</MenuItem>
					<MenuItem value="HOLD">{t('Draft')}</MenuItem>
					<MenuItem value="ACTIVE">{t('Published')}</MenuItem>
				</TextField>
				{kind === 'FAQ' && (
					<TextField
						select
						label={t('FAQ topic')}
						value={filterTopic}
						sx={{ minWidth: 180 }}
						onChange={(e) => {
							setFilterTopic(e.target.value as FaqTopic | '');
							setPage(1);
						}}
					>
						<MenuItem value="">{t('All topics')}</MenuItem>
						{topics.map((v) => (
							<MenuItem key={v} value={v}>
								{t(topicLabels[v])}
							</MenuItem>
						))}
					</TextField>
				)}
				<Button variant="contained" disabled={action.busy} onClick={() => open('new')}>
					{t(kind === 'FAQ' ? 'Create FAQ' : 'Create notice')}
				</Button>
			</Stack>
			<QueryState
				loading={query.loading}
				error={query.error}
				empty={!query.data?.result.list.length}
				retry={() => query.refetch()}
			>
				{query.data?.result.list.map((entry) => (
					<Paper key={entry._id} variant="outlined" sx={{ p: 2 }}>
						<Stack spacing={1}>
							<Typography variant="h6" sx={{ overflowWrap: 'anywhere' }}>
								{entry.noticeTitle}
							</Typography>
							<Stack direction="row" spacing={1}>
								<Chip label={t(entry.noticeStatus === 'HOLD' ? 'Draft' : 'Published')} />
								{entry.faqTopic && <Chip label={t(topicLabels[entry.faqTopic])} />}
							</Stack>
							<Typography variant="caption">
								{t('Created')}: {displayDate(entry.createdAt, i18n.language)} · {t('Updated')}: {displayDate(entry.updatedAt, i18n.language)}
							</Typography>
							<Stack direction="row" spacing={1} flexWrap="wrap">
								<Button disabled={action.busy} onClick={() => open(entry)}>
									{t('Edit')}
								</Button>
								<Button
									disabled={action.busy}
									onClick={() =>
										action.run(async () => {
											try {
												await update({
													variables: {
														input: {
															entryId: entry._id,
															noticeStatus: entry.noticeStatus === 'ACTIVE' ? 'HOLD' : 'ACTIVE',
														},
													},
												});
											} finally {
												refresh();
											}
										})
									}
								>
									{t(entry.noticeStatus === 'ACTIVE' ? 'Unpublish' : 'Publish')}
								</Button>
								<Button color="error" disabled={action.busy} onClick={() => setDeleting(entry)}>
									{t('Delete permanently')}
								</Button>
							</Stack>
						</Stack>
					</Paper>
				))}
			</QueryState>
			<Pager total={query.data?.result.metaCounter[0]?.total ?? 0} page={page} onChange={setPage} />
			<Dialog
				open={!!editing}
				onClose={() => {
					if (!action.busy) setEditing(null);
				}}
				fullWidth
				maxWidth="md"
				aria-labelledby="help-edit-title"
			>
				<DialogTitle id="help-edit-title">
					{t(editing === 'new' ? (kind === 'FAQ' ? 'Create FAQ' : 'Create notice') : 'Edit Help Center entry')}
				</DialogTitle>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						void save();
					}}
				>
					<DialogContent>
						<Stack spacing={3}>
							{action.feedback?.props.severity === 'error' ? action.feedback : null}
							<TextField
								required
								label={t('Title')}
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								inputProps={{ minLength: 3, maxLength: 150 }}
							/>
							<TextField
								required
								multiline
								minRows={6}
								label={t('Content')}
								value={content}
								onChange={(e) => setContent(e.target.value)}
								inputProps={{ minLength: 3, maxLength: 10000 }}
							/>
							{kind === 'FAQ' && (
								<TextField
									select
									label={t('FAQ topic')}
									value={topic}
									onChange={(e) => setTopic(e.target.value as FaqTopic)}
								>
									{topics.map((v) => (
										<MenuItem key={v} value={v}>
											{t(topicLabels[v])}
										</MenuItem>
									))}
								</TextField>
							)}
							<TextField
								select
								label={t('Publication status')}
								value={publication}
								onChange={(e) => setPublication(e.target.value as HelpStatus)}
							>
								<MenuItem value="HOLD">{t('Draft')}</MenuItem>
								<MenuItem value="ACTIVE">{t('Published')}</MenuItem>
							</TextField>
						</Stack>
					</DialogContent>
					<DialogActions>
						<Button disabled={action.busy} onClick={() => setEditing(null)}>
							{t('Cancel')}
						</Button>
						<Button
							type="submit"
							variant="contained"
							disabled={action.busy || title.trim().length < 3 || content.trim().length < 3}
						>
							{t('Save')}
						</Button>
					</DialogActions>
				</form>
			</Dialog>
			<Dialog
				open={!!deleting}
				onClose={() => {
					if (!action.busy) setDeleting(null);
				}}
				aria-labelledby="help-delete-title"
			>
				<DialogTitle id="help-delete-title">{t('Delete permanently')}</DialogTitle>
				<DialogContent>
					{action.feedback?.props.severity === 'error' ? action.feedback : null}
					<Typography>{t('Permanently delete this entry?')}</Typography>
					<Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{deleting?.noticeTitle}</Typography>
					<Typography>{t('This action cannot be undone.')}</Typography>
				</DialogContent>
				<DialogActions>
					<Button disabled={action.busy} onClick={() => setDeleting(null)}>
						{t('Cancel')}
					</Button>
					<Button
						color="error"
						disabled={action.busy}
						onClick={() =>
							action.run(async () => {
								if (!deleting) return;
								try {
									await remove({ variables: { entryId: deleting._id } });
								} finally {
									refresh();
								}
								setDeleting(null);
							})
						}
					>
						{t('Delete permanently')}
					</Button>
				</DialogActions>
			</Dialog>
		</Stack>
	);
}
