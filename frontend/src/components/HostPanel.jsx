import React, { useCallback, useEffect, useState } from 'react';
import { Users, Check, Clock, X as XIcon, Mail, UtensilsCrossed, RefreshCw, ChevronDown } from 'lucide-react';
import { api } from '../services/api';
import { STATUS_LABEL } from '../data/seenHai';
import { useLiveEvent, useRefreshOnFocus } from '../hooks/useSSE';

/**
 * What the host sees on their own invitation.
 *
 * Previously a host got a "Host Mode Active" banner and nothing else — no way to
 * see who had replied, what they said, their contact, plus-ones or dietary notes.
 * That data existed in the database the whole time with a policy permitting the
 * host to read it; nothing surfaced it.
 *
 * Only rendered when the database says `is_host`, and the RPC behind it refuses
 * anybody else, so this is not a client-side gate.
 */
const STATUS_META = {
  going: { Icon: Check, tint: '#34d399' },
  maybe: { Icon: Clock, tint: '#fbbf24' },
  not_going: { Icon: XIcon, tint: '#f87171' }
};

export default function HostPanel({ slug, eventId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [filter, setFilter] = useState('all');
  // Briefly highlights the header when the list changes on its own, so a host
  // watching the page knows something arrived rather than wondering whether the
  // number was always that.
  const [justUpdated, setJustUpdated] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api.getEventGuests(slug));
    } catch (e) {
      setError(e.message || 'Could not load your guest list.');
    } finally {
      setLoading(false);
    }
  };

  /** Background refresh: no spinner, so the list does not blank out. */
  const refreshQuietly = useCallback(async () => {
    try {
      setData(await api.getEventGuests(slug));
      setJustUpdated(true);
      setTimeout(() => setJustUpdated(false), 2200);
    } catch {
      // Leave the current list in place on failure.
    }
  }, [slug]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Live: a guest replied or left a note.
  useLiveEvent(eventId, refreshQuietly, 'host-panel');
  useRefreshOnFocus(refreshQuietly);

  const counts = data?.counts;
  const guests = data?.guests || [];
  const shown = filter === 'all' ? guests : guests.filter((g) => g.status === filter);

  const stat = (label, value, tint) => (
    <div style={{ flex: 1, minWidth: 76 }}>
      <div style={{ fontSize: '1.35rem', fontWeight: 700, color: tint || '#fff', lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{label}</div>
    </div>
  );

  return (
    <section
      style={{
        marginBottom: 22,
        borderRadius: 18,
        border: '1px solid rgba(245,181,68,0.3)',
        background: 'rgba(245,181,68,0.05)',
        overflow: 'hidden'
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '14px 18px',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          font: 'inherit',
          textAlign: 'left'
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Users size={16} strokeWidth={2} color="#f5b544" />
          <span style={{ fontSize: '0.94rem', fontWeight: 700, color: '#fff' }}>
            Your guest list
          </span>
          <span
            style={{
              fontSize: '0.72rem',
              padding: '2px 8px',
              borderRadius: 999,
              background: 'rgba(245,181,68,0.18)',
              color: '#f5b544',
              fontWeight: 700
            }}
          >
            host only
          </span>
          {justUpdated && (
            <span
              role="status"
              style={{
                fontSize: '0.72rem',
                padding: '2px 8px',
                borderRadius: 999,
                background: 'rgba(52,211,153,0.16)',
                color: '#34d399',
                fontWeight: 600
              }}
            >
              just updated
            </span>
          )}
        </span>
        <ChevronDown
          size={17}
          strokeWidth={2}
          color="rgba(255,255,255,0.5)"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
        />
      </button>

      {open && (
        <div style={{ padding: '0 18px 18px' }}>
          {loading && (
            <div style={{ padding: '12px 0', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
              Loading…
            </div>
          )}

          {error && (
            <div role="alert" style={{ padding: '10px 0', fontSize: '0.85rem', color: '#fecaca' }}>
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 14,
                  padding: '12px 0 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.07)',
                  marginBottom: 14
                }}
              >
                {stat('Coming', counts.going, '#34d399')}
                {stat('Maybe', counts.maybe, '#fbbf24')}
                {stat("Can't", counts.notGoing, '#f87171')}
                {stat('Plus ones', counts.plusOnes)}
                {stat('Head count', counts.headCount, '#f5b544')}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: 'Everyone' },
                  { id: 'going', label: 'Coming' },
                  { id: 'maybe', label: 'Maybe' },
                  { id: 'not_going', label: "Can't" }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className="lp-chip"
                    aria-pressed={filter === f.id}
                    style={{ fontSize: '0.79rem', padding: '6px 13px' }}
                  >
                    {f.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={load}
                  className="lp-chip"
                  style={{ fontSize: '0.79rem', padding: '6px 13px', marginLeft: 'auto' }}
                  aria-label="Refresh guest list"
                >
                  <RefreshCw size={13} strokeWidth={2} />
                  <span>Refresh</span>
                </button>
              </div>

              {shown.length === 0 ? (
                <p style={{ margin: 0, fontSize: '0.86rem', color: 'rgba(255,255,255,0.45)' }}>
                  {guests.length === 0
                    ? 'Nobody has replied yet. Share the link and they will show up here.'
                    : 'Nobody in this group yet.'}
                </p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {shown.map((g) => {
                    const meta = STATUS_META[g.status] || STATUS_META.maybe;
                    return (
                      <li
                        key={g.id}
                        style={{
                          padding: '11px 13px',
                          borderRadius: 12,
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.06)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                          <meta.Icon size={14} strokeWidth={2.3} color={meta.tint} />
                          <strong style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 600 }}>
                            {g.name}
                          </strong>
                          {g.plusOnes > 0 && (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                padding: '1px 7px',
                                borderRadius: 999,
                                background: 'rgba(255,255,255,0.08)',
                                color: 'rgba(255,255,255,0.7)'
                              }}
                            >
                              +{g.plusOnes}
                            </span>
                          )}
                          <span style={{ fontSize: '0.76rem', color: meta.tint, marginLeft: 'auto' }}>
                            {STATUS_LABEL[g.status] || g.status}
                          </span>
                        </div>

                        {(g.contact || g.dietaryNotes) && (
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '4px 14px',
                              marginTop: 7,
                              fontSize: '0.78rem',
                              color: 'rgba(255,255,255,0.55)'
                            }}
                          >
                            {g.contact && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                <Mail size={12} strokeWidth={1.8} />
                                {g.contact}
                              </span>
                            )}
                            {g.dietaryNotes && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                <UtensilsCrossed size={12} strokeWidth={1.8} />
                                {g.dietaryNotes}
                              </span>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
