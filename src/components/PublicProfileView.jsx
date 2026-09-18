import React, { useEffect, useState } from 'react';
import { ArrowLeft, MapPin, Camera, Aperture, Music, ListMusic, CalendarDays, Ticket } from 'lucide-react';
import { api } from '../services/api';
import Avatar from './Avatar';

export default function PublicProfileView({ handle, onBack, currentUser, onOpenAuth }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    if (!handle) return;
    
    setLoading(true);
    setError('');

    api.getPublicProfile(handle)
      .then(p => {
        if (!alive) return;
        if (!p) {
          setError('Profile not found or is private.');
        } else {
          setProfile(p);
        }
      })
      .catch(err => {
        if (!alive) return;
        setError('Profile not found or is private.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => { alive = false; };
  }, [handle]);

  if (loading) {
    return (
      <div className="lp-scope" style={{ minHeight: '100vh', background: '#08090f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>Loading profile…</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="lp-scope" style={{ minHeight: '100vh', background: '#08090f', color: '#f5f7fa' }}>
        <div className="lp-grain" aria-hidden="true" />
        <header style={{ padding: '20px 22px' }}>
          <button type="button" onClick={onBack} className="lp-chip" style={{ padding: '7px 13px' }}>
            <ArrowLeft size={14} strokeWidth={2} />
            <span>Back</span>
          </button>
        </header>
        <main style={{ maxWidth: 400, margin: '10vh auto 0', textAlign: 'center', padding: '0 22px' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔒</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 600, marginBottom: 8 }}>{error}</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>
            This username doesn't exist, or the host has set their profile to private.
          </p>
        </main>
      </div>
    );
  }

  // Social links mapping
  const socials = [
    { key: 'instagram', icon: Camera, urlPrefix: 'https://instagram.com/', label: 'Instagram' },
    { key: 'vsco', icon: Aperture, urlPrefix: 'https://vsco.co/', label: 'VSCO' },
    { key: 'spotify', icon: Music, urlPrefix: 'https://open.spotify.com/user/', label: 'Spotify' },
    { key: 'playlistUrl', icon: ListMusic, urlPrefix: '', label: 'Playlist', isFullUrl: true }
  ];

  return (
    <div className="lp-scope" style={{ minHeight: '100vh', background: '#08090f', color: '#f5f7fa' }}>
      <div className="lp-ambient" aria-hidden="true" />
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
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 22px', height: 60, display: 'flex', alignItems: 'center' }}>
          <button type="button" onClick={onBack} className="lp-chip" style={{ padding: '7px 13px' }}>
            <ArrowLeft size={14} strokeWidth={2} />
            <span>Back</span>
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 560, margin: '0 auto', padding: '40px 22px 80px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <Avatar name={profile.displayName} avatarUrl={profile.avatarUrl} size={96} style={{ marginBottom: 20 }} />
          
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0 0 4px', color: '#fff' }}>
            {profile.displayName}
          </h1>
          <div style={{ fontSize: '1.05rem', color: '#ec4899', fontWeight: 500, marginBottom: 16 }}>
            @{profile.handle}
          </div>

          {profile.bio && (
            <p style={{ fontSize: '1.05rem', lineHeight: 1.5, color: 'rgba(255,255,255,0.8)', maxWidth: 400, margin: '0 0 16px' }}>
              {profile.bio}
            </p>
          )}

          {profile.city && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', marginBottom: 32 }}>
              <MapPin size={16} />
              <span>{profile.city}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 32, marginBottom: 40 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                <CalendarDays size={14} />
                <span>Thrown</span>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff', lineHeight: 1 }}>{profile.stats.hosted}</div>
            </div>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }}></div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                <Ticket size={14} />
                <span>Attended</span>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff', lineHeight: 1 }}>{profile.stats.attended}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
            {socials.map(s => {
              const val = profile.socials[s.key];
              if (!val) return null;
              
              let href = s.isFullUrl ? val : `${s.urlPrefix}${val}`;
              if (!href.startsWith('http')) href = `https://${href}`;

              return (
                <a
                  key={s.key}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lp-chip"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', textDecoration: 'none' }}
                >
                  <s.icon size={16} color="rgba(255,255,255,0.6)" />
                  <span>{s.label}</span>
                </a>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
