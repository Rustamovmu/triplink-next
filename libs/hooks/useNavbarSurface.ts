import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const heroSelector = '[data-triplink-nav-hero]';

/** Observe the hero at the bottom of the navbar, rather than an arbitrary scroll distance. */
export default function useNavbarSurface(route: string) {
	const ref = useRef<HTMLElement>(null);
	const [surface, setSurface] = useState<{ route: string; clear: boolean } | null>(null);
	useBrowserLayoutEffect(() => {
		const navbar = ref.current;
		const root = navbar?.closest<HTMLElement>('#pc-wrap, #mobile-wrap');
		if (!navbar || !root) return;
		let hero: Element | null = null;
		let observer: IntersectionObserver | undefined;
		let frame = 0;
		let disposed = false;
		const update = () => {
			if (disposed) return;
			const boundary = navbar.getBoundingClientRect().bottom;
			const rect = hero?.getBoundingClientRect();
			const clear = Boolean(rect && rect.top <= boundary && rect.bottom > boundary);
			setSurface((current) => (current?.route === route && current.clear === clear ? current : { route, clear }));
		};
		const observe = () => {
			if (disposed) return;
			observer?.disconnect();
			hero = root.querySelector(heroSelector);
			const height = navbar.getBoundingClientRect().height;
			root.style.setProperty('--triplink-nav-height', `${height}px`);
			update();
			if (hero && typeof IntersectionObserver !== 'undefined') {
				// A one-pixel viewport strip at the navbar's lower edge crosses the hero boundary once.
				const edge = Math.min(height, window.innerHeight - 1);
				observer = new IntersectionObserver(update, {
					rootMargin: `-${edge}px 0px -${Math.max(0, window.innerHeight - edge - 1)}px 0px`,
					threshold: 0,
				});
				observer.observe(hero);
			}
		};
		observe();
		// Access/loading states may add or remove a hero without changing the route.
		const mutations = new MutationObserver(() => {
			if (root.querySelector(heroSelector) !== hero) observe();
		});
		mutations.observe(root, { childList: true, subtree: true });
		const resize = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(observe) : undefined;
		resize?.observe(navbar);
		window.addEventListener('resize', observe);
		window.addEventListener('pageshow', update);
		const fallbackScroll = () => {
			if (!frame) frame = window.requestAnimationFrame(() => { frame = 0; update(); });
		};
		if (typeof IntersectionObserver === 'undefined') window.addEventListener('scroll', fallbackScroll, { passive: true });
		return () => {
			disposed = true;
			observer?.disconnect();
			mutations.disconnect();
			resize?.disconnect();
			window.cancelAnimationFrame(frame);
			window.removeEventListener('resize', observe);
			window.removeEventListener('pageshow', update);
			window.removeEventListener('scroll', fallbackScroll);
			root.style.removeProperty('--triplink-nav-height');
		};
	}, [route]);
	return { ref, mode: surface?.route === route ? (surface.clear ? 'clear' : 'glass') : 'auto' };
}
