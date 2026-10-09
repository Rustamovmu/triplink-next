import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { Accordion, AccordionSummary, AccordionDetails, MenuItem, Stack, TextField, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTranslation } from 'next-i18next';
import { HELP_ENTRIES } from '../../../apollo/user/triplink';
import { FaqTopic } from '../../types/triplink';
import { Pager, QueryState, usePublicReady } from '../triplink/Common';
export const topics: FaqTopic[] = ['TOURS', 'BOOKINGS', 'PAYMENTS', 'ACCOUNTS', 'AGENTS', 'COMMUNITY', 'OTHER'];
export const topicLabels: Record<FaqTopic, string> = {
	TOURS: 'Tours',
	BOOKINGS: 'Bookings',
	PAYMENTS: 'Payments',
	ACCOUNTS: 'Accounts',
	AGENTS: 'Agents',
	COMMUNITY: 'Community',
	OTHER: 'Other',
};
export default function Faq() {
	const { t } = useTranslation('common');
	const ready = usePublicReady();
	const [topic, setTopic] = useState<FaqTopic | ''>('');
	const [text, setText] = useState('');
	const [page, setPage] = useState(1);
	const query = useQuery(HELP_ENTRIES, {
		variables: {
			input: {
				page,
				limit: 12,
				search: {
					noticeCategory: 'FAQ',
					...(topic ? { faqTopic: topic } : {}),
					...(text.trim() ? { text: text.trim() } : {}),
				},
			},
		},
		skip: !ready,
		fetchPolicy: 'network-only',
	});
	return (
		<Stack spacing={2} className="triplink-help-center">
			<Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
				<TextField
					select
					label={t('FAQ topic')}
					value={topic}
					onChange={(e) => {
						setTopic(e.target.value as FaqTopic | '');
						setPage(1);
					}}
					sx={{ minWidth: 180 }}
				>
					<MenuItem value="">{t('All topics')}</MenuItem>
					{topics.map((v) => (
						<MenuItem key={v} value={v}>
							{t(topicLabels[v])}
						</MenuItem>
					))}
				</TextField>
				<TextField
					fullWidth
					label={t('Search Help Center')}
					value={text}
					inputProps={{ maxLength: 100 }}
					onChange={(e) => {
						setText(e.target.value);
						setPage(1);
					}}
				/>
			</Stack>
			<QueryState
				loading={!ready || query.loading}
				error={query.error}
				empty={!query.data?.result.list.length}
				retry={() => query.refetch()}
			>
				{query.data?.result.list.map((entry) => (
					<Accordion key={entry._id}>
						<AccordionSummary
							expandIcon={<ExpandMoreIcon />}
							id={'faq-' + entry._id}
							aria-controls={'answer-' + entry._id}
						>
							<Stack>
								<Typography variant="caption">{entry.faqTopic && t(topicLabels[entry.faqTopic])}</Typography>
								<Typography>{entry.noticeTitle}</Typography>
							</Stack>
						</AccordionSummary>
						<AccordionDetails id={'answer-' + entry._id}>
							<Typography className="help-center-content">{entry.noticeContent}</Typography>
						</AccordionDetails>
					</Accordion>
				))}
			</QueryState>
			<Pager total={query.data?.result.metaCounter[0]?.total ?? 0} page={page} onChange={setPage} />
		</Stack>
	);
}
