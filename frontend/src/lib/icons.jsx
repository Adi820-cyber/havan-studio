import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles, Flame, Martini, Gem, Cake, CircleCheck, CircleDashed, CircleX,
  Shirt, Clock, Users, MapPin, CalendarDays, Lock, LockOpen
} from 'lucide-react';

/**
 * Central icon vocabulary.
 *
 * The UI previously used emoji as its icon set. Three problems with that:
 *   1. Emoji are font glyphs, so they render differently on every OS and can
 *      look broken or mis-sized when the platform font lacks the codepoint.
 *   2. They cannot inherit `currentColor`, so they never match the theme.
 *   3. They cannot be animated or transitioned.
 *
 * Lucide icons are inline SVG: consistent everywhere, they take the surrounding
 * text colour, and they can be sized and animated like any other element.
 *
 * Emoji are still fine as *content* a host types (a party name, an RSVP label
 * they wrote themselves). They are no longer used as interface furniture.
 */

/* Event category → icon. Chosen for what the category actually is, not for decoration. */
export const CATEGORY_ICON = {
  all: Sparkles,
  mehfil: Flame,        // the diya / candlelit baithak
  happyhours: Martini,
  wedding: Gem,
  birthday: Cake
};

/* SEAL_ICON removed along with the wax seals themselves. It mapped ids from a
   WAX_SEALS array that no longer exists, so every lookup returned undefined. */

/* RSVP state → icon. Keyed by both the UI key and the database status value. */
export const RSVP_ICON = {
  yes: CircleCheck,
  going: CircleCheck,
  maybe: CircleDashed,
  no: CircleX,
  not_going: CircleX
};

export const RSVP_TINT = {
  yes: '#34d399',
  going: '#34d399',
  maybe: '#fbbf24',
  no: '#f87171',
  not_going: '#f87171'
};

export const META_ICON = {
  when: CalendarDays,
  time: Clock,
  where: MapPin,
  guests: Users,
  dress: Shirt,
  locked: Lock,
  unlocked: LockOpen
};

/** Resolve the icon for a template, falling back to its category then to Sparkles. */
export function iconForTemplate(template) {
  if (!template) return Sparkles;
  return CATEGORY_ICON[template.category] || Sparkles;
}

export function iconForCategory(categoryId) {
  return CATEGORY_ICON[categoryId] || Sparkles;
}

/**
 * Small pulsing dot. Replaces literal "⚡ LIVE" text labels.
 * The ring animation is disabled under prefers-reduced-motion (see index.css).
 */
export function LiveDot({ label = 'Live', style }) {
  return (
    <span className="lp-live" style={style}>
      <span className="lp-live-dot" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

/**
 * Reveals children on first scroll into view.
 *
 * Replaces the always-running particle canvas as the page's sense of motion:
 * movement now happens in response to the reader rather than continuously in the
 * background. Uses one IntersectionObserver and disconnects after firing, so it
 * costs nothing once the element has appeared.
 */
export function Reveal({ children, delay = 0, as: Tag = 'div', className = '', style, ...rest }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // If the browser cannot observe, or the reader prefers less motion, show it.
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`lp-reveal ${shown ? 'is-in' : ''} ${className}`.trim()}
      style={{ transitionDelay: shown ? `${delay}ms` : '0ms', ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
