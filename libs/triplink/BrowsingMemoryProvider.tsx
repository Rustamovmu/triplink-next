import React, {
	createContext,
	useContext,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import {
	BrowsingEntry,
	ENTRY_KEY,
	NavigationMemory,
	browsingRoute,
	capturePosition,
	restorePosition,
} from './browsingMemoryStore';

export const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
type NavigationContext = {
	memory: NavigationMemory;
	route: string;
	locale: string;
	pathname: string;
	returnTo: (entry: BrowsingEntry, back: boolean) => void;
	cancel: () => void;
};
const Context = createContext<NavigationContext | null>(null);
export function NavigationMemoryProvider({ children }: { children: React.ReactNode }) {
	const router = useRouter();
	const routerRef = useRef(router);
	routerRef.current = router;
	const [memory] = useState(() => new NavigationMemory(router.asPath, router.locale));
	const root = useRef<HTMLDivElement>(null);
	const correction = useRef<(() => void) | undefined>();
	const intent = useRef<BrowsingEntry>();
	const pop = useRef<{ entry?: BrowsingEntry; id?: string; locale?: string }>();
	const restore = useRef<BrowsingEntry>();
	const clicked = useRef<Element | null>(null);
	const savedMode = useRef<ScrollRestoration>();
	const interruption = useRef<() => void>();
	const interruptionKey = useRef<(event: KeyboardEvent) => void>();
	const release = () => {
		if (interruption.current)
			for (const name of ['wheel', 'touchstart', 'pointerdown'])
				window.removeEventListener(name, interruption.current, true);
		if (interruptionKey.current) window.removeEventListener('keydown', interruptionKey.current, true);
		interruption.current = undefined;
		interruptionKey.current = undefined;
		if (savedMode.current !== undefined) window.history.scrollRestoration = savedMode.current;
		savedMode.current = undefined;
	};
	const cancel = () => {
		correction.current?.();
		correction.current = undefined;
		restore.current = undefined;
		release();
	};
	const ownScroll = () => {
		if (savedMode.current === undefined) {
			savedMode.current = window.history.scrollRestoration;
			interruption.current = cancel;
			interruptionKey.current = (event) => {
				if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Escape', 'Tab'].includes(event.key))
					cancel();
			};
			for (const name of ['wheel', 'touchstart', 'pointerdown'])
				window.addEventListener(name, cancel, { passive: true, capture: true });
			window.addEventListener('keydown', interruptionKey.current, true);
		}
		window.history.scrollRestoration = 'manual';
	};
	const stamp = () => {
		// Next.js owns its history fields; add only our entry identity.
		if (window.history.state)
			window.history.replaceState({ ...window.history.state, [ENTRY_KEY]: memory.active.id }, '');
	};
	const save = () => {
		if (!memory.pending && !restore.current && browsingRoute(memory.active.route).supported) {
			capturePosition(memory.active, root.current, clicked.current);
			memory.entries.set(memory.active.id, memory.active);
		}
		try {
			memory.persist(window.sessionStorage);
		} catch {
			/* Storage access itself can be denied. */
		}
	};
	useBrowserLayoutEffect(() => {
		if (!router.isReady) return;
		const initialRoute = browsingRoute(router.asPath, router.locale);
		memory.active.route = initialRoute.route;
		memory.active.locale = initialRoute.locale;
		try {
			memory.load(window.sessionStorage);
		} catch {
			/* Storage is optional. */
		}
		const type = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
		const reloaded =
			type?.type === 'reload' ? memory.get(window.history.state?.[ENTRY_KEY] ?? memory.lastDocumentEntry) : undefined;
		if (
			reloaded &&
			memory.forRoute(router.asPath, router.locale ?? 'en')?.route === reloaded.route &&
			reloaded.locale === router.locale
		) {
			Object.assign(memory.active, reloaded);
			memory.notify();
		}
		stamp();
		memory.entries.set(memory.active.id, memory.active);
		const start = (url: string) => {
			const returning = intent.current ?? pop.current?.entry;
			cancel();
			save();
			const destination = browsingRoute(url, pop.current?.locale ?? routerRef.current.locale);
			const eligible =
				returning && returning.route === destination.route && returning.locale === destination.locale
					? returning
					: undefined;
			memory.begin(url, destination.locale, eligible, Boolean(pop.current));
			if (pop.current?.id && !eligible) memory.pending!.id = pop.current.id;
			restore.current = eligible;
			if (eligible) ownScroll();
			intent.current = undefined;
			pop.current = undefined;
			clicked.current = null;
		};
		const complete = (url: string) => {
			if (memory.pending && memory.pending.route !== browsingRoute(url, routerRef.current.locale).route) return;
			memory.commit();
			stamp();
		};
		const failed = (_error: unknown, url: string) => {
			if (memory.pending && memory.pending.route !== browsingRoute(url, routerRef.current.locale).route) return;
			cancel();
			intent.current = undefined;
			pop.current = undefined;
			memory.pending = undefined;
		};
		router.beforePopState((state) => {
			const id = window.history.state?.[ENTRY_KEY];
			const entry = memory.get(id);
			pop.current = {
				id,
				entry,
				locale: typeof state.options.locale === 'string' ? state.options.locale : entry?.locale,
			};
			if (entry && !state.as.includes('#')) {
				state.options.scroll = false;
				ownScroll();
			} else pop.current.entry = undefined;
			return true;
		});
		const hashStart = () => {
			cancel();
			save();
		};
		const hashComplete = () => {
			// A hash entry has a separate history identity, but keeps the page controls.
			const next = memory.create(routerRef.current.asPath, routerRef.current.locale ?? 'en');
			Object.assign(next, memory.active, { id: next.id, previous: memory.active.id, ui: { ...memory.active.ui } });
			memory.active = next;
			stamp();
			save();
		};
		const hidden = () => {
			if (document.hidden) save();
		};
		const pagehide = () => {
			save();
			cancel();
		};
		const pageshow = (event: PageTransitionEvent) => {
			if (event.persisted) {
				cancel();
				pop.current = undefined;
				intent.current = undefined;
			}
		};
		router.events.on('routeChangeStart', start);
		router.events.on('routeChangeComplete', complete);
		router.events.on('routeChangeError', failed);
		router.events.on('hashChangeStart', hashStart);
		router.events.on('hashChangeComplete', hashComplete);
		document.addEventListener('visibilitychange', hidden);
		window.addEventListener('pagehide', pagehide);
		window.addEventListener('pageshow', pageshow);
		return () => {
			cancel();
			router.beforePopState(() => true);
			router.events.off('routeChangeStart', start);
			router.events.off('routeChangeComplete', complete);
			router.events.off('routeChangeError', failed);
			router.events.off('hashChangeStart', hashStart);
			router.events.off('hashChangeComplete', hashComplete);
			document.removeEventListener('visibilitychange', hidden);
			window.removeEventListener('pagehide', pagehide);
			window.removeEventListener('pageshow', pageshow);
		};
		// Keep subscriptions stable and read current routing fields through routerRef.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [router.isReady, memory]);
	useBrowserLayoutEffect(() => {
		if (!restore.current || !root.current) return;
		const entry = restore.current;
		correction.current = restorePosition(entry, root.current, () => {
			restore.current = undefined;
			correction.current = undefined;
			release();
		});
		return () => {
			correction.current?.();
			correction.current = undefined;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [router.asPath, router.locale]);
	const returnTo = (entry: BrowsingEntry, back: boolean) => {
		intent.current = entry;
		if (back) router.back();
		else
			void router.push(entry.route, undefined, { locale: entry.locale, scroll: false }).catch(() => {
				if (intent.current !== entry && restore.current !== entry) return;
				intent.current = undefined;
				cancel();
			});
	};
	return (
		<Context.Provider
			value={{
				memory,
				returnTo,
				cancel,
				route: router.asPath,
				locale: router.locale ?? 'en',
				pathname: router.pathname,
			}}
		>
			<div
				ref={root}
				data-browse-root
				onClickCapture={(event) => {
					const anchor = (event.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
					if (
						!anchor ||
						!ordinaryClick(event) ||
						anchor.target === '_blank' ||
						anchor.origin !== window.location.origin
					)
						return;
					clicked.current = anchor;
				}}
			>
				{children}
			</div>
		</Context.Provider>
	);
}

/** Primitive/small JSON state, keyed by the particular page visit, never by account. */
export function useRememberedState<T>(
	key: string,
	initial: T,
	enabled = true,
): [T, React.Dispatch<React.SetStateAction<T>>] {
	const context = useContext(Context);
	const record = enabled && context ? context.memory.forRoute(context.route, context.locale) : undefined;
	const [local, setLocal] = useState(initial);
	const fallback = useRef(initial);
	const read = useCallback(
		() =>
			record && Object.prototype.hasOwnProperty.call(record.ui, key) && typeof record.ui[key] === typeof initial
				? (record.ui[key] as T)
				: local,
		[record, key, initial, local],
	);
	const subscribe = context?.memory.subscribe ?? (() => () => {});
	const value = useSyncExternalStore(subscribe, read, () => fallback.current);
	const memory = context?.memory;
	const setValue: React.Dispatch<React.SetStateAction<T>> = useCallback(
		(next) => {
			const resolved = typeof next === 'function' ? (next as (value: T) => T)(read()) : next;
			if (Object.is(resolved, read())) return;
			if (record) {
				record.ui[key] = resolved;
				memory!.notify();
			} else setLocal(resolved);
		},
		[record, memory, key, read],
	);
	return [value, setValue];
}
function ordinaryClick(event: React.MouseEvent) {
	return (
		!event.defaultPrevented &&
		event.button === 0 &&
		!event.metaKey &&
		!event.ctrlKey &&
		!event.shiftKey &&
		!event.altKey
	);
}

/** Home and logo share one navigation intent; native modified clicks still work. */
export function useHomeNavigation() {
	const context = useContext(Context);
	return (event: React.MouseEvent<HTMLAnchorElement>) => {
		if (!ordinaryClick(event) || !context) return;
		if (context.pathname === '/') {
			event.preventDefault();
			context.cancel();
			window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
			capturePosition(context.memory.active, document.querySelector('[data-browse-root]'));
			return;
		}
		const current = context.memory.forRoute(context.route, context.locale);
		const home = context.memory.get(current?.home);
		if (home && home.locale === context.locale) {
			event.preventDefault();
			context.returnTo(home, false);
		}
	};
}
export function BrowsingBackLink({
	fallback,
	className,
	children,
}: {
	fallback: string;
	className?: string;
	children: React.ReactNode;
}) {
	const context = useContext(Context);
	const current = context?.memory.forRoute(context.route, context.locale);
	const source = context?.memory.get(current?.source);
	return (
		<Link
			href={source?.route ?? fallback}
			locale={source?.locale}
			className={className}
			onClick={(event) => {
				if (!ordinaryClick(event) || !source || !context) return;
				event.preventDefault();
				context.returnTo(source, current?.previous === source.id);
			}}
		>
			{source?.route.split('?')[0] === '/' ? <BackHomeLabel /> : children}
		</Link>
	);
}
// Kept separate so return labels use the existing localization system.
function BackHomeLabel() {
	const { t } = useTranslation('common');
	return <>{t('Back to home')}</>;
}
