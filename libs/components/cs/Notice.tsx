import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import { useTranslation } from 'next-i18next';
import { HELP_ENTRIES, HELP_ENTRY } from '../../../apollo/user/triplink';
import { Pager, QueryState, usePublicReady, displayDate } from '../triplink/Common';
export default function Notice() {
	const { t, i18n } = useTranslation('common');
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
			<div className="triplink-support__answer-heading">
				<div>
					<h2>{t('Latest notices')}</h2>
					<p>{t('News and updates from TripLink.')}</p>
				</div>
				<TextField
					label={t('Search Help Center')}
					value={text}
					inputProps={{ maxLength: 100 }}
					onChange={(e) => {
						setText(e.target.value);
						setPage(1);
					}}
				/>
			</div>
			<QueryState loading={!ready || query.loading} error={query.error} retry={() => query.refetch()}>
				{!query.data?.result.list.length && (
					<div className="triplink-support__empty">
						<CampaignOutlinedIcon aria-hidden="true" />
						<h3>{t(text.trim() ? 'No notices match your search' : 'No notices published yet')}</h3>
						<p>{t(text.trim() ? 'Try a different search term.' : 'Updates from TripLink will appear here.')}</p>
						{text.trim() && (
							<button
								type="button"
								onClick={() => {
									setText('');
									setPage(1);
								}}
							>
								{t('Clear filters')}
							</button>
						)}
					</div>
				)}
				<div className="triplink-support__notices">
					{query.data?.result.list.map((entry) => (
						<button type="button" key={entry._id} onClick={() => setSelected(entry._id)} aria-haspopup="dialog">
							<CampaignOutlinedIcon aria-hidden="true" />
							<time dateTime={entry.createdAt}>{displayDate(entry.createdAt, i18n.language)}</time>
							<h3>{entry.noticeTitle}</h3>
							<p>{entry.noticeContent}</p>
							<span>{t('Read notice')}</span>
						</button>
					))}
				</div>
			</QueryState>
			<Pager total={query.data?.result.metaCounter[0]?.total ?? 0} page={page} onChange={setPage} />
			<Dialog
				open={!!selected}
				onClose={() => setSelected('')}
				fullWidth
				maxWidth="md"
				aria-labelledby="notice-dialog-title"
				className="triplink-support-dialog"
			>
				<DialogTitle id="notice-dialog-title">{detail.data?.result.noticeTitle || t('Notice')}</DialogTitle>
				<DialogContent>
					<QueryState
						loading={detail.loading}
						error={detail.error}
						empty={!detail.data?.result}
						retry={() => detail.refetch()}
					>
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
