import React from 'react';
import Link from 'next/link';
import BrandLogo from './BrandLogo';
import { useTranslation } from 'next-i18next';
import { homeDestinations } from './homepage/homeContent';
export default function Footer() {
	const { t } = useTranslation('common');
	return (
		<footer className="triplink-footer">
			<div className="triplink-footer__inner">
				<div className="triplink-footer__grid">
					<div className="triplink-footer__brand">
						<BrandLogo />
						<p>{t('Discover tours, follow travel agents, and share your journeys.')}</p>
						<span>{t('Find your next journey.')}</span>
					</div>
					<div>
						<h2>{t('Explore destinations')}</h2>
						<ul>
							{homeDestinations.map((destination) => (
								<li key={destination.image}>
									<Link href={{ pathname: '/tour', query: { text: destination.name } }}>{t(destination.name)}</Link>
								</li>
							))}
						</ul>
					</div>
					<div>
						<h2>{t('Marketplace')}</h2>
						<ul>
							{[
								['/tour', 'Tours'],
								['/agent', 'Agents'],
								['/community', 'Community'],
							].map(([url, title]) => (
								<li key={url}>
									<Link href={url}>{t(title)}</Link>
								</li>
							))}
						</ul>
					</div>
					<div>
						<h2>TripLink</h2>
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
