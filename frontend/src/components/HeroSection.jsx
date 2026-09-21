import React from 'react';
import { ArrowRight, Ticket } from 'lucide-react';
import InteractiveCard from './InteractiveCard';
import { CATEGORY_ICON, LiveDot, Reveal } from '../lib/icons';

/**
 * Hero.
 *
 * Previously this offered six competing actions above the fold — four category
 * buttons, "Create Event", "Explore Live Presets" — plus a nine-template vibe
 * switcher and three invented statistics ("94.6% Avg. RSVP Turnout"). A first
 * visitor had to choose before understanding anything.
 *
 * Now: one sentence saying what it is, one primary action, one secondary action
 * for people who arrived holding an invite, and the card doing the explaining.
 * The fabricated metrics are gone rather than restated.
 */
export default function HeroSection({
  templates,
  activeTemplate,
  onSelectTemplate,
  onOpenMaker,
  onOpenCheckInvite
}) {
  // One representative template per category keeps the switcher to four options
  // instead of nine near-identical chips.
  const byCategory = ['mehfil', 'happyhours', 'wedding', 'birthday']
    .map((cat) => templates.find((t) => t.category === cat))
    .filter(Boolean);

  return (
    <section className="lp-section" style={{ paddingTop: 132, paddingBottom: 76 }}>
      <div className="lp-container">
        <div
          className="lp-hero-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 64,
            alignItems: 'center'
          }}
        >
          {/* ---------- Narrative ---------- */}
          <Reveal>
            <h1
              style={{
                fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
                fontSize: 'clamp(2.4rem, 4.6vw, 3.85rem)',
                fontWeight: 700,
                lineHeight: 1.06,
                letterSpacing: '-0.035em',
                margin: '0 0 20px',
                color: '#f7f8fa'
              }}
            >
              Stop planning parties
              <br />
              in the group chat.
            </h1>

            <p
              style={{
                fontSize: '1.1rem',
                lineHeight: 1.6,
                color: 'rgba(255,255,255,0.66)',
                maxWidth: 460,
                margin: '0 0 32px'
              }}
            >
              Make the invite, send the link, see who is actually coming. The exact
              address unlocks once they reply, so it does not end up screenshotted
              into three other groups.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 34 }}>
              <button type="button" onClick={() => onOpenMaker('all')} className="lp-btn lp-btn-primary">
                <span>Create an invite</span>
                <ArrowRight size={17} strokeWidth={2} />
              </button>
              <button type="button" onClick={onOpenCheckInvite} className="lp-btn lp-btn-ghost">
                <Ticket size={16} strokeWidth={1.9} />
                <span>I have an invite</span>
              </button>
            </div>

            {/* Category switcher — drives the preview beside it. */}
            <div>
              <div
                style={{
                  fontSize: '0.73rem',
                  fontWeight: 600,
                  letterSpacing: '0.09em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.36)',
                  marginBottom: 11
                }}
              >
                Preview a style
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {byCategory.map((tpl) => {
                  const Icon = CATEGORY_ICON[tpl.category];
                  const on = activeTemplate.id === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => onSelectTemplate(tpl)}
                      className="lp-chip"
                      aria-pressed={on}
                    >
                      <Icon size={14} strokeWidth={1.9} />
                      <span>{tpl.vibeTag}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </Reveal>

          {/* ---------- Live preview ---------- */}
          <Reveal delay={120} style={{ position: 'relative' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginBottom: 12,
                paddingRight: 4
              }}
            >
              {/* Replaces the "⚡ LIVE INTERACTIVE PREVIEW" label. A quiet pulsing
                  dot communicates the same thing without shouting. */}
              <LiveDot label="Interactive preview — try it" />
            </div>
            <InteractiveCard template={activeTemplate} isFeatured />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
