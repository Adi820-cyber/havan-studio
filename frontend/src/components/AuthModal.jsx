import React, { useState, useEffect } from 'react';
import { X, Sparkles, Lock, Mail, User, ArrowRight, CheckCircle2, AlertCircle, AtSign } from 'lucide-react';
import { api } from '../services/api';
import Avatar from './Avatar';
import BrandLogo from './BrandLogo';

export default function AuthModal({ isOpen, onClose, onAuthSuccess, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [handleStatus, setHandleStatus] = useState('');
  
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

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const user = await api.signIn(email, password);
        setSuccessMsg(`Welcome back, ${user.name}!`);
        if (onAuthSuccess) onAuthSuccess(user);
        onClose();
      } else {
        if (!name.trim()) {
          setError('Please provide your name');
          setLoading(false);
          return;
        }
        if (handleStatus === 'taken') {
          setError('That username is already taken. Please pick another.');
          setLoading(false);
          return;
        }
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
            <BrandLogo size="lg" showDevanagari={true} />
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
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', marginBottom: '6px' }}>
                Your Name
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '14px', top: '14px', color: 'rgba(255, 255, 255, 0.4)' }} />
                <input
                  type="text"
                  placeholder="e.g. Maya Roy"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
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
                required
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
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', marginBottom: '6px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '14px', top: '14px', color: 'rgba(255, 255, 255, 0.4)' }} />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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
          </div>

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
                onClick={() => setMode('register')}
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
                onClick={() => setMode('login')}
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
