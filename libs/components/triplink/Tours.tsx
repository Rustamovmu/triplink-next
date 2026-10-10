import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, Rating, Stack, Typography } from '@mui/material';
import { useQuery } from '@apollo/client';
import { TOURS, TOUR_REVIEWS, PUBLIC_AGENT_REVIEWS } from '../../../apollo/user/triplink';
import { Inquiry, TourSearch, Tour, totalOf } from '../../types/triplink';
import { imageUrl, Pager, QueryState, usePublicReady } from './Common';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { useTourFavorites } from './TourFavorites';
const tourPlaceholder = '/img/tour-placeholder.svg';

function TourPhotos({ images, href, title }: { images: string[]; href: string; title: string }) {
	const { t } = useTranslation('common');
	const [index, setIndex] = useState(0);
	const [failed, setFailed] = useState<string[]>([]);
	const track = useRef<HTMLDivElement>(null);
	const slides = images.length ? images : [''];
	const goTo = (next: number) => {
		const target = (next + slides.length) % slides.length;
		track.current?.scrollTo({
			left: target * track.current.clientWidth,
			behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
		});
	};
	return (
		<div className="triplink-tour-card__media">
			<div
				ref={track}
				className="triplink-tour-card__slides"
				onScroll={(event) => {
					const { scrollLeft, clientWidth } = event.currentTarget;
					if (clientWidth) setIndex(Math.max(0, Math.min(slides.length - 1, Math.round(scrollLeft / clientWidth))));
				}}
			>
				{slides.map((path, photoIndex) => {
					const src = path && !failed.includes(path) ? imageUrl(path) : tourPlaceholder;
					return (
						<Link
							key={`${path}-${photoIndex}`}
							href={href}
							passHref
							className="triplink-tour-card__photo-link"
							aria-label={t('View tour: {{title}}', { title })}
							tabIndex={photoIndex === index ? 0 : -1}
							aria-hidden={photoIndex !== index}
						>
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img
								src={src}
								alt={
									t('Photo {{current}} of {{total}}', { current: photoIndex + 1, total: slides.length }) + ': ' + title
								}
								width={600}
								height={400}
								loading="lazy"
								decoding="async"
								draggable={false}
								onError={() => {
									if (path && src !== tourPlaceholder)
										setFailed((previous) => (previous.includes(path) ? previous : [...previous, path]));
								}}
							/>
						</Link>
					);
				})}
			</div>
			{images.length > 1 && (
				<div className="triplink-tour-card__gallery">
					<button
						type="button"
						aria-label={t('Previous photo of {{title}}', { title })}
						onClick={() => goTo(index - 1)}
					>
						<ChevronLeftRoundedIcon aria-hidden="true" />
					</button>
					<span role="status" aria-live="polite" aria-atomic="true">
						<span aria-hidden="true">
							{index + 1}/{images.length}
						</span>
						<span className="triplink-visually-hidden">
							{t('Photo {{current}} of {{total}}', { current: index + 1, total: images.length })}
						</span>
					</span>
					<button type="button" aria-label={t('Next photo of {{title}}', { title })} onClick={() => goTo(index + 1)}>
						<ChevronRightRoundedIcon aria-hidden="true" />
					</button>
				</div>
			)}
		</div>
	);
}

