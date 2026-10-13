import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { useQuery } from '@apollo/client';
import { Avatar } from '@mui/material';
import { IntroVideo } from './IntroMedia';
import { IntroGallery } from './IntroGallery';
import { IntroCircularCarousel } from './IntroCircularCarousel';
import { HomeArticles } from './HomeArticles';
import { AgentsAtlas } from './AgentsAtlas';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { TOURS, AGENTS } from '../../../apollo/user/triplink';
import { Inquiry, Tour, TourSearch } from '../../types/triplink';
import { imageUrl, QueryState, usePublicReady } from '../triplink/Common';
import { useTourFavorites } from '../triplink/TourFavorites';
import { useRememberedState } from '../../triplink/BrowsingMemoryProvider';

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

const introductions: Record<string, { text: string; detail?: string; photo?: string }> = {
	featured: {
		text: 'Make room for a memorable journey.',
		detail: 'Explore featured tours and find a destination that stays with you.',
		photo: '/img/homepage/featured/swiss-alps.jpg',
	},
	rated: { text: 'Let traveler reviews guide your next trip.', photo: '/img/homepage/rated-circular/kyoto.jpg' },
	agents: { text: 'Meet the people behind your next adventure.' },
	top: { text: 'See what other travelers are exploring.', photo: '/video/top-tours-temple.jpg' },
	events: { text: 'Plan your travels around moments worth experiencing.' },
	articles: { text: 'Stories from those who wander further.' },
};

