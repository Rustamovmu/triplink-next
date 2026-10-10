import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { Accordion, AccordionSummary, AccordionDetails, Stack, TextField, Typography } from '@mui/material';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
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
const topicCards = {
	TOURS: { icon: ExploreOutlinedIcon, description: 'Finding your next trip' },
	BOOKINGS: { icon: EventAvailableOutlinedIcon, description: 'Reservations and trip details' },
	PAYMENTS: { icon: CreditCardOutlinedIcon, description: 'Payment and refund questions' },
	ACCOUNTS: { icon: PersonOutlineIcon, description: 'Your account and profile' },
	AGENTS: { icon: BadgeOutlinedIcon, description: 'Travel agents and their tours' },
	COMMUNITY: { icon: ForumOutlinedIcon, description: 'Stories and connections' },
	OTHER: { icon: HelpOutlineIcon, description: 'More about TripLink' },
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
			<div className="triplink-support__heading">
				<h2>{t('Browse by topic')}</h2>
				<button
					type="button"
					aria-pressed={!topic}
					onClick={() => {
						setTopic('');
						setPage(1);
					}}
				>
					{t('All topics')}
				</button>
			</div>
			<div className="triplink-support__topics" role="group" aria-label={t('FAQ topic')}>
				{topics.map((value) => {
					const Icon = topicCards[value].icon;
					return (
						<button
							type="button"
							key={value}
							aria-pressed={topic === value}
							onClick={() => {
								setTopic(value);
								setPage(1);
							}}
						>
							<Icon aria-hidden="true" />
							<strong>{t(topicLabels[value])}</strong>
							<span>{t(topicCards[value].description)}</span>
						</button>
					);
				})}
			</div>
			<section className="triplink-support__answers" aria-labelledby="help-answers-title">
				<div className="triplink-support__answer-heading">
					<h2 id="help-answers-title">{topic ? t(topicLabels[topic]) : t('Frequently asked questions')}</h2>
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
				</div>
				<QueryState loading={!ready || query.loading} error={query.error} retry={() => query.refetch()}>
					{!query.data?.result.list.length && (
						<div className="triplink-support__empty">
							<HelpOutlineIcon aria-hidden="true" />
							<h3>{t(text.trim() || topic ? 'No answers match your search' : 'No FAQs published yet')}</h3>
							<p>
								{t(
									text.trim() || topic
										? 'Try another topic or clear your search.'
										: 'Published answers will appear here. You can also check the latest notices.',
								)}
							</p>
							{(text.trim() || topic) && (
								<button
									type="button"
									onClick={() => {
										setText('');
										setTopic('');
										setPage(1);
									}}
								>
									{t('Clear filters')}
								</button>
							)}
						</div>
					)}
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
			</section>
		</Stack>
	);
}