export function TourCard({ tour, catalog = false }: { tour: Tour; catalog?: boolean }) {
	const { t } = useTranslation('common');
	const favorites = useTourFavorites();
	const saved = favorites.saved.has(tour._id);
	const favoriteCount = favorites.counts[tour._id] ?? tour.tourFavoriteCount;
	const { locale = 'en' } = useRouter();
	const displayLocale = locale === 'kr' ? 'ko-KR' : locale === 'ru' ? 'ru-RU' : 'en-US';
	const price = new Intl.NumberFormat(displayLocale, {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	});
	const number = new Intl.NumberFormat(displayLocale, { maximumFractionDigits: 1 });
	const href = `/tour/detail?id=${tour._id}`;
	const discounted = tour.tourDiscountPrice !== null && tour.tourDiscountPrice < tour.tourPrice;
	return (
		<Card component="article" className="triplink-tour-card" elevation={0}>
			<div className="triplink-tour-card__visual">
				<TourPhotos
					key={JSON.stringify([tour._id, tour.tourImages])}
					images={tour.tourImages}
					href={href}
					title={tour.tourTitle}
				/>
				{(tour.tourFeatured || tour.tourStatus === 'SOLD_OUT') && (
					<div className="triplink-tour-card__badges">
						{tour.tourFeatured && <span>{t(catalog ? 'Top tour' : 'Featured')}</span>}
						{tour.tourStatus === 'SOLD_OUT' && <span className="triplink-tour-card__sold-out">{t('Sold out')}</span>}
					</div>
				)}
				{favorites.anonymous ? (
					<Link
						href="/account/join"
						passHref
						className="triplink-tour-card__favorite"
						aria-label={t('Login to like {{title}}', { title: tour.tourTitle })}
					>
						<FavoriteBorderRoundedIcon aria-hidden="true" />
					</Link>
				) : (
					(favorites.eligible || catalog) && (
						<button
							type="button"
							className="triplink-tour-card__favorite"
							aria-label={
								favorites.error
									? t('Retry saved tours')
									: t(saved ? 'Unlike {{title}}' : 'Like {{title}}', { title: tour.tourTitle })
							}
							aria-pressed={favorites.eligible && favorites.ready ? saved : undefined}
							aria-busy={
								favorites.eligible && ((!favorites.ready && !favorites.error) || favorites.pending.has(tour._id))
							}
							title={!favorites.eligible ? t('Only travelers and agents can like tours.') : undefined}
							disabled={
								!favorites.eligible || (!favorites.ready && !favorites.error) || favorites.pending.has(tour._id)
							}
							onClick={() => (favorites.error ? favorites.retry() : void favorites.toggle(tour._id, favoriteCount))}
						>
							{saved ? <FavoriteRoundedIcon aria-hidden="true" /> : <FavoriteBorderRoundedIcon aria-hidden="true" />}
						</button>
					)
				)}
			</div>
			<div className="triplink-tour-card__content">
				<span className="triplink-tour-card__category">{t(tour.tourCategory)}</span>
				<h2 className="triplink-tour-card__title">
					<Link href={href}>{tour.tourTitle}</Link>
				</h2>
				<p className="triplink-tour-card__details">
					<PlaceOutlinedIcon aria-hidden="true" />
					<span>{tour.tourDestination}</span>
					<span aria-hidden="true">·</span>
					<span>{t('{{count}} days', { count: tour.tourDurationDays })}</span>
				</p>
				<div className="triplink-tour-card__rating">
					{tour.tourReviewCount > 0 ? (
						<>
							<Rating value={tour.tourAverageRating} precision={0.1} readOnly size="small" aria-hidden="true" />
							<span>{t('{{rating}} out of 5', { rating: number.format(tour.tourAverageRating) })}</span>
							<span className="triplink-tour-card__review-count">
								({t('{{count}} reviews', { count: tour.tourReviewCount })})
							</span>
						</>
					) : (
						<span className="triplink-tour-card__review-count">{t('No reviews yet')}</span>
					)}
				</div>

				{catalog && (
					<p className="triplink-tour-card__likes">
						<FavoriteBorderRoundedIcon aria-hidden="true" />
						{t('Tour likes', { count: favoriteCount, displayCount: number.format(favoriteCount) })}
					</p>
				)}
				<div className="triplink-tour-card__stats">
					<span>
						<VisibilityOutlinedIcon aria-hidden="true" />
						{t('{{count}} views', { count: tour.tourViewCount, displayCount: number.format(tour.tourViewCount) })}
					</span>
					<span>
						<FavoriteBorderRoundedIcon aria-hidden="true" />
						{t('Tour likes', { count: favoriteCount, displayCount: number.format(favoriteCount) })}
					</span>
				</div>
				{(favorites.error || favorites.errors[tour._id]) && (
					<p role="alert" className="triplink-tour-card__error">
						{t(favorites.error || favorites.errors[tour._id])}
					</p>
				)}
				<div className="triplink-tour-card__bottom">
					<div className="triplink-tour-card__pricing">
						<span className="triplink-tour-card__price-caption">{t('Per person')}</span>
						{discounted && <s className="triplink-tour-card__original-price">{price.format(tour.tourPrice)}</s>}
						<strong
							className={
								discounted
									? 'triplink-tour-card__price triplink-tour-card__price--discount'
									: 'triplink-tour-card__price'
							}
						>
							{price.format(discounted ? tour.tourDiscountPrice! : tour.tourPrice)}
						</strong>
					</div>
					<Link
						href={href}
						className="triplink-tour-card__view"
						aria-label={t('View tour: {{title}}', { title: tour.tourTitle })}
					>
						{t('View tour')}
					</Link>
				</div>
			</div>
		</Card>
	);
}

