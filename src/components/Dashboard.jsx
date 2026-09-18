import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, CalendarDays, MapPin, Users, Ticket, Plus, AtSign,
  Camera, Aperture, ListMusic, Pencil, ExternalLink
} from 'lucide-react';
import { api } from '../services/api';
import Avatar from './Avatar';

/**
 * What a signed-in person sees at "/".
 *
 * Before this, the root route rendered the marketing landing page to everybody —
 * so someone with four invitations out and replies coming in was shown "Build an
 * invite in a couple of minutes, send it as a link", every visit, forever. Their
 * own gatherings existed only inside a modal behind a button in the navbar,
 * which is a strange place to keep the thing the account is *for*.
 *
 * The split now is the normal one: logged out gets the pitch, logged in gets
 * their stuff. The landing page is still reachable at #/about for anyone who
 * wants to look at it.
 *
 * Sorting is by time, not by hosted-versus-attending, because "what is happening
 * next" is the question someone opens this to answer. Whether they are throwing
 * it or going to it is a label on the card.
 */

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function Dashboard({ profile, currentUser, onOpenMaker, onOpenCheckInvite, onOpenProfile }) {
  const [invites, setInvites] = useState({ hosted: [], accepted: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await api.getMyInvites();
        if (alive) setInvites(data || { hosted: [], accepted: [] });
      } catch (err) {
        if (alive) setError(err.message || 'Could not load your gatherings.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // One list, tagged by role. An event you host *and* replied to would otherwise
  // appear twice; hosting wins, since that is the more consequential role.
  const { upcoming, past } = useMemo(() => {
    const seen = new Set();
    const all = [];

    for (const e of invites.hosted) {
      seen.add(e.id);
      all.push({ ...e, role: 'hosting' });
    }
    for (const e of invites.accepted) {
      if (seen.has(e.id)) continue;
      all.push({ ...e, role: e.myStatus === 'going' ? 'going' : e.myStatus === 'maybe' ? 'maybe' : 'replied' });
    }

    const cutoff = startOfToday();
    const isUpcoming = (e) => e.startsAt && e.startsAt >= cutoff;

    return {
      upcoming: all.filter(isUpcoming).sort((a, b) => a.startsAt - b.startsAt),
      past: all.filter((e) => !isUpcoming(e)).sort((a, b) => (b.startsAt || 0) - (a.startsAt || 0))
    };
  }, [invites]);

  const name = profile?.displayName || currentUser?.name || 'there';
  const handle = profile?.handle;
  const socials = profile?.socials || {};
  const hasSocials = Boolean(socials.instagram || socials.vsco || socials.spotify || socials.playlistUrl);

  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Still up' : hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';

  const roleChip = {
    hosting: { text: 'You’re hosting', tint: '#f5b544' },
    going: { text: 'You’re going', tint: '#34d399' },
    maybe: { text: 'You said maybe', tint: '#fbbf24' },
    replied: { text: 'You replied', tint: 'rgba(255,255,255,0.4)' }
  };

  const card = (e) => {
    const chip = roleChip[e.role] || roleChip.replied;
    return (
      <a
        key={e.id}
        href={`/invite/${e.slug}`}
        style={{
          display: 'flex',
          gap: 14,
          padding: 12,
          borderRadius: 14,
          textDecoration: 'none',
          color: 'inherit',
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.03)'
        }}
      >
        <div
          style={{
            width: 78,
            height: 78,
            borderRadius: 10,
            flexShrink: 0,
            overflow: 'hidden',
            background: '#0b0d14'
          }}
        >
          {e.coverImage && (
            <img
              src={e.coverImage}
              alt=""
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: '0.67rem',
              fontWeight: 700,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              color: chip.tint,
              marginBottom: 4
            }}
          >
            {chip.text}
          </div>
          <div
            style={{
              fontSize: '0.97rem',
              fontWeight: 600,
              color: '#fff',
              lineHeight: 1.25,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {e.title}
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '3px 12px',
              marginTop: 5,
              fontSize: '0.79rem',
              color: 'rgba(255,255,255,0.5)'
            }}
          >
            {e.startsAt && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <CalendarDays size={12} strokeWidth={1.8} />
                {e.startsAt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                {' · '}
                {e.startsAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
            {e.venueName && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <MapPin size={12} strokeWidth={1.8} />
                {e.venueName}
              </span>
            )}
            {e.role === 'hosting' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Users size={12} strokeWidth={1.8} />
                {e.goingCount} going
              </span>
            )}
          </div>
        </div>
      </a>
    );
  };

  const sectionTitle = (text, count) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, margin: '0 0 14px' }}>
      <h2 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 600, color: '#fff' }}>{text}</h2>
      {count != null && (
        <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.35)' }}>{count}</span>
      )}
    </div>
  );

  return (
    <main className="lp-container" style={{ paddingTop: 96, paddingBottom: 80 }}>
      {/* ── greeting + actions ── */}
      <div
        className="lp-pair"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 18,
          flexWrap: 'wrap',
          marginBottom: 30
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar name={name} size={46} />
          <div>
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
                fontSize: 'clamp(1.5rem, 3vw, 2rem)',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: '#f7f8fa'
              }}
            >
              {greeting}, {name.split(' ')[0]}
            </h1>
            {handle ? (
              <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.42)', marginTop: 2 }}>
                @{handle}
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenProfile}
                style={{
                  marginTop: 4,
                  padding: 0,
                  border: 'none',
                  background: 'none',
                  font: 'inherit',
                  fontSize: '0.85rem',
                  color: '#f5b544',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5
                }}
              >
                <AtSign size={13} strokeWidth={2} />
                Pick a username
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={onOpenCheckInvite} className="lp-btn lp-btn-ghost">
            <Ticket size={16} strokeWidth={1.9} />
            <span>Open an invite code</span>
          </button>
          <button type="button" onClick={() => onOpenMaker('all')} className="lp-btn lp-btn-primary">
            <Plus size={16} strokeWidth={2.1} />
            <span>Throw something</span>
          </button>
        </div>
      </div>

      <div
        className="lp-pair"
        style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 30, alignItems: 'start' }}
      >
        {/* ── the gatherings ── */}
        <div>
          {error && (
            <div
              role="alert"
              style={{
                padding: '11px 13px',
                borderRadius: 11,
                marginBottom: 18,
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.35)',
                fontSize: '0.85rem',
                color: '#fecaca'
              }}
            >
              {error}
            </div>
          )}

          {loading ? (
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>Loading your gatherings…</p>
          ) : upcoming.length === 0 && past.length === 0 ? (
            <div
              style={{
                padding: '34px 26px',
                borderRadius: 16,
                textAlign: 'center',
                border: '1px dashed rgba(255,255,255,0.14)',
                background: 'rgba(255,255,255,0.02)'
              }}
            >
              <h2 style={{ margin: '0 0 8px', fontSize: '1.08rem', fontWeight: 600, color: '#fff' }}>
                Nothing on yet
              </h2>
              <p style={{ margin: '0 0 20px', fontSize: '0.9rem', lineHeight: 1.6, color: 'rgba(255,255,255,0.5)' }}>
                Throw the first thing, or open an invite someone sent you. Both end up here.
              </p>
              <button type="button" onClick={() => onOpenMaker('all')} className="lp-btn lp-btn-primary">
                <span>Throw something</span>
                <ArrowRight size={16} strokeWidth={2} />
              </button>
            </div>
          ) : (
            <>
              {upcoming.length > 0 && (
                <section style={{ marginBottom: 34 }}>
                  {sectionTitle('Coming up', upcoming.length)}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {upcoming.map(card)}
                  </div>
                </section>
              )}

              {past.length > 0 && (
                <section>
                  {sectionTitle('Already happened', past.length)}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: 0.72 }}>
                    {past.slice(0, 8).map(card)}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        {/* ── the profile rail ── */}
        <aside
          style={{
            padding: 18,
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span
              style={{
                fontSize: '0.71rem',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.4)'
              }}
            >
              Your profile
            </span>
            <button type="button" onClick={onOpenProfile} className="lp-chip" style={{ padding: '5px 10px', fontSize: '0.75rem' }}>
              <Pencil size={11} strokeWidth={2} />
              <span>Edit</span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: 22, marginBottom: 16 }}>
            {[
              { n: profile?.stats?.hosted ?? 0, l: 'thrown' },
              { n: profile?.stats?.attended ?? 0, l: 'shown up to' }
            ].map((s) => (
              <div key={s.l}>
                <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#fff', lineHeight: 1 }}>{s.n}</div>
                <div style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.42)', marginTop: 4 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {profile?.bio && (
            <p style={{ margin: '0 0 14px', fontSize: '0.85rem', lineHeight: 1.55, color: 'rgba(255,255,255,0.62)' }}>
              {profile.bio}
            </p>
          )}

          {hasSocials ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {socials.instagram && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem', color: 'rgba(255,255,255,0.6)' }}>
                  <Camera size={13} strokeWidth={1.8} />@{socials.instagram}
                </span>
              )}
              {socials.vsco && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem', color: 'rgba(255,255,255,0.6)' }}>
                  <Aperture size={13} strokeWidth={1.8} />{socials.vsco}
                </span>
              )}
              {socials.playlistUrl && (
                <a
                  href={socials.playlistUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem', color: '#f5b544', textDecoration: 'none' }}
                >
                  <ListMusic size={13} strokeWidth={1.8} />
                  Playlist
                  <ExternalLink size={11} strokeWidth={1.8} />
                </a>
              )}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: '0.83rem', lineHeight: 1.55, color: 'rgba(255,255,255,0.38)' }}>
              Add your socials and a playlist so people know whose party they're at.
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}
