import React from 'react';
import Link from 'next/link';
import BrandLogo from './BrandLogo';
import TelegramIcon from '@mui/icons-material/Telegram';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import GitHubIcon from '@mui/icons-material/GitHub';
import { useTranslation } from 'next-i18next';
import { homeDestinations } from './homepage/homeContent';
const socialLinks = [
	{ label: 'Telegram', href: 'https://t.me/Muhammadumar_2004', Icon: TelegramIcon },
	{ label: 'LinkedIn', href: 'https://www.linkedin.com/in/mukhammadumar-rustamov-16385028a/', Icon: LinkedInIcon },
	{ label: 'GitHub', href: 'https://github.com/Rustamovmu', Icon: GitHubIcon },
];

export default function Footer() {
	const { t } = useTranslation('common');
	return (
		<footer className="triplink-footer">
			<div className="triplink-footer__inner">
				<div className="triplink-footer__grid">
					<div className="triplink-footer__brand">
						<h2>{t('About TripLink')}</h2>
						<Link href="/" passHref aria-label={t('Home')} className="triplink-footer__logo">
							<BrandLogo inverse />
						</Link>
						<p>{t('Discover tours, follow travel agents, and share your journeys.')}</p>
						<span className="triplink-footer__promise">{t('Find your next journey.')}</span>
						<div className="triplink-footer__connect">
							<p className="triplink-footer__social-caption">{t('Connect with the creator')}</p>
							<ul className="triplink-footer__socials">
								{socialLinks.map(({ label, href, Icon }) => (
									<li key={label}>
										<a href={href} target="_blank" rel="noopener noreferrer">
											<Icon aria-hidden="true" />
											<span className="triplink-visually-hidden" translate="no">
												{label}
											</span>
											<span className="triplink-visually-hidden"> ({t('Opens in a new tab')})</span>
										</a>
									</li>
								))}
							</ul>
						</div>
					</div>
					<div>
						<h2>{t('Explore destinations')}</h2>
						<ul className="triplink-footer__destinations">
							{homeDestinations.slice(0, 6).map((destination) => (
								<li key={destination.image}>
									<Link href={{ pathname: '/tour', query: { text: destination.name } }}>{t(destination.name)}</Link>
								</li>
							))}
						</ul>
						<Link href="/tour" className="triplink-footer__browse">
							{t('Browse tours')}
						</Link>
					</div>
					<div>
						<h2>{t('Marketplace')}</h2>
						<ul>
							{[
								['/tour', 'Tours'],
								['/agent', 'Agents'],
								['/community', 'Community'],
								['/help-center', 'Help Center'],
							].map(([url, title]) => (
								<li key={url}>
									<Link href={url}>{t(title)}</Link>
								</li>
							))}
						</ul>
					</div>
					<div>
						<h2 translate="no">TripLink</h2>
						<ul>
							<li>
								<Link href="/about">{t('About')}</Link>
							</li>
							<li>
								<Link href="/account/join">{t('Join TripLink')}</Link>
							</li>
							<li>
								<Link href="/">{t('Home')}</Link>
							</li>
						</ul>
					</div>
				</div>
				<div className="triplink-footer__bottom">
					<span>© TripLink {new Date().getFullYear()}</span>
					<span>{t('Travel. Discover. Connect.')}</span>
				</div>
			</div>
		</footer>
	);
}
