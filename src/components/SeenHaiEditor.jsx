import React, { useState } from 'react';
import { Shuffle, RotateCcw } from 'lucide-react';
import { SEEN_HAI } from '../data/seenHai';
import { RSVP_ICON } from '../lib/icons';

/**
 * Lets the host write their own wording for the three Seen Hai replies.
 *
 * This is the piece that was missing: the guest view already reads
 * `customization.rsvpOptions[...].title` and prefers it over the defaults, and
 * the studio already published that object — it just always published the stock
 * labels, with no way to change them.
 *
 * Rather than an empty box per reply, each row offers real suggestions pulled
 * from that status's line pool, so a host can tap "Gadi nikal, chabi kaha hai?"
 * instead of inventing something. Shuffle deals three fresh ones.
 */
const ORDER = [
  { key: 'yes', status: 'going' },
  { key: 'maybe', status: 'maybe' },
  { key: 'no', status: 'not_going' }
];

function sample(pool, n) {
  const copy = [...pool];
  const out = [];
  while (out.length < n && copy.length) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}

export default function SeenHaiEditor({ value, onChange, accent = '#f5b544' }) {
  // Three suggestions per status, reshuffled on demand.
  const [suggestions, setSuggestions] = useState(() => ({
    going: sample(SEEN_HAI.going.lines, 3),
    maybe: sample(SEEN_HAI.maybe.lines, 3),
    not_going: sample(SEEN_HAI.not_going.lines, 3)
  }));

  const set = (key, title) => onChange({ ...value, [key]: { ...value[key], title } });

  const reshuffle = (status) =>
    setSuggestions((s) => ({ ...s, [status]: sample(SEEN_HAI[status].lines, 3) }));

  const resetAll = () =>
    onChange({
      yes: { title: SEEN_HAI.going.label, sub: SEEN_HAI.going.sub },
      maybe: { title: SEEN_HAI.maybe.label, sub: SEEN_HAI.maybe.sub },
      no: { title: SEEN_HAI.not_going.label, sub: SEEN_HAI.not_going.sub }
    });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
          What the three buttons say on your invite. Tap a suggestion or write your own.
        </p>
        <button
          type="button"
          onClick={resetAll}
          className="lp-chip"
          style={{ padding: '5px 10px', fontSize: '0.74rem', flexShrink: 0 }}
        >
          <RotateCcw size={11} strokeWidth={2.2} />
          <span>Reset</span>
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {ORDER.map(({ key, status }) => {
          const cfg = SEEN_HAI[status];
          const Icon = RSVP_ICON[status];
          const current = value[key]?.title ?? '';
          return (
            <div
              key={key}
              style={{
                padding: '13px 14px',
                borderRadius: 12,
                border: `1px solid ${cfg.tint}33`,
                background: `${cfg.tint}0a`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                <Icon size={15} strokeWidth={2} color={cfg.tint} />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: cfg.tint }}>
                  {cfg.sub}
                </span>
                <button
                  type="button"
                  onClick={() => reshuffle(status)}
                  aria-label={`Shuffle ${cfg.sub} suggestions`}
                  style={{
                    marginLeft: 'auto',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    font: 'inherit',
                    fontSize: '0.72rem',
                    color: 'rgba(255,255,255,0.38)',
                    cursor: 'pointer'
                  }}
                >
                  <Shuffle size={11} strokeWidth={2.2} />
                  Shuffle
                </button>
              </div>

              <input
                type="text"
                value={current}
                onChange={(e) => set(key, e.target.value)}
                placeholder={cfg.label}
                maxLength={40}
                aria-label={`Wording for the ${cfg.sub} reply`}
                style={{
                  width: '100%',
                  padding: '9px 11px',
                  borderRadius: 9,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(0,0,0,0.26)',
                  color: '#fff',
                  font: 'inherit',
                  fontSize: '0.87rem',
                  boxSizing: 'border-box',
                  marginBottom: 8
                }}
              />

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {suggestions[status].map((line) => (
                  <button
                    key={line}
                    type="button"
                    onClick={() => set(key, line)}
                    title={line}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 999,
                      cursor: 'pointer',
                      font: 'inherit',
                      fontSize: '0.74rem',
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      border: current === line ? `1px solid ${cfg.tint}` : '1px solid rgba(255,255,255,0.1)',
                      background: current === line ? `${cfg.tint}22` : 'rgba(255,255,255,0.03)',
                      color: current === line ? cfg.tint : 'rgba(255,255,255,0.6)'
                    }}
                  >
                    {line}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ margin: '12px 0 0', fontSize: '0.76rem', color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
        Whatever you write here replaces the default wording. The reaction clips and
        one-liners your guests see afterwards stay random.
      </p>
    </div>
  );
}
