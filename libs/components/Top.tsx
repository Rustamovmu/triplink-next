import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import BrandLogo from './BrandLogo';
import { Drawer } from '@mui/material';
import { useReactiveVar } from '@apollo/client';
import { memberVar, sessionVar } from '../../apollo/store';
import { logOut } from '../auth';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
export default function Top() {
	const member = useReactiveVar(memberVar),
		session = useReactiveVar(sessionVar);
	const router = useRouter();
	const { t } = useTranslation('common');
	const [open, setOpen] = useState(false);
	useEffect(() => {
		setOpen(false);
	}, [router.asPath]);
	useEffect(() => {
		const media = window.matchMedia('(min-width: 1200px)');
		const close = () => {
			if (media.matches) setOpen(false);
		};
		media.addEventListener('change', close);
		return () => media.removeEventListener('change', close);
	}, []);
	const routes = [
		['/', 'Home'],
		['/tour', 'Tours'],
		['/agent', 'Agents'],
		['/community', 'Community'],
		['/about', 'About'],
	];
	if (member) routes.push(['/mypage', 'My Page']);
	if (member?.memberType === 'ADMIN') routes.push(['/_admin/users', 'Admin']);
	const navigation = () =>
		routes.map(([url, title]) => (
			<Link
				key={url}
				href={url}
				onClick={() => setOpen(false)}
				aria-current={
					router.pathname === url || (url !== '/' && router.pathname.startsWith(`${url}/`)) ? 'page' : undefined
				}
			>
				{t(title)}
			</Link>
		));
	const account = () => (
		<>
			{member ? (
				<button
					type="button"
					className="triplink-top__account-button"
					onClick={() => {
						logOut();
						setOpen(false);
					}}
				>
					{t('Logout')}
				</button>
			) : (
				session !== 'loading' && (
					<Link className="triplink-top__account-button" href="/account/join" onClick={() => setOpen(false)}>
						{t('Login')} / {t('Register')}
					</Link>
				)
			)}
			<label className="triplink-top__language">
				<span className="triplink-visually-hidden">{t('Language')}</span>
				<select
					value={router.locale ?? 'en'}
					onChange={(event) => {
						setOpen(false);
						void router.push(router.asPath, router.asPath, { locale: event.target.value });
					}}
				>
					<option value="en">English</option>
					<option value="kr">한국어</option>
					<option value="ru">Русский</option>
				</select>
			</label>
		</>
	);
	return (
		<header className="triplink-top">
			<div className="triplink-top__inner">
				<Link href="/" className="triplink-brand-link">
					<BrandLogo />
				</Link>
				<nav className="triplink-top__desktop-nav" aria-label={t('Main navigation')}>
					{navigation()}
				</nav>
				<div className="triplink-top__desktop-account">{account()}</div>
				<button
					type="button"
					className="triplink-top__menu-button"
					aria-label={t('Open navigation menu')}
					aria-expanded={open}
					aria-controls={open ? 'triplink-navigation-drawer' : undefined}
					onClick={() => setOpen(true)}
				>
					☰
				</button>
			</div>
			<Drawer
				anchor="right"
				open={open}
				onClose={() => setOpen(false)}
				PaperProps={{
					role: 'dialog',
					'aria-modal': true,
					'aria-label': t('Main navigation'),
					style: { width: 'min(360px, 100vw)', background: '#f0fbff' },
				}}
			>
				<div id="triplink-navigation-drawer" className="triplink-nav-drawer">
					<div className="triplink-nav-drawer__heading">
						<strong>{t('Menu')}</strong>
						<button type="button" aria-label={t('Close navigation menu')} onClick={() => setOpen(false)}>
							×
						</button>
					</div>
					<nav aria-label={t('Main navigation')}>{navigation()}</nav>
					<div className="triplink-nav-drawer__account">{account()}</div>
				</div>
			</Drawer>
		</header>
	);
}
