import React, { useMemo } from 'react';
import { useTranslation } from 'next-i18next';
import { useRememberedState } from '../../triplink/BrowsingMemoryProvider';
import FlexCarousel from './FlexCarousel';

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

export function IntroGallery({ title }: { title: string }) {
  const { t } = useTranslation('common');
  const [active, setActive] = useRememberedState('home:featured-slide', 0);
  const items = useMemo(() => photos.map(photo => ({
    src: `/img/homepage/featured/${photo.file}.jpg`,
    fallbackSrc: '/img/tour-placeholder.svg',
    title: t(photo.destination),
    alt: t(photo.destination),
  })), [t]);

  return (
    <FlexCarousel
      className="triplink-intro-gallery"
      items={items}
      preset="liquid"
      intro="rise"
      cardHeight={0.5}
      gap={12}
      radius={14}
      squeeze={0.2}
      focusOnClick
      captions
      captureWheel={false}
      activeIndex={active}
      onChange={index => setActive(index)}
      ariaLabel={t('Photo inspiration for {{section}}', { section: t(title) })}
      carouselLabel={t('Carousel')}
      getItemLabel={(item, index, total) => `${item.title}, ${index + 1}/${total}`}
    />
  );
}
