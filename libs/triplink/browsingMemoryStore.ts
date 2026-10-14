/** Public browsing metadata only. Apollo remains responsible for query results. */
export const MEMORY_KEY = 'triplink:browsing:v1';
export const ENTRY_KEY = 'triplinkBrowsingEntry';
export const MEMORY_TTL = 30 * 60 * 1000;
export const MEMORY_LIMIT = 50;
export type Anchor = { key: string; offset: number };
export type BrowsingEntry = {
	id: string;
	route: string;
	locale: string;
	time: number;
	x: number;
	y: number;
	width: number;
	height: number;
	item?: Anchor;
	section?: Anchor;
	source?: string;
	previous?: string;
	home?: string;
	ui: Record<string, unknown>;
};
const routes = new Set(['/', '/tour', '/tour/detail', '/agent', '/agent/detail', '/community', '/community/detail']);
export function browsingRoute(url: string, locale = 'en'): { route: string; locale: string; supported: boolean } {
	const parsed = new URL(url, 'http://triplink.local');
	const prefix = parsed.pathname.match(/^\/(en|kr|ru|uz)(?=\/|$)/);
	const pathname = (prefix ? parsed.pathname.slice(prefix[0].length) : parsed.pathname).replace(/\/$/, '') || '/';
	parsed.searchParams.sort();
	return { route: pathname + parsed.search, locale: prefix?.[1] ?? locale, supported: routes.has(pathname) };
}
export const isListing = (route: string) => ['/', '/tour', '/agent', '/community'].includes(route.split('?')[0]);
const identifier = () => `tl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export class NavigationMemory {
	entries = new Map<string, BrowsingEntry>();
	active: BrowsingEntry;
	pending?: BrowsingEntry;
	lastDocumentEntry?: string;
	private listeners = new Set<() => void>();
	constructor(route: string, locale = 'en') {
		this.active = this.create(route, locale);
	}
	create(url: string, locale: string): BrowsingEntry {
		const { route, locale: language } = browsingRoute(url, locale);
		return { id: identifier(), route, locale: language, time: Date.now(), x: 0, y: 0, width: 0, height: 0, ui: {} };
	}
	subscribe = (listener: () => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};
	notify() {
		this.listeners.forEach((listener) => listener());
	}
	get(id?: string): BrowsingEntry | undefined {
		const entry = id ? this.entries.get(id) : undefined;
		return entry && Date.now() - entry.time <= MEMORY_TTL ? entry : undefined;
	}
	forRoute(url: string, locale: string): BrowsingEntry | undefined {
		const key = browsingRoute(url, locale);
		if (!key.supported) return undefined;
		return [this.pending, this.active].find((entry) => entry?.route === key.route && entry.locale === key.locale);
	}
	begin(url: string, locale: string, restore?: BrowsingEntry, pop = false) {
		const previous = this.active;
		const next = pop && restore ? restore : this.create(url, locale);
		// Switching language on this page keeps its controls and scroll anchors.
		if (!restore && previous.route === next.route && previous.locale !== next.locale) {
			Object.assign(next, {
				x: previous.x,
				y: previous.y,
				width: previous.width,
				height: previous.height,
				ui: { ...previous.ui },
				item: previous.item,
				section: previous.section,
			});
		}
		if (restore && !pop) Object.assign(next, restore, { id: next.id, ui: { ...restore.ui } });
		if (!pop) {
			next.previous = previous.id;
			const supported = browsingRoute(url, locale).supported && browsingRoute(previous.route).supported;
			if (supported && next.locale === previous.locale) {
				next.home = previous.route.split('?')[0] === '/' ? previous.id : previous.home;
				next.source = isListing(previous.route) ? previous.id : previous.source;
			}
		}
		this.pending = next;
		return next;
	}
	commit() {
		if (this.pending) this.active = this.pending;
		this.pending = undefined;
		this.active.time = Date.now();
		this.entries.set(this.active.id, this.active);
		this.prune();
	}
	prune() {
		const valid = Array.from(this.entries.values())
			.filter((entry) => browsingRoute(entry.route).supported && Date.now() - entry.time <= MEMORY_TTL)
			.sort((a, b) => b.time - a.time)
			.slice(0, MEMORY_LIMIT);
		this.entries = new Map(valid.map((entry) => [entry.id, entry]));
	}
	persist(storage: Pick<Storage, 'setItem'>) {
		this.prune();
		try {
			storage.setItem(
				MEMORY_KEY,
				JSON.stringify({ version: 1, active: this.active.id, entries: Array.from(this.entries.values()) }),
			);
		} catch {
			/* In-memory navigation works without storage. */
		}
	}
	load(storage: Pick<Storage, 'getItem'>) {
		try {
			const raw = storage.getItem(MEMORY_KEY);
			if (!raw || raw.length > 500_000) return;
			const data = JSON.parse(raw);
			if (data.version !== 1 || !Array.isArray(data.entries)) return;
			for (const entry of data.entries.slice(0, MEMORY_LIMIT)) if (validEntry(entry)) this.entries.set(entry.id, entry);
			this.prune();
			this.lastDocumentEntry = typeof data.active === 'string' ? data.active : undefined;
		} catch {
			/* Corrupt or blocked storage is a fresh browsing session. */
		}
	}
}
function validEntry(entry: BrowsingEntry): boolean {
	if (
		!entry ||
		typeof entry.id !== 'string' ||
		!/^tl-[\w-]{1,100}$/.test(entry.id) ||
		typeof entry.route !== 'string' ||
		entry.route.length > 8000 ||
		!entry.route.startsWith('/') ||
		entry.route.startsWith('//')
	)
		return false;
	if (!browsingRoute(entry.route).supported || !['en', 'kr', 'ru', 'uz'].includes(entry.locale)) return false;
	if (
		![entry.time, entry.x, entry.y, entry.width, entry.height].every((value) => Number.isFinite(value) && value >= 0) ||
		entry.time > Date.now() + 1000
	)
		return false;
	if (!entry.ui || Array.isArray(entry.ui) || typeof entry.ui !== 'object' || JSON.stringify(entry.ui).length > 16_000)
		return false;
	if (Object.keys(entry.ui).some((key) => !/^(home|agents|community|gallery):[\w:.-]{1,200}$/.test(key))) return false;
	if (
		Object.values(entry.ui).some(
			(value) =>
				!['string', 'number', 'boolean'].includes(typeof value) ||
				(typeof value === 'number' && !Number.isFinite(value)),
		)
	)
		return false;
	for (const anchor of [entry.item, entry.section])
		if (anchor && (typeof anchor.key !== 'string' || anchor.key.length > 200 || !Number.isFinite(anchor.offset)))
			return false;
	for (const reference of [entry.source, entry.previous, entry.home])
		if (reference && (typeof reference !== 'string' || !/^tl-[\w-]{1,100}$/.test(reference))) return false;
	return true;
}

export function capturePosition(entry: BrowsingEntry, root: HTMLElement | null, source?: Element | null) {
	entry.time = Date.now();
	entry.x = window.scrollX;
	entry.y = window.scrollY;
	entry.width = window.innerWidth;
	entry.height = window.innerHeight;
	const navbar = document.querySelector('.triplink-top');
	const top = navbar?.getBoundingClientRect().bottom ?? 0;
	const visible = (node: Element) => {
		const rect = node.getBoundingClientRect();
		return rect.bottom > top && rect.top < window.innerHeight;
	};
	const items = Array.from(root?.querySelectorAll('[data-browse-item]') ?? []);
	const previousItem = items.find((node) => node.getAttribute('data-browse-item') === entry.item?.key && visible(node));
	const fullyVisible = items.find((node) => visible(node) && node.getBoundingClientRect().top >= top);
	const interaction = source && root?.contains(source) ? source : undefined;
	const sourceSection = interaction?.closest('[data-browse-section]');
	// A section's own link must not inherit a card from the preceding section.
	const item =
		interaction?.closest('[data-browse-item]') ??
		(sourceSection ? undefined : previousItem ?? fullyVisible ?? items.find(visible));
	const section =
		sourceSection ??
		item?.closest('[data-browse-section]') ??
		Array.from(root?.querySelectorAll('[data-browse-section]') ?? []).find(visible);
	const anchor = (node: Element | undefined | null, attribute: string): Anchor | undefined =>
		node ? { key: node.getAttribute(attribute)!, offset: node.getBoundingClientRect().top } : undefined;
	entry.item = anchor(item, 'data-browse-item');
	entry.section = anchor(section, 'data-browse-section');
}

/** A bounded, event-driven correction; never polls for missing content. */
export function restorePosition(entry: BrowsingEntry, root: HTMLElement, done: () => void): () => void {
	let stopped = false,
		frame = 0,
		settle = 0;
	const previousMode = window.history.scrollRestoration;
	window.history.scrollRestoration = 'manual';
	const html = document.documentElement;
	const previousBehavior = html.style.scrollBehavior;
	html.style.scrollBehavior = 'auto';
	const find = (attribute: string, anchor?: Anchor) =>
		anchor
			? Array.from(root.querySelectorAll<HTMLElement>(`[${attribute}]`)).find(
					(node) => node.getAttribute(attribute) === anchor.key,
			  )
			: undefined;
	const cleanup = () => {
		if (stopped) return;
		stopped = true;
		window.cancelAnimationFrame(frame);
		window.clearTimeout(settle);
		window.clearTimeout(timeout);
		mutations.disconnect();
		resize?.disconnect();
		root.removeEventListener('load', schedule, true);
		window.removeEventListener('resize', schedule);
		for (const name of ['wheel', 'touchstart', 'pointerdown']) window.removeEventListener(name, cleanup, true);
		window.removeEventListener('keydown', keydown, true);
		window.history.scrollRestoration = previousMode;
		html.style.scrollBehavior = previousBehavior;
		done();
	};
	const keydown = (event: KeyboardEvent) => {
		if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Escape', 'Tab'].includes(event.key))
			cleanup();
	};
	const attempt = (final = false) => {
		frame = 0;
		if (stopped || !root.isConnected) return;
		window.clearTimeout(settle);
		const section = find('data-browse-section', entry.section);
		const candidate = find('data-browse-item', entry.item);
		const item = candidate && (!entry.section || section?.contains(candidate)) ? candidate : undefined;
		const target = item ?? section;
		const pending = Array.from(root.querySelectorAll('[data-browse-pending="true"]')).some(
			(node) =>
				!target ||
				target.contains(node) ||
				Boolean(node.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING),
		);
		const offset = item ? entry.item!.offset : entry.section?.offset ?? 0;
		const navbarHeight = document.querySelector('.triplink-top')?.getBoundingClientRect().height ?? 0;
		const resized =
			entry.width > 0 &&
			(Math.abs(entry.width - window.innerWidth) > 100 || entry.width < 768 !== window.innerWidth < 768);
		const safeOffset =
			(!item && entry.item) || resized
				? Math.max(navbarHeight + 12, Math.min(offset, window.innerHeight - 80))
				: offset;
		const validPixels = Number.isFinite(entry.y) && entry.y >= 0 && !resized;
		// Use the same priority for readiness corrections and the bounded deadline.
		const requested = item
			? window.scrollY + item.getBoundingClientRect().top - safeOffset
			: validPixels
			? entry.y
			: section
			? window.scrollY + section.getBoundingClientRect().top - safeOffset
			: undefined;
		const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
		// Wait for the originating section and all loading content above it.
		if (pending && !final) return;
		if (requested === undefined) {
			cleanup();
			return;
		}
		window.scrollTo({
			left: Math.min(entry.x, Math.max(0, html.scrollWidth - window.innerWidth)),
			top: Math.max(0, Math.min(requested, max)),
			behavior: 'auto',
		});
		if (!final && !pending && document.fonts?.status !== 'loading' && (item || section || requested <= max))
			settle = window.setTimeout(cleanup, 150);
	};
	function schedule() {
		if (!stopped && !frame) frame = window.requestAnimationFrame(() => attempt());
	}
	const mutations = new MutationObserver(schedule);
	mutations.observe(root, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ['data-browse-pending'],
	});
	const resize = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : undefined;
	resize?.observe(root);
	root.addEventListener('load', schedule, true);
	window.addEventListener('resize', schedule);
	for (const name of ['wheel', 'touchstart', 'pointerdown'])
		window.addEventListener(name, cleanup, { passive: true, capture: true });
	window.addEventListener('keydown', keydown, true);
	void document.fonts?.ready.then(schedule);
	const timeout = window.setTimeout(() => {
		if (!stopped) {
			attempt(true);
			cleanup();
		}
	}, 5000);
	attempt();
	return cleanup;
}
