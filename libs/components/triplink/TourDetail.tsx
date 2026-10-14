import { useTranslation } from 'next-i18next';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useQuery } from '@apollo/client';
import { Alert, Avatar, Container } from '@mui/material';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import { TOUR } from '../../../apollo/user/triplink';
import { Tour } from '../../types/triplink';
import { Frame, imageUrl, QueryState, usePublicReady, validId } from './Common';
import { BookingForm } from './Bookings';
import { FavoriteButton } from './Members';
import { PublicReviews } from './Tours';
import { BrowsingBackLink } from '../../triplink/BrowsingMemoryProvider';

function DetailPhoto({ path, title, eager = false }: { path?: string; title: string; eager?: boolean }) {
	const [failed, setFailed] = useState(false);
	return (
		// Backend upload paths need the existing direct-image fallback behavior.
		// eslint-disable-next-line @next/next/no-img-element
		<img
			src={path && !failed ? imageUrl(path) : '/img/tour-placeholder.svg'}
			alt={title}
			width={1200}
			height={750}
			loading={eager ? 'eager' : 'lazy'}
			decoding="async"
			onError={() => setFailed(true)}
		/>
	);
}

function DetailGallery({ tour }: { tour: Tour }) {
	const { t } = useTranslation('common');
	const [selected, setSelected] = useState(0);
	return (
		<div className="triplink-detail-gallery">
			<div className="triplink-detail-gallery__main">
				<DetailPhoto key={tour.tourImages[selected]} path={tour.tourImages[selected]} title={tour.tourTitle} eager />
				{tour.tourImages.length > 1 && (
					<div className="triplink-detail-gallery__controls">
						<button
							type="button"
							aria-label={t('Previous photo of {{title}}', { title: tour.tourTitle })}
							onClick={() => setSelected((selected - 1 + tour.tourImages.length) % tour.tourImages.length)}
						>
							‹
						</button>
						<span role="status" aria-live="polite">
							{t('Photo {{current}} of {{total}}', { current: selected + 1, total: tour.tourImages.length })}
						</span>
						<button
							type="button"
							aria-label={t('Next photo of {{title}}', { title: tour.tourTitle })}
							onClick={() => setSelected((selected + 1) % tour.tourImages.length)}
						>
							›
						</button>
					</div>
				)}
			</div>
			{tour.tourImages.length > 1 && (
				<div className="triplink-detail-gallery__thumbnails">
					{tour.tourImages.map((path, index) => (
						<button
							key={`${path}-${index}`}
							type="button"
							aria-pressed={selected === index}
							aria-label={t('Show tour photo {{number}}', { number: index + 1 })}
							onClick={() => setSelected(index)}
						>
							<DetailPhoto path={path} title="" />
						</button>
					))}
				</div>
			)}
		</div>
	);
}

