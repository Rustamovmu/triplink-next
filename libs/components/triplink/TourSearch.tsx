import React from 'react';
import { useRouter } from 'next/router';
import { Box, Button, MenuItem, Stack, TextField } from '@mui/material';
import { Frame } from './Common';
import { TourList } from './Tours';
import {
	TourCategory,
	TourDifficulty,
	TourSearch,
	tourCategories,
	tourDifficulties,
	tourSorts,
} from '../../types/triplink';
import { useTranslation } from 'next-i18next';
export default function TourSearchPage() {
	const router = useRouter();
	const { t } = useTranslation('common');
	const one = (key: string) => (typeof router.query[key] === 'string' ? (router.query[key] as string) : '');
	const page = Math.max(1, Math.floor(Number(one('page')) || 1));
	const search: TourSearch = {};
	if (one('text')) search.text = one('text');
	if (one('destination')) search.destinations = [one('destination')];
	if (tourCategories.includes(one('category') as TourCategory)) search.categories = [one('category') as TourCategory];
	if (tourDifficulties.includes(one('difficulty') as TourDifficulty))
		search.difficulties = [one('difficulty') as TourDifficulty];
	if (
		one('minPrice') &&
		one('maxPrice') &&
		Number(one('minPrice')) >= 0 &&
		Number(one('maxPrice')) >= Number(one('minPrice'))
	)
		search.priceRange = { start: Number(one('minPrice')), end: Number(one('maxPrice')) };
	if (
		one('minDays') &&
		one('maxDays') &&
		Number(one('minDays')) >= 1 &&
		Number(one('maxDays')) >= Number(one('minDays'))
	)
		search.durationRange = { start: Number(one('minDays')), end: Number(one('maxDays')) };
	if (one('start') && one('end') && new Date(one('start')) < new Date(one('end')))
		search.availableDateRange = {
			start: new Date(one('start')).toISOString(),
			end: new Date(one('end')).toISOString(),
		};
	if (Number(one('seats')) > 0) search.minimumAvailableSeats = Math.floor(Number(one('seats')));
	if (Number(one('rating')) >= 1 && Number(one('rating')) <= 5) search.minimumRating = Number(one('rating'));
	const updatePage = (value: number) =>
		void router.push({ pathname: '/tour', query: { ...router.query, page: value } });
	const submit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const values = Object.fromEntries(new FormData(event.currentTarget).entries());
		const query: Record<string, string> = {};
		for (const [key, value] of Object.entries(values)) if (typeof value === 'string' && value) query[key] = value;
		void router.push({ pathname: '/tour', query: { ...query, page: '1' } });
	};
	return (
		<Frame title={t('Tours')}>
			<Box
				component="form"
				key={router.asPath}
				onSubmit={submit}
				sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}
			>
				{['text', 'destination'].map((key) => (
					<TextField
						key={key}
						name={key}
						label={t(key === 'text' ? 'Search' : 'Destination')}
						defaultValue={one(key)}
					/>
				))}
				<TextField select name="category" label={t('Category')} defaultValue={one('category')}>
					<MenuItem value="">{t('All')}</MenuItem>
					{tourCategories.map((value) => (
						<MenuItem key={value} value={value}>
							{t(String(value))}
						</MenuItem>
					))}
				</TextField>
				<TextField select name="difficulty" label={t('Difficulty')} defaultValue={one('difficulty')}>
					<MenuItem value="">{t('All')}</MenuItem>
					{tourDifficulties.map((value) => (
						<MenuItem key={value} value={value}>
							{t(String(value))}
						</MenuItem>
					))}
				</TextField>
				{['minPrice', 'maxPrice', 'minDays', 'maxDays', 'seats', 'rating'].map((key) => (
					<TextField
						key={key}
						name={key}
						label={t(key)}
						type="number"
						inputProps={{
							min: key.includes('Price') ? 0 : 1,
							step: key === 'rating' ? 0.1 : 1,
							...(key === 'rating' ? { max: 5 } : {}),
						}}
						defaultValue={one(key)}
					/>
				))}
				{['start', 'end'].map((key) => (
					<TextField
						key={key}
						name={key}
						label={t(key === 'start' ? 'From' : 'Until')}
						type="datetime-local"
						InputLabelProps={{ shrink: true }}
						defaultValue={one(key)}
					/>
				))}
				<TextField
					select
					name="sort"
					label={t('Sort')}
					defaultValue={tourSorts.includes(one('sort')) ? one('sort') : 'createdAt'}
				>
					{tourSorts.map((value) => (
						<MenuItem key={value} value={value}>
							{t(String(value))}
						</MenuItem>
					))}
				</TextField>
				<TextField
					select
					name="direction"
					label={t('Order')}
					defaultValue={one('direction') === 'ASC' ? 'ASC' : 'DESC'}
				>
					<MenuItem value="ASC">{t('Ascending')}</MenuItem>
					<MenuItem value="DESC">{t('Descending')}</MenuItem>
				</TextField>
				<Stack direction="row" spacing={1}>
					<Button type="submit" variant="contained">
						{t('Search')}
					</Button>
					<Button onClick={() => void router.push('/tour')}>{t('Reset')}</Button>
				</Stack>
			</Box>
			<TourList
				input={{
					page,
					limit: 12,
					search,
					sort: tourSorts.includes(one('sort')) ? one('sort') : 'createdAt',
					direction: one('direction') === 'ASC' ? 'ASC' : 'DESC',
				}}
				onPage={updatePage}
			/>
		</Frame>
	);
}
