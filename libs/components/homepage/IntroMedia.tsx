import React, { useEffect, useState } from 'react';
import { useTranslation } from 'next-i18next';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import { useRememberedState } from '../../triplink/BrowsingMemoryProvider';

export function IntroVideo() {
	const { t } = useTranslation('common');
	const video = React.useRef<HTMLVideoElement>(null);
	const [paused, setPaused] = useRememberedState('home:video-paused', false);
	const pausedByUser = React.useRef(paused);
	pausedByUser.current = paused;
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
								setPaused(true);
								element.pause();
							} else {
								pausedByUser.current = false;
								setPaused(false);
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
