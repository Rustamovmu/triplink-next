import React, { useEffect, useRef, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Swiper as SwiperInstance } from 'swiper';
import { useTranslation } from 'next-i18next';
import { useRememberedState } from '../../triplink/BrowsingMemoryProvider';

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

// Swiper 8 supports enabled at runtime, though its AutoplayOptions omits that field.
const autoplayOptions = { enabled: false, delay: 5000, disableOnInteraction: true };

function DestinationPhoto({ photo }: { photo: typeof photos[number] }) {
	const [failed, setFailed] = useState(false);
	return (
		// eslint-disable-next-line @next/next/no-img-element
		<img
			src={failed ? '/img/tour-placeholder.svg' : `/img/homepage/featured/${photo.file}.jpg`}
			alt=""
			width={800}
			height={500}
			loading="lazy"
			decoding="async"
			draggable={false}
			onError={() => setFailed(true)}
		/>
	);
}

export function IntroGallery({ title }: { title: string }) {
	const { t } = useTranslation('common');
	const gallery = useRef<HTMLDivElement>(null);
	const [swiper, setSwiper] = useState<SwiperInstance | null>(null);
	const [active, setActive] = useRememberedState('home:featured-slide', 0);
	const initialSlide = useRef(active);
	const [reduced, setReduced] = useState(true);
	const [hidden, setHidden] = useState(true);
	const [visible, setVisible] = useState(false);
	const [hovered, setHovered] = useState(false);
	const [focused, setFocused] = useState(false);
	const [dragging, setDragging] = useState(false);
	useEffect(() => {
		if (swiper && !swiper.destroyed && swiper.realIndex !== active) swiper.slideToLoop(active, 0);
	}, [swiper, active]);

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
		if (!reduced && !hidden && visible && !hovered && !focused && !dragging) swiper.autoplay.start();
		else swiper.autoplay.stop();
		return () => {
			if (!swiper.destroyed) swiper.autoplay.stop();
		};
	}, [swiper, reduced, hidden, visible, hovered, focused, dragging]);

	return (
		<div
			ref={gallery}
			className="triplink-intro-gallery"
			role="region"
			tabIndex={0}
			aria-roledescription={t('Carousel')}
			aria-label={t('Photo inspiration for {{section}}', { section: t(title) })}
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
				else if (event.key === 'Home') swiper.slideToLoop(0);
				else if (event.key === 'End') swiper.slideToLoop(photos.length - 1);
				else return;
				event.preventDefault();
			}}
		>
			<Swiper
				initialSlide={initialSlide.current}
				modules={[Autoplay]}
				slidesPerView="auto"
				centeredSlides
				loop
				loopedSlides={3}
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
				{photos.map((photo) => (
					<SwiperSlide key={photo.file}>
						{({ isActive }) => (
							<figure className="triplink-intro-gallery__frame" aria-hidden={!isActive}>
								<DestinationPhoto photo={photo} />
								<figcaption>{t(photo.destination)}</figcaption>
							</figure>
						)}
					</SwiperSlide>
				))}
			</Swiper>
			<span className="triplink-intro-gallery__announcement" role="status" aria-live={focused ? 'polite' : 'off'}>
				{t(photos[active]?.destination || photos[0].destination)}
			</span>
		</div>
	);
}
