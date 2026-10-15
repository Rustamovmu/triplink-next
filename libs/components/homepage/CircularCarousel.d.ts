import { CSSProperties, MutableRefObject, ReactElement } from 'react';

export interface CircularCarouselItem { src: string; alt?: string; title?: string; subtitle?: string }
export interface CircularCarouselHandle { stepBy(delta: number): void; focusIndex(index: number): void }
export interface CircularCarouselProps {
  items: CircularCarouselItem[];
  preset?: 'cylinder' | 'orbit' | 'wheel' | 'panorama';
  intro?: 'assemble' | 'rise' | 'spin' | 'none';
  cardWidth?: number; aspectRatio?: number; gap?: number; curve?: number; tilt?: number; perspective?: number;
  autoplay?: 'drift' | 'step' | 'off'; speed?: number; interval?: number; direction?: 'left' | 'right';
  draggable?: boolean; momentum?: number; snap?: boolean; pauseOnHover?: boolean; focusOnClick?: boolean;
  parallax?: number; stretch?: number; depthFade?: number; fadeColor?: string; innerShade?: number;
  cornerRadius?: number; captions?: boolean; className?: string; style?: CSSProperties;
  onChange?: (index: number) => void; onItemClick?: (item: CircularCarouselItem, index: number) => void;
  controller?: MutableRefObject<CircularCarouselHandle | null>; selectedIndex?: number;
  ariaLabel?: string; ariaRoleDescription?: string; slideRoleDescription?: string; announce?: boolean;
}
export default function CircularCarousel(props: CircularCarouselProps): ReactElement;
