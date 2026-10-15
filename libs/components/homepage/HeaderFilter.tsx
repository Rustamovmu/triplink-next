import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslation } from 'next-i18next';
import HomeSearchForm from './HomeSearchForm';
import { tourSearchQuery } from '../../triplink/tourSearchUrl';
import { motion } from 'framer-motion';
import {
	ArrowForwardRounded,
	NorthEastRounded,
} from '@mui/icons-material';
import { homeDestinations } from './homeContent';
import { useRememberedState } from '../../triplink/BrowsingMemoryProvider';

export default function HeaderFilter() {
	const { t } = useTranslation('common');
	const [index, setIndex] = useRememberedState('home:hero-slide', 0);
	const [reduced, setReduced] = useState(true),
		[hovered, setHovered] = useState(false);
	const [focused, setFocused] = useState(false),
		[hidden, setHidden] = useState(false);
	const [loadedSlides, setLoadedSlides] = useState(() => new Set([0, 1]));
	useEffect(() => {
		setLoadedSlides((current) => {
			const next = (index + 1) % homeDestinations.length;
			if (current.has(index) && current.has(next)) return current;
			return new Set([...Array.from(current), index, next]);
		});
	}, [index]);
	const touch = useRef<{ x: number; y: number } | null>(null);
	const change = useCallback(
		(offset: number) => setIndex((current) => (current + offset + homeDestinations.length) % homeDestinations.length),
		[setIndex],
	);
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
		if (reduced || hovered || focused || hidden) return;
		const timer = window.setInterval(() => change(1), 6000);
		return () => window.clearInterval(timer);
	}, [reduced, hovered, focused, hidden, index, change]);
	return (
		<div className="triplink-home-intro">
			<section
				data-browse-section="home:hero"
				data-triplink-nav-hero
				className={`triplink-hero${reduced || hovered || focused || hidden ? ' is-paused' : ''}`}
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
							{(active || loadedSlides.has(slideIndex)) && (
								<Image
									className="triplink-hero__image"
									style={
										{
											'--triplink-image-position': slide.imagePosition ?? '50% 50%',
											'--triplink-mobile-image-position': slide.mobileImagePosition ?? '50% 50%',
										} as React.CSSProperties
									}
									src={`/img/homepage/${slide.image}.jpg`}
									alt=""
									fill
									sizes="(max-width: 767px) calc(100vw - 24px), calc(100vw - 48px)"
									quality={90}
									priority={slideIndex === 0}
									onError={(event) => {
										event.currentTarget.style.visibility = 'hidden';
									}}
								/>
							)}
							<motion.div
								className="triplink-hero__content"
								initial={false}
								animate={{ opacity: active ? 1 : 0, y: reduced ? 0 : active ? 0 : 14 }}
								transition={{ duration: reduced ? 0 : 0.7, ease: 'easeOut', delay: active && !reduced ? 0.1 : 0 }}
							>
								<span className="triplink-hero__eyebrow">
									{t('Destination spotlight')} · {t(slide.name)}
								</span>
								<Heading>{t(slide.title)}</Heading>
								<p>{t(slide.description)}</p>
								<div className="triplink-hero__actions">
									<Link
										passHref
										href={{
											pathname: '/tour',
											query: tourSearchQuery({ page: 1, limit: 12, search: { text: slide.name } }),
										}}
										className="triplink-action triplink-action--coral"
										tabIndex={active ? 0 : -1}
									>
										{t('Explore {{destination}} tours', { destination: t(slide.name) })}{' '}
										<NorthEastRounded aria-hidden="true" />
									</Link>
									<Link
										passHref
										href="/tour"
										className="triplink-action triplink-action--glass"
										tabIndex={active ? 0 : -1}
									>
										{t('Browse all tours')} <ArrowForwardRounded aria-hidden="true" />
									</Link>
								</div>
							</motion.div>
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
				</div>
			</section>
			<HomeSearchForm />
		</div>
	);
}