// Exact decorative geometry from the five inspected Stitch exports.
const sectionBackdrops: Record<string, React.ReactNode> = {
	featured: (
		<svg
			className="triplink-stitch-contours"
			aria-hidden="true"
			focusable="false"
			fill="none"
			preserveAspectRatio="none"
			viewBox="0 0 1440 900"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M-100 200 C300 260 500 120 850 190 C1200 260 1350 180 1600 220"
				stroke="currentColor"
				strokeDasharray="4 6"
				strokeWidth="1.2"
			></path>
			<path
				d="M-120 320 C240 370 600 240 920 310 C1240 380 1400 300 1620 340"
				stroke="currentColor"
				strokeWidth="1.2"
			></path>
			<path
				d="M-80 440 C280 490 620 380 980 430 C1340 480 1420 420 1600 460"
				stroke="currentColor"
				strokeDasharray="8 6"
				strokeWidth="1.2"
			></path>
			<path
				d="M-150 580 C200 620 520 510 880 570 C1240 630 1380 560 1640 600"
				stroke="currentColor"
				strokeWidth="1.2"
			></path>
			<path
				d="M-90 700 C320 740 640 660 1020 710 C1400 760 1480 700 1620 740"
				stroke="currentColor"
				strokeDasharray="3 4"
				strokeWidth="1.2"
			></path>
		</svg>
	),
	rated: (
		<svg
			className="triplink-stitch-contours"
			aria-hidden="true"
			focusable="false"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 1600 1200"
		>
			<path d="M-100,200 C300,50 700,350 1100,180 C1400,60 1700,250 1900,100" strokeWidth="1.8"></path>
			<path
				d="M-150,380 C250,220 650,480 1050,310 C1350,190 1650,400 1850,260"
				strokeDasharray="6 8"
				strokeWidth="1.5"
			></path>
			<path d="M-50,560 C350,420 750,680 1150,520 C1450,410 1750,580 1950,450" strokeWidth="2"></path>
			<path d="M-100,750 C400,600 800,850 1200,690 C1500,580 1700,790 1900,620" strokeWidth="1.4"></path>
			<path
				d="M-200,980 C320,800 720,1050 1120,910 C1420,820 1720,990 1920,850"
				strokeDasharray="4 6"
				strokeWidth="1.8"
			></path>
		</svg>
	),
	top: (
		<svg
			className="triplink-stitch-contours"
			aria-hidden="true"
			focusable="false"
			fill="none"
			viewBox="0 0 1440 900"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M-100 200C120 180 340 320 620 280C900 240 1080 120 1320 180C1440 210 1560 300 1600 350"
				stroke="#073B43"
				strokeDasharray="3 3"
				strokeOpacity="0.08"
				strokeWidth="1.2"
			></path>
			<path
				d="M-60 320C180 300 400 450 700 400C1000 350 1140 220 1380 280C1480 310 1580 410 1640 460"
				stroke="#073B43"
				strokeOpacity="0.07"
				strokeWidth="1.2"
			></path>
			<path
				d="M-120 450C150 430 420 570 780 510C1140 450 1220 330 1440 390C1540 420 1620 520 1680 570"
				stroke="#073B43"
				strokeOpacity="0.06"
				strokeWidth="1.2"
			></path>
			<path
				d="M-40 600C220 560 480 710 860 630C1240 550 1340 460 1520 510C1600 530 1660 620 1720 680"
				stroke="#073B43"
				strokeOpacity="0.05"
				strokeWidth="1.2"
			></path>
		</svg>
	),
	articles: (
		<svg
			className="triplink-stitch-contours"
			aria-hidden="true"
			focusable="false"
			fill="none"
			stroke="currentColor"
			strokeWidth="0.8"
			viewBox="0 0 600 600"
		>
			<circle cx="300" cy="300" r="80" strokeDasharray="3 3"></circle>
			<circle cx="300" cy="300" r="140"></circle>
			<circle cx="300" cy="300" r="210"></circle>
			<circle cx="300" cy="300" r="280" strokeDasharray="4 6"></circle>
			<path d="M 50,300 Q 180,240 300,300 T 550,300"></path>
			<path d="M 60,340 Q 200,280 300,340 T 540,340"></path>
			<path d="M 40,260 Q 170,210 300,260 T 560,260" strokeDasharray="2 4"></path>
		</svg>
	),
	events: (
		<svg
			className="triplink-stitch-contours"
			aria-hidden="true"
			focusable="false"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 1400 900"
		>
			<path
				d="M-100,120 C250,90 450,280 800,210 C1150,140 1350,320 1600,260"
				stroke="#073B43"
				strokeDasharray="6 4"
				strokeOpacity="0.06"
				strokeWidth="1.2"
			></path>
			<path
				d="M-50,220 C320,170 510,400 860,330 C1210,260 1410,460 1650,380"
				stroke="#073B43"
				strokeOpacity="0.05"
				strokeWidth="1.4"
			></path>
			<path
				d="M-120,410 C180,360 420,580 770,510 C1120,440 1320,620 1580,560"
				stroke="#073B43"
				strokeOpacity="0.04"
				strokeWidth="1.2"
			></path>
			<circle cx="1120" cy="180" r="140" stroke="#c19852" strokeOpacity="0.12" strokeWidth="1"></circle>
			<circle
				cx="1120"
				cy="180"
				r="85"
				stroke="#c19852"
				strokeDasharray="4 6"
				strokeOpacity="0.08"
				strokeWidth="0.8"
			></circle>
			<circle cx="210" cy="620" r="180" stroke="#073B43" strokeOpacity="0.05" strokeWidth="1"></circle>
		</svg>
	),
};

