import { useTranslation } from 'next-i18next';
import React, { useState } from 'react';
import Image from 'next/image';
import { useMutation, useQuery } from '@apollo/client';
import { Alert, Box, Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { AGENT_TOURS, CREATE_TOUR, UPDATE_TOUR } from '../../../apollo/user/triplink';
import { ADMIN_TOURS, ADMIN_TOUR_UPDATE } from '../../../apollo/admin/triplink';
import { Tour, TourInput, TourStatus, tourCategories, tourDifficulties, totalOf } from '../../types/triplink';
import { imageUrl, Pager, QueryState, useAction } from './Common';
import { uploadImages } from '../../uploads';
export const ownerTransitions: Partial<Record<TourStatus, TourStatus[]>> = {
	DRAFT: ['PENDING', 'CANCELLED'],
	PENDING: ['DRAFT', 'CANCELLED'],
	ACTIVE: ['PENDING', 'CANCELLED'],
	SOLD_OUT: ['CANCELLED'],
};
export const adminTransitions: Partial<Record<TourStatus, TourStatus[]>> = {
	DRAFT: ['CANCELLED'],
	PENDING: ['DRAFT', 'ACTIVE', 'CANCELLED'],
	ACTIVE: ['SOLD_OUT', 'COMPLETED', 'CANCELLED'],
	SOLD_OUT: ['ACTIVE', 'COMPLETED', 'CANCELLED'],
};
const emptyTour: TourInput = {
	tourTitle: '',
	tourDescription: '',
	tourDestination: '',
	tourCountry: '',
	tourCity: '',
	tourImages: [],
	tourPrice: 0,
	tourDurationDays: 1,
	tourAvailableDates: [],
	tourAvailableSeats: 0,
	tourMaxGroupSize: 1,
	tourCategory: 'CITY',
	tourDifficulty: 'EASY',
	tourLanguages: [],
	tourTransportation: [],
	tourAccommodation: '',
	tourMeals: [],
	tourItinerary: [],
	tourIncludedServices: [],
	tourExcludedServices: [],
};
export function tourToInput(tour: Tour): TourInput {
	return {
		tourTitle: tour.tourTitle,
		tourDescription: tour.tourDescription,
		tourDestination: tour.tourDestination,
		tourCountry: tour.tourCountry,
		tourCity: tour.tourCity,
		tourImages: tour.tourImages,
		tourPrice: tour.tourPrice,
		...(tour.tourDiscountPrice !== null ? { tourDiscountPrice: tour.tourDiscountPrice } : {}),
		tourDurationDays: tour.tourDurationDays,
		tourAvailableDates: tour.tourAvailableDates.map(({ startDate, endDate, availableSeats }) => ({
			startDate,
			endDate,
			availableSeats,
		})),
		tourAvailableSeats: tour.tourAvailableSeats,
		tourMaxGroupSize: tour.tourMaxGroupSize,
		tourCategory: tour.tourCategory,
		tourDifficulty: tour.tourDifficulty,
		tourLanguages: tour.tourLanguages,
		tourTransportation: tour.tourTransportation,
		tourAccommodation: tour.tourAccommodation ?? '',
		tourMeals: tour.tourMeals,
		tourItinerary: tour.tourItinerary.map(({ day, title, description }) => ({ day, title, description })),
		tourIncludedServices: tour.tourIncludedServices,
		tourExcludedServices: tour.tourExcludedServices,
	};
}
export function validateTour(input: TourInput) {
	if (input.tourTitle.trim().length < 5 || input.tourDescription.trim().length < 20)
		throw new Error('Title needs 5 characters and description needs 20 characters.');
	if (input.tourDiscountPrice !== undefined && input.tourDiscountPrice > input.tourPrice)
		throw new Error('Discount price cannot exceed price.');
	if (
		input.tourAvailableDates.some(
			(date) =>
				!date.startDate ||
				!date.endDate ||
				new Date(date.startDate) >= new Date(date.endDate) ||
				!Number.isInteger(date.availableSeats) ||
				date.availableSeats < 0,
		)
	)
		throw new Error('Check departure dates and seats.');
	if (
		new Set(input.tourItinerary.map((item) => item.day)).size !== input.tourItinerary.length ||
		input.tourItinerary.some(
			(item) => item.day < 1 || item.day > input.tourDurationDays || !item.title.trim() || !item.description.trim(),
		)
	)
		throw new Error('Itinerary days must be unique and within tour duration, with a title and description.');
}
const localDate = (value: string) => {
	if (!value) return '';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
export function TourForm({ tour, onSaved }: { tour?: Tour; onSaved: () => Promise<unknown> }) {
	const { t } = useTranslation('common');

	const [form, setForm] = useState<TourInput>(() => (tour ? tourToInput(tour) : emptyTour));
	const action = useAction();
	const [create] = useMutation(CREATE_TOUR);
	const [update] = useMutation(UPDATE_TOUR);
	const field = <K extends keyof TourInput>(key: K, value: TourInput[K]) =>
		setForm((previous) => ({ ...previous, [key]: value }));
	const submit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		void action.run(async () => {
			const input = {
				...form,
				tourAvailableSeats: form.tourAvailableDates.reduce((sum, item) => sum + item.availableSeats, 0),
			};
			validateTour(input);
			if (tour) await update({ variables: { input: { ...input, tourId: tour._id } } });
			else await create({ variables: { input } });
			await onSaved();
		});
	};
	return (
		<Stack component="form" spacing={2} onSubmit={submit} className="triplink-workspace-form triplink-tour-form">
			{action.feedback}
			<Alert severity="info">
				{t(
					'Departure times use your local timezone and are saved as ISO instants. Drafts can have empty departures and itinerary; submission requires images, departures, and itinerary.',
				)}
			</Alert>
			<fieldset className="triplink-editor-section triplink-tour-form__overview">
				<legend>{t('Tour overview')}</legend>
				<div className="triplink-tour-form__grid">
					{(
						['tourTitle', 'tourDescription', 'tourDestination', 'tourCountry', 'tourCity', 'tourAccommodation'] as const
					).map((key) => (
						<TextField
							key={key}
							className={['tourTitle', 'tourDescription'].includes(key) ? 'triplink-tour-form__wide' : undefined}
							label={t(key)}
							required={key !== 'tourAccommodation'}
							multiline={key === 'tourDescription'}
							minRows={key === 'tourDescription' ? 4 : undefined}
							value={form[key] ?? ''}
							onChange={(e) => field(key, e.target.value)}
							inputProps={{
								minLength: key === 'tourTitle' ? 5 : key === 'tourDescription' ? 20 : 2,
								maxLength:
									key === 'tourDescription'
										? 10000
										: key === 'tourTitle' || key === 'tourDestination'
										? 150
										: key === 'tourAccommodation'
										? 500
										: 100,
							}}
						/>
					))}
				</div>
			</fieldset>
			<fieldset className="triplink-editor-section">
				<legend>{t('Pricing and group size')}</legend>
				<div className="triplink-tour-form__grid triplink-tour-form__pricing">
					{(['tourPrice', 'tourDurationDays', 'tourMaxGroupSize'] as const).map((key) => (
						<TextField
							key={key}
							label={t(key)}
							type="number"
							required
							value={form[key]}
							onChange={(e) => field(key, Number(e.target.value))}
							inputProps={{
								min: key === 'tourPrice' ? 0 : 1,
								step: key === 'tourPrice' ? 0.01 : 1,
								...(key === 'tourDurationDays' ? { max: 365 } : {}),
							}}
						/>
					))}
					<TextField
						label={t('Discount price (optional)')}
						type="number"
						value={form.tourDiscountPrice ?? ''}
						onChange={(e) => field('tourDiscountPrice', e.target.value === '' ? undefined : Number(e.target.value))}
						inputProps={{ min: 0, step: 0.01 }}
					/>
				</div>
			</fieldset>
			<fieldset className="triplink-editor-section">
				<legend>{t('Travel arrangements')}</legend>
				<div className="triplink-tour-form__grid">
					<TextField
						select
						label={t('Category')}
						value={form.tourCategory}
						onChange={(e) => field('tourCategory', e.target.value as TourInput['tourCategory'])}
					>
						{tourCategories.map((value) => (
							<MenuItem key={value} value={value}>
								{t(String(value))}
							</MenuItem>
						))}
					</TextField>
					<TextField
						select
						label={t('Difficulty')}
						value={form.tourDifficulty}
						onChange={(e) => field('tourDifficulty', e.target.value as TourInput['tourDifficulty'])}
					>
						{tourDifficulties.map((value) => (
							<MenuItem key={value} value={value}>
								{t(String(value))}
							</MenuItem>
						))}
					</TextField>
					{(
						[
							'tourLanguages',
							'tourTransportation',
							'tourMeals',
							'tourIncludedServices',
							'tourExcludedServices',
						] as const
					).map((key) => (
						<TextField
							key={key}
							label={`${t(key)} (${t('One per line')})`}
							multiline
							minRows={2}
							value={form[key].join('\n')}
							onChange={(e) => field(key, e.target.value.split('\n'))}
						/>
					))}
				</div>
			</fieldset>
			<fieldset className="triplink-editor-section triplink-tour-form__photos">
				<legend>{t('Tour photos')}</legend>
				<Button component="label" variant="outlined" disabled={action.busy}>
					{t('Upload tour images')}
					<input
						type="file"
						multiple
						accept="image/jpeg,image/png"
						hidden
						onChange={(e) => {
							const files = Array.from(e.target.files ?? []);
							void action.run(async () => {
								if (form.tourImages.length + files.length > 20) throw new Error('At most 20 tour images.');
								field('tourImages', [...form.tourImages, ...(await uploadImages(files, 'tour'))]);
							});
							e.target.value = '';
						}}
					/>
				</Button>
				<Stack direction="row" flexWrap="wrap" gap={2}>
					{form.tourImages.map((path, index) => (
						<Stack key={path}>
							<Box
								component="img"
								onError={(event: React.SyntheticEvent<HTMLImageElement>) => {
									const target = event.currentTarget;
									target.onerror = null;
									if (!target.src.endsWith('/img/tour-placeholder.svg')) target.src = '/img/tour-placeholder.svg';
								}}
								src={imageUrl(path)}
								alt={t('Tour upload')}
								sx={{ width: 120, height: 90, objectFit: 'cover' }}
							/>
							<Button
								variant="outlined"
								className="triplink-danger-action"
								disabled={action.busy}
								onClick={() =>
									field(
										'tourImages',
										form.tourImages.filter((_, i) => i !== index),
									)
								}
							>
								{t('Remove image')}
							</Button>
						</Stack>
					))}
				</Stack>
			</fieldset>
			<fieldset className="triplink-editor-section">
				<legend>{t('Departures')}</legend>
				<Typography className="triplink-tour-form__seat-total">
					{t('Departures · total seats')} {form.tourAvailableDates.reduce((sum, item) => sum + item.availableSeats, 0)}
				</Typography>
				{form.tourAvailableDates.map((date, index) => (
					<Stack
						key={index}
						direction={{ xs: 'column', sm: 'row' }}
						spacing={1}
						className="triplink-tour-form__departure"
					>
						{(['startDate', 'endDate'] as const).map((key) => (
							<TextField
								key={key}
								label={t(key)}
								type="datetime-local"
								required
								InputLabelProps={{ shrink: true }}
								value={localDate(date[key])}
								onChange={(e) =>
									field(
										'tourAvailableDates',
										form.tourAvailableDates.map((item, i) =>
											i === index
												? { ...item, [key]: e.target.value ? new Date(e.target.value).toISOString() : '' }
												: item,
										),
									)
								}
							/>
						))}
						<TextField
							label={t('Available seats')}
							type="number"
							required
							inputProps={{ min: 0, step: 1 }}
							value={date.availableSeats}
							onChange={(e) =>
								field(
									'tourAvailableDates',
									form.tourAvailableDates.map((item, i) =>
										i === index ? { ...item, availableSeats: Number(e.target.value) } : item,
									),
								)
							}
						/>
						<Button
							variant="outlined"
							className="triplink-danger-action"
							onClick={() =>
								field(
									'tourAvailableDates',
									form.tourAvailableDates.filter((_, i) => i !== index),
								)
							}
						>
							{t('Remove departure')}
						</Button>
					</Stack>
				))}
				<Button
					variant="outlined"
					disabled={form.tourAvailableDates.length >= 100}
					onClick={() =>
						field('tourAvailableDates', [...form.tourAvailableDates, { startDate: '', endDate: '', availableSeats: 1 }])
					}
				>
					{t('Add departure')}
				</Button>
			</fieldset>
			<fieldset className="triplink-editor-section">
				<legend>{t('Daily itinerary')}</legend>
				{form.tourItinerary.map((item, index) => (
					<Stack key={index} spacing={1} className="triplink-tour-form__day">
						<TextField
							label={t('Day')}
							type="number"
							required
							inputProps={{ min: 1, max: form.tourDurationDays, step: 1 }}
							value={item.day}
							onChange={(e) =>
								field(
									'tourItinerary',
									form.tourItinerary.map((row, i) => (i === index ? { ...row, day: Number(e.target.value) } : row)),
								)
							}
						/>
						{(['title', 'description'] as const).map((key) => (
							<TextField
								key={key}
								label={t(key)}
								required
								multiline={key === 'description'}
								minRows={key === 'description' ? 3 : undefined}
								value={item[key]}
								onChange={(e) =>
									field(
										'tourItinerary',
										form.tourItinerary.map((row, i) => (i === index ? { ...row, [key]: e.target.value } : row)),
									)
								}
							/>
						))}
						<Button
							variant="outlined"
							className="triplink-danger-action"
							onClick={() =>
								field(
									'tourItinerary',
									form.tourItinerary.filter((_, i) => i !== index),
								)
							}
						>
							{t('Remove day')}
						</Button>
					</Stack>
				))}
				<Button
					variant="outlined"
					onClick={() =>
						field('tourItinerary', [
							...form.tourItinerary,
							{ day: form.tourItinerary.length + 1, title: '', description: '' },
						])
					}
				>
					{t('Add itinerary day')}
				</Button>
			</fieldset>
			<div className="triplink-tour-form__footer">
				<Button type="submit" variant="contained" disabled={action.busy}>
					{t('Save draft')}
				</Button>
			</div>
		</Stack>
	);
}
export function OwnedTours({ admin = false }: { admin?: boolean }) {
	const { t } = useTranslation('common');

	const [page, setPage] = useState(1);
	const [status, setStatus] = useState<TourStatus | ''>('');
	const [editing, setEditing] = useState<Tour | null>(null);
	const action = useAction();
	const [ownerUpdate] = useMutation(UPDATE_TOUR);
	const [adminUpdate] = useMutation(ADMIN_TOUR_UPDATE);
	const query = useQuery(admin ? ADMIN_TOURS : AGENT_TOURS, {
		variables: { input: { page, limit: 12, search: status ? { tourStatus: status } : {} } },
		fetchPolicy: 'network-only',
	});
	const save = async () => {
		setEditing(null);
		await query.refetch();
	};
	if (editing)
		return (
			<Stack spacing={2}>
				<Button onClick={() => setEditing(null)}>{t('Back to tours')}</Button>
				<TourForm key={editing._id} tour={editing} onSaved={save} />
			</Stack>
		);
	return (
		<Stack spacing={2} className={admin ? undefined : 'triplink-owned-tours'}>
			{action.feedback}
			<div className="triplink-owned-tours__toolbar">
				{!admin && query.data && !query.loading && !query.error && (
					<Typography className="triplink-owned-tours__count">
						<strong>{totalOf(query.data.result)}</strong> {t('Tours')}
					</Typography>
				)}
				<TextField
					className="triplink-owned-tours__filter"
					select
					label={t('Status')}
					value={status}
					SelectProps={{ displayEmpty: true }}
					InputLabelProps={{ shrink: true }}
					onChange={(e) => {
						setStatus(e.target.value as TourStatus | '');
						setPage(1);
					}}
				>
					<MenuItem value="">{t('All')}</MenuItem>
					{['DRAFT', 'PENDING', 'ACTIVE', 'SOLD_OUT', 'COMPLETED', 'CANCELLED'].map((value) => (
						<MenuItem key={value} value={value}>
							{t(String(value))}
						</MenuItem>
					))}
				</TextField>
			</div>
			<QueryState
				loading={query.loading}
				error={query.error}
				empty={!query.data?.result.list.length}
				retry={() => query.refetch()}
			>
				{query.data?.result.list.map((tour) => (
					<Card variant="outlined" key={tour._id} className="triplink-owned-tours__card">
						<CardContent>
							<div className="triplink-owned-tours__row">
								{!admin && (
									<div className="triplink-owned-tours__photo">
										<Image
											fill
											unoptimized
											alt=""
											loading="lazy"
											sizes="(max-width: 600px) 88px, 140px"
											src={tour.tourImages[0] ? imageUrl(tour.tourImages[0]) : '/img/tour-placeholder.svg'}
											onError={(event) => {
												if (!event.currentTarget.src.endsWith('/img/tour-placeholder.svg'))
													event.currentTarget.src = '/img/tour-placeholder.svg';
											}}
										/>
									</div>
								)}
								<div className="triplink-owned-tours__details">
									{admin ? (
										<>
											<Typography variant="h6">{tour.tourTitle}</Typography>
											<Typography>
												{t(tour.tourStatus)} · {tour.tourAvailableSeats} {t('seats ·')} {tour.tourBookingCount}{' '}
												{t('bookings ·')} {t(tour.tourFeatured ? 'Featured' : 'Not featured')}
											</Typography>
										</>
									) : (
										<>
											<div className="triplink-owned-tours__badges">
												<span className="triplink-owned-tours__status" data-status={tour.tourStatus}>
													<span aria-hidden="true" />
													{t(tour.tourStatus)}
												</span>
												<span className="triplink-owned-tours__featured" data-featured={tour.tourFeatured}>
													{t(tour.tourFeatured ? 'Featured' : 'Not featured')}
												</span>
											</div>
											<Typography component="h3" variant="h6" className="triplink-owned-tours__title">
												{tour.tourTitle}
											</Typography>
											<Typography className="triplink-owned-tours__location">
												{[tour.tourDestination, tour.tourCountry].filter(Boolean).join(', ')}
											</Typography>
											<dl className="triplink-owned-tours__metrics">
												<div>
													<dt>{t('Available seats')}</dt>
													<dd>{tour.tourAvailableSeats}</dd>
												</div>
												<div>
													<dt>{t('Bookings')}</dt>
													<dd>{tour.tourBookingCount}</dd>
												</div>
											</dl>
										</>
									)}
								</div>
								<Stack direction="row" flexWrap="wrap" gap={1} className="triplink-owned-tours__actions">
									{!admin && ['DRAFT', 'PENDING'].includes(tour.tourStatus) && (
										<Button variant="outlined" disabled={action.busy} onClick={() => setEditing(tour)}>
											{t('Edit draft')}
										</Button>
									)}
									{(admin ? adminTransitions : ownerTransitions)[tour.tourStatus]?.map((next) => (
										<Button
											key={t(next)}
											variant={admin ? 'text' : next === 'CANCELLED' ? 'outlined' : 'contained'}
											className={!admin && next === 'CANCELLED' ? 'triplink-owned-tours__cancel' : undefined}
											disabled={
												action.busy ||
												(next === 'PENDING' &&
													(!tour.tourImages.length || !tour.tourAvailableDates.length || !tour.tourItinerary.length)) ||
												(next === 'SOLD_OUT' && tour.tourAvailableSeats !== 0)
											}
											onClick={() =>
												void action.run(async () => {
													const resubmitting = !admin && tour.tourStatus === 'ACTIVE' && next === 'PENDING';
													const confirmation = resubmitting
														? t(
																'Resubmit this tour for admin approval? It will be hidden from public listings. Tours with confirmed bookings cannot be resubmitted.',
														  )
														: t('Change this tour to {{status}}?', { status: t(next) });
													if (!window.confirm(confirmation)) return;
													const input = { tourId: tour._id, tourStatus: next };
													if (admin) await adminUpdate({ variables: { input } });
													else await ownerUpdate({ variables: { input } });
													await query.refetch();
												})
											}
										>
											{t(
												admin
													? next
													: next === 'CANCELLED'
													? 'Cancel tour'
													: next === 'DRAFT'
													? 'Return to draft'
													: next === 'PENDING'
													? tour.tourStatus === 'ACTIVE'
														? 'Resubmit for approval'
														: 'Submit for approval'
													: next,
											)}
										</Button>
									))}
									{admin && tour.tourStatus === 'ACTIVE' && (
										<Button
											disabled={action.busy}
											onClick={() =>
												void action.run(async () => {
													await adminUpdate({
														variables: { input: { tourId: tour._id, tourFeatured: !tour.tourFeatured } },
													});
													await query.refetch();
												})
											}
										>
											{t(tour.tourFeatured ? 'Unfeature' : 'Feature')}
										</Button>
									)}
								</Stack>
							</div>
							{!admin && tour.tourStatus === 'ACTIVE' && (
								<Typography component="p" variant="body2" className="triplink-owned-tours__note">
									<span>
										{t(
											'Resubmitting returns this tour to Pending for admin approval. Tours with confirmed bookings cannot be resubmitted.',
										)}
									</span>
								</Typography>
							)}
						</CardContent>
					</Card>
				))}
			</QueryState>
			<Pager page={page} total={totalOf(query.data?.result)} onChange={setPage} />
		</Stack>
	);
}
