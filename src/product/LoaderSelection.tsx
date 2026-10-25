import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';

export function LoaderSelection({ index, disableAnimations }: { index: number; disableAnimations: boolean }) {
  const marker = useRef<HTMLSpanElement>(null);
  const positioned = useRef(false);

  useLayoutEffect(() => {
    const element = marker.current;
    if (!element) return;
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const move = () => {
      gsap.to(element, {
        xPercent: index * 100, x: index * 4,
        duration: !positioned.current || disableAnimations || preference?.matches !== false ? 0 : .18,
        ease: 'power2.out', overwrite: true,
      });
      positioned.current = true;
    };
    move();
    preference?.addEventListener('change', move);
    return () => {
      preference?.removeEventListener('change', move);
      gsap.killTweensOf(element);
    };
  }, [index, disableAnimations]);

  return <span ref={marker} className="next-loader-selection" aria-hidden="true" data-testid="loader-selection" />;
}
