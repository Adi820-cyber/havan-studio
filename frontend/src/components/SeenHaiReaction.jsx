import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { X } from 'lucide-react';

/**
 * The reaction that fires after someone answers an invite.
 *
 * A clip plus a one-liner, and a party-popper burst from the bottom corners for
 * anyone who said yes. A decline gets a much smaller, greyer puff — celebrating a
 * "no" with the same fanfare reads as sarcasm.
 *
 * Clips are muted, looping MP4 rather than GIF: the same 23 files went from
 * 52.8 MB to 1.12 MB, and video pauses itself when the tab is hidden.
 *
 * Closes on Escape, on backdrop click, and on its own after a few seconds.
 */
export default function SeenHaiReaction({ reaction, onClose }) {
  const [visible, setVisible] = useState(false);
  const closeRef = useRef(null);
  const autoTimer = useRef(null);

  useEffect(() => {
    if (!reaction) return;

    setVisible(true);
    closeRef.current?.focus();

    const reduced =
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

    if (!reduced) {
      const colors = reaction.confetti || ['#f5b544', '#ec4899', '#ffffff'];

      if (reaction.status === 'going') {
        // Party poppers: two angled bursts from the bottom corners.
        confetti({ particleCount: 70, angle: 60, spread: 62, origin: { x: 0, y: 0.95 }, colors, startVelocity: 55 });
        confetti({ particleCount: 70, angle: 120, spread: 62, origin: { x: 1, y: 0.95 }, colors, startVelocity: 55 });
        const second = setTimeout(() => {
          confetti({ particleCount: 45, spread: 95, origin: { y: 0.55 }, colors, scalar: 0.9 });
        }, 260);
        autoTimer.current = second;
      } else if (reaction.status === 'maybe') {
        confetti({ particleCount: 26, spread: 60, origin: { y: 0.7 }, colors, scalar: 0.8 });
      } else {
        // A commiseration puff, deliberately small.
        confetti({ particleCount: 12, spread: 45, origin: { y: 0.7 }, colors, scalar: 0.7, gravity: 1.4 });
      }
    }

    const dismiss = setTimeout(() => handleClose(), 5200);

    const onKey = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKey);

    return () => {
      clearTimeout(dismiss);
      if (autoTimer.current) clearTimeout(autoTimer.current);
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reaction]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onClose?.(), 200);
  };

  if (!reaction) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Your reply"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: 'rgba(5,6,11,0.82)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.2s ease'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          borderRadius: 22,
          overflow: 'hidden',
          background: 'rgba(15,17,25,0.96)',
          border: `1px solid ${reaction.tint}55`,
          boxShadow: `0 30px 80px -24px rgba(0,0,0,0.9), 0 0 40px -18px ${reaction.tint}66`,
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.94) translateY(10px)',
          transition: 'transform 0.26s cubic-bezier(0.16,1,0.3,1)',
          position: 'relative'
        }}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={handleClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 2,
            width: 30,
            height: 30,
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(0,0,0,0.55)',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <X size={15} strokeWidth={2.2} />
        </button>

        {reaction.src && (
          <video
            key={reaction.src}
            src={reaction.src}
            autoPlay
            loop
            muted
            playsInline
            aria-hidden="true"
            style={{
              width: '100%',
              maxHeight: 260,
              objectFit: 'cover',
              display: 'block',
              background: '#0b0d14'
            }}
          />
        )}

        <div style={{ padding: '18px 22px 22px', textAlign: 'center' }}>
          <div
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: reaction.tint,
              marginBottom: 9
            }}
          >
            {reaction.label}
          </div>
          <p
            style={{
              margin: 0,
              fontSize: '1.16rem',
              fontWeight: 600,
              lineHeight: 1.32,
              color: '#fff',
              letterSpacing: '-0.01em'
            }}
          >
            {reaction.line}
          </p>
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              onClick={handleClose}
              style={{
                padding: '9px 22px',
                borderRadius: 999,
                border: 'none',
                background: reaction.tint,
                color: '#0a0b10',
                font: 'inherit',
                fontSize: '0.87rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Theek hai
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
