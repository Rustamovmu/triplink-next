import React from 'react';
import { useRouter } from 'next/router';
import { Alert, Box, Button, MenuItem, Stack, TextField } from '@mui/material';
import { Frame } from './Common';
import { TourList } from './Tours';
import { tourCategories, tourDifficulties, tourSorts } from '../../types/triplink';
import { useTranslation } from 'next-i18next';
import {
	applyTourSearchForm,
	invalidTourSearch,
	parseTourSearchQuery,
	tourSearchFormValues,
	tourSearchQuery,
} from '../../triplink/tourSearchUrl';
export default function TourSearchPage() {
	const router = useRouter();
	const { t } = useTranslation('common');
	// Static HTML and the first browser render must share the loading state.
	const [queryReady, setQueryReady] = React.useState(false);
	React.useEffect(() => {
		setQueryReady(router.isReady);
	}, [router.isReady]);
	const changed = React.useRef(new Set<string>());
	const [formError, setFormError] = React.useState('');
	React.useEffect(() => {
		changed.current.clear();
		setFormError('');
	}, [router.asPath]);
	let input: ReturnType<typeof parseTourSearchQuery> | undefined;
	try {
		if (queryReady) input = parseTourSearchQuery(router.query);
	} catch {
		/* Display invalid URLs without sending a query. */
	}
	const values = input ? tourSearchFormValues(input) : {};
	const one = (key: string) => values[key] ?? '';
	const updatePage = (page: number) => {
		if (input) void router.push({ pathname: '/tour', query: tourSearchQuery({ ...input, page }) });
	};
	const submit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!input) return;
		try {
			const values = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
			const next = applyTourSearchForm(input, values, changed.current);
			setFormError('');
			void router.push({ pathname: '/tour', query: tourSearchQuery(next) });
		} catch {
			setFormError(invalidTourSearch);
		}
	};
	if (!queryReady)
		return (
			<Frame title={t('Tours')}>
				<p role="status">{t('Loading…')}</p>
			</Frame>
		);
	if (!input)
		return (
			<Frame title={t('Tours')}>
				<Alert severity="error">{t(invalidTourSearch)}</Alert>
				<Button onClick={() => void router.push('/tour')}>{t('Reset')}</Button>
			</Frame>
		);
	return (
		<Frame title={t('Tours')}>
			{formError && <Alert severity="error">{t(formError)}</Alert>}
			<Box
				component="form"
				key={router.asPath}
				onSubmit={submit}
				onChange={(event: React.FormEvent<HTMLFormElement>) => {
					const target = event.target as HTMLInputElement;
					if (target.name) changed.current.add(target.name);
				}}
				sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}
			>
				{['text', 'destination'].map((key) => (
					<TextField
						key={key}
						name={key}
						onChange={() => changed.current.add(key)}
						label={t(key === 'text' ? 'Search' : 'Destination')}
						defaultValue={one(key)}
					/>
				))}
				<TextField
					select
					name="category"
					onChange={() => changed.current.add('category')}
					label={t('Category')}
					defaultValue={one('category')}
				>
					<MenuItem value="">{t('All')}</MenuItem>
					{tourCategories.map((value) => (
						<MenuItem key={value} value={value}>
							{t(String(value))}
						</MenuItem>
					))}
				</TextField>
				<TextField
					select
					name="difficulty"
					onChange={() => changed.current.add('difficulty')}
					label={t('Difficulty')}
					defaultValue={one('difficulty')}
				>
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
						onChange={() => changed.current.add(key)}
						label={t(key)}
						type="number"
						inputProps={{
							min: key.includes('Price') || key === 'rating' ? 0 : 1,
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
						onChange={() => changed.current.add(key)}
						label={t(key === 'start' ? 'From' : 'Until')}
						type="datetime-local"
						InputLabelProps={{ shrink: true }}
						inputProps={{ step: 0.001 }}
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
			<TourList input={input} onPage={updatePage} />
		</Frame>
	);
}
