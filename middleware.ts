// eslint-disable-next-line @next/next/no-server-import-in-page -- The installed Next 12 lint rule predates root middleware in Next 14.
import { NextRequest, NextResponse } from 'next/server';

/** NEXT_LOCALE is the same preference used by Next's locale routing.
 * Restore it before SSR on a fresh root visit or a provider's fixed callback.
 * Explicit locale URLs always win; assets and API requests never enter here.
 */
export function middleware(request: NextRequest) {
	const preference = request.cookies.get('NEXT_LOCALE')?.value;
	if (request.nextUrl.locale !== 'en' || !preference || !['kr', 'ru', 'uz'].includes(preference))
		return NextResponse.next();
	const url = request.nextUrl.clone();
	url.locale = preference;
	return NextResponse.redirect(url);
}

export const config = { matcher: ['/', '/account/:path*'] };
