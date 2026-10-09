import { parseTourSearchQuery, tourSearchQuery } from './tourSearchUrl';

function calendarDate(value: string): Date {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Choose valid departure dates.');
	const [year, month, day] = value.split('-').map(Number);
	const date = new Date(year, month - 1, day);
	if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day)
		throw new Error('Choose valid departure dates.');
	return date;
}
export function buildHomeSearch(values: {
	text: string;
	start: string;
	end: string;
	seats: string;
}): Record<string, string> {
	const query: Record<string, string> = { page: '1' };
	const text = values.text.trim();
	if (text.length > 150) throw new Error('Search must be 150 characters or fewer.');
	if (text) query.text = text;
	const seats = Number(values.seats);
	if (!Number.isInteger(seats) || seats < 1 || seats > 100) throw new Error('Choose between 1 and 100 travelers.');
	query.seats = String(seats);
	if (Boolean(values.start) !== Boolean(values.end)) throw new Error('Choose both departure dates.');
	if (values.start && values.end) {
		const start = calendarDate(values.start),
			end = calendarDate(values.end);
		if (end < start) throw new Error('The end date must not be before the start date.');
		end.setHours(23, 59, 59, 999);
		query.start = start.toISOString();
		query.end = end.toISOString();
	}
	return tourSearchQuery(parseTourSearchQuery(query));
}
export { localDateTimeValue } from './tourSearchUrl';