export function TourGrid({ tours, catalog = false }: { tours: Tour[]; catalog?: boolean }) {
	return (
		<div className="triplink-tour-grid">
			{tours.map((tour) => (
				<TourCard key={tour._id} tour={tour} catalog={catalog} />
			))}
		</div>
	);
}
export function TourList({
	input,
	onPage,
	catalog = false,
}: {
	input: Inquiry<TourSearch>;
	onPage?: (page: number) => void;
	catalog?: boolean;
}) {
	const { t } = useTranslation('common');

	const ready = usePublicReady();
	const query = useQuery(TOURS, { variables: { input }, skip: !ready, notifyOnNetworkStatusChange: true });
	return (
		<Stack spacing={3}>
			<QueryState
				loading={!ready || query.loading}
				error={query.error}
				empty={!query.data?.result.list.length}
				retry={() => query.refetch()}
			>
				<TourGrid tours={query.data?.result.list ?? []} catalog={catalog} />
			</QueryState>
			{onPage && <Pager total={totalOf(query.data?.result)} page={input.page} limit={input.limit} onChange={onPage} />}
		</Stack>
	);
}
export function PublicReviews({ tourId, agentId }: { tourId?: string; agentId?: string }) {
	const { t } = useTranslation('common');

	const [page, setPage] = React.useState(1);
	const ready = usePublicReady();
	const tour = useQuery(TOUR_REVIEWS, {
		variables: { input: { page, limit: 10, search: { tourId: tourId ?? '' } } },
		skip: !ready || !tourId,
	});
	const agent = useQuery(PUBLIC_AGENT_REVIEWS, {
		variables: { agentId: agentId ?? '', input: { page, limit: 10, search: {} } },
		skip: !ready || !agentId,
	});
	const query = agentId ? agent : tour;
	return (
		<Stack spacing={2}>
			<Typography variant="h5" component="h2">{t('Reviews')}</Typography>
			<QueryState
				loading={!ready || query.loading}
				error={query.error}
				retry={() => query.refetch()}
			>
				{!query.data?.result.list.length && <Typography color="text.secondary">{t('No reviews yet')}</Typography>}
				{query.data?.result.list.map((review) => (
					<Card variant="outlined" key={review._id}>
						<CardContent>
							<Typography>
								★ {review.reviewRating} · {review.userData?.memberNick ?? 'Unavailable member'}
							</Typography>
							<Typography sx={{ whiteSpace: 'pre-wrap' }}>{review.reviewComment}</Typography>
						</CardContent>
					</Card>
				))}
			</QueryState>
			<Pager total={totalOf(query.data?.result)} page={page} limit={10} onChange={setPage} />
		</Stack>
	);
}
