import React, { useEffect, useRef, useState } from 'react';

/**
 * Fires the host's chosen reveal once, when the card scrolls into view.
 *
 * Three things this has to get right, none of them obvious:
 *
 * 1. **Once.** An IntersectionObserver that re-fires on every scroll-past turns
 *    an invitation into a slot machine. It disconnects itself the moment it
 *    triggers.
 *
 * 2. **Already-visible cards.** On a short page, or on a direct link to an
 *    invite, the card is on screen at mount and the observer would fire
 *    instantly — which looks like a glitch rather than an opening. A single
 *    frame of delay lets the browser paint the closed state first, so the guest
 *    actually sees it open.
 *
 * 3. **Letting go afterwards.** The animation ends on a transform, and an
 *    ancestor with a transform silently breaks `position: sticky` and
 *    `position: fixed` in every descendant. So once it finishes the wrapper adds
 *    `is-done`, which clears the transform, the clip-path and the mask. Without
 *    it the reveal would quietly break the share sheet and the sticky header on
 *    the same page.
 *
 * The wrapper never touches the card's own box — no radius, no border, no
 * overflow — so the chamfer, the borders and text selection all survive it.
 */
export default function RevealOnScroll({ revealId = 'gate', children, style, className = '' }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    // No observer support, or motion turned down: show it immediately and skip
    // the whole mechanism rather than leaving the card at opacity 0.
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (typeof IntersectionObserver === 'undefined') {
      setOpen(true);
      setDone(true);
      return undefined;
    }

    let raf = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.disconnect();
          // One frame, so the closed state is painted before the open one.
          raf = requestAnimationFrame(() => setOpen(true));
        }
      },
      // A little above the fold, so it starts opening just before it is centred.
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );

    observer.observe(el);

    if (reduced) {
      // Still fires, still once, just as a fade — the CSS handles that.
      observer.disconnect();
      raf = requestAnimationFrame(() => setOpen(true));
    }

    return () => {
      observer.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const handleAnimationEnd = (e) => {
    // Only the wrapper's own animation counts; a child's finishing is not the
    // reveal finishing.
    if (e.target === ref.current) setDone(true);
  };

  return (
    <div
      ref={ref}
      onAnimationEnd={handleAnimationEnd}
      className={[
        'havan-reveal',
        `havan-reveal--${revealId}`,
        open ? 'is-open' : '',
        done ? 'is-done' : '',
        className
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ position: 'relative', ...style }}
    >
      {/* The one gradient the direction permits: warm light behind the gate,
          fading as the card settles. */}
      <span className="havan-reveal-glow" aria-hidden="true" />
      {children}
    </div>
  );
}
