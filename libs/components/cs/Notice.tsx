import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import {
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	List,
	ListItemButton,
	ListItemText,
	Stack,
	TextField,
	Typography,
} from '@mui/material';
import { useTranslation } from 'next-i18next';
import { HELP_ENTRIES, HELP_ENTRY } from '../../../apollo/user/triplink';
import { Pager, QueryState, usePublicReady, displayDate } from '../triplink/Common';
export default function Notice() {
	const { t } = useTranslation('common');
	const ready = usePublicReady();
	const [page, setPage] = useState(1);
	const [text, setText] = useState('');
	const [selected, setSelected] = useState('');
	const query = useQuery(HELP_ENTRIES, {
		variables: {
			input: { page, limit: 12, search: { noticeCategory: 'NOTICE', ...(text.trim() ? { text: text.trim() } : {}) } },
		},
		skip: !ready,
		fetchPolicy: 'network-only',
	});
	const detail = useQuery(HELP_ENTRY, {
		variables: { entryId: selected },
		skip: !selected || !ready,
		fetchPolicy: 'network-only',
	});
	return (
		<Stack spacing={2} className="triplink-help-center">
			<TextField
				label={t('Search Help Center')}
				value={text}
				inputProps={{ maxLength: 100 }}
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
				<List>
					{query.data?.result.list.map((entry) => (
						<ListItemButton key={entry._id} onClick={() => setSelected(entry._id)}>
							<ListItemText primary={entry.noticeTitle} secondary={displayDate(entry.createdAt)} />
						</ListItemButton>
					))}
				</List>
			</QueryState>
			<Pager total={query.data?.result.metaCounter[0]?.total ?? 0} page={page} onChange={setPage} />
			<Dialog
				open={!!selected}
				onClose={() => setSelected('')}
				fullWidth
				maxWidth="md"
				aria-labelledby="notice-dialog-title"
			>
				<DialogTitle id="notice-dialog-title">{detail.data?.result.noticeTitle || t('Notice')}</DialogTitle>
				<DialogContent>
					<QueryState loading={detail.loading} error={detail.error} retry={() => detail.refetch()}>
						<Typography className="help-center-content">{detail.data?.result.noticeContent}</Typography>
					</QueryState>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setSelected('')}>{t('Close')}</Button>
				</DialogActions>
			</Dialog>
		</Stack>
	);
}