function SectionBackdrop({ variant }: { variant: string }) {
	if (variant === 'agents') return null;
	return (
		<>
			<div className="triplink-stitch-glows" aria-hidden="true">
				<i />
				<i />
				<i />
			</div>
			{sectionBackdrops[variant]}
		</>
	);
}

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
	const { t, i18n } = useTranslation('common');
	const introduction = introductions[id];
	return (
		<section
			data-browse-section={`home:${id}`}
			className={`triplink-home-section triplink-home-section--${id}${
				id !== 'agents' ? ' triplink-home-section--stitch' : ''
			}`}
			aria-labelledby={`home-${id}`}
			lang={
				id === 'agents' || id === 'featured' || id === 'rated'
					? i18n.language === 'kr'
						? 'ko'
						: i18n.language
					: undefined
			}
		>
			<SectionBackdrop variant={id} />
			<div className="triplink-home-section__inner">
				<div
					className={`triplink-home-section__intro${introduction?.photo ? ' triplink-home-section__intro--photo' : ''}`}
				>
					<div className="triplink-home-section__copy">
						{id === 'featured' && (
							<svg
								className="triplink-stitch-solar"
								viewBox="0 0 220 130"
								fill="none"
								aria-hidden="true"
								focusable="false"
							>
								<circle cx="150" cy="46" fill="#ECC076" fillOpacity="0.25" r="42" />
								<circle cx="150" cy="46" fill="#ECC076" fillOpacity="0.35" r="28" />
								<path
									d="M10 78 C 60 60, 100 95, 150 78 C 180 68, 205 74, 220 80"
									stroke="#71787A"
									strokeDasharray="3 3"
									strokeWidth="0.75"
								/>
								<path
									d="M25 90 C 70 76, 115 106, 165 90 C 190 82, 210 86, 220 92"
									stroke="#71787A"
									strokeWidth="0.75"
								/>
								<path
									d="M40 102 C 85 90, 130 118, 180 102 C 200 96, 215 98, 220 104"
									stroke="#71787A"
									strokeDasharray="4 2"
									strokeWidth="0.75"
								/>
							</svg>
						)}
						<h2 id={`home-${id}`}>{t(title)}</h2>
						{introduction && (
							<p className="triplink-home-section__statement">
								{id === 'rated' ? (
									<>
										{t('Let traveler reviews')}{' '}
										<span className="triplink-home-section__accent">{t('guide your next trip.')}</span>
									</>
								) : (
									t(introduction.text)
								)}
							</p>
						)}
						<p className="triplink-home-section__description">
							{introduction?.detail && <>{t(introduction.detail)} </>}
							{t(description)}
						</p>
						{href && linkText && (
							<Link className="triplink-home-section__link" href={href}>
								{t(linkText)}
							</Link>
						)}
					</div>
					{id === 'featured' ? (
						<IntroGallery title={title} />
					) : id === 'rated' ? (
						<IntroCircularCarousel title={title} />
					) : id === 'top' ? (
						<IntroVideo />
					) : id === 'agents' ? (
						<AgentsAtlas />
					) : (
						introduction?.photo && (
							<div className="triplink-home-section__image" aria-hidden="true">
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img src={introduction.photo} alt="" width={800} height={500} loading="lazy" decoding="async" />
							</div>
						)
					)}
				</div>
				{children}
			</div>
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
				onClick={() => (favorites.error ? favorites.retry() : void favorites.toggle(tour._id, tour.tourFavoriteCount))}
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

function RatedTourCard({ tour }: { tour: Tour }) {
	const { t } = useTranslation('common');
	const { locale } = useRouter();
	const [failedImage, setFailedImage] = useState(false);
	const language = locale === 'kr' ? 'ko-KR' : locale === 'ru' ? 'ru-RU' : 'en-US';
	const number = new Intl.NumberFormat(language, { maximumFractionDigits: 1 });
	const compact = new Intl.NumberFormat(language, { notation: 'compact', maximumFractionDigits: 1 });
	const exact = new Intl.NumberFormat(language);
	const agentName = tour.agentData?.memberFullname || tour.agentData?.memberNick;
	const placeholder = '/img/tour-placeholder.svg';
	let photo = placeholder;
	if (!failedImage && tour.tourImages[0]) {
		const source = imageUrl(tour.tourImages[0]);
		if (source.startsWith('/') && !source.startsWith('//')) photo = source;
		else {
			try {
				const url = new URL(source);
				const origin = new URL(process.env.REACT_APP_API_URL || 'http://localhost:3007');
				if (url.origin === origin.origin && url.pathname.startsWith('/uploads/tour/')) photo = source;
			} catch {
				// Unsupported image paths use the same safe fallback as failed uploads.
			}
		}
	}
	return (
		<article data-browse-item={`rated:tour:${tour._id}`} className="triplink-home-tour triplink-home-tour--rated">
			<div className="triplink-home-tour__visual">
				<div className="triplink-home-tour__photo">
					<Image
						src={photo}
						alt={
							photo === placeholder
								? ''
								: t('Tour photo: {{title}} in {{destination}}', {
										title: tour.tourTitle,
										destination: tour.tourDestination,
								  })
						}
						fill
						sizes="(max-width: 599px) calc(100vw - 40px), (max-width: 1023px) 35vw, (max-width: 1199px) 17vw, 195px"
						loading="lazy"
						onError={() => setFailedImage(true)}
					/>
				</div>
				{tour.tourFeatured === true && (
					<span className="triplink-home-tour__featured-badge">
						<StarRoundedIcon aria-hidden="true" />
						{t('Featured')}
					</span>
				)}
				{tour.tourReviewCount > 0 && tour.tourAverageRating >= 4.5 && (
					<span className="triplink-home-tour__rated-badge">
						<StarRoundedIcon aria-hidden="true" />
						{t('Top rated')}
					</span>
				)}
				<SaveTour tour={tour} />
			</div>
			<div className="triplink-home-tour__body">
				<h3>
					<Link href={`/tour/detail?id=${tour._id}`}>{tour.tourTitle}</Link>
				</h3>
				<p className="triplink-home-tour__destination">
					<LocationOnOutlinedIcon aria-hidden="true" />
					{tour.tourDestination}
				</p>
				<div className="triplink-home-tour__rating">
					{tour.tourReviewCount > 0 ? (
						<>
							<StarRoundedIcon aria-hidden="true" />
							<strong aria-label={t('{{rating}} out of 5', { rating: number.format(tour.tourAverageRating) })}>
								{number.format(tour.tourAverageRating)}
							</strong>
							<span>({t('{{count}} reviews', { count: tour.tourReviewCount })})</span>
						</>
					) : (
						<span>{t('No reviews yet')}</span>
					)}
				</div>
				<div className="triplink-home-tour__metadata">
					<span>
						<ScheduleRoundedIcon aria-hidden="true" />
						{t('{{count}} days', { count: tour.tourDurationDays })}
					</span>
					<span className="triplink-home-tour__category">{t(tour.tourCategory)}</span>
					<span
						role="img"
						aria-label={t('{{count}} views', {
							count: tour.tourViewCount,
							displayCount: exact.format(tour.tourViewCount),
						})}
					>
						<VisibilityOutlinedIcon aria-hidden="true" />
						<span aria-hidden="true">
							{t('{{count}} views', { count: tour.tourViewCount, displayCount: compact.format(tour.tourViewCount) })}
						</span>
					</span>
				</div>
				{tour.tourDescription && <p className="triplink-home-tour__description">{tour.tourDescription}</p>}
				{agentName && <p className="triplink-home-tour__agent">{t('By {{name}}', { name: agentName })}</p>}
				{tour.tourStatus === 'SOLD_OUT' && <span className="triplink-home-tour__sold-out">{t('Sold out')}</span>}
				<div className="triplink-home-tour__bottom">
					<Price tour={tour} />
					<span className="triplink-home-tour__details" aria-hidden="true">
						{t('View tour')}
					</span>
				</div>
			</div>
		</article>
	);
}

function HomeTourCard({ tour, variant, rank }: { tour: Tour; variant: Exclude<TourVariant, 'rated'>; rank: number }) {
	const { t } = useTranslation('common');
	const { locale } = useRouter();
	const number = new Intl.NumberFormat(locale === 'kr' ? 'ko-KR' : locale === 'ru' ? 'ru-RU' : 'en-US', {
		maximumFractionDigits: 1,
	});
	const href = `/tour/detail?id=${tour._id}`;
	const language = locale === 'kr' ? 'ko-KR' : locale === 'ru' ? 'ru-RU' : 'en-US';
	const exact = new Intl.NumberFormat(language);
	const compact = new Intl.NumberFormat(language, { notation: 'compact', maximumFractionDigits: 1 });
	const agentName = tour.agentData?.memberFullname || tour.agentData?.memberNick;
	return (
		<article
			data-browse-item={`${variant}:tour:${tour._id}`}
			className={`triplink-home-tour triplink-home-tour--${variant}`}
		>
			{variant === 'top' && (
				<span className="triplink-home-tour__rank" aria-label={t('Rank {{rank}}', { rank })}>
					{String(rank).padStart(2, '0')}
				</span>
			)}
			<div className="triplink-home-tour__visual">
				<TourImage key={JSON.stringify([tour._id, tour.tourImages])} tour={tour} />
				{tour.tourFeatured === true && (
					<span className="triplink-home-tour__featured-badge">
						<StarRoundedIcon aria-hidden="true" />
						{t('Featured')}
					</span>
				)}
				{variant === 'featured' && <SaveTour tour={tour} />}
			</div>
			<div className="triplink-home-tour__body">
				<h3>
					<Link href={href}>{tour.tourTitle}</Link>
				</h3>
				<p className="triplink-home-tour__destination">
					<LocationOnOutlinedIcon aria-hidden="true" />
					{tour.tourDestination}
				</p>
				<div className="triplink-home-tour__rating">
					{tour.tourReviewCount > 0 ? (
						<>
							<StarRoundedIcon aria-hidden="true" />
							<strong aria-label={t('{{rating}} out of 5', { rating: number.format(tour.tourAverageRating) })}>
								{number.format(tour.tourAverageRating)}
							</strong>
							<span>({t('{{count}} reviews', { count: tour.tourReviewCount })})</span>
						</>
					) : (
						<span>{t('No reviews yet')}</span>
					)}
				</div>
				<div className="triplink-home-tour__metadata">
					<span>
						<ScheduleRoundedIcon aria-hidden="true" />
						{t('{{count}} days', { count: tour.tourDurationDays })}
					</span>
					<span className="triplink-home-tour__category">{t(tour.tourCategory)}</span>
					{Number.isFinite(tour.tourViewCount) && (
						<span
							role="img"
							aria-label={t('{{count}} views', {
								count: tour.tourViewCount,
								displayCount: exact.format(tour.tourViewCount),
							})}
						>
							<VisibilityOutlinedIcon aria-hidden="true" />
							<span aria-hidden="true">
								{t('{{count}} views', { count: tour.tourViewCount, displayCount: compact.format(tour.tourViewCount) })}
							</span>
						</span>
					)}
				</div>
				{tour.tourDescription && <p className="triplink-home-tour__description">{tour.tourDescription}</p>}
				{agentName && <p className="triplink-home-tour__agent">{t('By {{name}}', { name: agentName })}</p>}
				{tour.tourStatus === 'SOLD_OUT' && <span className="triplink-home-tour__sold-out">{t('Sold out')}</span>}
				<div className="triplink-home-tour__bottom">
					<Price tour={tour} />
					<Link
						href={href}
						className="triplink-home-tour__cta"
						aria-label={t('View tour: {{title}}', { title: tour.tourTitle })}
					>
						{t('View tour')}
					</Link>
				</div>
			</div>
		</article>
	);
}

export function TourSection({ variant }: { variant: TourVariant }) {
	const { t } = useTranslation('common');
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
			{variant === 'top' && (
				<div className="triplink-home-list-heading">
					<h3>{t('Most viewed tours')}</h3>
					<p>{t('Explore the tours attracting traveler interest.')}</p>
				</div>
			)}
			<QueryState
				loading={!ready || query.loading}
				error={query.error}
				empty={!query.data?.result.list.length}
				retry={() => query.refetch()}
			>
				<div
					className={`triplink-home-grid triplink-home-grid--${variant}`}
					data-count={query.data?.result.list.length}
				>
					{query.data?.result.list.map((tour, index) =>
						variant === 'rated' ? (
							<RatedTourCard key={JSON.stringify([tour._id, tour.tourImages])} tour={tour} />
						) : (
							<HomeTourCard key={tour._id} tour={tour} variant={variant} rank={index + 1} />
						),
					)}
				</div>
			</QueryState>
		</Section>
	);
}

