import React, { useEffect, useRef, useState } from 'react';

// Illustrative routes on the local equirectangular map, unrelated to agent coverage.
const routes = [
	'M 53 21.651 Q 69 8.651 85 23.383',
	'M 85 23.383 Q 119 10.383 153 23.383',
	'M 153 23.383 Q 163 15.383 173 64.952',
];
const endpoints = [
	[53, 21.651],
	[85, 23.383],
	[153, 23.383],
	[173, 64.952],
];

export function AgentsAtlas() {
	const artwork = useRef<HTMLDivElement>(null);
	const played = useRef(false);
	const [animate, setAnimate] = useState(false);

	useEffect(() => {
		const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
		let observer: IntersectionObserver | undefined;
		let active = true;
		const update = () => {
			observer?.disconnect();
			if (preference.matches) {
				setAnimate(false);
				return;
			}
			if (played.current || !artwork.current || !('IntersectionObserver' in window)) return;
			observer = new window.IntersectionObserver(
				(entries) => {
					if (!active || played.current || preference.matches || !entries.some((entry) => entry.isIntersecting)) return;
					played.current = true;
					setAnimate(true);
					observer?.disconnect();
				},
				{ threshold: 0.2 },
			);
			observer.observe(artwork.current);
		};
		update();
		preference.addEventListener('change', update);
		return () => {
			active = false;
			observer?.disconnect();
			preference.removeEventListener('change', update);
		};
	}, []);

	return (
		<div ref={artwork} className={`triplink-agents-atlas${animate ? ' is-animated' : ''}`} aria-hidden="true">
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img src="/img/homepage/agents-atlas/world.svg" alt="" width={895} height={360} loading="lazy" decoding="async" />
			<svg viewBox="0 0 179 72" focusable="false">
				{routes.map((route) => (
					<path key={route} className="triplink-agents-atlas__route" d={route} pathLength={1} />
				))}
				{endpoints.map(([x, y]) => (
					<circle key={`${x}-${y}`} className="triplink-agents-atlas__endpoint" cx={x} cy={y} r={1.05} />
				))}
			</svg>
		</div>
	);
}
