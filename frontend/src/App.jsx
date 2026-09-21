import React, { useState, useEffect, useCallback } from 'react';
import { TEMPLATES, THEME_PALETTES } from './data/templates';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import TemplatePlayground from './components/TemplatePlayground';
import HowItWorks from './components/HowItWorks';
import WhyHavan from './components/WhyHavan';
import TheDoor from './components/TheDoor';
import Footer from './components/Footer';
import LiveInviteView from './components/LiveInviteView';
import InvitationCardMaker from './components/InvitationCardMaker';
import Dashboard from './components/Dashboard';
import ProfilePanel from './components/ProfilePanel';
import AuthModal from './components/AuthModal';
import CheckInviteModal from './components/CheckInviteModal';
import PublicProfileView from './components/PublicProfileView';
import { api } from './services/api';

function getSlugFromLocation() {
  const path = window.location.pathname;
  const match = path.match(/^\/(?:invite|e)\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];

  const params = new URLSearchParams(window.location.search);
  const querySlug = params.get('invite') || params.get('e');
  if (querySlug) return querySlug;

  const hash = window.location.hash;
  const hashMatch = hash.match(/^#(?:\/)?(?:invite|e)\/([a-zA-Z0-9_-]+)/);
  if (hashMatch && hashMatch[1]) return hashMatch[1];

  return null;
}

function getPublicProfileHandleFromLocation() {
  const path = window.location.pathname;
  const match = path.match(/^\/profile\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];

  const hash = window.location.hash;
  const hashMatch = hash.match(/^#(?:\/)?profile\/([a-zA-Z0-9_-]+)/);
  if (hashMatch && hashMatch[1]) return hashMatch[1];

  return null;
}

/**
 * Personal invite token from `?k=`.
 * A private event returns nothing without it, so this has to survive both the
 * path form (/invite/slug?k=…) and the hash form (#/invite/slug?k=…).
 */
function getInviteTokenFromLocation() {
  const fromQuery = new URLSearchParams(window.location.search).get('k');
  if (fromQuery) return fromQuery;
  const hash = window.location.hash;
  const q = hash.indexOf('?');
  if (q !== -1) {
    const t = new URLSearchParams(hash.slice(q)).get('k');
    if (t) return t;
  }
  return null;
}

function getMakerStateFromLocation() {
  const hash = window.location.hash;
  const isMaker = hash.startsWith('#maker') || hash.startsWith('#/maker');
  let category = 'all';
  const catMatch = hash.match(/[?&]category=([a-zA-Z0-9_-]+)/);
  if (catMatch) {
    category = catMatch[1];
  } else {
    const params = new URLSearchParams(window.location.search);
    if (params.get('category')) category = params.get('category');
  }
  return { isMaker, category };
}

const hashIs = (...names) => {
  const h = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return names.includes(h);
};

export default function App() {
  const [inviteSlug, setInviteSlug] = useState(getSlugFromLocation);
  const [inviteToken, setInviteToken] = useState(getInviteTokenFromLocation);
  const [publicProfileHandle, setPublicProfileHandle] = useState(getPublicProfileHandleFromLocation);
  const initialMakerState = getMakerStateFromLocation();
  const [isMakerOpen, setIsMakerOpen] = useState(initialMakerState.isMaker);
  const [makerCategory, setMakerCategory] = useState(initialMakerState.category || 'all');
  const [isProfileOpen, setIsProfileOpen] = useState(() => hashIs('me', 'profile'));
  // A signed-in person gets their dashboard at "/". The marketing page is still
  // reachable on purpose — from the footer, or by anyone who wants to look at it.
  const [wantsLanding, setWantsLanding] = useState(() => hashIs('about', 'home'));

  const [activeCategory, setActiveCategory] = useState('all');
  const [activeTemplate, setActiveTemplate] = useState(TEMPLATES[0]);

  // Authentication state. Sessions are restored asynchronously by Supabase, so
  // this starts null and is filled in by the onAuthChange subscription below.
  //
  // `authReady` exists because "null" means two different things before and
  // after that first callback — signed out, versus not known yet. Without the
  // distinction a returning user sees the landing page flash before their
  // dashboard replaces it, which looks like being logged out.
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login'); // 'login' | 'register'

  const [isCheckInviteOpen, setIsCheckInviteOpen] = useState(false);

  // Track the signed-in host. Guests who RSVP get an *anonymous* session so
  // their reply can be tied to a real auth.uid(); that is not an account, so it
  // must not light up the logged-in UI.
  useEffect(() => {
    return api.onAuthChange((user) => {
      setCurrentUser(user && !user.isAnonymous ? user : null);
      setAuthReady(true);
    });
  }, []);

  // The profile is what carries the username, socials and counts. It is loaded
  // once per session rather than per view, and cleared on sign-out so the next
  // person to use the browser does not see the last one's handle.
  useEffect(() => {
    let alive = true;
    if (!currentUser) {
      setProfile(null);
      return undefined;
    }
    api
      .getMyProfile()
      .then((p) => {
        if (alive) setProfile(p);
      })
      .catch(() => {
        // A missing profile row is not worth blocking the dashboard over; the
        // page falls back to the name on the session.
        if (alive) setProfile(null);
      });
    return () => {
      alive = false;
    };
  }, [currentUser]);

  useEffect(() => {
    const handleLocationChange = () => {
      setInviteSlug(getSlugFromLocation());
      setInviteToken(getInviteTokenFromLocation());
      setPublicProfileHandle(getPublicProfileHandleFromLocation());
      const makerState = getMakerStateFromLocation();
      setIsMakerOpen(makerState.isMaker);
      if (makerState.category) {
        setMakerCategory(makerState.category);
      }
      setIsProfileOpen(hashIs('me', 'profile'));
      setWantsLanding(hashIs('about', 'home'));
      if (window.location.hash === '#check-invite') {
        setIsCheckInviteOpen(true);
      }
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  // Sync active theme with document body.
  useEffect(() => {
    if (activeTemplate && activeTemplate.theme) {
      document.body.setAttribute('data-active-theme', activeTemplate.theme);
    }
  }, [activeTemplate]);

  const handleSelectCategory = (catId) => {
    setActiveCategory(catId);
    if (catId && catId !== 'all') {
      const match = TEMPLATES.find((t) => t.category === catId);
      if (match) setActiveTemplate(match);
    }
  };

  const handleOpenMaker = (category = 'all') => {
    setMakerCategory(category);
    setIsMakerOpen(true);
    window.history.pushState(null, '', `#/maker?category=${category}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goHome = useCallback(() => {
    setIsMakerOpen(false);
    setIsProfileOpen(false);
    setWantsLanding(false);
    window.history.pushState(null, '', window.location.pathname);
  }, []);

  const handleOpenProfile = () => {
    setIsProfileOpen(true);
    window.history.pushState(null, '', '#/me');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenAuth = (mode = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const handleLogout = async () => {
    await api.signOut();
    setCurrentUser(null);
    setProfile(null);
    goHome();
  };

  const handleSelectInviteFromCheck = (slug) => {
    setInviteSlug(slug);
    window.history.pushState(null, '', `#/invite/${slug}`);
  };

  /* ───────────────────────── routing ───────────────────────── */

  if (publicProfileHandle) {
    return (
      <PublicProfileView 
        handle={publicProfileHandle} 
        onBack={() => {
          window.history.pushState(null, '', '/');
          setPublicProfileHandle(null);
        }} 
      />
    );
  }

  // Guest-facing invitation view. Deliberately first: an invite link must render
  // the invite whether or not the recipient has an account.
  if (inviteSlug) {
    return (
      <LiveInviteView
        slug={inviteSlug}
        inviteToken={inviteToken}
        onBackToStudio={() => {
          window.history.pushState(null, '', '/');
          setInviteSlug(null);
        }}
      />
    );
  }

  if (isMakerOpen) {
    return (
      <InvitationCardMaker
        initialCategory={makerCategory}
        onBack={goHome}
        currentUser={currentUser}
        onOpenAuth={handleOpenAuth}
      />
    );
  }

  if (isProfileOpen && currentUser) {
    return <ProfilePanel onBack={goHome} onSaved={setProfile} />;
  }

  // Hold the first paint until the session is known, so a returning user never
  // sees the signed-out page flash past.
  if (!authReady) {
    return <div style={{ minHeight: '100vh', background: '#08090f' }} aria-busy="true" />;
  }

  const activeThemeObj =
    THEME_PALETTES.find((t) => t.id === activeTemplate.theme) || THEME_PALETTES[0];

  const chrome = (children, withFooter) => (
    <div
      className="lp-scope"
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: '#08090f',
        color: '#f5f7fa'
      }}
    >
      <div className="lp-ambient" aria-hidden="true" />
      <div className="lp-grain" aria-hidden="true" />

      <Navbar
        onOpenMaker={handleOpenMaker}
        activeThemeObj={activeThemeObj}
        currentFrequencies={activeThemeObj.soundFreqs || activeTemplate.soundFreqs}
        activeCategory={activeCategory}
        onSelectCategory={handleSelectCategory}
        currentUser={currentUser}
        profile={profile}
        onOpenAuth={handleOpenAuth}
        onOpenCheckInvite={() => setIsCheckInviteOpen(true)}
        onOpenProfile={handleOpenProfile}
        onLogout={handleLogout}
      />

      {children}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(user) => setCurrentUser(user)}
        initialMode={authModalMode}
      />

      <CheckInviteModal
        isOpen={isCheckInviteOpen}
        onClose={() => setIsCheckInviteOpen(false)}
        currentUser={currentUser}
        onOpenAuth={handleOpenAuth}
        onSelectInvite={handleSelectInviteFromCheck}
      />

      {withFooter && <Footer onOpenMaker={handleOpenMaker} />}
    </div>
  );

  // Signed in, and not explicitly asking for the pitch → their own gatherings.
  if (currentUser && !wantsLanding) {
    return chrome(
      <Dashboard
        profile={profile}
        currentUser={currentUser}
        onOpenMaker={handleOpenMaker}
        onOpenCheckInvite={() => setIsCheckInviteOpen(true)}
        onOpenProfile={handleOpenProfile}
      />,
      false
    );
  }

  return chrome(
    <>
      <HeroSection
        templates={TEMPLATES}
        activeTemplate={activeTemplate}
        onSelectTemplate={setActiveTemplate}
        onOpenMaker={handleOpenMaker}
        onOpenCheckInvite={() => setIsCheckInviteOpen(true)}
      />

      <TemplatePlayground
        templates={TEMPLATES}
        activeTemplate={activeTemplate}
        onSelectTemplate={setActiveTemplate}
        onOpenMaker={handleOpenMaker}
        activeCategory={activeCategory}
      />

      <WhyHavan />

      <TheDoor />

      <HowItWorks />
    </>,
    true
  );
}
