import React, { useEffect, useState } from 'react';
import { useTranslation } from 'next-i18next';
import CircularCarousel from './CircularCarousel';
import { useRememberedState } from '../../triplink/BrowsingMemoryProvider';

const photos = [
	['kyoto', 'Kyoto'], ['seoul', 'Seoul'], ['samarkand', 'Samarkand'],
	['iceland', 'Iceland'], ['sossusvlei', 'Sossusvlei'], ['petra', 'Petra'],
	['patagonia', 'Patagonia'], ['swiss-alps', 'Swiss Alps'], ['santorini', 'Santorini'],
	['cappadocia', 'Cappadocia'], ['dolomites', 'Dolomites'], ['lofoten', 'Lofoten'], ['bali', 'Bali'],
];

// React Bits motion with TripLink's local photography, translations and browsing memory.
export function IntroCircularCarousel({ title }: { title: string }) {
	const { t } = useTranslation('common');
	const [position, setPosition] = useRememberedState('home:rated-position', 0);
	const [reduced, setReduced] = useState(true);
	const [focused, setFocused] = useState(false);
	const active = ((position % photos.length) + photos.length) % photos.length;
	useEffect(() => {
		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		const motion = () => setReduced(media.matches);
		motion();
		media.addEventListener('change', motion);
		return () => {
			media.removeEventListener('change', motion);
		};
	}, []);
	return (
		<div
			className="triplink-circular-carousel"
			role="region"
			aria-roledescription={t('Carousel')}
			aria-label={t('Photo inspiration for {{section}}', { section: t(title) })}
			onFocusCapture={() => setFocused(true)}
			onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
		>
			<div className="triplink-circular-carousel__stage">
				<CircularCarousel
					items={photos.map(([file, name]) => ({ src: `/img/homepage/rated-circular/${file}.jpg`, title: t(name), alt: t(name) }))}
					preset="cylinder"
					intro="rise"
					cardWidth={220}
					aspectRatio={0.72}
					gap={25}
					autoplay={!reduced && !focused ? 'drift' : 'off'}
					speed={14}
					fadeColor="#f8f6ef"
					selectedIndex={active}
					onChange={setPosition}
					ariaLabel={`${t(photos[active][1])}, ${active + 1} / ${photos.length}`}
					ariaRoleDescription={t('Carousel')}
				/>
			</div>
			<div className="triplink-circular-carousel__footer">
				<div aria-live={focused ? 'polite' : 'off'} aria-atomic="true">
					<strong>{t(photos[active][1])}</strong>
					<span>{String(active + 1).padStart(2, '0')} / {photos.length}</span>
				</div>
			</div>
		</div>
	);
}
