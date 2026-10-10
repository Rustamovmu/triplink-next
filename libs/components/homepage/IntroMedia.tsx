import React, { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Swiper as SwiperInstance } from 'swiper';
import { useTranslation } from 'next-i18next';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';

export const introductionPhotos = {
	rated: [
		'/img/homepage/rated/kyoto.jpg',
		'/img/homepage/rated/seoul.jpg',
		'/img/homepage/rated/samarkand.jpg',
	],
};

export function IntroSlider({ photos, title }: { photos: string[]; title: string }) {
	const { t } = useTranslation('common');
	const [swiper, setSwiper] = useState<SwiperInstance | null>(null);
	const [playing, setPlaying] = useState(true);
	const [reduced, setReduced] = useState(true);
	const [hidden, setHidden] = useState(false);
	const [hovered, setHovered] = useState(false);
	const [focused, setFocused] = useState(false);
	const [index, setIndex] = useState(0);
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
		if (!swiper || swiper.destroyed) return;
		if (playing && !reduced && !hidden && !hovered && !focused) swiper.autoplay.start();
		else swiper.autoplay.stop();
	}, [swiper, playing, reduced, hidden, hovered, focused]);
	return (
		<div
			className="triplink-home-section__image triplink-intro-slider"
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
			<Swiper
				modules={[Autoplay]}
				slidesPerView={1}
				loop
				speed={reduced ? 0 : 700}
				autoplay={{ delay: 5000, disableOnInteraction: false }}
				onSwiper={(instance) => {
					instance.autoplay.stop();
					setSwiper(instance);
				}}
				onSlideChange={(instance) => setIndex(instance.realIndex)}
			>
				{photos.map((photo) => (
					<SwiperSlide key={photo}>
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img src={photo} alt="" width={800} height={500} loading="lazy" decoding="async" />
					</SwiperSlide>
				))}
			</Swiper>
			<div className="triplink-intro-media__controls">
				<span aria-hidden="true">
					{index + 1} / {photos.length}
				</span>
				<button
					type="button"
					aria-label={t('Previous photo in {{section}}', { section: t(title) })}
					onClick={() => {
						setPlaying(false);
						swiper?.slidePrev();
					}}
				>
					<ArrowBackRoundedIcon aria-hidden="true" />
				</button>
				{!reduced && (
					<button
						type="button"
						aria-label={t(playing ? 'Pause slideshow' : 'Play slideshow')}
						onClick={() => setPlaying((value) => !value)}
					>
						{playing ? <PauseRoundedIcon aria-hidden="true" /> : <PlayArrowRoundedIcon aria-hidden="true" />}
					</button>
				)}
				<button
					type="button"
					aria-label={t('Next photo in {{section}}', { section: t(title) })}
					onClick={() => {
						setPlaying(false);
						swiper?.slideNext();
					}}
				>
					<ArrowForwardRoundedIcon aria-hidden="true" />
				</button>
			</div>
		</div>
	);
}

export function IntroVideo() {
	const { t } = useTranslation('common');
	const video = React.useRef<HTMLVideoElement>(null);
	const pausedByUser = React.useRef(false);
	const [playing, setPlaying] = useState(false);
	const [failed, setFailed] = useState(false);
	useEffect(() => {
		const element = video.current;
		if (!element) return;
		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		let visible = false;
		const update = () => {
			if (media.matches || document.hidden || !visible || pausedByUser.current) element.pause();
			else void element.play().catch(() => setPlaying(false));
		};
		const observer = new IntersectionObserver(
			([entry]) => {
				visible = entry.isIntersecting;
				update();
			},
			{ threshold: 0.2 },
		);
		observer.observe(element);
		media.addEventListener('change', update);
		document.addEventListener('visibilitychange', update);
		return () => {
			observer.disconnect();
			media.removeEventListener('change', update);
			document.removeEventListener('visibilitychange', update);
			element.pause();
		};
	}, []);
	return (
		<div className="triplink-home-section__image triplink-intro-video">
			{failed ? (
				// eslint-disable-next-line @next/next/no-img-element
				<img src="/video/top-tours-temple.jpg" alt="" width={800} height={500} />
			) : (
				<video
					ref={video}
					src="/video/top-tours-temple.mp4"
					poster="/video/top-tours-temple.jpg"
					muted
					loop
					playsInline
					preload="none"
					aria-label={t('Aerial travel video of Istanbul')}
					onPlay={() => setPlaying(true)}
					onPause={() => setPlaying(false)}
					onError={() => setFailed(true)}
				/>
			)}
			{!failed && (
				<div className="triplink-intro-media__controls">
					<button
						type="button"
						aria-label={t(playing ? 'Pause travel video' : 'Play travel video')}
						onClick={() => {
							const element = video.current;
							if (!element) return;
							if (playing) {
								pausedByUser.current = true;
								element.pause();
							} else {
								pausedByUser.current = false;
								void element.play().catch(() => setPlaying(false));
							}
						}}
					>
						{playing ? <PauseRoundedIcon aria-hidden="true" /> : <PlayArrowRoundedIcon aria-hidden="true" />}
					</button>
				</div>
			)}
		</div>
	);
}
