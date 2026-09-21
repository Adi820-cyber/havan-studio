import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, AtSign, Camera, Aperture, ListMusic, Music, MapPin, Check, Link as LinkIcon, Eye, EyeOff
} from 'lucide-react';
import { api } from '../services/api';
import Avatar from './Avatar';

/**
 * The profile.
 *
 * The account used to be a login and nothing else: a display name in JWT
 * metadata, an emoji, and no way for one person to be recognisable to another.
 * That is fine for a card generator and wrong for a product where the same
 * people keep showing up in each other's evenings — a guest at four parties and
 * a host of one is one person, and both halves of that are worth keeping.
 *
 * So: a username, which is the part that was missing entirely and is what makes
 * a profile addressable at all; the links this cohort actually identifies each
 * other by; and two counts that come from real rows rather than a vanity
 * number — gatherings thrown and gatherings shown up to, both counted only once
 * they have happened.
 *
 * Deliberately not here: an email field, a follower count, or anything that
 * implies a social graph the product does not have yet.
 */

const AVATARS = Array.from({ length: 67 }, (_, i) => `/avatars/png/${i + 1}.png`);

export default function ProfilePanel({ onBack, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [stats, setStats] = useState({ hosted: 0, attended: 0 });

  const [form, setForm] = useState({
    displayName: '',
    handle: '',
    bio: '',
    city: '',
    avatarUrl: '',
    isPublic: true,
    instagram: '',
    vsco: '',
    spotify: '',
    playlistUrl: ''
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const p = await api.getMyProfile();
        if (!alive || !p) return;
        setStats(p.stats);
        setForm({
          displayName: p.displayName || '',
          handle: p.handle || '',
          bio: p.bio || '',
          city: p.city || '',
          avatarUrl: p.avatarUrl || '',
          isPublic: p.isPublic !== false,
          instagram: p.socials.instagram || '',
          vsco: p.socials.vsco || '',
          spotify: p.socials.spotify || '',
          playlistUrl: p.socials.playlistUrl || ''
        });
      } catch (err) {
        if (alive) setError(err.message || 'Could not load your profile.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const set = (key) => (e) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      const updated = await api.updateMyProfile(form);
      if (updated) {
        setStats(updated.stats);
        setSaved(true);
        if (onSaved) onSaved(updated);
      }
    } catch (err) {
      setError(err.message || 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  const label = {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 6
  };

  const input = {
    width: '100%',
    padding: '11px 13px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    font: 'inherit',
    fontSize: '0.9rem',
    boxSizing: 'border-box'
  };

  /** A text input with a fixed prefix glyph inside the box. */
  const prefixed = (id, Icon, prefix, key, placeholder) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 13px',
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.04)'
      }}
    >
      <Icon size={14} strokeWidth={1.8} color="rgba(255,255,255,0.4)" style={{ flexShrink: 0 }} />
      {prefix && <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.9rem' }}>{prefix}</span>}
      <input
        id={id}
        type="text"
        value={form[key]}
        onChange={set(key)}
        placeholder={placeholder}
        style={{
          ...input,
          border: 'none',
          background: 'none',
          padding: '11px 0',
          borderRadius: 0
        }}
      />
    </div>
  );

  const section = (text) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '32px 0 16px' }}>
      <span
        aria-hidden="true"
        style={{ width: 3, height: 14, borderRadius: 2, background: 'linear-gradient(#f5b544, #ec4899)', flexShrink: 0 }}
      />
      <span
        style={{
          fontSize: '0.73rem',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.55)'
        }}
      >
        {text}
      </span>
    </div>
  );

  return (
    <div className="lp-scope" style={{ minHeight: '100vh', background: '#08090f', color: '#f5f7fa' }}>
      <div className="lp-grain" aria-hidden="true" />

      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'rgba(8,9,15,0.9)',
          backdropFilter: 'blur(14px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)'
        }}
      >
        <div
          style={{
            maxWidth: 720,
            margin: '0 auto',
            padding: '0 22px',
            height: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14
          }}
        >
          <button type="button" onClick={onBack} className="lp-chip" style={{ padding: '7px 13px' }}>
            <ArrowLeft size={14} strokeWidth={2} />
            <span>Back</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="lp-btn lp-btn-primary"
            style={{ padding: '9px 20px', fontSize: '0.88rem', opacity: saving || loading ? 0.6 : 1 }}
          >
            {saved && !saving ? <Check size={15} strokeWidth={2.4} /> : null}
            <span>{saving ? 'Saving…' : saved ? 'Saved' : 'Save'}</span>
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '30px 22px 70px' }}>
        {loading ? (
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>Loading…</p>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 6 }}>
              <Avatar name={form.displayName || 'You'} avatarUrl={form.avatarUrl} size={54} />
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>
                  {form.displayName || 'Your name'}
                </div>
                <div style={{ fontSize: '0.86rem', color: 'rgba(255,255,255,0.42)', marginTop: 2 }}>
                  {form.handle ? `@${form.handle}` : 'no username yet'}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 20, textAlign: 'right' }}>
                {[
                  { n: stats.hosted, l: 'thrown' },
                  { n: stats.attended, l: 'shown up to' }
                ].map((s) => (
                  <div key={s.l}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fff', lineHeight: 1 }}>{s.n}</div>
                    <div style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {section('Privacy')}
            
            <div style={{ marginBottom: 24 }}>
              <button
                type="button"
                onClick={() => { setSaved(false); setForm(f => ({ ...f, isPublic: !f.isPublic })); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: '16px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                {form.isPublic ? (
                  <Eye size={20} color="#34d399" />
                ) : (
                  <EyeOff size={20} color="#f472b6" />
                )}
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                    {form.isPublic ? 'Public Profile' : 'Private Profile'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                    {form.isPublic 
                      ? 'Anyone can view your profile at havan.studio/profile/yourname' 
                      : 'Your profile is hidden from the public'}
                  </div>
                </div>
              </button>
            </div>

            {section('Who you are')}

            <div style={{ marginBottom: 18 }}>
              <label htmlFor="p-name" style={label}>Name</label>
              <input
                id="p-name"
                type="text"
                value={form.displayName}
                onChange={set('displayName')}
                placeholder="What your friends call you"
                style={input}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label htmlFor="p-handle" style={label}>
                Username
                <span style={{ color: 'rgba(255,255,255,0.32)' }}> — letters, numbers, dots and underscores</span>
              </label>
              {prefixed('p-handle', AtSign, '@', 'handle', 'yourname')}
            </div>

            <div style={{ marginBottom: 18 }}>
              <label htmlFor="p-bio" style={label}>Bio</label>
              <textarea
                id="p-bio"
                rows={2}
                maxLength={280}
                value={form.bio}
                onChange={set('bio')}
                placeholder="One line. Who shows up when you throw something."
                style={{ ...input, resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label htmlFor="p-city" style={label}>City</label>
              {prefixed('p-city', MapPin, '', 'city', 'Mumbai')}
            </div>

            <div style={{ marginBottom: 6 }}>
              <span style={label}>Avatar</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: 10, maxHeight: 300, overflowY: 'auto', padding: 10, background: 'rgba(255,255,255,0.02)', borderRadius: 12 }}>
                {AVATARS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => { setSaved(false); setForm((f) => ({ ...f, avatarUrl: a })); }}
                    aria-pressed={form.avatarUrl === a}
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      padding: 0,
                      overflow: 'hidden',
                      background: form.avatarUrl === a ? 'rgba(245,181,68,0.14)' : 'rgba(255,255,255,0.04)',
                      border: form.avatarUrl === a ? '2px solid #f5b544' : '2px solid transparent',
                      transition: 'all 0.2s'
                    }}
                  >
                    <img src={a} alt="avatar option" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            </div>

            {section('Where else you are')}

            <p style={{ margin: '-6px 0 16px', fontSize: '0.82rem', lineHeight: 1.55, color: 'rgba(255,255,255,0.45)' }}>
              All optional, all public. Paste a full URL if it's easier — the handle gets
              pulled out of it.
            </p>

            <div style={{ marginBottom: 18 }}>
              <label htmlFor="p-ig" style={label}>Instagram</label>
              {prefixed('p-ig', Camera, '@', 'instagram', 'yourname')}
            </div>

            <div style={{ marginBottom: 18 }}>
              <label htmlFor="p-vsco" style={label}>VSCO</label>
              {prefixed('p-vsco', Aperture, '', 'vsco', 'yourname')}
            </div>

            <div style={{ marginBottom: 18 }}>
              <label htmlFor="p-spotify" style={label}>Spotify</label>
              {prefixed('p-spotify', Music, '', 'spotify', 'yourname')}
            </div>

            <div style={{ marginBottom: 22 }}>
              <label htmlFor="p-playlist" style={label}>
                Playlist link
                <span style={{ color: 'rgba(255,255,255,0.32)' }}> — the one you'd put on</span>
              </label>
              {prefixed('p-playlist', ListMusic, '', 'playlistUrl', 'https://open.spotify.com/playlist/…')}
            </div>

            {error && (
              <div
                role="alert"
                style={{
                  display: 'flex',
                  gap: 8,
                  padding: '11px 13px',
                  borderRadius: 11,
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.35)',
                  fontSize: '0.85rem',
                  color: '#fecaca',
                  marginBottom: 16
                }}
              >
                <LinkIcon size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="lp-btn lp-btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: '0.94rem', opacity: saving ? 0.6 : 1 }}
            >
              <span>{saving ? 'Saving…' : saved ? 'Saved' : 'Save profile'}</span>
            </button>
          </>
        )}
      </main>
    </div>
  );
}
