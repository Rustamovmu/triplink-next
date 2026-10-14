/** Route codes are stable; Korean's inherited `kr` maps to BCP 47 `ko`. */
export const regionalLocale = (locale?: string): string =>
	(({ en: 'en-US', kr: 'ko-KR', ru: 'ru-RU', uz: 'uz-UZ' } as Record<string, string>)[locale?.split('-')[0] || 'en'] ||
	'en-US');

export function formatDate(iso?: string | null, locale?: string): string {
	if (!iso || Number.isNaN(Date.parse(iso))) return '—';
	return new Intl.DateTimeFormat(regionalLocale(locale), { dateStyle: 'medium', timeStyle: 'short' }).format(
		new Date(iso),
	);
}

export function formatCurrency(value: number, locale: string | undefined, currency: string): string {
	return new Intl.NumberFormat(regionalLocale(locale), { style: 'currency', currency }).format(value);
}
