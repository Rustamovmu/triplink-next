import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { useQuery } from '@apollo/client';
import { Avatar } from '@mui/material';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import TheaterComedyOutlinedIcon from '@mui/icons-material/TheaterComedyOutlined';
import LocalFloristOutlinedIcon from '@mui/icons-material/LocalFloristOutlined';
import CelebrationOutlinedIcon from '@mui/icons-material/CelebrationOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { TOURS, AGENTS } from '../../../apollo/user/triplink';
import { Inquiry, Tour, TourSearch } from '../../types/triplink';
import { imageUrl, QueryState, usePublicReady } from '../triplink/Common';
import { useTourFavorites } from '../triplink/TourFavorites';

type TourVariant = 'featured' | 'rated' | 'top';
const inputs: Record<TourVariant, Inquiry<TourSearch>> = {
	featured: { page: 1, limit: 6, search: { featured: true } },
	rated: { page: 1, limit: 6, search: {}, sort: 'tourAverageRating', direction: 'DESC' },
	top: { page: 1, limit: 6, search: {}, sort: 'tourViewCount', direction: 'DESC' },
};
const agentInput = { page: 1, limit: 4, search: {}, sort: 'memberFollowers', direction: 'DESC' as const };
const headings = {
	featured: ['Featured tours', 'Remarkable places, thoughtfully chosen.'],
	rated: ['Best rated', 'Trips travelers love.'],
	top: ['Top tours', 'Most viewed tours'],
};

function Section({
	id,
	title,
	description,
	href,
	linkText,
	children,
}: {
	id: string;
	title: string;
	description: string;
	href?: string;
	linkText?: string;
	children: React.ReactNode;
}) {
	const { t } = useTranslation('common');
	return (
		<section className={`triplink-home-section triplink-home-section--${id}`} aria-labelledby={`home-${id}`}>
			<div className="triplink-home-section__heading">
				<div>
					<h2 id={`home-${id}`}>{t(title)}</h2>
					<p>{t(description)}</p>
				</div>
				{href && linkText && (
					<Link className="triplink-home-section__link" href={href}>
						{t(linkText)}
					</Link>
				)}
			</div>
			{children}
		</section>
	);
}

function TourImage({ tour }: { tour: Tour }) {
	const [failed, setFailed] = useState(false);
	return (
		<Link
			href={`/tour/detail?id=${tour._id}`}
			passHref
			className="triplink-home-tour__photo"
			tabIndex={-1}
			aria-hidden="true"
		>
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img
				src={!failed && tour.tourImages[0] ? imageUrl(tour.tourImages[0]) : '/img/tour-placeholder.svg'}
				alt=""
				width={640}
				height={400}
				loading="lazy"
				decoding="async"
				onError={() => setFailed(true)}
			/>
		</Link>
	);
}

function Price({ tour }: { tour: Tour }) {
	const { t } = useTranslation('common');
	const { locale } = useRouter();
	const format = new Intl.NumberFormat(locale === 'kr' ? 'ko-KR' : locale === 'ru' ? 'ru-RU' : 'en-US', {
		style: 'currency',
		currency: 'USD',
		maximumFractionDigits: 2,
		minimumFractionDigits: 0,
	});
	const discounted = tour.tourDiscountPrice !== null && tour.tourDiscountPrice < tour.tourPrice;
	return (
		<div className="triplink-home-price">
			<span>{t('Per person')}</span>
			<div>
				{discounted && <s>{format.format(tour.tourPrice)}</s>}
				<strong>{format.format(discounted ? tour.tourDiscountPrice! : tour.tourPrice)}</strong>
			</div>
		</div>
	);
}

