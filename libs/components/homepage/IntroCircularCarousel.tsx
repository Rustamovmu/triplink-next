import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';

const photos = [
	['kyoto', 'Kyoto'], ['seoul', 'Seoul'], ['samarkand', 'Samarkand'],
	['iceland', 'Iceland'], ['sossusvlei', 'Sossusvlei'], ['petra', 'Petra'],
	['patagonia', 'Patagonia'], ['swiss-alps', 'Swiss Alps'], ['santorini', 'Santorini'],
	['cappadocia', 'Cappadocia'], ['dolomites', 'Dolomites'], ['lofoten', 'Lofoten'], ['bali', 'Bali'],
];

// A CSS cylinder interpretation of React Bits' Circular Carousel, using local travel photography.
export function IntroCircularCarousel({ title }: { title: string }) {
	const { t } = useTranslation('common');
	const [position, setPosition] = useState(0);
	const [playing, setPlaying] = useState(true);
	const [reduced, setReduced] = useState(true);
	const [hidden, setHidden] = useState(false);
	const [hovered, setHovered] = useState(false);
	const [focused, setFocused] = useState(false);
	const [dragging, setDragging] = useState(false);
	const press = useRef<{ id: number; x: number; y: number } | null>(null);
	const active = ((position % photos.length) + photos.length) % photos.length;
	const move = (delta: number) => { setPlaying(false); setPosition((value) => value + delta); };
	useEffect(() => {
		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		const motion = () => setReduced(media.matches);
		const visibility = () => setHidden(document.hidden);
		motion(); visibility();
		media.addEventListener('change', motion);
		document.addEventListener('visibilitychange', visibility);
		return () => {
			media.removeEventListener('change', motion);
			document.removeEventListener('visibilitychange', visibility);
		};
	}, []);
	useEffect(() => {
		if (!playing || reduced || hidden || hovered || focused || dragging) return;
		const timer = window.setInterval(() => setPosition((value) => value + 1), 5000);
		return () => window.clearInterval(timer);
	}, [playing, reduced, hidden, hovered, focused, dragging]);
	return (
		<div
			className="triplink-circular-carousel"
			role="region"
			aria-roledescription={t('Carousel')}
			aria-label={t('Photo inspiration for {{section}}', { section: t(title) })}
			onPointerEnter={() => setHovered(true)}
			onPointerLeave={() => setHovered(false)}
			onFocusCapture={() => setFocused(true)}
			onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
		>
			<div
				className="triplink-circular-carousel__stage"
				tabIndex={0}
				role="group"
				aria-label={`${t(photos[active][1])}, ${active + 1} / ${photos.length}`}
				onKeyDown={(event) => {
					if (event.key === 'ArrowRight') move(1);
					else if (event.key === 'ArrowLeft') move(-1);
					else if (event.key === 'Home') move(-active);
					else if (event.key === 'End') move(photos.length - 1 - active);
					else return;
					event.preventDefault();
				}}
				onPointerDown={(event) => {
					if (!event.isPrimary || event.button !== 0) return;
					press.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
					event.currentTarget.setPointerCapture(event.pointerId);
					setDragging(true);
				}}
				onPointerUp={(event) => {
					const start = press.current;
					if (!start || start.id !== event.pointerId) return;
					const dx = event.clientX - start.x;
					if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(event.clientY - start.y)) move(dx < 0 ? 1 : -1);
					press.current = null;
					setDragging(false);
				}}
				onLostPointerCapture={() => { press.current = null; setDragging(false); }}
				onPointerCancel={() => { press.current = null; setDragging(false); }}
			>
				<div className="triplink-circular-carousel__ring" style={{ transform: `translateZ(calc(-1 * var(--carousel-radius))) rotateX(-5deg) rotateY(${-position * 360 / photos.length}deg)` }} aria-hidden="true">
					{photos.map(([file], index) => (
						<div className="triplink-circular-carousel__card" key={file} style={{ transform: `translate(-50%, -50%) rotateY(${index * 360 / photos.length}deg) translateZ(var(--carousel-radius))` }}>
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img src={`/img/homepage/rated-circular/${file}.jpg`} alt="" width={800} height={1000} loading="lazy" decoding="async" draggable={false} />
						</div>
					))}
				</div>
			</div>
			<div className="triplink-circular-carousel__footer">
				<div aria-live={playing ? 'off' : 'polite'} aria-atomic="true">
					<strong>{t(photos[active][1])}</strong>
					<span>{String(active + 1).padStart(2, '0')} / {photos.length}</span>
				</div>
				<div className="triplink-circular-carousel__controls">
					<button type="button" aria-label={t('Previous photo in {{section}}', { section: t(title) })} onClick={() => move(-1)}><ArrowBackRoundedIcon aria-hidden="true" /></button>
					{!reduced && <button type="button" aria-label={t(playing ? 'Pause slideshow' : 'Play slideshow')} onClick={() => setPlaying((value) => !value)}>{playing ? <PauseRoundedIcon aria-hidden="true" /> : <PlayArrowRoundedIcon aria-hidden="true" />}</button>}
					<button type="button" aria-label={t('Next photo in {{section}}', { section: t(title) })} onClick={() => move(1)}><ArrowForwardRoundedIcon aria-hidden="true" /></button>
				</div>
			</div>
		</div>
	);
}
