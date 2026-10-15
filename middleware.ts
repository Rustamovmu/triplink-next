// eslint-disable-next-line @next/next/no-server-import-in-page -- The installed Next 12 lint rule predates root middleware in Next 14.
import { NextRequest, NextResponse } from 'next/server';

/** NEXT_LOCALE is the same preference used by Next's locale routing.
 * Restore it before SSR on a fresh root visit or a provider's fixed callback.
 * Explicit locale URLs always win; assets and API requests never enter here.
 */
export function middleware(request: NextRequest) {
	// Keep old localized links usable after removing Russian from Next's locales.
	if (/^\/ru(?:\/|$)/.test(request.nextUrl.pathname)) {
		const url = request.nextUrl.clone();
		url.pathname = url.pathname.replace(/^\/ru(?=\/|$)/, '') || '/';
		url.locale = 'en';
		const response = NextResponse.redirect(url);
		response.cookies.set('NEXT_LOCALE', 'en', { path: '/', maxAge: 31536000, sameSite: 'lax' });
		return response;
	}
	const preference = request.cookies.get('NEXT_LOCALE')?.value;
	if (preference === 'ru') {
		const response = NextResponse.next();
		response.cookies.set('NEXT_LOCALE', 'en', { path: '/', maxAge: 31536000, sameSite: 'lax' });
		return response;
	}
	if (request.nextUrl.locale !== 'en' || !preference || !['kr', 'uz'].includes(preference))
		return NextResponse.next();
	const url = request.nextUrl.clone();
	url.locale = preference;
	return NextResponse.redirect(url);
}

export const config = { matcher: ['/', '/account/:path*', '/ru/:path*'] };
