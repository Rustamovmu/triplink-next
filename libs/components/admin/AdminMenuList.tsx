import React from 'react';
import Link from 'next/link';
import { List, ListItemButton, ListItemText } from '@mui/material';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
export default function AdminMenuList() {
	const router = useRouter();
	const { t } = useTranslation('common');
	return (
		<List>
			{[
				['users', 'Members'],
				['tours', 'Tours'],
				['bookings', 'Bookings'],
				['reviews', 'Reviews'],
				['community', 'Community'],
			].map(([path, title]) => (
				<Link href={`/_admin/${path}`} key={path}>
					<ListItemButton component="div" selected={router.pathname === `/_admin/${path}`}>
						<ListItemText primary={t(title)} />
					</ListItemButton>
				</Link>
			))}
		</List>
	);
}
