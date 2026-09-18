import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, Flame, Ticket, LogOut, ArrowRight, UserRound } from 'lucide-react';
import AudioPlayer from './AudioPlayer';
import Avatar from './Avatar';
import BrandLogo from './BrandLogo';

/**
 * Top navigation.
 *
 * Was a 791-line floating pill carrying: a brand lockup with a tagline chip,
 * four emoji category buttons that duplicated the filters already present in the
 * templates section, an ambient audio toggle, a check-invite button, a create
 * button, an auth dropdown and a separate mobile drawer. On a laptop those wrapped
 * into each other, which is the overlap that shows in a narrow viewport.
 *
 * Now: brand, two anchors, and the actions a visitor actually needs. The category
 * buttons are gone because the templates section already filters by category and
 * that is where a visitor is looking when they want one.
 *
 * Also adds Escape-to-close and outside-click for both menus, which the previous
 * version had for neither.
 */
export default function Navbar({
  onOpenMaker,
  currentFrequencies,
  currentUser,
  profile,
  onOpenAuth,
  onOpenCheckInvite,
  onOpenProfile,
  onLogout
}) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef(null);

  useEffect(() => {
    let raf = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        setScrolled(window.scrollY > 16);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const onDown = (e) => {
      if (userRef.current && !userRef.current.contains(e.target)) setUserOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setUserOpen(false);
        setMobileOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const goTo = (id) => {
    setMobileOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const linkStyle = {
    background: 'none',
    border: 'none',
    padding: '6px 2px',
    font: 'inherit',
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.62)',
    cursor: 'pointer',
    transition: 'color 0.16s ease'
  };

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: scrolled ? 'rgba(8,9,15,0.86)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(16px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.07)' : '1px solid transparent',
        transition: 'background 0.3s ease, border-color 0.3s ease'
      }}
    >
      <div
        className="lp-container"
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20
        }}
      >
        {/* Brand */}
        <a
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            textDecoration: 'none',
            flexShrink: 0
          }}
        >
          <BrandLogo size="md" showDevanagari={true} />
        </a>

        {/* Desktop links */}
        <nav
          style={{ display: 'flex', alignItems: 'center', gap: 26 }}
          className="lp-nav-links"
        >
          <button type="button" style={linkStyle} onClick={() => goTo('templates')}>
            Styles
          </button>
          <button type="button" style={linkStyle} onClick={() => goTo('how-it-works')}>
            How it works
          </button>
        </nav>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div className="lp-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AudioPlayer frequencies={currentFrequencies} />

            <button
              type="button"
              onClick={onOpenCheckInvite}
              className="lp-btn lp-btn-ghost"
              style={{ padding: '8px 15px', fontSize: '0.86rem' }}
            >
              <Ticket size={15} strokeWidth={1.9} />
              <span>I have an invite</span>
            </button>
          </div>

          {currentUser ? (
            <div ref={userRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setUserOpen((v) => !v)}
                aria-expanded={userOpen}
                aria-haspopup="menu"
                aria-label="Account menu"
                style={{
                  padding: 0,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <Avatar name={currentUser.name} avatarUrl={profile?.avatarUrl} size={34} />
              </button>

              {userOpen && (
                <div
                  role="menu"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    minWidth: 210,
                    padding: 7,
                    borderRadius: 13,
                    background: 'rgba(15,17,25,0.98)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 20px 50px -12px rgba(0,0,0,0.8)'
                  }}
                >
                  <div
                    style={{
                      padding: '9px 11px 11px',
                      borderBottom: '1px solid rgba(255,255,255,0.07)',
                      marginBottom: 5
                    }}
                  >
                    <div style={{ fontSize: '0.88rem', color: '#fff', fontWeight: 600 }}>
                      {currentUser.name}
                    </div>
                    <div
                      style={{
                        fontSize: '0.76rem',
                        color: 'rgba(255,255,255,0.42)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {profile?.handle ? `@${profile.handle}` : currentUser.email}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setUserOpen(false);
                      if (onOpenProfile) onOpenProfile();
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      padding: '9px 11px',
                      borderRadius: 8,
                      border: 'none',
                      background: 'none',
                      color: 'rgba(255,255,255,0.8)',
                      font: 'inherit',
                      fontSize: '0.86rem',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <UserRound size={15} strokeWidth={1.8} />
                    Profile
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setUserOpen(false);
                      onOpenCheckInvite();
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      padding: '9px 11px',
                      borderRadius: 8,
                      border: 'none',
                      background: 'none',
                      color: 'rgba(255,255,255,0.8)',
                      font: 'inherit',
                      fontSize: '0.86rem',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <Ticket size={15} strokeWidth={1.8} />
                    My invitations
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setUserOpen(false);
                      onLogout();
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      padding: '9px 11px',
                      borderRadius: 8,
                      border: 'none',
                      background: 'none',
                      color: 'rgba(255,255,255,0.8)',
                      font: 'inherit',
                      fontSize: '0.86rem',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <LogOut size={15} strokeWidth={1.8} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              style={{ ...linkStyle, fontSize: '0.88rem' }}
              className="lp-nav-links"
            >
              Sign in
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpenMaker('all')}
            className="lp-btn lp-btn-primary"
            style={{ padding: '9px 17px', fontSize: '0.88rem' }}
          >
            <span>Create</span>
            <ArrowRight size={15} strokeWidth={2.1} />
          </button>

          {/* Mobile toggle */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            className="lp-nav-burger"
            style={{
              display: 'none',
              width: 34,
              height: 34,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 9,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(255,255,255,0.05)',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            {mobileOpen ? <X size={17} /> : <Menu size={17} />}
          </button>
        </div>
      </div>

      {/* Mobile sheet */}
      {mobileOpen && (
        <div
          style={{
            padding: '8px 24px 20px',
            background: 'rgba(8,9,15,0.98)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4
          }}
        >
          <button type="button" style={{ ...linkStyle, padding: '11px 0', textAlign: 'left' }} onClick={() => goTo('templates')}>
            Styles
          </button>
          <button type="button" style={{ ...linkStyle, padding: '11px 0', textAlign: 'left' }} onClick={() => goTo('how-it-works')}>
            How it works
          </button>
          <button
            type="button"
            style={{ ...linkStyle, padding: '11px 0', textAlign: 'left' }}
            onClick={() => {
              setMobileOpen(false);
              onOpenCheckInvite();
            }}
          >
            I have an invite
          </button>
          {!currentUser && (
            <button
              type="button"
              style={{ ...linkStyle, padding: '11px 0', textAlign: 'left' }}
              onClick={() => {
                setMobileOpen(false);
                onOpenAuth('login');
              }}
            >
              Sign in
            </button>
          )}
        </div>
      )}
    </header>
  );
}
