import React, { useEffect, useState } from 'react';
import { useTranslation } from 'next-i18next';

export function IntroVideo() {
	const { t } = useTranslation('common');
	const video = React.useRef<HTMLVideoElement>(null);
	const [failed, setFailed] = useState(false);
	useEffect(() => {
		const element = video.current;
		if (!element) return;
		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		let visible = false;
		const update = () => {
			if (media.matches || document.hidden || !visible) element.pause();
			else void element.play().catch(() => undefined);
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
					onError={() => setFailed(true)}
				/>
			)}
		</div>
	);
}