function SaveTour({ tour }: { tour: Tour }) {
	const { t } = useTranslation('common');
	const favorites = useTourFavorites();
	const saved = favorites.saved.has(tour._id);
	const error = favorites.error || favorites.errors[tour._id];
	if (favorites.anonymous)
		return (
			<Link
				href="/account/join"
				passHref
				className="triplink-home-save"
				aria-label={t('Login to save {{title}}', { title: tour.tourTitle })}
			>
				<FavoriteBorderRoundedIcon aria-hidden="true" />
			</Link>
		);
	if (!favorites.eligible) return null;
	return (
		<>
			<button
				type="button"
				className="triplink-home-save"
				aria-label={
					favorites.error
						? t('Retry saved tours')
						: t(saved ? 'Unsave {{title}}' : 'Save {{title}}', { title: tour.tourTitle })
				}
				aria-pressed={favorites.ready ? saved : undefined}
				aria-busy={(!favorites.ready && !favorites.error) || favorites.pending.has(tour._id)}
				disabled={(!favorites.ready && !favorites.error) || favorites.pending.has(tour._id)}
				onClick={() => (favorites.error ? favorites.retry() : void favorites.toggle(tour._id))}
			>
				{saved ? <FavoriteRoundedIcon aria-hidden="true" /> : <FavoriteBorderRoundedIcon aria-hidden="true" />}
			</button>
			{error && (
				<p role="alert" className="triplink-home-tour__error">
					{t(error)}
				</p>
			)}
		</>
	);
}

function HomeTourCard({ tour, variant, rank }: { tour: Tour; variant: TourVariant; rank: number }) {
	const { t } = useTranslation('common');
	const { locale } = useRouter();
	const number = new Intl.NumberFormat(locale === 'kr' ? 'ko-KR' : locale === 'ru' ? 'ru-RU' : 'en-US', {
		maximumFractionDigits: 1,
	});
	const href = `/tour/detail?id=${tour._id}`;
	return (
		<article className={`triplink-home-tour triplink-home-tour--${variant}`}>
			{variant === 'top' && (
				<span className="triplink-home-tour__rank" aria-label={t('Rank {{rank}}', { rank })}>
					{String(rank).padStart(2, '0')}
				</span>
			)}
			<div className="triplink-home-tour__visual">
				<TourImage key={JSON.stringify([tour._id, tour.tourImages])} tour={tour} />
				{variant === 'featured' && <SaveTour tour={tour} />}
			</div>
			<div className="triplink-home-tour__body">
				{variant === 'featured' && <span className="triplink-home-tour__category">{t(tour.tourCategory)}</span>}
				{variant === 'rated' && (
					<div className="triplink-home-tour__rating">
						<StarRoundedIcon aria-hidden="true" />
						{tour.tourReviewCount > 0 ? (
							<>
								<strong>{number.format(tour.tourAverageRating)}</strong>
								<span>
									{t('{{rating}} out of 5', { rating: number.format(tour.tourAverageRating) })} ·{' '}
									{t('{{count}} reviews', { count: tour.tourReviewCount })}
								</span>
							</>
						) : (
							<span>{t('No reviews yet')}</span>
						)}
					</div>
				)}
				<h3>
					<Link href={href}>{tour.tourTitle}</Link>
				</h3>
				<p className="triplink-home-tour__destination">
					{tour.tourDestination} <span aria-hidden="true">·</span>{' '}
					{t('{{count}} days', { count: tour.tourDurationDays })}
				</p>
				{tour.tourStatus === 'SOLD_OUT' && <span className="triplink-home-tour__sold-out">{t('Sold out')}</span>}
				{variant === 'top' && (
					<p className="triplink-home-tour__views">
						{t('{{count}} views', { count: tour.tourViewCount, displayCount: number.format(tour.tourViewCount) })}
					</p>
				)}
				<div className="triplink-home-tour__bottom">
					<Price tour={tour} />
					{variant === 'featured' && (
						<Link
							href={href}
							className="triplink-home-tour__cta"
							aria-label={t('View tour: {{title}}', { title: tour.tourTitle })}
						>
							{t('View tour')}
						</Link>
					)}
				</div>
			</div>
		</article>
	);
}

function TourSection({ variant }: { variant: TourVariant }) {
	const ready = usePublicReady();
	const query = useQuery(TOURS, {
		variables: { input: inputs[variant] },
		skip: !ready,
		notifyOnNetworkStatusChange: true,
	});
	return (
		<Section
			id={variant}
			title={headings[variant][0]}
			description={headings[variant][1]}
			href="/tour"
			linkText="Explore tours"
		>
			<QueryState
				loading={!ready || query.loading}
				error={query.error}
				empty={!query.data?.result.list.length}
				retry={() => query.refetch()}
			>
				<div className={`triplink-home-grid triplink-home-grid--${variant}`}>
					{query.data?.result.list.map((tour, index) => (
						<HomeTourCard key={tour._id} tour={tour} variant={variant} rank={index + 1} />
					))}
				</div>
			</QueryState>
		</Section>
	);
}

