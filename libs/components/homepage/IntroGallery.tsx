import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';

const photos = [
	{ destination: 'Iceland', file: 'iceland' },
	{ destination: 'Sossusvlei', file: 'sossusvlei' },
	{ destination: 'Petra', file: 'petra' },
	{ destination: 'Patagonia', file: 'patagonia' },
	{ destination: 'Swiss Alps', file: 'swiss-alps' },
	{ destination: 'Santorini', file: 'santorini' },
	{ destination: 'Cappadocia', file: 'cappadocia' },
	{ destination: 'Dolomites', file: 'dolomites' },
	{ destination: 'Lofoten', file: 'lofoten' },
	{ destination: 'Bali', file: 'bali' },
];
const groupSize = 4;

export function IntroGallery({ title }: { title: string }) {
	const { t } = useTranslation('common');
	const [active, setActive] = useState(0);
	const [playing, setPlaying] = useState(true);
	const [reduced, setReduced] = useState(true);
	const [hidden, setHidden] = useState(false);
	const [hovered, setHovered] = useState(false);
	const [focused, setFocused] = useState(false);
	const panels = useRef<Array<HTMLButtonElement | null>>([]);
	const pendingFocus = useRef<number | null>(null);
	const groupStart = Math.floor(active / groupSize) * groupSize;
	useEffect(() => {
		if (pendingFocus.current === null) return;
		panels.current[pendingFocus.current]?.focus();
		pendingFocus.current = null;
	}, [active]);
	useEffect(() => {
		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		const update = () => setReduced(media.matches);
		const visibility = () => setHidden(document.hidden);
		update();
		visibility();
		media.addEventListener('change', update);
		document.addEventListener('visibilitychange', visibility);
		return () => {
			media.removeEventListener('change', update);
			document.removeEventListener('visibilitychange', visibility);
		};
	}, []);
	useEffect(() => {
		if (!playing || reduced || hidden || hovered || focused) return;
		const timer = window.setInterval(() => setActive((index) => (index + 1) % photos.length), 5000);
		return () => window.clearInterval(timer);
	}, [playing, reduced, hidden, hovered, focused]);
	return (
		<div
			className="triplink-intro-gallery"
			role="region"
			aria-roledescription={t('Carousel')}
			aria-label={t('Photo inspiration for {{section}}', { section: t(title) })}
			onPointerEnter={() => setHovered(true)}
			onPointerLeave={() => setHovered(false)}
			onFocusCapture={() => setFocused(true)}
			onBlurCapture={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
			}}
		>
			<div className="triplink-intro-gallery__panels">
				{photos.slice(groupStart, groupStart + groupSize).map((photo, offset) => {
					const index = groupStart + offset;
					return (
						<button
							key={photo.file}
							ref={(element) => { panels.current[index] = element; }}
							type="button"
							className={`triplink-intro-gallery__panel${active === index ? ' is-active' : ''}`}
							aria-label={t(photo.destination)}
							aria-pressed={active === index}
							onPointerEnter={(event) => {
								if (event.pointerType !== 'touch') setActive(index);
							}}
							onFocus={() => setActive(index)}
							onClick={() => { setActive(index); setPlaying(false); }}
							onKeyDown={(event) => {
								let next: number;
								if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % photos.length;
								else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + photos.length - 1) % photos.length;
								else if (event.key === 'Home') next = 0;
								else if (event.key === 'End') next = photos.length - 1;
								else return;
								event.preventDefault();
								pendingFocus.current = next;
								setActive(next);
								if (next === active) panels.current[next]?.focus();
							}}
						>
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img src={`/img/homepage/featured/${photo.file}.jpg`} alt="" width={800} height={500} loading="lazy" decoding="async" draggable={false} />
							<span className="triplink-intro-gallery__caption" aria-hidden="true">{t(photo.destination)}</span>
						</button>
					);
				})}
			</div>
			<div className="triplink-intro-gallery__footer">
				<span aria-hidden="true">{String(active + 1).padStart(2, '0')} / {photos.length}</span>
				<div className="triplink-intro-gallery__navigation">
					<button type="button" aria-label={t('Previous photo in {{section}}', { section: t(title) })} onClick={() => { setPlaying(false); setActive((index) => (index + photos.length - 1) % photos.length); }}>
						<ArrowBackRoundedIcon aria-hidden="true" />
					</button>
					{!reduced && (
						<button type="button" aria-label={t(playing ? 'Pause slideshow' : 'Play slideshow')} onClick={() => setPlaying((value) => !value)}>
							{playing ? <PauseRoundedIcon aria-hidden="true" /> : <PlayArrowRoundedIcon aria-hidden="true" />}
						</button>
					)}
					<button type="button" aria-label={t('Next photo in {{section}}', { section: t(title) })} onClick={() => { setPlaying(false); setActive((index) => (index + 1) % photos.length); }}>
						<ArrowForwardRoundedIcon aria-hidden="true" />
					</button>
				</div>
			</div>
		</div>
	);
}
