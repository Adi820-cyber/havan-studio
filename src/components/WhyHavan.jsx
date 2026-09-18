import React from 'react';
import { MessageSquareOff, PartyPopper } from 'lucide-react';
import { Reveal } from '../lib/icons';

/**
 * The argument.
 *
 * The landing page explained *what the product does* and never said what it is
 * instead of. Nobody is comparing this to a competitor — they are comparing it
 * to the group chat, because that is where their last four parties were
 * organised. So name that, and be specific enough that it reads as observed
 * rather than as marketing.
 *
 * The right-hand column only claims things the app actually does today: replies
 * are counted, the address is gated behind an RSVP, logistics live on the invite,
 * and replies close before the party. No invented statistics — the old page had
 * "94.6% Avg. RSVP Turnout" and a testimonial wall for a product with no users,
 * and asking strangers for their phone number under a fabricated number is a bad
 * trade.
 */

const ROWS = [
  {
    q: 'Who’s actually coming?',
    chat: 'Twelve 👍 reactions, four of which are jokes. You count them by scrolling.',
    havan: 'A number. It moves when someone replies, and when they bail.'
  },
  {
    q: 'Where is it?',
    chat: 'Pinned somewhere in 200 messages, then screenshotted into three other groups.',
    havan: 'Exact address once you reply. The door code too.'
  },
  {
    q: 'Do I bring anything?',
    chat: 'Asked six separate times. Answered twice. Everyone brings Old Monk.',
    havan: 'House rules, written once, on the invite. BYOB, shoes off, out by two.'
  },
  {
    q: 'Can I still say yes at 11pm?',
    chat: 'Sure, and you will, and there won’t be enough food.',
    havan: 'Replies close two hours before. Final is final.'
  }
];

export default function WhyHavan() {
  return (
    <section id="why" className="lp-section">
      <div className="lp-container">
        <Reveal className="lp-head">
          <div className="lp-eyebrow">Why bother</div>
          <h2 className="lp-h2">The group chat is where plans go to die</h2>
          <p className="lp-sub">
            You’ve organised a party in a WhatsApp group. You know how it went.
          </p>
        </Reveal>

        <Reveal
          style={{
            borderRadius: 18,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.02)'
          }}
        >
          {/* Column headers */}
          <div
            className="lp-why-row"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1fr) minmax(0, 1fr)',
              gap: 0,
              borderBottom: '1px solid rgba(255,255,255,0.08)'
            }}
          >
            <div style={{ padding: '14px 18px' }} />
            <div
              style={{
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.74rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.38)',
                borderLeft: '1px solid rgba(255,255,255,0.06)'
              }}
            >
              <MessageSquareOff size={13} strokeWidth={1.9} />
              The group chat
            </div>
            <div
              style={{
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.74rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#f5b544',
                borderLeft: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(245,181,68,0.05)'
              }}
            >
              <PartyPopper size={13} strokeWidth={1.9} />
              Here
            </div>
          </div>

          {ROWS.map((row, i) => (
            <div
              key={row.q}
              className="lp-why-row"
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1fr) minmax(0, 1fr)',
                borderBottom: i === ROWS.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.06)'
              }}
            >
              <div
                style={{
                  padding: '18px',
                  fontSize: '0.93rem',
                  fontWeight: 600,
                  color: '#fff',
                  lineHeight: 1.4
                }}
              >
                {row.q}
              </div>
              <div
                style={{
                  padding: '18px',
                  fontSize: '0.88rem',
                  lineHeight: 1.55,
                  color: 'rgba(255,255,255,0.45)',
                  borderLeft: '1px solid rgba(255,255,255,0.06)'
                }}
              >
                {row.chat}
              </div>
              <div
                style={{
                  padding: '18px',
                  fontSize: '0.88rem',
                  lineHeight: 1.55,
                  color: 'rgba(255,255,255,0.78)',
                  borderLeft: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(245,181,68,0.035)'
                }}
              >
                {row.havan}
              </div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
