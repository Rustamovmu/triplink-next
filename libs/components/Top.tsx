import React, { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import BrandLogo from './BrandLogo';
import { Avatar, Divider, Drawer, Menu, MenuItem } from '@mui/material';
import { useReactiveVar } from '@apollo/client';
import { memberVar, sessionVar } from '../../apollo/store';
import { logOut } from '../auth';
import { imageUrl } from './triplink/Common';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';

export default function Top() {
	const member = useReactiveVar(memberVar),
		session = useReactiveVar(sessionVar);
	const router = useRouter();
	const { t } = useTranslation('common');
	const id = useId().replace(/:/g, '');
	const menuId = `triplink-account-${id}`,
		drawerId = `triplink-navigation-${id}`;
	const [open, setOpen] = useState(false);
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	const [scrolled, setScrolled] = useState(false);
	useEffect(() => {
		const update = () => setScrolled(window.scrollY > 24);
		update();
		window.addEventListener('scroll', update, { passive: true });
		return () => window.removeEventListener('scroll', update);
	}, []);
	const close = () => {
		setOpen(false);
		setAnchor(null);
	};
	useEffect(() => {
		setOpen(false);
		setAnchor(null);
	}, [router.asPath, member?._id, member?.memberType]);
	useEffect(() => {
		const media = window.matchMedia('(min-width: 1200px)');
		const onChange = () => {
			setOpen(false);
			setAnchor(null);
		};
		media.addEventListener('change', onChange);
		return () => media.removeEventListener('change', onChange);
	}, []);
	const routes = [
		['/', 'Home'],
		['/tour', 'Tours'],
		['/agent', 'Agents'],
		['/community', 'Community'],
		['/about', 'About'],
	];
	const shortcuts: [string, string][] = [
		['/mypage', 'My workspace'],
		['/mypage?category=myProfile', 'Profile'],
	];
	if (member?.memberType === 'USER')
		shortcuts.push(
			['/mypage?category=myBookings', 'My bookings'],
			['/mypage?category=myFavorites', 'Favorites'],
			['/mypage?category=myReviews', 'My reviews'],
		);
	if (member?.memberType === 'AGENT')
		shortcuts.push(
			['/mypage?category=myTours', 'My tours'],
			['/mypage?category=addTour', 'Create tour'],
			['/mypage?category=agentBookings', 'Tour bookings'],
			['/mypage?category=agentReviews', 'Tour reviews'],
			['/mypage?category=myArticles', 'My articles'],
		);
	if (member?.memberType === 'ADMIN')
		shortcuts.push(
			['/_admin/users', 'Admin management'],
			['/mypage?category=myArticles', 'My articles'],
			['/mypage?category=writeArticle', 'Write article'],
		);
	const current = (url: string) => {
		const [path, query] = url.split('?');
		if (query) return router.pathname === path && router.query.category === new URLSearchParams(query).get('category');
		if (path === '/mypage') return router.pathname === path && !router.query.category;
		return router.pathname === path || (path !== '/' && router.pathname.startsWith(`${path}/`));
	};
	const navigation = () =>
		routes.map(([url, title]) => (
			<Link key={url} href={url} onClick={close} aria-current={current(url) ? 'page' : undefined}>
				{t(title)}
			</Link>
		));
	const logout = () => {
		close();
		logOut();
	};
	const language = () => (
		<label className="triplink-top__language">
			<span className="triplink-visually-hidden">{t('Language')}</span>
			<select
				name="language"
				value={router.locale ?? 'en'}
				onChange={(event) => {
					close();
					void router.push(router.asPath, router.asPath, { locale: event.target.value });
				}}
			>
				<option value="en">English</option>
				<option value="kr">한국어</option>
				<option value="ru">Русский</option>
			</select>
		</label>
	);
	const nickname = member?.memberNick?.trim() || String(t('Account'));
	const initials = Array.from(nickname)
		.slice(0, 2)
		.join('')
		.toLocaleUpperCase(router.locale === 'kr' ? 'ko' : router.locale ?? 'en');
	const avatar = () => (
		<Avatar
			className="triplink-top__avatar"
			src={member?.memberImage ? imageUrl(member.memberImage) : undefined}
			alt=""
			aria-hidden="true"
			imgProps={{ width: 30, height: 30 }}
		>
			{initials}
		</Avatar>
	);
	const login = () =>
		session === 'loading' ? (
			<span className="triplink-top__account-placeholder" role="status">
				<span className="triplink-visually-hidden">{t('Loading account…')}</span>
			</span>
		) : (
			<Link className="triplink-top__account-button" href="/account/join" onClick={close}>
				{t('Login')} / {t('Register')}
			</Link>
		);
	return (
		<header className={`triplink-top${router.pathname === '/' && !scrolled ? ' triplink-top--clear' : ''}`}>
			<a
				className="triplink-top__skip"
				href="#main"
				onClick={() => {
					const main = document.getElementById('main');
					if (main) {
						main.tabIndex = -1;
						main.focus();
					}
				}}
			>
				{t('Skip to content')}
			</a>
			<div className="triplink-top__inner">
				<Link href="/" passHref className="triplink-brand-link" translate="no">
					<BrandLogo inverse />
				</Link>
				<nav className="triplink-top__desktop-nav" aria-label={t('Main navigation')}>
					{navigation()}
				</nav>
				<div className="triplink-top__desktop-account">
					{language()}
					{member ? (
						<button
							type="button"
							className="triplink-top__account-button"
							id={`${menuId}-trigger`}
							aria-label={t('Account menu for {{name}}', { name: nickname })}
							aria-haspopup="menu"
							aria-expanded={Boolean(anchor)}
							aria-controls={anchor ? menuId : undefined}
							onClick={(event) => setAnchor(event.currentTarget)}
							onKeyDown={(event) => {
								if (event.key === 'ArrowDown') {
									event.preventDefault();
									setAnchor(event.currentTarget);
								}
							}}
						>
							{avatar()}
							<span className="triplink-top__nickname" translate="no">
								{nickname}
							</span>
							<span className="triplink-top__chevron" aria-hidden="true">
								⌄
							</span>
						</button>
					) : (
						login()
					)}
				</div>
				<button
					type="button"
					className="triplink-top__menu-button"
					aria-label={t('Open navigation menu')}
					aria-expanded={open}
					aria-controls={open ? drawerId : undefined}
					onClick={() => setOpen(true)}
				>
					<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
					</svg>
				</button>
			</div>
			<Menu
				anchorEl={anchor}
				open={Boolean(anchor) && Boolean(member)}
				onClose={() => setAnchor(null)}
				PaperProps={{ className: 'triplink-account-menu' }}
				MenuListProps={{ id: menuId, 'aria-labelledby': `${menuId}-trigger` }}
				anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
				transformOrigin={{ vertical: 'top', horizontal: 'right' }}
			>
				{shortcuts.map(([url, label]) => (
					<MenuItem
						key={url}
						component={Link}
						href={url}
						onClick={close}
						aria-current={current(url) ? 'page' : undefined}
					>
						{t(label)}
					</MenuItem>
				))}
				<Divider />
				<MenuItem onClick={logout} className="triplink-account-menu__logout">
					{t('Logout')}
				</MenuItem>
			</Menu>
			<Drawer
				anchor="right"
				open={open}
				onClose={close}
				PaperProps={{
					className: 'triplink-nav-drawer-paper',
					role: 'dialog',
					'aria-modal': true,
					'aria-label': t('Main navigation'),
				}}
			>
				<div id={drawerId} className="triplink-nav-drawer">
					<div className="triplink-nav-drawer__heading">
						<strong>{t('Menu')}</strong>
						<button type="button" aria-label={t('Close navigation menu')} onClick={close}>
							×
						</button>
					</div>
					<nav aria-label={t('Main navigation')}>{navigation()}</nav>
					<section className="triplink-nav-drawer__account" aria-labelledby={`${drawerId}-account`}>
						<h2 id={`${drawerId}-account`}>{t('Account')}</h2>
						{member ? (
							<>
								<div className="triplink-nav-drawer__identity">
									{avatar()}
									<p className="triplink-nav-drawer__nickname" translate="no">
										{nickname}
									</p>
								</div>
								<nav aria-label={t('Account navigation')}>
									{shortcuts.map(([url, label]) => (
										<Link key={url} href={url} onClick={close} aria-current={current(url) ? 'page' : undefined}>
											{t(label)}
										</Link>
									))}
								</nav>
								<button type="button" className="triplink-nav-drawer__logout" onClick={logout}>
									{t('Logout')}
								</button>
							</>
						) : (
							login()
						)}
					</section>
					<div className="triplink-nav-drawer__language">{language()}</div>
				</div>
			</Drawer>
		</header>
	);
}
