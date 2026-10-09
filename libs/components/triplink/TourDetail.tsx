import { useTranslation } from 'next-i18next';
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useQuery } from '@apollo/client';
import { Alert, Box, Chip, Stack, Typography } from '@mui/material';
import { TOUR } from '../../../apollo/user/triplink';
import { displayDate, Frame, imageUrl, QueryState, usePublicReady, validId } from './Common';
import { BookingForm } from './Bookings';
import { FavoriteButton } from './Members';
import { PublicReviews } from './Tours';
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
	return (
		<Frame title={tour?.tourTitle ?? 'Tour'}>
			<QueryState loading={!ready || query.loading} error={query.error} empty={!tour} retry={() => query.refetch()}>
				{tour && (
					<Stack spacing={3}>
						<Box
							component="div"
							sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}
						>
							{tour.tourImages.map((path) => (
								<Box
									key={path}
									component="img"
									onError={(event: React.SyntheticEvent<HTMLImageElement>) => {
										const target = event.currentTarget;
										target.onerror = null;
										if (!target.src.endsWith('/img/tour-placeholder.svg')) target.src = '/img/tour-placeholder.svg';
									}}
									src={imageUrl(path)}
									alt={tour.tourTitle}
									sx={{ width: '100%', height: 260, objectFit: 'cover', borderRadius: 2 }}
								/>
							))}
						</Box>
						<Stack direction="row" spacing={1}>
							<Chip label={t(tour.tourStatus)} />
							<Chip label={t(tour.tourCategory)} />
							<Chip label={t(tour.tourDifficulty)} />
						</Stack>
						<Typography variant="h5">
							{tour.tourDiscountPrice ?? tour.tourPrice} · {tour.tourDurationDays} {t('days · ★')}{' '}
							{tour.tourAverageRating} ({tour.tourReviewCount})
						</Typography>
						<Typography>
							{tour.tourDestination} · {tour.tourCity}, {tour.tourCountry}
						</Typography>
						<Typography sx={{ whiteSpace: 'pre-wrap' }}>{tour.tourDescription}</Typography>
						<Typography>
							{t('Maximum group:')} {tour.tourMaxGroupSize} {t('· Languages:')} {tour.tourLanguages.join(', ')}
						</Typography>
						{tour.agentData ? (
							<Link href={`/agent/detail?agentId=${tour.agentId}`}>{tour.agentData.memberNick}</Link>
						) : (
							<Typography>{t('Agent unavailable')}</Typography>
						)}
						<FavoriteButton tourId={tour._id} onChanged={() => query.refetch()} />
						<Typography variant="h5">{t('Departures')}</Typography>
						{tour.tourAvailableDates.map((date) => (
							<Typography key={date._id}>
								{displayDate(date.startDate)} → {displayDate(date.endDate)} · {date.availableSeats} {t('seats')}
							</Typography>
						))}
						<Typography variant="h5">{t('Itinerary')}</Typography>
						{tour.tourItinerary.map((item) => (
							<Box component="div" key={item.day}>
								<Typography variant="h6">
									{t('Day')} {item.day}: {item.title}
								</Typography>
								<Typography sx={{ whiteSpace: 'pre-wrap' }}>{item.description}</Typography>
							</Box>
						))}
						{(['tourIncludedServices', 'tourExcludedServices', 'tourTransportation', 'tourMeals'] as const).map(
							(key) => (
								<Box component="div" key={key}>
									<Typography variant="h6">
										{
											{
												tourIncludedServices: 'Included',
												tourExcludedServices: 'Excluded',
												tourTransportation: 'Transportation',
												tourMeals: 'Meals',
											}[key]
										}
									</Typography>
									<Typography>{tour[key].join(', ') || '—'}</Typography>
								</Box>
							),
						)}
						<Typography>
							{t('Accommodation:')} {tour.tourAccommodation ?? '—'}
						</Typography>
						<BookingForm tour={tour} onChanged={() => query.refetch()} />
						<PublicReviews tourId={tour._id} />
					</Stack>
				)}
			</QueryState>
		</Frame>
	);
}
