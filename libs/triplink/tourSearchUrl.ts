import { Inquiry, TourSearch, tourCategories, tourDifficulties, tourSorts } from '../types/triplink';

export const invalidTourSearch = 'This search link is invalid. Reset the search and try again.';
type Query = Record<string, string | string[] | undefined>;
const fail = (): never => {
	throw new Error(invalidTourSearch);
};
const object = (value: unknown): Record<string, unknown> =>
	value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : fail();
const number = (value: unknown, min: number, max = Infinity, integer = false): number =>
	typeof value === 'number' &&
	Number.isFinite(value) &&
	value >= min &&
	value <= max &&
	(!integer || Number.isSafeInteger(value))
		? value
		: fail();
const string = (value: unknown, max: number): string =>
	typeof value === 'string' && value.length <= max ? value : fail();
function strings(value: unknown, count: number, length: number, allowed?: readonly string[]): string[] {
	if (!Array.isArray(value) || value.length > count) return fail();
	return value.map((item) => {
		const result = string(item, length);
		if (allowed && !allowed.includes(result)) return fail();
		return result;
	});
}
function range(value: unknown, min: number, max = Infinity, integer = false) {
	const input = object(value);
	const start = number(input.start, min, max, integer),
		end = number(input.end, min, max, integer);
	if (start > end) return fail();
	return { start, end };
}
function instant(value: unknown, requireZone: boolean): string {
	const text = string(value, 100);
	if (!/^\d{4}-\d{2}-\d{2}T/.test(text) || (requireZone && !/(Z|[+-]\d{2}:\d{2})$/i.test(text))) return fail();
	const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/.exec(text);
	if (!parts) return fail();
	const [, year, month, day, hour, minute, second = '0'] = parts;
	const days = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
	if (
		Number(month) < 1 ||
		Number(month) > 12 ||
		Number(day) < 1 ||
		Number(day) > days ||
		Number(hour) > 23 ||
		Number(minute) > 59 ||
		Number(second) > 59
	)
		return fail();
	const date = new Date(text);
	if (!Number.isFinite(date.getTime())) return fail();
	return date.toISOString();
}
/** Copy only DTO fields; never forward arbitrary URL objects to GraphQL. */
export function normalizeTourInquiry(value: unknown): Inquiry<TourSearch> {
	const input = object(value),
		raw = object(input.search ?? {});
	const search: TourSearch = {};
	if (raw.agentId !== undefined) {
		const id = string(raw.agentId, 24);
		if (!/^[a-f0-9]{24}$/i.test(id)) return fail();
		search.agentId = id;
	}
	if (raw.text !== undefined) search.text = string(raw.text, 150);
	if (raw.destinations !== undefined) search.destinations = strings(raw.destinations, 30, 150);
	if (raw.countries !== undefined) search.countries = strings(raw.countries, 30, 100);
	if (raw.cities !== undefined) search.cities = strings(raw.cities, 30, 100);
	if (raw.categories !== undefined)
		search.categories = strings(raw.categories, 20, 100, tourCategories) as TourSearch['categories'];
	if (raw.difficulties !== undefined)
		search.difficulties = strings(raw.difficulties, 10, 100, tourDifficulties) as TourSearch['difficulties'];
	if (raw.priceRange !== undefined) search.priceRange = range(raw.priceRange, 0);
	if (raw.durationRange !== undefined) search.durationRange = range(raw.durationRange, 1, 365, true);
	if (raw.availableDateRange !== undefined) {
		const dates = object(raw.availableDateRange);
		const start = instant(dates.start, true),
			end = instant(dates.end, true);
		if (start > end) return fail();
		search.availableDateRange = { start, end };
	}
	if (raw.minimumAvailableSeats !== undefined)
		search.minimumAvailableSeats = number(raw.minimumAvailableSeats, 1, 2147483647, true);
	if (raw.minimumRating !== undefined) search.minimumRating = number(raw.minimumRating, 0, 5);
	if (raw.featured !== undefined) {
		if (typeof raw.featured !== 'boolean') return fail();
		search.featured = raw.featured;
	}
	const sort = input.sort ?? 'createdAt',
		direction = input.direction ?? 'DESC';
	if (typeof sort !== 'string' || !tourSorts.includes(sort) || (direction !== 'ASC' && direction !== 'DESC'))
		return fail();
	return {
		page: number(input.page ?? 1, 1, 2147483647, true),
		limit: number(input.limit ?? 12, 1, 100, true),
		sort,
		direction,
		search,
	};
}
export function tourSearchQuery(input: Inquiry<TourSearch>): { input: string } {
	return { input: JSON.stringify(normalizeTourInquiry(input)) };
}
export function parseTourSearchQuery(query: Query): Inquiry<TourSearch> {
	if (query.input !== undefined) {
		if (typeof query.input !== 'string') return fail();
		try {
			return normalizeTourInquiry(JSON.parse(query.input));
		} catch {
			return fail();
		}
	}
	const one = (key: string): string => {
		if (query[key] === undefined) return '';
		return typeof query[key] === 'string' ? (query[key] as string) : fail();
	};
	const search: Record<string, unknown> = {};
	for (const [key, field] of [
		['text', 'text'],
		['destination', 'destinations'],
		['category', 'categories'],
		['difficulty', 'difficulties'],
	]) {
		const value = one(key);
		if (value) search[field] = field === 'text' ? value : [value];
	}
	for (const [a, b, field] of [
		['minPrice', 'maxPrice', 'priceRange'],
		['minDays', 'maxDays', 'durationRange'],
	]) {
		if (one(a) || one(b)) {
			if (!one(a) || !one(b)) return fail();
			search[field] = { start: Number(one(a)), end: Number(one(b)) };
		}
	}
	if (one('start') || one('end'))
		search.availableDateRange = { start: instant(one('start'), false), end: instant(one('end'), false) };
	if (one('seats')) search.minimumAvailableSeats = Number(one('seats'));
	if (one('rating')) search.minimumRating = Number(one('rating'));
	return normalizeTourInquiry({
		page: one('page') ? Number(one('page')) : 1,
		limit: one('limit') ? Number(one('limit')) : 12,
		sort: one('sort') || 'createdAt',
		direction: one('direction') || 'DESC',
		search,
	});
}
export function tourSearchFormValues(input: Inquiry<TourSearch>): Record<string, string> {
	const s = input.search;
	return {
		text: s.text ?? '',
		destination: s.destinations?.[0] ?? '',
		category: s.categories?.[0] ?? '',
		difficulty: s.difficulties?.[0] ?? '',
		minPrice: String(s.priceRange?.start ?? ''),
		maxPrice: String(s.priceRange?.end ?? ''),
		minDays: String(s.durationRange?.start ?? ''),
		maxDays: String(s.durationRange?.end ?? ''),
		start: localDateTimeValue(s.availableDateRange?.start ?? ''),
		end: localDateTimeValue(s.availableDateRange?.end ?? ''),
		seats: String(s.minimumAvailableSeats ?? ''),
		rating: String(s.minimumRating ?? ''),
		sort: input.sort ?? 'createdAt',
		direction: input.direction ?? 'DESC',
	};
}
export function applyTourSearchForm(
	input: Inquiry<TourSearch>,
	values: Record<string, string>,
	changed: ReadonlySet<string>,
): Inquiry<TourSearch> {
	const search = { ...input.search };
	for (const [keys, field] of [
		[['text'], 'text'],
		[['destination'], 'destinations'],
		[['category'], 'categories'],
		[['difficulty'], 'difficulties'],
		[['minPrice', 'maxPrice'], 'priceRange'],
		[['minDays', 'maxDays'], 'durationRange'],
		[['start', 'end'], 'availableDateRange'],
		[['seats'], 'minimumAvailableSeats'],
		[['rating'], 'minimumRating'],
	] as [string[], keyof TourSearch][]) {
		if (!keys.some((key) => changed.has(key))) continue;
		const query: Query = {};
		for (const key of keys) query[key] = values[key] ?? '';
		// An untouched endpoint keeps its original instant, including a repeated DST hour.
		if (field === 'availableDateRange' && input.search.availableDateRange) {
			if (!changed.has('start')) query.start = input.search.availableDateRange.start;
			if (!changed.has('end')) query.end = input.search.availableDateRange.end;
		}
		const parsed = parseTourSearchQuery(query).search;
		delete search[field];
		Object.assign(search, parsed);
	}
	return normalizeTourInquiry({ ...input, page: 1, search, sort: values.sort, direction: values.direction });
}

/** Preserve local meaning for both ISO instants and existing datetime-local URLs. */
export function localDateTimeValue(value: string): string {
	if (!value) return '';
	const date = new Date(value);
	if (!Number.isFinite(date.getTime())) return '';
	const pad = (part: number, size = 2) => String(part).padStart(size, '0');
	return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
		date.getHours(),
	)}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}