function TopAgents() {
	const { t } = useTranslation('common');
	const ready = usePublicReady();
	const query = useQuery(AGENTS, { variables: { input: agentInput }, skip: !ready, notifyOnNetworkStatusChange: true });
	return (
		<Section id="agents" title="Top agents" description="Most followed agents" href="/agent" linkText="All agents">
			<QueryState
				loading={!ready || query.loading}
				error={query.error}
				empty={!query.data?.result.list.length}
				retry={() => query.refetch()}
			>
				<div className="triplink-home-grid triplink-home-grid--agents">
					{query.data?.result.list.map((agent) => (
						<article key={agent._id} className="triplink-home-agent">
							<Avatar src={imageUrl(agent.memberImage)} alt="" className="triplink-home-agent__portrait">
								{(agent.memberFullname || agent.memberNick).slice(0, 1)}
							</Avatar>
							<div className="triplink-home-agent__body">
								<h3>
									<Link href={`/agent/detail?agentId=${agent._id}`}>{agent.memberFullname || agent.memberNick}</Link>
								</h3>
								{agent.memberCountry && <p>{agent.memberCountry}</p>}
								<div className="triplink-home-agent__stats">
									<span>{t('Agent tour count', { count: agent.memberTours })}</span>
									<span>{t('Agent follower count', { count: agent.memberFollowers })}</span>
								</div>
								<Link
									className="triplink-home-agent__link"
									href={`/agent/detail?agentId=${agent._id}`}
									aria-label={t('View agent: {{name}}', { name: agent.memberFullname || agent.memberNick })}
								>
									{t('View profile')}
								</Link>
							</div>
						</article>
					))}
				</div>
			</QueryState>
		</Section>
	);
}

// Evergreen editorial content, deliberately separate from bookable tours and API data.
const events = [
	{
		name: 'Venice Carnival',
		location: 'Venice, Italy',
		description: 'Masks, costumes, and performances across Venice.',
		season: 'Winter',
		icon: TheaterComedyOutlinedIcon,
		href: 'https://carnevale.venezia.it/en/the-venice-carnival/',
	},
	{
		name: 'Hirosaki Cherry Blossom Festival',
		location: 'Hirosaki, Japan',
		description: 'Cherry blossoms frame the castle grounds of Hirosaki Park.',
		season: 'Spring',
		icon: LocalFloristOutlinedIcon,
		href: 'https://sakura.hirosakipark.jp/en',
	},
	{
		name: 'Oktoberfest',
		location: 'Munich, Germany',
		description: 'Explore Munich’s traditional folk festival.',
		season: 'Autumn',
		icon: CelebrationOutlinedIcon,
		href: 'https://www.oktoberfest.de/en',
	},
	{
		name: 'Taiwan Lantern Festival',
		location: 'Taiwan',
		description: 'Discover illuminated lantern art and cultural performances.',
		season: 'Winter',
		icon: LightModeOutlinedIcon,
		href: 'https://www.taiwan.net.tw/m1.aspx?sno=0027328',
	},
];
function Events() {
	const { t } = useTranslation('common');
	return (
		<Section id="events" title="Events" description="Seasonal inspiration around the world">
			<div className="triplink-home-grid triplink-home-grid--events">
				{events.map((event) => (
					<article className="triplink-home-event" key={event.name}>
						<div className="triplink-home-event__illustration">
							<event.icon aria-hidden="true" />
							<span>{t(event.season)}</span>
						</div>
						<div className="triplink-home-event__body">
							<p className="triplink-home-event__location">{t(event.location)}</p>
							<h3>{t(event.name)}</h3>
							<p>{t(event.description)}</p>
						</div>
						<a
							href={event.href}
							target="_blank"
							rel="noopener noreferrer"
							className="triplink-home-event__link"
							aria-label={t('Official website for {{event}} (opens in a new tab)', { event: t(event.name) })}
						>
							{t('Official website')}
							<OpenInNewRoundedIcon aria-hidden="true" />
						</a>
					</article>
				))}
			</div>
		</Section>
	);
}

export default function HomeSections() {
	return (
		<div className="triplink-home-sections">
			<TourSection variant="featured" />
			<TourSection variant="rated" />
			<TopAgents />
			<TourSection variant="top" />
			<Events />
		</div>
	);
}
