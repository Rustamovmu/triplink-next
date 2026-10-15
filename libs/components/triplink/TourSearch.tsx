import React from 'react';
import { useRouter } from 'next/router';
import { Alert, Box, Button, MenuItem, TextField } from '@mui/material';
import { Frame } from './Common';
import { TourList } from './Tours';
import { tourCategories, tourDifficulties, tourSorts } from '../../types/triplink';
import { useTranslation } from 'next-i18next';
import {
	applyTourSearchForm,
	calendarDateInstant,
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
	const formRef = React.useRef<HTMLFormElement>(null);
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
	const groups = [
		{ id: 'destination', label: 'Destinations', keys: ['destination'] },
		{ id: 'dates', label: 'Dates', keys: ['start', 'end'] },
		{ id: 'duration', label: 'Duration', keys: ['minDays', 'maxDays'] },
		{ id: 'price', label: 'Price', keys: ['minPrice', 'maxPrice'] },
		{ id: 'activity', label: 'Activity level', keys: ['difficulty'] },
		{ id: 'sort', label: 'Sort', keys: ['sorting'] },
		{ id: 'more', label: 'More filters', keys: ['category', 'rating', 'seats'] },
	];
	const openPanel = (id: string) => {
		const panel = formRef.current?.querySelector<HTMLDetailsElement>(`details[data-group="${id}"]`);
		if (panel) panel.open = true;
	};
	React.useEffect(() => {
		const dismiss = (event: MouseEvent | KeyboardEvent) => {
			if (event.type === 'keydown' && (event as KeyboardEvent).key !== 'Escape') return;
			if (event.type === 'click' && formRef.current?.contains(event.target as Node)) return;
			formRef.current?.querySelectorAll('details[open]').forEach((panel) => {
				(panel as HTMLDetailsElement).open = false;
				if (event.type === 'keydown') panel.querySelector<HTMLElement>('summary')?.focus();
			});
		};
		document.addEventListener('click', dismiss);
		document.addEventListener('keydown', dismiss);
		return () => {
			document.removeEventListener('click', dismiss);
			document.removeEventListener('keydown', dismiss);
		};
	}, []);
	const submit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!input) return;
		try {
			const values = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
			const [sort, direction] = values.sorting.split(':');
			values.sort = sort;
			values.direction = direction;
			for (const key of ['start', 'end']) {
				if (changed.current.has(key) && values[key]) {
					try {
						values[key] = calendarDateInstant(values[key], key === 'end');
					} catch {
						openPanel('dates');
						setFormError(t('Choose valid departure dates.') || invalidTourSearch);
						return;
					}
				}
			}
			for (const group of groups) {
				try {
					applyTourSearchForm(input, values, new Set(group.keys.filter((key) => changed.current.has(key))));
				} catch {
					openPanel(group.id);
					setFormError(
						t(
							['dates', 'duration', 'price'].includes(group.id)
								? 'Check {{filter}}. Enter valid values and keep the minimum before the maximum.'
								: 'Check {{filter}} and enter valid values.',
							{ filter: t(group.label) },
						) || invalidTourSearch,
					);
					return;
				}
			}
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
				<p role="status" data-browse-pending="true">
					{t('Loading…')}
				</p>
			</Frame>
		);
	if (!input)
		return (
			<Frame title={t('Tours')}>
				<Alert severity="error">{t(invalidTourSearch)}</Alert>
				<Button onClick={() => void router.push('/tour')}>{t('Reset')}</Button>
			</Frame>
		);
	const inquiry = input;
	const sortLabels: Record<string, [string, string]> = {
		createdAt: ['Oldest', 'Newest'],
		updatedAt: ['Least recently updated', 'Recently updated'],
		tourPrice: ['Price: low to high', 'Price: high to low'],
		tourDurationDays: ['Duration: shortest first', 'Duration: longest first'],
		tourAverageRating: ['Lowest rated', 'Best rated'],
		tourBookingCount: ['Fewest bookings', 'Most booked'],
		tourViewCount: ['Fewest views', 'Most viewed'],
		tourFavoriteCount: ['Fewest likes', 'Most liked'],
	};
	const sortingLabel = (sort: string, direction: string) => t(sortLabels[sort][direction === 'ASC' ? 0 : 1]);
	const field = (key: string) => {
		if (key === 'sorting')
			return (
				<TextField
					key={key}
					select
					name="sorting"
					label={t('Sort')}
					defaultValue={`${inquiry.sort || 'createdAt'}:${inquiry.direction || 'DESC'}`}
				>
					{tourSorts.flatMap((sort) =>
						['DESC', 'ASC'].map((direction) => (
							<MenuItem key={`${sort}:${direction}`} value={`${sort}:${direction}`}>
								{sortingLabel(sort, direction)}
							</MenuItem>
						)),
					)}
				</TextField>
			);
		const selects: Record<string, readonly string[]> = {
			category: tourCategories,
			difficulty: tourDifficulties,
		};
		const labels: Record<string, string> = {
			destination: 'Destination',
			start: 'From',
			end: 'Until',
			category: 'Category',
			difficulty: 'Difficulty',
		};
		const date = key === 'start' || key === 'end';
		const numeric = ['minPrice', 'maxPrice', 'minDays', 'maxDays', 'seats', 'rating'].includes(key);
		return (
			<TextField
				key={key}
				name={key}
				label={t(labels[key] || key)}
				select={Boolean(selects[key])}
				type={date ? 'date' : numeric ? 'number' : 'text'}
				defaultValue={date ? one(key).slice(0, 10) : one(key)}
				onChange={() => changed.current.add(key)}
				InputLabelProps={date ? { shrink: true } : undefined}
				inputProps={
					date
						? { step: 1 }
						: numeric
						? {
								min: key.includes('Price') || key === 'rating' ? 0 : 1,
								step: key === 'rating' ? 0.1 : 1,
								...(key === 'rating' ? { max: 5 } : {}),
						  }
						: undefined
				}
			>
				{selects[key] && [
					...(['category', 'difficulty'].includes(key)
						? [
								<MenuItem key="all" value="">
									{t('All')}
								</MenuItem>,
						  ]
						: []),
					...selects[key].map((value) => (
						<MenuItem key={value} value={value}>
							{t(value === 'ASC' ? 'Ascending' : value === 'DESC' ? 'Descending' : value)}
						</MenuItem>
					)),
				]}
			</TextField>
		);
	};
	const summary = (id: string) => {
		const search = inquiry.search;
		if (id === 'destination') return search.destinations?.join(', ');
		if (id === 'activity') return search.difficulties?.map((value) => t(value)).join(', ');
		if (id === 'duration' && search.durationRange) {
			const { start, end } = search.durationRange;
			if (start !== undefined && end !== undefined) return `${start}–${end} ${t('days')}`;
			return `${start !== undefined ? '≥' : '≤'} ${t('{{count}} days', { count: start ?? end })}`;
		}
		if (id === 'price' && search.priceRange) {
			const { start, end } = search.priceRange;
			if (start !== undefined && end !== undefined) return `$${start}–$${end}`;
			return `${start !== undefined ? '≥' : '≤'} $${start ?? end}`;
		}
		if (id === 'dates' && search.availableDateRange) {
			const locale = (router.locale === 'kr' ? 'ko-KR' : router.locale === 'uz' ? 'uz-UZ' : 'en-US');
			const { start, end } = search.availableDateRange;
			const format = (date: string) => new Date(date).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
			if (start && end) return `${format(start)} – ${format(end)}`;
			return start ? `${t('From')} ${format(start)}` : end ? `${t('Until')} ${format(end)}` : '';
		}
		if (id === 'sort') return sortingLabel(inquiry.sort || 'createdAt', inquiry.direction || 'DESC');
		if (id === 'more') {
			const count =
				Number(Boolean(search.categories?.length)) +
				Number(search.minimumRating !== undefined) +
				Number(search.minimumAvailableSeats !== undefined);
			return count ? t('{{count}} applied', { count }) : '';
		}
		return '';
	};
	return (
		<div className="triplink-tour-catalog">
			<Frame title={t('Tours')}>
				{formError && <Alert severity="error">{t(formError)}</Alert>}
				<Box
					component="form"
					ref={formRef}
					key={router.asPath}
					onSubmit={submit}
					className="triplink-tour-filters"
					onInvalidCapture={(event: React.FormEvent<HTMLFormElement>) => {
						const field = event.target as HTMLInputElement;
						const panel = field.closest('details');
						if (panel) panel.open = true;
						setFormError(t('Complete the highlighted filter with a valid value.') || invalidTourSearch);
					}}
					onChange={(event: React.FormEvent<HTMLFormElement>) => {
						const target = event.target as HTMLInputElement;
						if (target.name) changed.current.add(target.name);
					}}
				>
					<div className="triplink-tour-filters__search">
						<TextField
							name="text"
							label={t('Search tours')}
							defaultValue={one('text')}
							onChange={() => changed.current.add('text')}
						/>
						<Button type="submit" variant="contained">
							{t('Apply filters')}
						</Button>
						<Button type="button" onClick={() => void router.push('/tour')}>
							{t('Reset')}
						</Button>
					</div>
					<div className="triplink-tour-filters__bar">
						{groups.map((group) => (
							<details
								key={group.id}
								data-group={group.id}
								onToggle={(event) => {
									const active = event.currentTarget;
									if (active.open)
										formRef.current?.querySelectorAll('details[open]').forEach((panel) => {
											if (panel !== active) (panel as HTMLDetailsElement).open = false;
										});
								}}
							>
								<summary>
									<span>
										{t(group.label)}
										{summary(group.id) && <small>{summary(group.id)}</small>}
									</span>
									<span aria-hidden="true">⌄</span>
								</summary>
								<div className="triplink-tour-filters__panel">
									{group.keys.map(field)}
									{group.id === 'dates' && <p>{t('Choose a start date, an end date, or both. Entire days are included.')}</p>}
									<Button type="submit" variant="contained">
										{t('Apply filters')}
									</Button>
								</div>
							</details>
						))}
					</div>
				</Box>
				<TourList input={input} onPage={updatePage} catalog />
			</Frame>
		</div>
	);
}
