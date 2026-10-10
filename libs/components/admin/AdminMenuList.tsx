import React from 'react';
import Link from 'next/link';
import { List, ListItemButton, ListItemText, ListItemIcon } from '@mui/material';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import PeopleOutline from '@mui/icons-material/PeopleOutline';
import ExploreOutlined from '@mui/icons-material/ExploreOutlined';
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined';
import RateReviewOutlined from '@mui/icons-material/RateReviewOutlined';
import ForumOutlined from '@mui/icons-material/ForumOutlined';
import HelpOutline from '@mui/icons-material/HelpOutline';
import CampaignOutlined from '@mui/icons-material/CampaignOutlined';
const icons = [
	PeopleOutline,
	ExploreOutlined,
	EventNoteOutlined,
	RateReviewOutlined,
	ForumOutlined,
	HelpOutline,
	CampaignOutlined,
];
export default function AdminMenuList({ onNavigate }: { onNavigate?: () => void }) {
	const router = useRouter();
	const { t } = useTranslation('common');
	return (
		<List className="admin-menu" component="nav" aria-label={t('Administration')}>
			{[
				['users', 'Members'],
				['tours', 'Tours'],
				['bookings', 'Bookings'],
				['reviews', 'Reviews'],
				['community', 'Community'],
				['cs/faq', 'Help Center: FAQs'],
				['cs/notice', 'Help Center: Notices'],
			].map(([path, title], index) => (
				<Link href={`/_admin/${path}`} key={path} passHref legacyBehavior>
					<ListItemButton
						component="a"
						onClick={onNavigate}
						aria-current={router.pathname === `/_admin/${path}` ? 'page' : undefined}
						selected={router.pathname === `/_admin/${path}`}
					>
						<ListItemIcon>{React.createElement(icons[index])}</ListItemIcon>
						<ListItemText primary={t(title)} />
					</ListItemButton>
				</Link>
			))}
		</List>
	);
}
