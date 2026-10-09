import React from 'react';
import Link from 'next/link';
import { Alert, Box, Button, Card, CardContent, CardMedia, Chip, Stack, Typography } from '@mui/material';
import { useQuery } from '@apollo/client';
import { TOURS, TOUR_REVIEWS, PUBLIC_AGENT_REVIEWS } from '../../../apollo/user/triplink';
import { Inquiry, TourSearch, Tour, totalOf } from '../../types/triplink';
import { imageUrl, Pager, QueryState, usePublicReady } from './Common';
import { useTranslation } from 'next-i18next';
export function TourCard({ tour }: { tour: Tour }) {
	const { t } = useTranslation('common');
	return (
		<Card variant="outlined" sx={{ height: '100%' }}>
			<CardMedia
				component="img"
				onError={(event: React.SyntheticEvent<HTMLImageElement>) => {
					const target = event.currentTarget;
					target.onerror = null;
					if (!target.src.endsWith('/img/tour-placeholder.svg')) target.src = '/img/tour-placeholder.svg';
				}}
				height="190"
				image={tour.tourImages[0] ? imageUrl(tour.tourImages[0]) : '/img/tour-placeholder.svg'}
				alt={tour.tourTitle}
			/>
			<CardContent>
				<Stack spacing={1}>
					<Link href={`/tour/detail?id=${tour._id}`} passHref>
						<Typography variant="h6" component="h2">
							{tour.tourTitle}
						</Typography>
					</Link>
					<Typography>
						{tour.tourDestination} · {tour.tourDurationDays} {t('Days')}
					</Typography>
					<Typography>
						{tour.tourDiscountPrice ?? tour.tourPrice} · ★ {tour.tourAverageRating.toFixed(1)} ({tour.tourReviewCount})
					</Typography>
					<Stack direction="row" spacing={1}>
						<Chip label={t(tour.tourCategory)} size="small" />
						<Chip label={t(tour.tourStatus)} size="small" />
					</Stack>
				</Stack>
			</CardContent>
		</Card>
	);
}
export function TourGrid({ tours }: { tours: Tour[] }) {
	const { t } = useTranslation('common');
	return (
		<Box
			component="div"
			sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 3 }}
		>
			{tours.map((tour) => (
				<TourCard key={tour._id} tour={tour} />
			))}
		</Box>
	);
}
export function TourList({ input, onPage }: { input: Inquiry<TourSearch>; onPage?: (page: number) => void }) {
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
				<TourGrid tours={query.data?.result.list ?? []} />
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
			<Typography variant="h5">{t('Reviews')}</Typography>
			<QueryState
				loading={!ready || query.loading}
				error={query.error}
				empty={!query.data?.result.list.length}
				retry={() => query.refetch()}
			>
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
