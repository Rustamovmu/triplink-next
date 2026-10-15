import React, { useEffect, useRef, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Swiper as SwiperInstance } from 'swiper';
import { useTranslation } from 'next-i18next';
import { useRememberedState } from '../../triplink/BrowsingMemoryProvider';

type CarouselItem = { id: string; title: string; content: React.ReactNode };

// Swiper 8 supports enabled at runtime, though its AutoplayOptions omits that field.
const autoplayOptions = { enabled: false, delay: 5000, disableOnInteraction: true };

export function FeaturedTourSwiper({ items }: { items: CarouselItem[] }) {
	const { t } = useTranslation('common');
	const gallery = useRef<HTMLDivElement>(null);
	const [swiper, setSwiper] = useState<SwiperInstance | null>(null);
	const [active, setActive] = useRememberedState('home:featured-tour-slide', 0);
	const selected = Math.max(0, Math.min(active, items.length - 1));
	const initialSlide = useRef(selected);
	const [paused, setPaused] = useRememberedState('home:featured-tour-paused', false);
	const itemKey = items.map((item) => item.id).join('|');
	const [reduced, setReduced] = useState(true);
	const [hidden, setHidden] = useState(true);
	const [visible, setVisible] = useState(false);
	const [hovered, setHovered] = useState(false);
	const [focused, setFocused] = useState(false);
	const [dragging, setDragging] = useState(false);
	useEffect(() => {
		if (swiper && !swiper.destroyed && swiper.realIndex !== selected) {
			if (items.length > 2) swiper.slideToLoop(selected, 0);
			else swiper.slideTo(selected, 0);
		}
	}, [swiper, selected, items.length]);

	useEffect(() => {
		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		let mounted = true;
		const update = () => setReduced(media.matches);
		const visibility = () => setHidden(document.hidden);
		update();
		visibility();
		const observer =
			'IntersectionObserver' in window
				? new window.IntersectionObserver(
						([entry]) => {
							if (mounted && entry) setVisible(entry.isIntersecting);
						},
						{ threshold: 0.15 },
				  )
				: null;
		if (observer && gallery.current) observer.observe(gallery.current);
		else setVisible(true);
		media.addEventListener('change', update);
		document.addEventListener('visibilitychange', visibility);
		return () => {
			mounted = false;
			observer?.disconnect();
			media.removeEventListener('change', update);
			document.removeEventListener('visibilitychange', visibility);
		};
	}, []);

	useEffect(() => {
		if (!swiper || swiper.destroyed) return;
		// Reset Swiper's transition pause before starting a new interaction-free cycle.
		swiper.autoplay.paused = false;
		if (!reduced && !hidden && visible && !hovered && !focused && !dragging && !paused && items.length > 1)
			swiper.autoplay.start();
		else swiper.autoplay.stop();
		return () => {
			if (!swiper.destroyed) swiper.autoplay.stop();
		};
	}, [swiper, reduced, hidden, visible, hovered, focused, dragging, paused, items.length]);

	return (
		<div
			ref={gallery}
			className="triplink-featured-swiper"
			data-count={items.length}
			role="region"
			tabIndex={0}
			aria-roledescription={t('Carousel')}
			aria-label={t('Featured tours')}
			onPointerEnter={(event) => {
				if (event.pointerType !== 'touch') setHovered(true);
			}}
			onPointerLeave={() => setHovered(false)}
			onFocusCapture={() => setFocused(true)}
			onBlurCapture={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
			}}
			onKeyDown={(event) => {
				if (!swiper || swiper.destroyed || event.altKey || event.ctrlKey || event.metaKey) return;
				if (event.key === 'ArrowRight') swiper.slideNext();
				else if (event.key === 'ArrowLeft') swiper.slidePrev();
				else if (event.key === 'Home' || event.key === 'End') {
					const index = event.key === 'Home' ? 0 : items.length - 1;
					if (items.length > 2) swiper.slideToLoop(index);
					else swiper.slideTo(index);
				} else return;
				event.preventDefault();
			}}
		>
			<Swiper
				key={itemKey}
				initialSlide={initialSlide.current}
				modules={[Autoplay]}
				slidesPerView="auto"
				centeredSlides
				loop={items.length > 2}
				rewind={items.length === 2}
				allowTouchMove={items.length > 1}
				watchOverflow
				loopedSlides={Math.min(items.length, 3)}
				spaceBetween={20}
				speed={reduced ? 0 : 650}
				// The effect owns visibility and interaction pauses, including the initial start.
				autoplay={autoplayOptions}
				onSwiper={(instance) => {
					instance.autoplay.stop();
					setSwiper(instance);
				}}
				onSlideChange={(instance) => setActive(instance.realIndex)}
				onTouchStart={(instance) => {
					instance.autoplay.stop();
					setDragging(true);
				}}
				onTouchEnd={() => setDragging(false)}
			>
				{items.map((item) => (
					<SwiperSlide key={item.id}>{item.content}</SwiperSlide>
				))}
			</Swiper>
			{items.length > 1 && (
				<div className="triplink-featured-swiper__controls">
					<button type="button" aria-label={t('Previous slide')} onClick={() => swiper?.slidePrev()}>
						‹
					</button>
					<button
						type="button"
						aria-label={t(paused ? 'Play slideshow' : 'Pause slideshow')}
						aria-pressed={paused}
						onClick={() => setPaused(!paused)}
					>
						{paused ? '▶' : 'Ⅱ'}
					</button>
					<button type="button" aria-label={t('Next slide')} onClick={() => swiper?.slideNext()}>
						›
					</button>
				</div>
			)}
			<span className="triplink-featured-swiper__announcement" role="status" aria-live={focused ? 'polite' : 'off'}>
				{items[selected]?.title}
			</span>
		</div>
	);
}