export function TopAgents() {
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
						<article data-browse-item={`home:agent:${agent._id}`} key={agent._id} className="triplink-home-agent">
							<Avatar src={imageUrl(agent.memberImage)} alt="" className="triplink-home-agent__portrait">
								{(agent.memberFullname || agent.memberNick).slice(0, 1)}
							</Avatar>
							<div className="triplink-home-agent__body">
								<h3>
									<Link href={`/agent/detail?agentId=${agent._id}`}>{agent.memberFullname || agent.memberNick}</Link>
								</h3>
								{agent.memberCountry && <p className="triplink-home-agent__country">{agent.memberCountry}</p>}
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
		image: '/img/events/venice-carnival.jpg',
		href: 'https://carnevale.venezia.it/en/the-venice-carnival/',
	},
	{
		name: 'Hirosaki Cherry Blossom Festival',
		location: 'Hirosaki, Japan',
		description: 'Cherry blossoms frame the castle grounds of Hirosaki Park.',
		season: 'Spring',
		image: '/img/events/hirosaki-blossoms.jpg',
		href: 'https://sakura.hirosakipark.jp/en',
	},
	{
		name: 'Oktoberfest',
		location: 'Munich, Germany',
		description: 'Explore Munich’s traditional folk festival.',
		season: 'Autumn',
		image: '/img/events/oktoberfest.jpg',
		href: 'https://www.oktoberfest.de/en',
	},
	{
		name: 'Taiwan Lantern Festival',
		location: 'Taiwan',
		description: 'Discover illuminated lantern art and cultural performances.',
		season: 'Winter',
		image: '/img/events/taiwan-lanterns.jpg',
		href: 'https://www.taiwan.net.tw/m1.aspx?sno=0027328',
	},
];
function Events() {
	const { t } = useTranslation('common');
	const [season, setSeason] = useRememberedState('home:season', 'All seasons');
	const visibleEvents = season === 'All seasons' ? events : events.filter((event) => event.season === season);
	return (
		<Section id="events" title="Events" description="Seasonal inspiration around the world">
			<div className="triplink-home-filters" role="group" aria-label={t('Filter seasonal guides')}>
				{['All seasons', 'Winter', 'Spring', 'Summer', 'Autumn'].map((value) => (
					<button type="button" key={value} aria-pressed={season === value} onClick={() => setSeason(value)}>
						{t(value)}
					</button>
				))}
			</div>
			<div className="triplink-home-grid triplink-home-grid--events">
				{visibleEvents.map((event) => (
					<article className="triplink-home-event" key={event.name}>
						<div className="triplink-home-event__photo">
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img src={event.image} alt={t(event.name)} width={1000} height={625} loading="lazy" decoding="async" />
							<span className="triplink-home-event__season">{t(event.season)}</span>
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
			{visibleEvents.length === 0 && (
				<p className="triplink-home-editorial-note" role="status">
					{t('No seasonal guides for this season yet. Explore another season.')}
				</p>
			)}
			<p className="triplink-home-editorial-note">
				{t(
					'Seasonal editorial guides. Check each official website for current dates, tickets and visitor information.',
				)}
			</p>
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
			<Section
				id="articles"
				title="Articles"
				description="Travel stories from our community"
				href="/community"
				linkText="All articles"
			>
				<HomeArticles />
			</Section>
			<Events />
		</div>
	);
}
