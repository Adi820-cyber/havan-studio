import React, { useState, useEffect } from 'react';
import { X, Sparkles, Lock, Mail, User, ArrowRight, CheckCircle2, AlertCircle, AtSign, Eye, EyeOff } from 'lucide-react';
import { api } from '../services/api';
import Avatar from './Avatar';
import BrandLogo from './BrandLogo';

/**
 * Email format check.
 *
 * Deliberately not a "perfect" RFC 5322 regex — those either reject valid
 * addresses or accept garbage anyway, since the only real check is sending
 * mail to it. This is the same pragmatic shape the platform's own email
 * input type="email" uses, applied in JS too so the error shows up before a
 * request round-trip instead of relying only on the browser's native popup
 * (which some browsers style inconsistently, and none of them route through
 * this modal's own error box).
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Password strength check.
 *
 * Mirrors backend/supabase/config.toml exactly:
 *   minimum_password_length = 8
 *   password_requirements = "lower_upper_letters_digits"
 * Checking it here means a weak password is rejected before the network
 * round-trip, with a specific reason, instead of a generic failure after
 * Supabase rejects it — the modal used to *display* this requirement as
 * static copy without enforcing it anywhere.
 */
function passwordIssues(pw) {
  const issues = [];
  if (pw.length < 8) issues.push('at least 8 characters');
  if (!/[a-z]/.test(pw)) issues.push('a lower case letter');
  if (!/[A-Z]/.test(pw)) issues.push('an upper case letter');
  if (!/[0-9]/.test(pw)) issues.push('a digit');
  return issues;
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Register only — never sent anywhere, exists purely so a typo doesn't turn
  // into a locked-out account the moment the modal closes. There was no way to
  // see what you'd actually typed before this, in either field, which is a
  // dead end the moment autocomplete gets it wrong or a key sticks.
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [handleStatus, setHandleStatus] = useState('');

  // Per-field errors, shown inline under the field they belong to. `error`
  // (below) stays reserved for whole-form / server-side failures, so a field
  // problem and a "that email is already registered" response never collide
  // in the same box.
  const [fieldErrors, setFieldErrors] = useState({});
  // Only start showing validation state after the first submit attempt, so a
  // brand-new modal does not greet someone with red borders before they have
  // typed anything.
  const [touched, setTouched] = useState(false);
  
  const [avatarOptions] = useState(() => {
    const allIds = Array.from({ length: 67 }, (_, i) => i + 1);
    for (let i = allIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allIds[i], allIds[j]] = [allIds[j], allIds[i]];
    }
    return allIds.slice(0, 8).map(id => `/avatars/png/${id}.png`);
  });
  
  const [avatar, setAvatar] = useState(avatarOptions[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!handle.trim()) {
      setHandleStatus('');
      return;
    }
    setHandleStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const profile = await api.getPublicProfile(handle.trim().toLowerCase());
        if (profile) {
          setHandleStatus('taken');
        } else {
          setHandleStatus('available');
        }
      } catch (err) {
        setHandleStatus('available');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [handle]);

  /**
   * Validates the form for the current mode and returns a { field: message }
   * map. Empty object means the form is clean. Login only ever checks that an
   * email was typed and looks like one — a login password is validated by
   * whether it matches the account, not by a strength rule, since the account
   * may predate any particular rule. Register checks both, plus name.
   *
   * Defined with useCallback (not a plain function declaration) so it can sit
   * above the `if (!isOpen)` return below without upsetting the exhaustive-deps
   * lint rule on the effect that calls it — but the more important reason it
   * moved here at all is the effect right after it, which must run on every
   * render regardless of `isOpen`. See the note there.
   */
  const validate = React.useCallback(() => {
    const errs = {};

    if (!email.trim()) {
      errs.email = 'Enter your email address.';
    } else if (!EMAIL_RE.test(email.trim())) {
      errs.email = 'That doesn\'t look like a valid email address.';
    }

    if (!password) {
      errs.password = 'Enter your password.';
    } else if (mode === 'register') {
      const issues = passwordIssues(password);
      if (issues.length) {
        errs.password = `Password needs ${issues.join(', ')}.`;
      }
    }

    if (mode === 'register' && password && confirmPassword && password !== confirmPassword) {
      errs.confirmPassword = "That doesn't match your password above.";
    } else if (mode === 'register' && password && !confirmPassword) {
      errs.confirmPassword = 'Type your password again.';
    }

    if (mode === 'register' && !name.trim()) {
      errs.name = 'Let your guests know who is hosting.';
    }

    if (mode === 'register' && handleStatus === 'taken') {
      errs.handle = 'That username is already taken. Please pick another.';
    }

    return errs;
  }, [email, password, confirmPassword, name, mode, handleStatus]);

  // Re-validates on every keystroke, but only *displays* anything once
  // `touched` is true — so typing feels normal until the first submit attempt,
  // and immediately responsive after it (the classic "validate on blur/submit,
  // clear on change" pattern), rather than either nagging from the first
  // keystroke or staying silent until the server round-trip.
  //
  // This MUST run on every render, `isOpen` true or false — every hook in this
  // component does, and always in the same order, which is the actual rule
  // "don't call hooks conditionally" is protecting. AuthModal used to only
  // ever mount already-open, so the `if (!isOpen) return null` below this used
  // to sit safely below every hook. Once InvitationCardMaker started keeping
  // this modal mounted and toggling `isOpen` on the same instance (so a
  // publish draft survives a login interruption — see InvitationCardMaker's
  // own notes), a render where `isOpen` flips to false would hit that return
  // before this effect ran, giving React a different hook count than the
  // previous render and crashing with "Rendered more hooks than during the
  // previous render." Hooks first, conditional return last, no exceptions.
  useEffect(() => {
    if (touched) setFieldErrors(validate());
  }, [touched, validate, confirmPassword]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setTouched(true);

    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      // Nothing hits the network with an invalid field — this is the actual
      // fix for "no verification, user can just click through": Sign in /
      // Create account no longer submits at all while errs is non-empty.
      return;
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const user = await api.signIn(email, password);
        setSuccessMsg(`Welcome back, ${user.name}!`);
        if (onAuthSuccess) onAuthSuccess(user);
        onClose();
      } else {
        const user = await api.signUp(email, password, name, avatar);

        // Best effort. A taken or malformed handle must not strand somebody who
        // now has an account — they land on the dashboard, which prompts them to
        // pick one, so the failure is recoverable and silence is the right call.
        if (handle.trim()) {
          try {
            await api.updateMyProfile({ handle: handle.trim().toLowerCase() });
          } catch {
            /* dashboard will ask again */
          }
        }
        setSuccessMsg(`Account created! Welcome, ${user.name}!`);
        if (onAuthSuccess) onAuthSuccess(user);
        onClose();
      }
    } catch (err) {
      // A signup that needs email confirmation is not a failure — tell the user
      // to check their inbox instead of showing it as an error.
      if (err.needsConfirmation) {
        setSuccessMsg(err.message);
        setMode('login');
      } else {
        setError(err.message || 'Authentication failed');
      }
    } finally {
      setLoading(false);
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
        className="custom-scrollbar"
        style={{
          width: '100%',
          maxWidth: '480px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'rgba(15, 19, 32, 0.96)',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          borderRadius: '24px',
          boxShadow: '0 25px 70px rgba(0, 0, 0, 0.9), 0 0 35px rgba(255, 64, 125, 0.18)',
          padding: '28px 24px',
          position: 'relative',
          animation: 'modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          boxSizing: 'border-box'
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
            cursor: 'pointer'
          }}
        >
          <X size={18} />
        </button>

        {/* Header with havan Brand Logo */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
            <BrandLogo size="lg" />
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 700, color: '#fff', marginBottom: '6px', letterSpacing: '-0.02em' }}>
            {mode === 'login' ? 'Welcome back to havan' : 'Join the Host Circle'}
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'rgba(255, 255, 255, 0.6)' }}>
            {mode === 'login'
              ? 'Sign in to manage your party invitations & RSVPs'
              : 'Create your account to unlock viral gathering studios'}
          </p>
        </div>

        {/* Seed User Quick Fill Pill */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.12), rgba(255, 64, 125, 0.12))',
            border: '1px solid rgba(255, 215, 0, 0.35)',
            borderRadius: '16px',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, color: '#ffd700' }}>
              <Sparkles size={14} />
              <span>ACCOUNT SECURITY</span>
            </div>
            <div style={{ fontSize: '0.76rem', color: 'rgba(255, 255, 255, 0.7)', marginTop: '2px' }}>
              Passwords need 8+ characters with upper case, lower case and a digit.
              You only need an account to <em>host</em> — guests can RSVP without one.
            </div>
          </div>
        </div>

        {/* Tabs: Log In / Register */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '9999px',
            padding: '4px',
            marginBottom: '22px'
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
              setFieldErrors({});
              setTouched(false);
              setConfirmPassword('');
            }}
            style={{
              padding: '9px 0',
              borderRadius: '9999px',
              border: 'none',
              background: mode === 'login' ? 'rgba(255, 255, 255, 0.16)' : 'transparent',
              color: mode === 'login' ? '#fff' : 'rgba(255, 255, 255, 0.55)',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
              setFieldErrors({});
              setTouched(false);
            }}
            style={{
              padding: '9px 0',
              borderRadius: '9999px',
              border: 'none',
              background: mode === 'register' ? 'rgba(255, 255, 255, 0.16)' : 'transparent',
              color: mode === 'register' ? '#fff' : 'rgba(255, 255, 255, 0.55)',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Register
          </button>
        </div>

        {/* Error / Success Feedback */}
        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#fca5a5',
              padding: '10px 14px',
              borderRadius: '12px',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#a7f3d0',
              padding: '10px 14px',
              borderRadius: '12px',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}
          >
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {mode === 'register' && (
            <div>
              <label htmlFor="havan-auth-name" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', marginBottom: '6px' }}>
                Your Name
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '14px', top: '14px', color: 'rgba(255, 255, 255, 0.4)' }} />
                <input
                  id="havan-auth-name"
                  type="text"
                  placeholder="e.g. Maya Roy"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={fieldErrors.name ? 'havan-auth-name-error' : undefined}
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 40px',
                    borderRadius: '14px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: fieldErrors.name ? '1px solid rgba(239, 68, 68, 0.6)' : '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#fff',
                    fontSize: '0.92rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              {fieldErrors.name && (
                <div id="havan-auth-name-error" role="alert" style={{ fontSize: '0.75rem', color: '#fca5a5', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertCircle size={12} /> {fieldErrors.name}
                </div>
              )}
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', marginBottom: '6px' }}>
                Username <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>— optional, you can change it later</span>
              </label>
              <div style={{ position: 'relative' }}>
                <AtSign size={16} style={{ position: 'absolute', left: '14px', top: '14px', color: 'rgba(255, 255, 255, 0.4)' }} />
                <input
                  type="text"
                  placeholder="mayaroy"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9._]/g, '').toLowerCase())}
                  maxLength={30}
                  autoComplete="username"
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 40px',
                    borderRadius: '14px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#fff',
                    fontSize: '0.92rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              {handleStatus === 'taken' && (
                <div style={{ fontSize: '0.75rem', color: '#fca5a5', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertCircle size={12} /> This username is taken, please pick another.
                </div>
              )}
              {handleStatus === 'available' && handle.length > 0 && (
                <div style={{ fontSize: '0.75rem', color: '#a7f3d0', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={12} /> Username available!
                </div>
              )}
            </div>
          )}

          {mode === 'register' && name.trim() && (
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', marginBottom: '6px' }}>
                Pick an Avatar
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))', gap: '8px' }}>
                {avatarOptions.map(url => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setAvatar(url)}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      padding: 0,
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: avatar === url ? '2px solid #ff407d' : '1px solid rgba(255, 255, 255, 0.1)',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: avatar === url ? '0 0 12px rgba(255, 64, 125, 0.5)' : 'none'
                    }}
                  >
                    <img src={url} alt="Avatar option" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="havan-auth-email" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', marginBottom: '6px' }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '14px', top: '14px', color: 'rgba(255, 255, 255, 0.4)' }} />
              <input
                id="havan-auth-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'havan-auth-email-error' : undefined}
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 40px',
                  borderRadius: '14px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: fieldErrors.email ? '1px solid rgba(239, 68, 68, 0.6)' : '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#fff',
                  fontSize: '0.92rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            {fieldErrors.email && (
              <div id="havan-auth-email-error" role="alert" style={{ fontSize: '0.75rem', color: '#fca5a5', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertCircle size={12} /> {fieldErrors.email}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="havan-auth-password" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', marginBottom: '6px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '14px', top: '14px', color: 'rgba(255, 255, 255, 0.4)' }} />
              <input
                id="havan-auth-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? 'havan-auth-password-error' : undefined}
                style={{
                  width: '100%',
                  padding: '12px 78px 12px 40px',
                  borderRadius: '14px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: fieldErrors.password ? '1px solid rgba(239, 68, 68, 0.6)' : '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#fff',
                  fontSize: '0.92rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              {/* No way to see what was actually typed here before this — the
                  password box was a dead end the moment a key stuck or
                  autocomplete filled in something unexpected. */}
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                style={{
                  position: 'absolute', right: '8px', top: '8px',
                  minWidth: '62px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', color: '#f5d58b', cursor: 'pointer',
                  fontSize: '0.72rem', fontWeight: 700
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                <span>{showPassword ? 'Hide' : 'Show'}</span>
              </button>
            </div>
            {fieldErrors.password && (
              <div id="havan-auth-password-error" role="alert" style={{ fontSize: '0.75rem', color: '#fca5a5', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertCircle size={12} /> {fieldErrors.password}
              </div>
            )}
          </div>

          {mode === 'register' && (
            <div>
              <label htmlFor="havan-auth-confirm-password" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', marginBottom: '6px' }}>
                Confirm Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '14px', top: '14px', color: 'rgba(255, 255, 255, 0.4)' }} />
                <input
                  id="havan-auth-confirm-password"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.confirmPassword)}
                  aria-describedby={fieldErrors.confirmPassword ? 'havan-auth-confirm-password-error' : undefined}
                  style={{
                    width: '100%',
                    padding: '12px 78px 12px 40px',
                    borderRadius: '14px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: fieldErrors.confirmPassword ? '1px solid rgba(239, 68, 68, 0.6)' : '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#fff',
                    fontSize: '0.92rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showConfirmPassword}
                  style={{
                    position: 'absolute', right: '8px', top: '8px',
                    minWidth: '62px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', color: '#f5d58b', cursor: 'pointer',
                    fontSize: '0.72rem', fontWeight: 700
                  }}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  <span>{showConfirmPassword ? 'Hide' : 'Show'}</span>
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <div id="havan-auth-confirm-password-error" role="alert" style={{ fontSize: '0.75rem', color: '#fca5a5', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertCircle size={12} /> {fieldErrors.confirmPassword}
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '10px',
              padding: '14px',
              borderRadius: '9999px',
              border: 'none',
              background: 'linear-gradient(135deg, #ffd700 0%, #ff407d 100%)',
              color: '#000',
              fontWeight: 800,
              fontSize: '1rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 8px 25px rgba(255, 64, 125, 0.4)',
              opacity: loading ? 0.7 : 1
            }}
          >
            <span>{loading ? 'Signing in…' : mode === 'login' ? 'Sign in' : 'Create account'}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.5)' }}>
          {mode === 'login' ? (
            <span>
              Don't have an account yet?{' '}
              <button
                type="button"
                onClick={() => { setMode('register'); setError(''); setFieldErrors({}); setTouched(false); }}
                style={{ background: 'none', border: 'none', color: '#ffd700', fontWeight: 700, cursor: 'pointer' }}
              >
                Register here
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setFieldErrors({}); setTouched(false); setConfirmPassword(''); }}
                style={{ background: 'none', border: 'none', color: '#ffd700', fontWeight: 700, cursor: 'pointer' }}
              >
                Sign in here
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
