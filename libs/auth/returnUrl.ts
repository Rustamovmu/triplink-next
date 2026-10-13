export function safeReturnUrl(value: unknown): string {
	if (typeof value !== 'string' || value.length > 2000 || !value.startsWith('/') || value.startsWith('//')) return '/';
	try {
		const decoded = decodeURIComponent(value);
		if (
			decoded.startsWith('//') ||
			decoded.includes('\\') ||
			Array.from(decoded).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) ||
			/^\/(?:account|auth|api)(?:\/|\?|$)/i.test(decoded)
		)
			return '/';
		return new URL(value, 'https://triplink.invalid').origin === 'https://triplink.invalid' ? value : '/';
	} catch {
		return '/';
	}
}
