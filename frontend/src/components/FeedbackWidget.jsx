import React, { useEffect, useRef, useState } from 'react';
import { MessageSquareText, X } from 'lucide-react';
import { api } from '../services/api';

const categories = [
  { id: 'bug', label: 'Something is broken' },
  { id: 'confusing', label: 'Something confused me' },
  { id: 'idea', label: 'I have an idea' },
  { id: 'other', label: 'Something else' },
];

function getPageArea() {
  const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  const path = window.location.pathname;
  if (/^\/(?:invite|e)\//.test(path) || /^(?:invite|e)\//.test(hash)) return 'invite';
  if (/^\/profile\//.test(path) || /^profile\//.test(hash) || ['me', 'profile'].includes(hash)) return 'profile';
  if (hash.startsWith('maker')) return 'maker';
  if (hash === 'about' || hash === 'home') return 'landing';
  if (path === '/' && !hash) {
    return window.localStorage.getItem('havan-access-token') ? 'dashboard' : 'landing';
  }
  return 'other';
}

export default function FeedbackWidget({ pageArea = getPageArea() } = {}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState('');
  const [wantsReply, setWantsReply] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const messageRef = useRef(null);
  const doneRef = useRef(null);
  const dialogRef = useRef(null);
  const launcherRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    messageRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = dialogRef.current?.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), textarea:not(:disabled)'
      );
      if (!items?.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (launcherRef.current?.isConnected) launcherRef.current.focus();
    };
  }, [open]);

  useEffect(() => {
    if (status === 'sent') doneRef.current?.focus();
  }, [status]);

  const resetAndClose = () => {
    setOpen(false);
    setStatus('idle');
    setError('');
    setCategory('');
    setMessage('');
    setRating('');
    setWantsReply(false);
    setEmail('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setStatus('sending');
    setError('');
    try {
      await api.submitFeedback({
        category,
        message,
        rating: rating || null,
        pageArea,
        followUpRequested: wantsReply,
        contactEmail: wantsReply ? email : null,
      });
      setStatus('sent');
    } catch (err) {
      setError(err.message || 'We could not save that just now. Please try again.');
      setStatus('idle');
    }
  };

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        className="feedback-launch"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <MessageSquareText size={16} aria-hidden="true" />
        <span>Feedback</span>
      </button>

      {open && (
        <div
          className="feedback-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) resetAndClose();
          }}
        >
          <section
            ref={dialogRef}
            className="feedback-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
            aria-describedby="feedback-description"
          >
            <header className="feedback-header">
              <div>
                <p className="feedback-eyebrow">A quick note for the HAVAN team</p>
                <h2 id="feedback-title">{status === 'sent' ? 'Thank you for telling us' : 'How can we make this better?'}</h2>
              </div>
              <button type="button" className="feedback-close" onClick={resetAndClose} aria-label="Close feedback">
                <X size={20} />
              </button>
            </header>

            {status === 'sent' ? (
              <div className="feedback-success" role="status">
                <span className="feedback-success-mark" aria-hidden="true">✓</span>
                <p id="feedback-description">
                  Your note is saved. {wantsReply ? 'We can follow up using the email you provided.' : 'Thanks for helping us improve the experience.'}
                </p>
                <button ref={doneRef} type="button" className="feedback-submit" onClick={resetAndClose}>Done</button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <p id="feedback-description" className="feedback-intro">
                  It is optional, takes about a minute, and you do not need an account.
                </p>

                <fieldset className="feedback-fieldset">
                  <legend>What would you like to share? (required)</legend>
                  <div className="feedback-categories">
                    {categories.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        className={category === item.id ? 'feedback-category is-selected' : 'feedback-category'}
                        aria-pressed={category === item.id}
                        onClick={() => setCategory(item.id)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <label className="feedback-label" htmlFor="feedback-message">
                  Tell us what happened or what would help
                </label>
                <textarea
                  ref={messageRef}
                  id="feedback-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  minLength={3}
                  maxLength={2000}
                  rows={4}
                  required
                  placeholder="A few details help us understand."
                />
                <div className="feedback-char-count" aria-live="polite">{message.length}/2000</div>

                <fieldset className="feedback-fieldset feedback-rating">
                  <legend>How did this part feel? <span>(optional)</span></legend>
                  <div className="feedback-rating-options" aria-label="Optional experience rating">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        type="button"
                        key={value}
                        aria-label={value + ' out of 5'}
                        aria-pressed={Number(rating) === value}
                        className={Number(rating) === value ? 'feedback-rating-choice is-selected' : 'feedback-rating-choice'}
                        onClick={() => setRating(Number(rating) === value ? '' : String(value))}
                      >
                        {value}
                      </button>
                    ))}
                    <span className="feedback-rating-hint">1 = rough · 5 = great</span>
                  </div>
                </fieldset>

                <label className="feedback-opt-in">
                  <input
                    type="checkbox"
                    checked={wantsReply}
                    onChange={(event) => setWantsReply(event.target.checked)}
                  />
                  <span>I would like a reply</span>
                </label>

                {wantsReply && (
                  <label className="feedback-label" htmlFor="feedback-email">
                    Email address
                    <input
                      id="feedback-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      maxLength={254}
                      autoComplete="email"
                      required
                      placeholder="you@example.com"
                    />
                    <span className="feedback-privacy">We will only use this to reply to your note.</span>
                  </label>
                )}

                {error && <p className="feedback-error" role="alert">{error}</p>}
                <div className="feedback-actions">
                  <button type="button" className="feedback-cancel" onClick={resetAndClose}>Maybe later</button>
                  <button type="submit" className="feedback-submit" disabled={status === 'sending' || !category || message.trim().length < 3}>
                    {status === 'sending' ? 'Sending…' : 'Send feedback'}
                  </button>
                </div>
                <p className="feedback-privacy">Please do not include passwords, invite codes, or private event details.</p>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