export default function TourDetail() {
	const { t } = useTranslation('common');
	const router = useRouter();
	const id = router.query.id;
	const ready = usePublicReady();
	const query = useQuery(TOUR, {
		variables: { tourId: typeof id === 'string' ? id : '' },
		skip: !ready || !validId(id),
		fetchPolicy: 'network-only',
	});
	if (router.isReady && !validId(id))
		return (
			<Frame title={t('Tour')}>
				<Alert severity="error">{t('Invalid tour ID.')}</Alert>
			</Frame>
		);
	const tour = query.data?.result;
	const locale = (router.locale === 'kr' ? 'ko-KR' : router.locale === 'ru' ? 'ru-RU' : router.locale === 'uz' ? 'uz-UZ' : 'en-US');
	const price = new Intl.NumberFormat(locale, {
		style: 'currency',
		currency: 'USD',
		maximumFractionDigits: 2,
		minimumFractionDigits: 0,
	});
	const dateFormat = new Intl.DateTimeFormat(locale, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	});
	const dateText = (date: string) => (Number.isNaN(Date.parse(date)) ? '—' : dateFormat.format(new Date(date)));
	const discounted = tour && tour.tourDiscountPrice !== null && tour.tourDiscountPrice < tour.tourPrice;
	return (
		<Container maxWidth="lg" className="triplink-tour-detail">
			<BrowsingBackLink fallback="/tour" className="triplink-detail-back">
				{t('Back to tours')}
			</BrowsingBackLink>
			<QueryState
				loading={!ready || !router.isReady || query.loading}
				error={query.error}
				empty={!tour}
				retry={() => query.refetch()}
			>
				{tour && (
					<>
						<header className="triplink-detail-heading">
							<div className="triplink-detail-tags">
								<span>{t(tour.tourCategory)}</span>
								<span>{t(tour.tourDifficulty)}</span>
								{tour.tourFeatured && <span className="triplink-detail-tag--top">{t('Top tour')}</span>}
								{tour.tourStatus === 'SOLD_OUT' && <span>{t('Sold out')}</span>}
							</div>
							<h1>{tour.tourTitle}</h1>
							<p>
								{[tour.tourDestination, tour.tourCity, tour.tourCountry]
									.filter((value, index, list) => value && list.indexOf(value) === index)
									.join(', ')}
							</p>
							<div className="triplink-detail-heading__meta">
								<span>{t('{{count}} days', { count: tour.tourDurationDays })}</span>
								<span>
									{tour.tourReviewCount > 0
										? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
												tour.tourAverageRating,
										  )} / 5 · ${t('{{count}} reviews', { count: tour.tourReviewCount })}`
										: t('No reviews yet')}
								</span>
								<span>
									<FavoriteBorderRoundedIcon aria-hidden="true" />
									{t('Tour likes', {
										count: tour.tourFavoriteCount,
										displayCount: new Intl.NumberFormat(locale).format(tour.tourFavoriteCount),
									})}
								</span>
							</div>
						</header>
						<DetailGallery key={JSON.stringify([tour._id, tour.tourImages])} tour={tour} />
						<div className="triplink-detail-layout">
							<div className="triplink-detail-content">
								<nav className="triplink-detail-nav" aria-label={t('Tour sections')}>
									{[
										['overview', 'Overview'],
										['departures', 'Departures'],
										['itinerary', 'Itinerary'],
										['reviews', 'Reviews'],
									].map(([id, label]) => (
										<a key={id} href={`#tour-${id}`}>
											{t(label)}
										</a>
									))}
								</nav>
								<section id="tour-overview" className="triplink-detail-section">
									<h2>{t('Overview')}</h2>
									<p className="triplink-detail-description">{tour.tourDescription}</p>
									<dl className="triplink-detail-facts">
										<div>
											<dt>{t('Duration')}</dt>
											<dd>{t('{{count}} days', { count: tour.tourDurationDays })}</dd>
										</div>
										<div>
											<dt>{t('Maximum group size')}</dt>
											<dd>{tour.tourMaxGroupSize}</dd>
										</div>
										<div>
											<dt>{t('Languages')}</dt>
											<dd>{tour.tourLanguages.join(', ') || '—'}</dd>
										</div>
										<div>
											<dt>{t('Activity level')}</dt>
											<dd>{t(tour.tourDifficulty)}</dd>
										</div>
									</dl>
									<div className="triplink-detail-host">
										{tour.agentData ? (
											<>
												<Avatar
													src={tour.agentData.memberImage ? imageUrl(tour.agentData.memberImage) : undefined}
													alt=""
												>
													{(tour.agentData.memberFullname || tour.agentData.memberNick).slice(0, 1)}
												</Avatar>
												<div>
													<p>{t('Your travel agent')}</p>
													<Link href={`/agent/detail?agentId=${tour.agentId}`}>
														{tour.agentData.memberFullname || tour.agentData.memberNick}
													</Link>
												</div>
											</>
										) : (
											<p>{t('Agent unavailable')}</p>
										)}
									</div>
								</section>
								<section id="tour-departures" className="triplink-detail-section">
									<h2>{t('Departures')}</h2>
									<div className="triplink-detail-departures">
										{tour.tourAvailableDates.length ? (
											tour.tourAvailableDates.map((date) => (
												<div key={date._id}>
													<div>
														<time dateTime={date.startDate}>{dateText(date.startDate)}</time>
														<span aria-hidden="true"> → </span>
														<time dateTime={date.endDate}>{dateText(date.endDate)}</time>
													</div>
													<span className="triplink-detail-seats">
														{date.availableSeats} {t('seats')}
													</span>
												</div>
											))
										) : (
											<p>{t('No departures available')}</p>
										)}
									</div>
								</section>
								<section id="tour-itinerary" className="triplink-detail-section">
									<h2>{t('Itinerary')}</h2>
									<ol className="triplink-detail-itinerary">
										{tour.tourItinerary.map((item) => (
											<li key={item.day}>
												<span>
													{t('Day')} {item.day}
												</span>
												<div>
													<h3>{item.title}</h3>
													<p>{item.description}</p>
												</div>
											</li>
										))}
									</ol>
									{!tour.tourItinerary.length && <p>{t('Itinerary not provided')}</p>}
								</section>
								<section className="triplink-detail-section">
									<h2>{t('What to expect')}</h2>
									<div className="triplink-detail-inclusions">
										{(['tourIncludedServices', 'tourExcludedServices', 'tourTransportation', 'tourMeals'] as const).map(
											(key) => (
												<div key={key}>
													<h3>
														{t(
															{
																tourIncludedServices: 'Included',
																tourExcludedServices: 'Excluded',
																tourTransportation: 'Transportation',
																tourMeals: 'Meals',
															}[key],
														)}
													</h3>
													{tour[key].length ? (
														<ul>
															{tour[key].map((value, index) => (
																<li key={index}>{value}</li>
															))}
														</ul>
													) : (
														<p>{t('Not specified')}</p>
													)}
												</div>
											),
										)}
									</div>
									<div className="triplink-detail-accommodation">
										<h3>{t('Accommodation')}</h3>
										<p>{tour.tourAccommodation || t('Not specified')}</p>
									</div>
								</section>
								<section id="tour-reviews" className="triplink-detail-section">
									<PublicReviews tourId={tour._id} />
								</section>
							</div>
							<aside className="triplink-detail-booking" aria-label={t('Tour booking')}>
								<p className="triplink-detail-booking__caption">{t('Per person')}</p>
								<div className="triplink-detail-booking__price">
									{discounted && <s>{price.format(tour.tourPrice)}</s>}
									<strong>{price.format(discounted ? tour.tourDiscountPrice! : tour.tourPrice)}</strong>
								</div>
								<p className="triplink-detail-booking__duration">
									{t('{{count}} days', { count: tour.tourDurationDays })} · {t(tour.tourStatus)}
								</p>
								<div className="triplink-detail-booking__save">
									<FavoriteButton tourId={tour._id} onChanged={() => query.refetch()} />
								</div>
								<BookingForm tour={tour} onChanged={() => query.refetch()} />
							</aside>
						</div>
					</>
				)}
			</QueryState>
		</Container>
	);
}
