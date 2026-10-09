import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Alert } from '@mui/material';
import { useTranslation } from 'next-i18next';
import { buildHomeSearch } from '../../triplink/homeSearch';
import { homeDestinations } from './homeContent';

export default function HeaderFilter() {
	const router = useRouter();
	const { t } = useTranslation('common');
	const [index, setIndex] = useState(0),
		[playing, setPlaying] = useState(true);
	const [reduced, setReduced] = useState(true),
		[hovered, setHovered] = useState(false);
	const [focused, setFocused] = useState(false),
		[hidden, setHidden] = useState(false),
		[error, setError] = useState('');
	const touch = useRef<{ x: number; y: number } | null>(null);
	const change = (offset: number) =>
		setIndex((current) => (current + offset + homeDestinations.length) % homeDestinations.length);
	useEffect(() => {
		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		const update = () => setReduced(media.matches),
			visibility = () => setHidden(document.hidden);
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
		if (!playing || reduced || hovered || focused || hidden) return;
		const timer = window.setInterval(() => change(1), 6000);
		return () => window.clearInterval(timer);
	}, [playing, reduced, hovered, focused, hidden, index]);
	const submit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		try {
			const query = buildHomeSearch({
				text: String(data.get('text') ?? ''),
				start: String(data.get('start') ?? ''),
				end: String(data.get('end') ?? ''),
				seats: String(data.get('seats') ?? '1'),
			});
			setError('');
			void router.push({ pathname: '/tour', query });
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Choose valid departure dates.');
		}
	};
	return (
		<div className="triplink-home-intro">
			<section
				className="triplink-hero"
				aria-label={t('Destination inspiration')}
				aria-roledescription={t('Carousel')}
				onPointerEnter={(event) => {
					if (event.pointerType !== 'touch') setHovered(true);
				}}
				onPointerLeave={() => setHovered(false)}
				onFocusCapture={() => setFocused(true)}
				onBlurCapture={(event) => {
					if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
				}}
				onTouchStart={(event) => {
					const point = event.touches[0];
					touch.current = { x: point.clientX, y: point.clientY };
				}}
				onTouchEnd={(event) => {
					const point = event.changedTouches[0];
					if (touch.current) {
						const dx = point.clientX - touch.current.x,
							dy = point.clientY - touch.current.y;
						if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) change(dx < 0 ? 1 : -1);
					}
					touch.current = null;
				}}
				onTouchCancel={() => {
					touch.current = null;
				}}
			>
				{homeDestinations.map((slide, slideIndex) => {
					const active = index === slideIndex;
					const Heading = active ? 'h1' : 'h2';
					return (
						<div
							key={slide.image}
							className={`triplink-hero__slide${active ? ' is-active' : ''}`}
							aria-hidden={!active}
						>
							<img
								className="triplink-hero__image"
								src={`/img/homepage/${slide.image}.jpg`}
								alt=""
								onError={(event) => {
									event.currentTarget.style.visibility = 'hidden';
								}}
							/>
							<div className="triplink-hero__content">
								<span className="triplink-hero__eyebrow">
									{t('Destination spotlight')} · {t(slide.name)}
								</span>
								<Heading>{t(slide.title)}</Heading>
								<p>{t(slide.description)}</p>
								<div className="triplink-hero__actions">
									<Link
										href={{ pathname: '/tour', query: { text: slide.name } }}
										className="triplink-action triplink-action--coral"
										tabIndex={active ? 0 : -1}
									>
										{t('Explore {{destination}} tours', { destination: t(slide.name) })}{' '}
										<span aria-hidden="true">↗</span>
									</Link>
									<Link href="/tour" className="triplink-action triplink-action--glass" tabIndex={active ? 0 : -1}>
										{t('Browse all tours')} <span aria-hidden="true">→</span>
									</Link>
								</div>
							</div>
						</div>
					);
				})}
				<div className="triplink-hero__controls">
					<div className="triplink-hero__dots">
						{homeDestinations.map((slide, slideIndex) => (
							<button
								key={slide.image}
								type="button"
								aria-label={t('Show {{destination}} slide', { destination: t(slide.name) })}
								aria-pressed={index === slideIndex}
								onClick={() => setIndex(slideIndex)}
							/>
						))}
					</div>
					<div className="triplink-hero__navigation">
						<span className="triplink-hero__counter">{String(index + 1).padStart(2, '0')} / 05</span>
						<button
							type="button"
							disabled={reduced}
							aria-label={t(playing && !reduced ? 'Pause slideshow' : 'Play slideshow')}
							aria-pressed={!playing || reduced}
							onClick={() => setPlaying((value) => !value)}
						>
							{playing && !reduced ? 'Ⅱ' : '▷'}
						</button>
						<button type="button" aria-label={t('Previous slide')} onClick={() => change(-1)}>
							←
						</button>
						<button type="button" aria-label={t('Next slide')} onClick={() => change(1)}>
							→
						</button>
					</div>
				</div>
			</section>
			<div className="triplink-search-wrap">
				<form className="triplink-search" onSubmit={submit} aria-label={t('Search tours')}>
					<label className="triplink-search__destination">
						<span>{t('Destination or tour')}</span>
						<input name="text" type="text" maxLength={150} placeholder={t('Where would you like to go?')} />
					</label>
					<label>
						<span>{t('Departure from')}</span>
						<input name="start" type="date" />
					</label>
					<label>
						<span>{t('Departure until')}</span>
						<input name="end" type="date" />
					</label>
					<label>
						<span>{t('Travelers')}</span>
						<input name="seats" type="number" min={1} max={100} step={1} defaultValue={1} required />
						<small>{t('Minimum available seats')}</small>
					</label>
					<button className="triplink-action triplink-action--primary" type="submit">
						{t('Search tours')} <span aria-hidden="true">→</span>
					</button>
					{error && (
						<Alert severity="error" className="triplink-search__error">
							{t(error)}
						</Alert>
					)}
				</form>
			</div>
		</div>
	);
}
