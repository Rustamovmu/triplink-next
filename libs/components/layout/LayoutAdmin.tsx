import React, { ComponentType, useState } from 'react';
import { AppBar, Box, Button, Drawer, Stack, Toolbar, Typography } from '@mui/material';
import Link from 'next/link';
import Head from 'next/head';
import AdminMenuList from '../admin/AdminMenuList';
import { Access } from '../triplink/Session';
import { logOut } from '../../auth';
import { useTranslation } from 'next-i18next';
const drawerWidth = 240;
export default function withAdminLayout(Component: ComponentType) {
	function AdminLayout(props: object) {
		const [open, setOpen] = useState(false);
		const { t } = useTranslation('common');
		return (
			<Access roles={['ADMIN']}>
				<Head>
					<title>TripLink · {t('Admin')}</title>
				</Head>
				<Box component="div" sx={{ display: 'flex', minHeight: '100vh' }}>
					<AppBar position="fixed" sx={{ zIndex: 1201 }}>
						<Toolbar>
							<Button color="inherit" sx={{ display: { md: 'none' } }} onClick={() => setOpen(!open)}>
								{t('Menu')}
							</Button>
							<Typography sx={{ flex: 1 }}>TripLink · {t('Admin')}</Typography>
							<Link href="/">{t('Home')}</Link>
							<Button color="inherit" onClick={logOut}>
								{t('Logout')}
							</Button>
						</Toolbar>
					</AppBar>
					<Drawer
						variant="permanent"
						sx={{
							display: { xs: 'none', md: 'block' },
							width: drawerWidth,
							'& .MuiDrawer-paper': { width: drawerWidth, pt: 8 },
						}}
					>
						<AdminMenuList />
					</Drawer>
					<Drawer
						open={open}
						onClose={() => setOpen(false)}
						sx={{ display: { md: 'none' }, '& .MuiDrawer-paper': { width: drawerWidth, pt: 8 } }}
					>
						<AdminMenuList />
					</Drawer>
					<Box component="main" sx={{ flex: 1, minWidth: 0, pt: 8 }}>
						<Component {...props} />
					</Box>
				</Box>
			</Access>
		);
	}
	return AdminLayout;
}
