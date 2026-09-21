import React, { useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import { CalendarDays, MapPin, Lock, LockOpen, Users, KeyRound } from 'lucide-react';
import { RSVP_ICON, RSVP_TINT } from '../lib/icons';

/**
 * The invitation card used as a live demo on the landing page.
 *
 * Reworked for density. It previously carried, above the artwork alone, a wax
 * seal pill plus a guest count, then a vibe tag, host name, title, subtitle,
 * three metadata chips, a lock panel and three emoji buttons — before the reader
 * had learned what the product does. The lock-and-reveal is the one idea worth
 * showing, so everything else got quieter and the reveal got the emphasis.
 *
 * The wax seal badge is gone entirely: it rendered `badgeEmoji` next to `badge`,
 * and `badge` already began with the same emoji, which is where the duplicated
 * peacock came from.
 */
export default function InteractiveCard({ template, isFeatured = false }) {
  const [rsvpState, setRsvpState] = useState(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const cardRef = useRef(null);
  const frame = useRef(null);

  // Pointer spotlight + tilt, batched into a single animation frame. The old
  // version wrote inline styles and read getBoundingClientRect on every
  // mousemove, forcing layout on each event.
  const handleMouseMove = (e) => {
    if (!cardRef.current || !isFeatured) return;
    const { clientX, clientY } = e;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const el = cardRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      el.style.setProperty('--mouse-x', `${x}px`);
      el.style.setProperty('--mouse-y', `${y}px`);
      const rx = ((y - rect.height / 2) / (rect.height / 2)) * -3.5;
      const ry = ((x - rect.width / 2) / (rect.width / 2)) * 3.5;
      el.style.transform = `perspective(1100px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    });
  };

  const handleMouseLeave = () => {
    if (frame.current) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    if (cardRef.current && isFeatured) {
      cardRef.current.style.transform = 'perspective(1100px) rotateX(0deg) rotateY(0deg)';
    }
  };

  const handleRSVP = (status) => {
    setRsvpState(status);
    if (status === 'yes') {
      setIsUnlocked(true);
      confetti({
        particleCount: 90,
        spread: 72,
        origin: { y: 0.62 },
        colors: ['#C0922E', '#4E8B7C', '#E6D5AE', '#D23C78'],
        disableForReducedMotion: true
      });
    } else {
      setIsUnlocked(false);
    }
  };

  const rsvpOptions = [
    { key: 'yes', ...template.rsvpPreset.yes },
    { key: 'maybe', ...template.rsvpPreset.maybe },
    { key: 'no', ...template.rsvpPreset.no }
  ];

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        maxWidth: isFeatured ? '440px' : '100%',
        width: '100%',
        margin: '0 auto',
        borderRadius: 20,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(14, 16, 24, 0.72)',
        backdropFilter: 'blur(12px)',
        boxShadow: isFeatured
          ? '0 30px 70px -20px rgba(0,0,0,0.75)'
          : '0 12px 30px -12px rgba(0,0,0,0.6)',
        transition: 'transform 0.2s cubic-bezier(0.16,1,0.3,1)',
        position: 'relative',
        zIndex: 2
      }}
    >
      {/* Artwork carries the mood. Title sits on it so the card leads with an
          image and a name rather than a row of chrome. */}
      <div style={{ position: 'relative', aspectRatio: isFeatured ? '5 / 4' : '4 / 3', background: '#0b0d14' }}>
        <img
          src={template.image}
          alt={template.title}
          loading={isFeatured ? 'eager' : 'lazy'}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(8,9,15,0.96) 4%, rgba(8,9,15,0.35) 48%, transparent 78%)'
          }}
        />

        <div style={{ position: 'absolute', left: 20, right: 20, bottom: 16 }}>
          <div
            style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.6)',
              marginBottom: 7
            }}
          >
            {template.vibeTag}
          </div>
          <h3
            style={{
              margin: 0,
              fontSize: isFeatured ? '1.42rem' : '1.16rem',
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
              color: '#fff'
            }}
          >
            {template.title}
          </h3>
        </div>
      </div>

      <div style={{ padding: isFeatured ? '18px 20px 20px' : '16px 18px 18px' }}>
        {/* Quiet metadata line. One row, not three chip groups. */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '6px 14px',
            fontSize: '0.83rem',
            color: 'rgba(255,255,255,0.62)',
            marginBottom: 16
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <CalendarDays size={14} strokeWidth={1.75} />
            {template.date}
          </span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{template.time}</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Users size={14} strokeWidth={1.75} />
            {template.guestCount} going
          </span>
        </div>

        {/* The reveal. This is the product's whole idea, so it gets the space. */}
        <div
          style={{
            padding: '13px 15px',
            borderRadius: 13,
            marginBottom: 16,
            border: isUnlocked ? '1px solid rgba(245,181,68,0.42)' : '1px dashed rgba(255,255,255,0.16)',
            background: isUnlocked ? 'rgba(245,181,68,0.09)' : 'rgba(255,255,255,0.028)',
            transition: 'background 0.3s ease, border-color 0.3s ease'
          }}
        >
          {isUnlocked ? (
            <>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: '#f5b544',
                  marginBottom: 9
                }}
              >
                <LockOpen size={13} strokeWidth={2} />
                Address unlocked
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                <MapPin size={15} strokeWidth={1.75} color="rgba(255,255,255,0.5)" style={{ marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 500 }}>{template.venue}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <KeyRound size={15} strokeWidth={1.75} color="rgba(255,255,255,0.5)" style={{ marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.68)' }}>{template.doorCode}</span>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <Lock size={16} strokeWidth={1.75} color="rgba(255,255,255,0.4)" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.87rem', color: '#fff', fontWeight: 500 }}>
                  The host is keeping the address private
                </div>
                <div style={{ fontSize: '0.79rem', color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                  Reply below and it appears here
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RSVP. Icons rather than emoji, so they inherit colour and animate. */}
        <div className="lp-trio" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
          {rsvpOptions.map((opt) => {
            const Icon = RSVP_ICON[opt.key];
            const tint = RSVP_TINT[opt.key];
            const on = rsvpState === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => handleRSVP(opt.key)}
                aria-pressed={on}
                style={{
                  padding: '11px 8px',
                  borderRadius: 12,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'center',
                  border: on ? `1px solid ${tint}` : '1px solid rgba(255,255,255,0.1)',
                  background: on ? `${tint}1f` : 'rgba(255,255,255,0.035)',
                  transition: 'border-color 0.18s ease, background 0.18s ease'
                }}
              >
                <Icon
                  size={17}
                  strokeWidth={1.9}
                  color={on ? tint : 'rgba(255,255,255,0.5)'}
                  style={{ marginBottom: 5 }}
                />
                <span
                  style={{
                    display: 'block',
                    fontSize: '0.79rem',
                    fontWeight: 600,
                    color: on ? '#fff' : 'rgba(255,255,255,0.8)',
                    lineHeight: 1.25
                  }}
                >
                  {opt.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
