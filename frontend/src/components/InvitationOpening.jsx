import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, MailOpen } from 'lucide-react';

/** A small, user-triggered invitation opening that runs before event details. */
export default function InvitationOpening({ event, theme, children, onOpened }) {
  const [opened, setOpened] = useState(false);
  const [opening, setOpening] = useState(false);
  const timer = useRef(null);
  const custom = event?.customization || {};
  const selected = custom.revealId || 'envelope';
  const style = {
    '--opening-primary': theme?.primary || '#4E8B7C',
    '--opening-accent': theme?.accent || '#C0922E',
    '--opening-paper': theme?.cardBg || 'rgba(28, 42, 75, 0.96)',
    '--opening-text': theme?.textColor || '#f5f7fa'
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  const openInvitation = () => {
    if (opening || opened) return;
    setOpening(true);
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    timer.current = setTimeout(() => {
      setOpened(true);
      setOpening(false);
      onOpened?.();
    }, reducedMotion ? 0 : 680);
  };

  if (opened) {
    return (
      <div className={`havan-opening havan-opening--${selected}`} style={style}>
        <div
          className="havan-opening-revealed"
          role="region"
          aria-label={`${event?.title || 'Gathering'} invitation details`}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`havan-opening havan-opening--${selected}${opening ? ' is-opening' : ''}`}
      style={style}
    >
      <button
        type="button"
        className="havan-opening-cover"
        onClick={openInvitation}
        disabled={opening}
        aria-expanded={opening}
        aria-label={`Open the invitation from ${event?.hostName || 'your host'}`}
      >
        <span className="havan-opening-ornament" aria-hidden="true">
          {selected === 'kabutar' ? (
            <svg className="havan-kabutar" viewBox="0 0 100 72" role="presentation">
              <path d="M8 42c14-3 21-17 31-27 4 15 13 21 27 18-4 7-10 11-18 13 12 4 23 2 36-7-3 12-14 21-29 22-17 2-29-6-47-19Z" />
              <path d="m53 40 23 4-18 8" className="havan-kabutar-letter" />
              <circle cx="69" cy="36" r="1.7" className="havan-kabutar-eye" />
            </svg>
          ) : selected === 'scroll' ? (
            <span className="havan-scroll-mark" aria-hidden="true"><i /><MailOpen size={25} /><i /></span>
          ) : selected === 'kathputli' ? (
            <svg className="havan-kathputli" viewBox="0 0 76 76" role="presentation">
              <path className="havan-kathputli-strings" d="M27 8v17m22-17v17" />
              <circle className="havan-kathputli-head" cx="38" cy="27" r="8" />
              <path className="havan-kathputli-body" d="M28 38 38 33l10 5-4 17H32zM30 41 18 49m28-8 12 8M34 55l-5 12m13-12 5 12" />
              <path className="havan-kathputli-stage" d="M13 68h50" />
            </svg>
          ) : selected === 'warli-circle' ? (
            <svg className="havan-warli" viewBox="0 0 76 76" role="presentation">
              <circle className="havan-warli-ring" cx="38" cy="38" r="29" />
              <g className="havan-warli-dancers">
                <circle cx="38" cy="11" r="3" /><path d="m38 14-4 8 4 5 4-5zm-4 8-5-4m9 4 5-4m-6 5-4 5m4-5 4 5" />
                <circle cx="15" cy="51" r="3" /><path d="m15 54-4 8 4 5 4-5zm-4 8-5-4m9 4 5-4m-6 5-4 5m4-5 4 5" />
                <circle cx="61" cy="51" r="3" /><path d="m61 54-4 8 4 5 4-5zm-4 8-5-4m9 4 5-4m-6 5-4 5m4-5 4 5" />
              </g>
            </svg>
          ) : selected === 'madhubani-frame' ? (
            <svg className="havan-madhubani" viewBox="0 0 76 76" role="presentation">
              <g className="havan-madhubani-petals">
                <path d="M38 8c8 8 8 14 0 20-8-6-8-12 0-20Zm0 40c8 8 8 14 0 20-8-6-8-12 0-20ZM8 38c8-8 14-8 20 0-6 8-12 8-20 0Zm40 0c8-8 14-8 20 0-6 8-12 8-20 0Z" />
                <path d="M17 17c11 1 15 5 15 15-10 0-14-4-15-15Zm27 27c11 1 15 5 15 15-10 0-14-4-15-15ZM59 17c-11 1-15 5-15 15 10 0 14-4 15-15ZM32 44c-11 1-15 5-15 15 10 0 14-4 15-15Z" />
                <circle cx="38" cy="38" r="5" />
              </g>
            </svg>
          ) : (
            <span className="havan-envelope-mark" aria-hidden="true"><MailOpen size={28} /></span>
          )}
        </span>
        <span className="havan-opening-kicker">A note from</span>
        <strong className="havan-opening-sender">{event?.hostName || 'Your host'}</strong>
        <span className="havan-opening-message">
          {custom.senderMessage?.trim() || 'I saved a place for you. Open this invitation for the details.'}
        </span>
        <span className="havan-opening-action">
          {opening ? 'Opening your invitation…' : 'Open your invitation'}
          {!opening && <ArrowRight size={15} aria-hidden="true" />}
        </span>
      </button>
      <span className="havan-opening-hint">Tap to reveal the gathering</span>
    </div>
  );
}
