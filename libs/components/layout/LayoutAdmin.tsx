import React, { ComponentType, useState } from 'react';
import { AppBar, Box, Button, Drawer, Toolbar, Typography } from '@mui/material';
import Link from 'next/link';
import Head from 'next/head';
import AdminMenuList from '../admin/AdminMenuList';
import { Access } from '../triplink/Session';
import { logOut } from '../../auth';
import Avatar from '@mui/material/Avatar';
import { useReactiveVar } from '@apollo/client';
import { memberVar } from '../../../apollo/store';
import { imageUrl } from '../triplink/Common';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
const drawerWidth = 248;
export default function withAdminLayout(Component: ComponentType) {
	function AdminLayout(props: object) {
		const router = useRouter();
		const [open, setOpen] = useState(false);
		const { t } = useTranslation('common');
		const member = useReactiveVar(memberVar);
		const logout = () => {
			setOpen(false);
			void logOut()
				.then(() => router.push('/'))
				.catch(() => {
					window.alert(String(t('Unable to sign out. Please retry.')));
				});
		};
		return (
			<Access roles={['ADMIN']}>
				<Head>
					<title>{`TripLink · ${t('Admin')}`}</title>
				</Head>
				<Box component="div" className="triplink-admin" sx={{ display: 'flex', minHeight: '100vh' }}>
					<AppBar className="admin-topbar" position="fixed" elevation={0} sx={{ zIndex: 1201 }}>
						<Toolbar>
							<Button color="inherit" sx={{ display: { md: 'none' } }} onClick={() => setOpen(!open)}>
								{t('Menu')}
							</Button>
							<Link href="/_admin/users" passHref legacyBehavior>
								<a className="admin-brand">
									TripLink<span>{t('Admin workspace')}</span>
								</a>
							</Link>
							<div style={{ flex: 1 }} />
							<Avatar
								src={member?.memberImage ? imageUrl(member.memberImage) : undefined}
								sx={{ width: 32, height: 32, mr: 1 }}
							>
								{member?.memberNick.slice(0, 2).toUpperCase()}
							</Avatar>
							<Typography className="admin-current-user" sx={{ mr: 3 }}>
								{member?.memberNick}
							</Typography>
							<Link href="/">{t('Home')}</Link>
							<Button color="inherit" onClick={logout}>
								{t('Logout')}
							</Button>
						</Toolbar>
					</AppBar>
					<Drawer
						className="admin-sidebar"
						variant="permanent"
						sx={{
							display: { xs: 'none', md: 'block' },
							width: drawerWidth,
							'& .MuiDrawer-paper': { width: drawerWidth, pt: 8 },
						}}
					>
						<AdminMenuList onNavigate={() => setOpen(false)} />
					</Drawer>
					<Drawer
						className="admin-sidebar"
						open={open}
						PaperProps={{ className: 'triplink-admin' }}
						onClose={() => setOpen(false)}
						sx={{ display: { md: 'none' }, '& .MuiDrawer-paper': { width: drawerWidth, pt: 8 } }}
					>
						<AdminMenuList onNavigate={() => setOpen(false)} />
					</Drawer>
					<Box component="main" className="admin-main" sx={{ flex: 1, minWidth: 0, pt: 8 }}>
						<Component {...props} />
					</Box>
				</Box>
			</Access>
		);
	}
	return AdminLayout;
}
