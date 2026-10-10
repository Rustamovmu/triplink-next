import { useTranslation } from 'next-i18next';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApolloClient, useMutation, useQuery, useReactiveVar } from '@apollo/client';
import { Alert, Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material';
import {
	CREATE_BOOKING,
	MY_BOOKINGS,
	AGENT_BOOKINGS,
	PAY_BOOKING,
	CONFIRM_BOOKING,
	CANCEL_BOOKING,
	REJECT_BOOKING,
	COMPLETE_BOOKING,
	CREATE_REVIEW,
	MY_REVIEWS,
} from '../../../apollo/user/triplink';
import { ADMIN_BOOKINGS, ADMIN_REFUND, ADMIN_EXPIRE } from '../../../apollo/admin/triplink';
import { memberVar } from '../../../apollo/store';
import { Booking, BookingStatus, PaymentStatus, Tour, totalOf } from '../../types/triplink';
import { bookingActions, bookingCapacity } from '../../triplink/rules';
import { displayDate, Pager, QueryState, useAction } from './Common';
export function BookingForm({ tour, onChanged }: { tour: Tour; onChanged: () => Promise<unknown> }) {
	const { t } = useTranslation('common');

	const member = useReactiveVar(memberVar);
	const [dateId, setDateId] = useState('');
	const [people, setPeople] = useState(1);
	const [created, setCreated] = useState<Booking | null>(null);
	const [create] = useMutation(CREATE_BOOKING);
	const action = useAction();
	const maximum = bookingCapacity(tour, dateId);
	if (!member)
		return (
			<Alert severity="info">
				<Link href={`/account/join?referrer=${encodeURIComponent('/tour/detail?id=' + tour._id)}`}>
					{t('Login to book this tour')}
				</Link>
			</Alert>
		);
	if (member.memberType !== 'USER') return null;
	if (tour.tourStatus !== 'ACTIVE')
		return <Alert severity="info">{t('This tour is not available for booking.')}</Alert>;
	return (
		<Stack
			component="form"
			spacing={2}
			onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
				e.preventDefault();
				void action.run(async () => {
					if (!Number.isInteger(people) || people < 1 || people > maximum)
						throw new Error('Choose an available departure and valid group size.');
					const response = await create({
						variables: { input: { tourId: tour._id, tourDateId: dateId, numberOfPeople: people } },
					});
					setCreated(response.data?.result ?? null);
					await onChanged();
				});
			}}
		>
			<Typography variant="h5">{t('Book this tour')}</Typography>
			{action.feedback}
			{created && (
				<Alert severity="success">
					{created.bookingCode}: {created.bookingStatus} / {created.paymentStatus}
					{t('. Seats are reserved after confirmation.')}{' '}
					<Link href="/mypage?category=myBookings">{t('My bookings')}</Link>
				</Alert>
			)}
			<TextField
				select
				required
				label={t('Departure')}
				value={dateId}
				onChange={(e) => {
					setDateId(e.target.value);
					setPeople(1);
				}}
			>
				<MenuItem value="">{t('Choose departure')}</MenuItem>
				{tour.tourAvailableDates
					.filter((date) => bookingCapacity(tour, date._id) > 0)
					.map((date) => (
						<MenuItem key={date._id} value={date._id}>
							{displayDate(date.startDate)} · {date.availableSeats} {t('seats')}
						</MenuItem>
					))}
			</TextField>
			<TextField
				label={t('People')}
				type="number"
				required
				inputProps={{ min: 1, max: maximum || 1, step: 1 }}
				value={people}
				onChange={(e) => setPeople(Number(e.target.value))}
			/>
			<Typography>
				{t('Estimated total:')} {(tour.tourDiscountPrice ?? tour.tourPrice) * people}
				{t('. The backend confirms the final price.')}
			</Typography>
			<Button type="submit" variant="contained" disabled={action.busy || !maximum}>
				{t('Request booking')}
			</Button>
		</Stack>
	);
}
function BookingRow({ booking, refetch }: { booking: Booking; refetch: () => Promise<unknown> }) {
	const { t } = useTranslation('common');

	const member = useReactiveVar(memberVar)!;
	const agentView = member.memberType === 'AGENT';
	const action = useAction();
	const client = useApolloClient();
	const [reason, setReason] = useState('');
	const [rating, setRating] = useState(5);
	const [comment, setComment] = useState('');
	const [reviewed, setReviewed] = useState<boolean | null>(null);
	const [reviewError, setReviewError] = useState<Error>();
	const [reviewAttempt, setReviewAttempt] = useState(0);
	const [pay] = useMutation(PAY_BOOKING);
	const [confirm] = useMutation(CONFIRM_BOOKING);
	const [cancel] = useMutation(CANCEL_BOOKING);
	const [reject] = useMutation(REJECT_BOOKING);
	const [complete] = useMutation(COMPLETE_BOOKING);
	const [refund] = useMutation(ADMIN_REFUND);
	const [expire] = useMutation(ADMIN_EXPIRE);
	const [createReview] = useMutation(CREATE_REVIEW);
	const acts = bookingActions(booking, member.memberType);
	useEffect(() => {
		let active = true;
		setReviewed(null);
		setReviewError(undefined);
		if (!acts.review) return;
		void (async () => {
			try {
				let page = 1;
				while (true) {
					const { data } = await client.query({
						query: MY_REVIEWS,
						variables: { input: { page, limit: 100, search: { tourId: booking.tourId } } },
						fetchPolicy: 'network-only',
					});
					if (data.result.list.some((review) => review.bookingId === booking._id)) {
						if (active) setReviewed(true);
						break;
					}
					if (!data.result.list.length || page * 100 >= totalOf(data.result)) {
						if (active) setReviewed(false);
						break;
					}
					page++;
				}
			} catch (error) {
				if (active) setReviewError(error instanceof Error ? error : new Error('Something went wrong!'));
			}
		})();
		return () => {
			active = false;
		};
	}, [client, acts.review, booking._id, booking.tourId, member._id, reviewAttempt]);
	const reasonValid = reason.trim().length >= 3 && reason.trim().length <= 500;
	const finish = async () => {
		await refetch();
		await client.refetchQueries({
			include: [
				'TOUR',
				'TOURS',
				'AGENT_TOURS',
				'ADMIN_TOURS',
				'MY_REVIEWS',
				'TOUR_REVIEWS',
				'PUBLIC_AGENT_REVIEWS',
				'MEMBER',
			],
		});
	};
	return (
		<Card variant="outlined" className={agentView ? 'triplink-booking-card' : undefined}>
			<CardContent>
				<Stack spacing={2}>
					{action.feedback}
					{agentView ? (
						<>
							<div className="triplink-booking-card__heading">
								<h3>{booking.tourData?.tourTitle ?? t('Tour unavailable')}</h3>
								<p>
									{t('Booking reference')} <strong>{booking.bookingCode}</strong>
								</p>
							</div>
							<div className="triplink-booking-card__badges">
								<span className="triplink-status-badge" data-status={booking.bookingStatus}>
									{t('Booking status')}: {t(booking.bookingStatus)}
								</span>
								<span className="triplink-status-badge" data-status={booking.paymentStatus}>
									{t('Payment status')}: {t(booking.paymentStatus)}
								</span>
							</div>
							<dl className="triplink-booking-card__details">
								<div>
									<dt>{t('Departure')}</dt>
									<dd>{displayDate(booking.selectedDate)}</dd>
								</div>
								<div>
									<dt>{t('Return')}</dt>
									<dd>{displayDate(booking.selectedEndDate)}</dd>
								</div>
								<div>
									<dt>{t('Travelers')}</dt>
									<dd>{booking.numberOfPeople}</dd>
								</div>
								<div>
									<dt>{t('Unit price:')}</dt>
									<dd>{booking.unitPrice.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</dd>
								</div>
								<div className="triplink-booking-card__total">
									<dt>{t('Total')}</dt>
									<dd>{booking.totalPrice.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</dd>
								</div>
							</dl>
							<dl className="triplink-booking-card__references">
								<div>
									<dt>{t('Payment reference')}</dt>
									<dd>{booking.paymentReference ?? '—'}</dd>
								</div>
								<div>
									<dt>{t('Refund reference')}</dt>
									<dd>{booking.refundReference ?? '—'}</dd>
								</div>
							</dl>
						</>
					) : (
						<>
							<Typography variant="h6">
								{booking.bookingCode} · {booking.tourData?.tourTitle ?? 'Tour unavailable'}
							</Typography>
							<Typography>
								{t(booking.bookingStatus)} / {t(booking.paymentStatus)} · {booking.numberOfPeople} {t('people')}
							</Typography>
							<Typography>
								{displayDate(booking.selectedDate)} → {displayDate(booking.selectedEndDate)}
							</Typography>
							<Typography>
								{t('Unit price:')} {booking.unitPrice} {t('· Total:')} {booking.totalPrice}
							</Typography>
							<Typography>
								{t('Payment:')} {booking.paymentReference ?? '—'} {t('· Refund:')} {booking.refundReference ?? '—'}
							</Typography>
						</>
					)}
					{booking.cancellationReason && (
						<Typography>
							{t('Cancellation:')} {booking.cancellationReason}
						</Typography>
					)}
					{booking.rejectionReason && (
						<Typography>
							{t('Rejection:')} {booking.rejectionReason}
						</Typography>
					)}
					{booking.refundReason && (
						<Typography>
							{t('Refund:')} {booking.refundReason}
						</Typography>
					)}
					{(acts.cancel || acts.reject || acts.refund) && (
						<TextField
							label={t('Reason (3–500 characters)')}
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							inputProps={{ maxLength: 500 }}
							multiline
						/>
					)}
					<Stack direction="row" flexWrap="wrap" gap={1} className="triplink-booking-card__actions">
						{acts.pay && (
							<Button
								disabled={action.busy}
								onClick={() =>
									void action.run(async () => {
										if (!window.confirm(t('Simulate payment for this booking?'))) return;
										await pay({ variables: { bookingId: booking._id } });
										await finish();
									})
								}
							>
								{t('Simulate payment')}
							</Button>
						)}
						{acts.confirm && (
							<Button
								variant={agentView ? 'contained' : 'text'}
								disabled={action.busy}
								onClick={() =>
									void action.run(async () => {
										await confirm({ variables: { bookingId: booking._id } });
										await finish();
									})
								}
							>
								{t('Confirm and reserve seats')}
							</Button>
						)}
						{acts.cancel && (
							<Button
								disabled={action.busy || !reasonValid}
								onClick={() =>
									void action.run(async () => {
										await cancel({
											variables: { input: { bookingId: booking._id, cancellationReason: reason.trim() } },
										});
										await finish();
									})
								}
							>
								{t('Cancel unpaid booking')}
							</Button>
						)}
						{acts.reject && (
							<Button
								variant={agentView ? 'outlined' : 'text'}
								className={agentView ? 'triplink-danger-action' : undefined}
								disabled={action.busy || !reasonValid}
								onClick={() =>
									void action.run(async () => {
										await reject({ variables: { input: { bookingId: booking._id, rejectionReason: reason.trim() } } });
										await finish();
									})
								}
							>
								{t('Reject')}
							</Button>
						)}
						{acts.complete && (
							<Button
								variant={agentView ? 'contained' : 'text'}
								disabled={action.busy}
								onClick={() =>
									void action.run(async () => {
										await complete({ variables: { bookingId: booking._id } });
										await finish();
									})
								}
							>
								{t('Complete trip')}
							</Button>
						)}
						{acts.expire && (
							<Button
								disabled={action.busy}
								onClick={() =>
									void action.run(async () => {
										await expire({ variables: { bookingId: booking._id } });
										await finish();
									})
								}
							>
								{t('Expire unpaid booking')}
							</Button>
						)}
						{acts.refund && (
							<Button
								disabled={action.busy || !reasonValid}
								onClick={() =>
									void action.run(async () => {
										if (!window.confirm(t('Simulate refund for this booking?'))) return;
										await refund({ variables: { input: { bookingId: booking._id, refundReason: reason.trim() } } });
										await finish();
									})
								}
							>
								{t('Simulate refund')}
							</Button>
						)}
					</Stack>
					{acts.review && (
						<QueryState
							loading={reviewed === null && !reviewError}
							error={reviewError}
							retry={() => setReviewAttempt((value) => value + 1)}
						>
							<></>
						</QueryState>
					)}
					{acts.review && reviewed === true && <Link href="/mypage?category=myReviews">{t('My reviews')}</Link>}
					{acts.review && reviewed === false && (
						<Stack spacing={1}>
							<Typography variant="h6">{t('Review completed trip')}</Typography>
							<TextField select label={t('Rating')} value={rating} onChange={(e) => setRating(Number(e.target.value))}>
								{[1, 2, 3, 4, 5].map((value) => (
									<MenuItem value={value} key={value}>
										{t(String(value))}
									</MenuItem>
								))}
							</TextField>
							<TextField
								label={t('Review (3–2000 characters)')}
								multiline
								value={comment}
								onChange={(e) => setComment(e.target.value)}
								inputProps={{ maxLength: 2000 }}
							/>
							<Button
								disabled={action.busy || comment.trim().length < 3}
								onClick={() =>
									void action.run(async () => {
										await createReview({
											variables: {
												input: { bookingId: booking._id, reviewRating: rating, reviewComment: comment.trim() },
											},
										});
										setReviewed(true);
										await finish();
									})
								}
							>
								{t('Publish review')}
							</Button>
						</Stack>
					)}
				</Stack>
			</CardContent>
		</Card>
	);
}
export function BookingsPanel({ admin = false }: { admin?: boolean }) {
	const { t } = useTranslation('common');

	const member = useReactiveVar(memberVar);
	const [page, setPage] = useState(1);
	const [status, setStatus] = useState<BookingStatus | ''>('');
	const [payment, setPayment] = useState<PaymentStatus | ''>('');
	const query = useQuery(admin ? ADMIN_BOOKINGS : member?.memberType === 'AGENT' ? AGENT_BOOKINGS : MY_BOOKINGS, {
		variables: {
			input: {
				page,
				limit: 12,
				search: { ...(status ? { bookingStatus: status } : {}), ...(payment ? { paymentStatus: payment } : {}) },
			},
		},
		skip: !member,
		fetchPolicy: 'network-only',
		notifyOnNetworkStatusChange: true,
	});
	return (
		<Stack spacing={2} className={!admin && member?.memberType === 'AGENT' ? 'triplink-bookings' : undefined}>
			<Alert severity="info">
				{t('Payments and refunds are simulated. Booking status and payment status are independent.')}
			</Alert>
			<Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} className="triplink-bookings__filters">
				<TextField
					select
					label={t('Booking status')}
					value={status}
					SelectProps={{ displayEmpty: true }}
					InputLabelProps={{ shrink: true }}
					onChange={(e) => {
						setStatus(e.target.value as BookingStatus | '');
						setPage(1);
					}}
				>
					<MenuItem value="">{t('All')}</MenuItem>
					{['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED'].map((value) => (
						<MenuItem key={value} value={value}>
							{t(String(value))}
						</MenuItem>
					))}
				</TextField>
				<TextField
					select
					label={t('Payment status')}
					value={payment}
					SelectProps={{ displayEmpty: true }}
					InputLabelProps={{ shrink: true }}
					onChange={(e) => {
						setPayment(e.target.value as PaymentStatus | '');
						setPage(1);
					}}
				>
					<MenuItem value="">{t('All')}</MenuItem>
					{['UNPAID', 'PAID', 'REFUNDED'].map((value) => (
						<MenuItem key={value} value={value}>
							{t(String(value))}
						</MenuItem>
					))}
				</TextField>
			</Stack>
			<QueryState
				loading={query.loading}
				error={query.error}
				empty={!query.data?.result.list.length}
				retry={() => query.refetch()}
			>
				{query.data?.result.list.map((booking) => (
					<BookingRow key={booking._id} booking={booking} refetch={() => query.refetch()} />
				))}
			</QueryState>
			<Pager page={page} total={totalOf(query.data?.result)} onChange={setPage} />
		</Stack>
	);
}
