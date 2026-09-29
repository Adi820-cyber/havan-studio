import React, { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, Palette, Pencil, Share2, Ticket, X } from 'lucide-react';
import InteractiveCard from './InteractiveCard';
import InvitationStory from './InvitationStory';
import { CATEGORIES, TEMPLATES } from '../data/templates';

const STEPS = [
  {
    Icon: Palette,
    title: 'Choose a starting style',
    body: 'Browse an example below or start with a blank invitation. You can change the look later.'
  },
  {
    Icon: CalendarDays,
    title: 'Add the real event details',
    body: 'Set the name, date, time, venue, and address. You can keep the location private until guests reply.'
  },
  {
    Icon: Share2,
    title: 'Share the invitation',
    body: 'Send the invite link or code. Guests can open a public invitation and RSVP without creating an account.'
  },
  {
    Icon: Pencil,
    title: 'Keep everyone up to date',
    body: 'Edit the event before the party. Guests who open the invitation will see your update message.'
  }
];

export default function DashboardGuidePanel({ type, onClose, onOpenMaker, onOpenCheckInvite }) {
  const [category, setCategory] = useState('all');
  const stylesView = type === 'styles';
  const templates = category === 'all'
    ? TEMPLATES
    : TEMPLATES.filter((template) => template.category === category);

  useEffect(() => {
    setCategory('all');
  }, [type]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const startInvite = (nextCategory = 'all') => {
    onClose();
    onOpenMaker(nextCategory);
  };

  const openInviteLookup = () => {
    onClose();
    onOpenCheckInvite();
  };

  return (
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, background: 'rgba(5, 7, 12, 0.82)', backdropFilter: 'blur(10px)'
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-guide-title"
        style={{
          width: 'min(1120px, 100%)', maxHeight: 'min(88vh, 900px)', overflowY: 'auto',
          background: '#111a32', color: '#e6d5ae', border: '1px solid rgba(230,213,174,0.22)',
          clipPath: 'var(--chamfer-card)'
        }}
      >
        <header style={{
          position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 18, padding: '18px 22px',
          background: 'rgba(17,26,50,0.97)', borderBottom: '1px solid rgba(230,213,174,0.14)'
        }}>
          <div>
            <div className="lp-eyebrow">Your dashboard</div>
            <h2 id="dashboard-guide-title" style={{ margin: '5px 0 0', fontSize: '1.35rem', color: '#e6d5ae' }}>
              {stylesView ? 'Find your invitation style' : 'How Havan works for you'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="lp-chip"
            style={{ width: 38, height: 38, padding: 0, justifyContent: 'center', flexShrink: 0 }}
          >
            <X size={18} />
          </button>
        </header>

        {stylesView ? (
          <div style={{ padding: '22px clamp(16px, 3vw, 30px) 30px' }}>
            <p style={{ margin: '0 0 18px', color: 'rgba(230,213,174,0.68)', lineHeight: 1.55 }}>
              Preview a starting point. Your actual event name, date, and venue are added when you create the invitation.
            </p>
            <InvitationStory compact onOpenMaker={startInvite} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
              {CATEGORIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="lp-chip"
                  aria-pressed={category === item.id}
                  onClick={() => setCategory(item.id)}
                >
                  <span>{item.emoji || '✨'}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            {templates.length ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 24 }}>
                {templates.map((template) => (
                  <article key={template.id}>
                    <InteractiveCard template={template} />
                    <button
                      type="button"
                      onClick={() => startInvite(template.category || 'all')}
                      className="lp-btn lp-btn-primary"
                      style={{ width: '100%', justifyContent: 'center', padding: '11px 16px', marginTop: 10 }}
                    >
                      <span>Start a {CATEGORIES.find((item) => item.id === template.category)?.label || 'custom'} invite</span>
                      <ArrowRight size={15} />
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <p style={{ color: 'rgba(230,213,174,0.65)' }}>More styles are on the way for this category.</p>
            )}
          </div>
        ) : (
          <div style={{ padding: '24px clamp(18px, 4vw, 42px) 32px' }}>
            <p style={{ margin: '0 0 24px', maxWidth: 720, color: 'rgba(230,213,174,0.68)', lineHeight: 1.6 }}>
              Create and manage your gatherings here. Guests can reply from the link without signing up.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 14 }}>
              {STEPS.map(({ Icon, title, body }, index) => (
                <article key={title} style={{
                  padding: 18, background: 'rgba(230,213,174,0.045)',
                  border: '1px solid rgba(230,213,174,0.15)', clipPath: 'var(--chamfer-sm)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <span style={{ color: '#c0922e' }}><Icon size={18} /></span>
                    <span style={{ color: 'rgba(230,213,174,0.55)', fontSize: '0.75rem' }}>0{index + 1}</span>
                  </div>
                  <h3 style={{ margin: '0 0 8px', color: '#e6d5ae', fontSize: '1rem' }}>{title}</h3>
                  <p style={{ margin: 0, color: 'rgba(230,213,174,0.66)', fontSize: '0.88rem', lineHeight: 1.55 }}>{body}</p>
                </article>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 24 }}>
              <button type="button" onClick={() => startInvite('all')} className="lp-btn lp-btn-primary">
                <span>Create an invite</span><ArrowRight size={15} />
              </button>
              <button type="button" onClick={openInviteLookup} className="lp-btn lp-btn-ghost">
                <Ticket size={15} /><span>Open an invite code</span>
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
