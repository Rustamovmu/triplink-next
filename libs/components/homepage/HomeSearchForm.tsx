import React, { useId, useRef, useState } from 'react';
import { Alert, CircularProgress, Popover, TextField } from '@mui/material';
import {
	DatePicker,
	LocalizationProvider,
	enUS as pickerEn,
	koKR as pickerKo,
	ruRU as pickerRu,
} from '@mui/x-date-pickers-pro';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enUS, ko, ru } from 'date-fns/locale';
import {
	ArrowForwardRounded,
	AddRounded,
	RemoveRounded,
	PlaceOutlined,
	PeopleOutlineRounded,
} from '@mui/icons-material';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { buildHomeSearch } from '../../triplink/homeSearch';
import { useRememberedState } from '../../triplink/BrowsingMemoryProvider';

function calendarValue(date: Date | null): string {
	if (!date) return '';
	if (!Number.isFinite(date.getTime())) return 'invalid';
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(
		2,
		'0',
	)}`;
}
const validDate = (date: Date | null) => (date && Number.isFinite(date.getTime()) ? date : undefined);

export default function HomeSearchForm() {
	const router = useRouter(),
		{ t } = useTranslation('common');
	const id = useId().replace(/:/g, '');
	const [text, setText] = useRememberedState('home:search-text', '');
	const [startValue, setStartValue] = useRememberedState('home:search-start', ''),
		[endValue, setEndValue] = useRememberedState('home:search-end', '');
	const start = startValue ? new Date(startValue) : null,
		end = endValue ? new Date(endValue) : null;
	const setStart = (value: Date | null) =>
		setStartValue(value ? (Number.isFinite(value.getTime()) ? value.toISOString() : 'invalid') : '');
	const setEnd = (value: Date | null) =>
		setEndValue(value ? (Number.isFinite(value.getTime()) ? value.toISOString() : 'invalid') : '');
	const [seats, setSeats] = useRememberedState('home:search-seats', '1');
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	const [error, setError] = useState(''),
		[searching, setSearching] = useState(false);
	const pending = useRef(false),
		startInput = useRef<HTMLInputElement>(null),
		endInput = useRef<HTMLInputElement>(null),
		travelerButton = useRef<HTMLButtonElement>(null);
	const submit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (pending.current) return;
		const form = new FormData(event.currentTarget);
		let query: Record<string, string>;
		try {
			query = buildHomeSearch({
				text: String(form.get('text') ?? ''),
				start: calendarValue(start),
				end: calendarValue(end),
				seats,
			});
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Choose valid departure dates.');
			if (!Number.isInteger(Number(seats)) || Number(seats) < 1 || Number(seats) > 100) travelerButton.current?.focus();
			else if (!validDate(start)) startInput.current?.focus();
			else endInput.current?.focus();
			return;
		}
		setError('');
		pending.current = true;
		setSearching(true);
		setAnchor(null);
		try {
			if (!(await router.push({ pathname: '/tour', query }))) setError('Could not open tours. Try again.');
		} catch {
			setError('Could not open tours. Try again.');
		} finally {
			pending.current = false;
			setSearching(false);
		}
	};
	return (
		<div data-browse-section="home:search" className="triplink-search-wrap">
			<form className="triplink-search" onSubmit={submit} aria-label={t('Search tours')} aria-busy={searching}>
				<label className="triplink-search__field triplink-search__destination">
					<span className="triplink-search__label">{t('Destination or tour')}</span>
					<span className="triplink-search__value">
						<PlaceOutlined aria-hidden="true" />
						<input
							value={text}
							onChange={(event) => setText(event.target.value)}
							name="text"
							type="text"
							autoComplete="off"
							maxLength={150}
							placeholder={t('Where would you like to go?')}
						/>
					</span>
				</label>
				<LocalizationProvider
					dateAdapter={AdapterDateFns}
					adapterLocale={router.locale === 'kr' ? ko : router.locale === 'ru' ? ru : enUS}
					localeText={{
						...(router.locale === 'kr' ? pickerKo : router.locale === 'ru' ? pickerRu : pickerEn).components
							.MuiLocalizationProvider.defaultProps.localeText,
						cancelButtonLabel: String(t('Cancel')),
						okButtonLabel: String(t('Done')),
						clearButtonLabel: String(t('Clear dates')),
					}}
				>
					{(['start', 'end'] as const).map((key) => (
						<div key={key} className="triplink-search__field triplink-search__date">
							<DatePicker
								label={t(key === 'start' ? 'Departure from' : 'Departure until')}
								value={key === 'start' ? start : end}
								onChange={key === 'start' ? setStart : setEnd}
								disablePast={false}
								minDate={key === 'end' ? validDate(start) : undefined}
								maxDate={key === 'start' ? validDate(end) : undefined}
								PaperProps={{ className: 'triplink-calendar' }}
								DialogProps={{ PaperProps: { className: 'triplink-calendar' } }}
								componentsProps={{ actionBar: { actions: ['clear', 'cancel', 'accept'] } }}
								renderInput={(params) => (
									<TextField
										{...params}
										fullWidth
										variant="standard"
										inputRef={key === 'start' ? startInput : endInput}
										InputLabelProps={{ ...params.InputLabelProps, shrink: true }}
										InputProps={{ ...params.InputProps, disableUnderline: true }}
										inputProps={{
											...params.inputProps,
											autoComplete: 'off',
											'aria-describedby': error ? `${id}-error` : undefined,
										}}
									/>
								)}
							/>
						</div>
					))}
				</LocalizationProvider>
				<div className="triplink-search__field triplink-search__travelers">
					<span className="triplink-search__label" id={`${id}-travelers`}>
						{t('Travelers')}
					</span>
					<button
						ref={travelerButton}
						type="button"
						className="triplink-search__traveler-button"
						aria-labelledby={`${id}-travelers ${id}-count`}
						aria-describedby={`${id}-seats-help`}
						aria-haspopup="dialog"
						aria-expanded={Boolean(anchor)}
						aria-controls={anchor ? `${id}-popover` : undefined}
						onClick={(event) => setAnchor(event.currentTarget)}
					>
						<PeopleOutlineRounded aria-hidden="true" />
						<span id={`${id}-count`}>
							{seats === '1' ? t('1 traveler') : t('{{count}} travelers', { count: Number(seats) || 0 })}
						</span>
					</button>
					<small id={`${id}-seats-help`}>{t('Minimum available seats')}</small>
					<input type="hidden" name="seats" value={seats} />
				</div>
				<button
					className="triplink-action triplink-action--primary triplink-search__submit"
					type="submit"
					disabled={searching}
				>
					{searching ? (
						<>
							<CircularProgress size={20} color="inherit" aria-hidden="true" />
							{t('Searching…')}
						</>
					) : (
						<>
							{t('Search tours')}
							<ArrowForwardRounded aria-hidden="true" />
						</>
					)}
				</button>
				{error && (
					<Alert severity="error" className="triplink-search__error" id={`${id}-error`}>
						{t(error)}
					</Alert>
				)}
			</form>
			<Popover
				open={Boolean(anchor)}
				anchorEl={anchor}
				onClose={() => setAnchor(null)}
				anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
				transformOrigin={{ vertical: 'top', horizontal: 'left' }}
				PaperProps={{
					className: 'triplink-traveler-popover',
					role: 'dialog',
					id: `${id}-popover`,
					'aria-labelledby': `${id}-popover-title`,
				}}
			>
				<h2 id={`${id}-popover-title`}>{t('Travelers')}</h2>
				<p>{t('Minimum available seats')}</p>
				<div className="triplink-traveler-popover__stepper">
					<button
						type="button"
						aria-label={t('Decrease travelers')}
						disabled={Number(seats) <= 1}
						onClick={() => setSeats(String(Math.max(1, (Number(seats) || 1) - 1)))}
					>
						<RemoveRounded aria-hidden="true" />
					</button>
					<input
						type="number"
						min={1}
						max={100}
						step={1}
						value={seats}
						aria-label={t('Travelers')}
						onChange={(event) => setSeats(event.target.value)}
						inputMode="numeric"
					/>
					<button
						type="button"
						aria-label={t('Increase travelers')}
						disabled={Number(seats) >= 100}
						onClick={() => setSeats(String(Math.min(100, (Number(seats) || 1) + 1)))}
					>
						<AddRounded aria-hidden="true" />
					</button>
				</div>
				<button type="button" className="triplink-traveler-popover__done" onClick={() => setAnchor(null)}>
					{t('Done')}
				</button>
			</Popover>
		</div>
	);
}
