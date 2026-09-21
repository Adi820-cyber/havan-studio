import React, { useState, useEffect } from 'react';
import {
  X, Search, Ticket, Calendar, MapPin, Key, Lock, Unlock,
  Sparkles, ArrowRight, CheckCircle2, AlertCircle, Share2, Eye
} from 'lucide-react';
import { api } from '../services/api';

export default function CheckInviteModal({
  isOpen,
  onClose,
  currentUser,
  onOpenAuth,
  onSelectInvite
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const [activeTab, setActiveTab] = useState('search'); // 'search' | 'accepted' | 'hosted'
  const [userInvites, setUserInvites] = useState({ hosted: [], accepted: [] });
  const [loadingInvites, setLoadingInvites] = useState(false);

  useEffect(() => {
    if (isOpen && currentUser) {
      loadUserInvites();
    }
  }, [isOpen, currentUser]);

  // No contact argument: the backend scopes this to the caller's own session,
  // so there is no parameter through which to request someone else's invites.
  const loadUserInvites = async () => {
    setLoadingInvites(true);
    try {
      const data = await api.getMyInvites();
      setUserInvites(data || { hosted: [], accepted: [] });
    } catch (e) {
      console.error('Failed to load user invites', e);
    } finally {
      setLoadingInvites(false);
    }
  };

  if (!isOpen) return null;

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError('');
    setSearchResult(null);

    try {
      // Exact invite-code lookup. The old endpoint matched title substrings,
      // which let anyone enumerate every gathering with a one-letter query.
      const invite = await api.getInvite(searchQuery.trim());
      if (!invite) {
        setSearchError('No gathering matches that invite code. Check the link your host sent you.');
      } else {
        setSearchResult(invite);
      }
    } catch (err) {
      setSearchError(err.message || 'Could not look up that invite code.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleOpenEvent = (slug) => {
    onClose();
    if (onSelectInvite) {
      onSelectInvite(slug);
    } else {
      window.location.hash = `#/invite/${slug}`;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(5, 7, 12, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '620px',
          maxHeight: '90vh',
          background: 'rgba(15, 19, 32, 0.96)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          borderRadius: '28px',
          boxShadow: '0 25px 70px rgba(0, 0, 0, 0.9), 0 0 35px rgba(255, 64, 125, 0.15)',
          padding: '32px',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '9999px',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            cursor: 'pointer',
            zIndex: 10
          }}
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #ffd700, #ff407d)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem'
              }}
            >
              🎟️
            </div>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>
                Check Invitations & Passes
              </h2>
              <p style={{ fontSize: '0.84rem', color: 'rgba(255, 255, 255, 0.6)', margin: 0 }}>
                Lookup any event code or view your accepted invitations and secret door codes.
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '9999px',
            padding: '4px',
            marginBottom: '20px'
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('search')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '9999px',
              border: 'none',
              background: activeTab === 'search' ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
              color: activeTab === 'search' ? '#fff' : 'rgba(255, 255, 255, 0.6)',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: 'pointer'
            }}
          >
            🔍 Search Code
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('accepted')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '9999px',
              border: 'none',
              background: activeTab === 'accepted' ? 'rgba(16, 185, 129, 0.22)' : 'transparent',
              color: activeTab === 'accepted' ? '#34d399' : 'rgba(255, 255, 255, 0.6)',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <span>🍾 Accepted RSVPs</span>
            {userInvites.accepted?.length > 0 && (
              <span style={{ background: '#10b981', color: '#000', borderRadius: '9999px', padding: '1px 6px', fontSize: '0.72rem', fontWeight: 800 }}>
                {userInvites.accepted.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('hosted')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '9999px',
              border: 'none',
              background: activeTab === 'hosted' ? 'rgba(255, 64, 125, 0.22)' : 'transparent',
              color: activeTab === 'hosted' ? '#ff66a3' : 'rgba(255, 255, 255, 0.6)',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <span>👑 Hosted Invites</span>
            {userInvites.hosted?.length > 0 && (
              <span style={{ background: '#ff407d', color: '#fff', borderRadius: '9999px', padding: '1px 6px', fontSize: '0.72rem', fontWeight: 800 }}>
                {userInvites.hosted.length}
              </span>
            )}
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
          {/* TAB 1: Search by Code */}
          {activeTab === 'search' && (
            <div>
              <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={16} style={{ position: 'absolute', left: '14px', top: '14px', color: 'rgba(255, 255, 255, 0.4)' }} />
                  <input
                    type="text"
                    placeholder="Enter invite code or slug (e.g. sufi-qawwali-night)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px 12px 40px',
                      borderRadius: '14px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching}
                  style={{
                    padding: '12px 20px',
                    borderRadius: '14px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #ffd700, #ff407d)',
                    color: '#000',
                    fontWeight: 800,
                    cursor: isSearching ? 'not-allowed' : 'pointer',
                    fontSize: '0.88rem',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {isSearching ? 'Searching...' : 'Lookup'}
                </button>
              </form>

              {/* Quick suggestions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.76rem', color: 'rgba(255, 255, 255, 0.5)' }}>Try:</span>
                <button
                  type="button"
                  onClick={() => { setSearchQuery('sufi-qawwali-night'); }}
                  style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', borderRadius: '8px', padding: '3px 8px', fontSize: '0.74rem', cursor: 'pointer' }}
                >
                  🪔 sufi-qawwali-night
                </button>
                <button
                  type="button"
                  onClick={() => { setSearchQuery('disco-house-party'); }}
                  style={{ background: 'rgba(255, 64, 125, 0.15)', border: '1px solid rgba(255, 64, 125, 0.3)', color: '#ff66a3', borderRadius: '8px', padding: '3px 8px', fontSize: '0.74rem', cursor: 'pointer' }}
                >
                  🍹 disco-house-party
                </button>
              </div>

              {/* Search Error */}
              {searchError && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#fca5a5',
                    padding: '12px 16px',
                    borderRadius: '14px',
                    fontSize: '0.86rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '16px'
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{searchError}</span>
                </div>
              )}

              {/* Search Result Card */}
              {searchResult && (
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--primary-glow, #ff407d)',
                    borderRadius: '20px',
                    padding: '20px',
                    boxShadow: '0 12px 35px rgba(0, 0, 0, 0.5)'
                  }}
                >
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    <img
                      src={searchResult.coverImage || '/media/img4.jpeg'}
                      alt={`Cover artwork for ${searchResult.title}`}
                      style={{ width: '80px', height: '80px', borderRadius: '14px', objectFit: 'cover' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '9999px', background: 'rgba(255, 215, 0, 0.2)', color: '#ffd700', marginBottom: '6px' }}>
                        {searchResult.vibeTag || 'LIVE GATHERING'}
                      </div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: '0 0 4px 0' }}>
                        {searchResult.title}
                      </h3>
                      <div style={{ fontSize: '0.84rem', color: 'rgba(255, 255, 255, 0.65)' }}>
                        Host: {searchResult.hostName} •{' '}
                        {searchResult.startsAt
                          ? searchResult.startsAt.toLocaleDateString(undefined, {
                              weekday: 'long',
                              month: 'long',
                              day: 'numeric'
                            })
                          : 'Upcoming'}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                      Code: <code style={{ color: '#fff' }}>{searchResult.slug}</code>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenEvent(searchResult.slug)}
                      style={{
                        padding: '8px 18px',
                        borderRadius: '9999px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #ffd700, #ff407d)',
                        color: '#000',
                        fontWeight: 800,
                        fontSize: '0.86rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>Open invitation</span>
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Accepted RSVPs */}
          {activeTab === 'accepted' && (
            <div>
              {!currentUser ? (
                <div style={{ textAlign: 'center', padding: '30px 10px' }}>
                  <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.92rem', marginBottom: '14px' }}>
                    Sign in to view the gatherings you have replied to.
                  </p>
                  <button
                    type="button"
                    onClick={() => { onClose(); if (onOpenAuth) onOpenAuth('login'); }}
                    style={{
                      background: 'linear-gradient(135deg, #ffd700, #ff407d)',
                      color: '#000',
                      border: 'none',
                      borderRadius: '9999px',
                      padding: '10px 22px',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Log In to Continue 👑
                  </button>
                </div>
              ) : userInvites.accepted?.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: 'rgba(255, 255, 255, 0.6)' }}>
                  <p>You haven't confirmed attendance to any gatherings yet.</p>
                  <p style={{ fontSize: '0.82rem', marginTop: '6px' }}>Search a gathering code above and click RSVP!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {userInvites.accepted.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '18px',
                        padding: '18px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '1.1rem' }}>🍾</span>
                          <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#34d399', textTransform: 'uppercase' }}>
                            ATTENDANCE CONFIRMED
                          </span>
                        </div>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', margin: '0 0 4px 0' }}>
                          {item.title || 'Party Invitation'}
                        </h4>
                        <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                          Status: <strong style={{ color: '#34d399' }}>{(item.myStatus || '').replace('_', ' ').toUpperCase()}</strong>
                          {item.venueName ? <> • {item.venueName}</> : null}
                        </div>
                        {/* The door code is deliberately not shown here. It is
                            disclosed only on the invitation itself, by the
                            database, to a guest entitled to see it. */}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenEvent(item.slug)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '9999px',
                          border: '1px solid rgba(16, 185, 129, 0.5)',
                          background: 'rgba(16, 185, 129, 0.2)',
                          color: '#fff',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        View Pass 🎟️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Hosted Invites */}
          {activeTab === 'hosted' && (
            <div>
              {!currentUser ? (
                <div style={{ textAlign: 'center', padding: '30px 10px' }}>
                  <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.92rem', marginBottom: '14px' }}>
                    Sign in to view and manage all invitations you have created.
                  </p>
                  <button
                    type="button"
                    onClick={() => { onClose(); if (onOpenAuth) onOpenAuth('login'); }}
                    style={{
                      background: 'linear-gradient(135deg, #ffd700, #ff407d)',
                      color: '#000',
                      border: 'none',
                      borderRadius: '9999px',
                      padding: '10px 22px',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Log In to Continue 👑
                  </button>
                </div>
              ) : userInvites.hosted?.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: 'rgba(255, 255, 255, 0.6)' }}>
                  <p>You haven't created any custom invitations yet.</p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      window.location.hash = '#/maker';
                    }}
                    style={{
                      marginTop: '12px',
                      background: 'linear-gradient(135deg, #ffd700, #ff407d)',
                      color: '#000',
                      border: 'none',
                      borderRadius: '9999px',
                      padding: '8px 18px',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Create an invite
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {userInvites.hosted.map((ev, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'rgba(255, 64, 125, 0.08)',
                        border: '1px solid rgba(255, 64, 125, 0.3)',
                        borderRadius: '18px',
                        padding: '18px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '1.1rem' }}>👑</span>
                          <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#ff66a3', textTransform: 'uppercase' }}>
                            HOSTED BY YOU
                          </span>
                        </div>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', margin: '0 0 4px 0' }}>
                          {ev.title}
                        </h4>
                        <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                          Attendees: <strong style={{ color: '#ffd700' }}>{ev.goingCount}</strong> • Code: <code style={{ color: '#fff' }}>{ev.slug}</code>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEvent(ev.slug)}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '9999px',
                            border: '1px solid rgba(255, 64, 125, 0.5)',
                            background: 'rgba(255, 64, 125, 0.2)',
                            color: '#fff',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          View
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
