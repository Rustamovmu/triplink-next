export function safeReturnUrl(value: unknown): string {
	return typeof value === 'string' &&
		value.startsWith('/') &&
		!value.startsWith('//') &&
		!value.includes('\\') &&
		!/[\r\n]/.test(value)
		? value
		: '/';
}
