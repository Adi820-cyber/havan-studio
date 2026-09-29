import React, { useState } from 'react';
import { X, Share2, Copy, Check, Send, Download, MapPin, ExternalLink } from 'lucide-react';
import { api } from '../services/api';

/**
 * One share surface, used everywhere an invite needs to go out.
 *
 * Before this, "share an invite" was four separate things that all did the same
 * job with different UI: the Share modal on the live invite page (QR, copy,
 * WhatsApp, ICS), a second standalone "Add to calendar" button a few pixels
 * below it doing exactly what the modal's ICS button already did, map links
 * buried inside the unlocked-venue card and reachable nowhere else, and a third,
 * separate copy/QR/WhatsApp mini-UI in the studio's just-published screen. A
 * host or guest trying to send an invite had to already know which of the four
 * places had the thing they wanted.
 *
 * This component is that one surface. It always shows QR + copy link; WhatsApp
 * and the .ics download show whenever the event is available; map links show
 * only once `api.mapLinks(event)` has something to offer (i.e. the venue is
 * unlocked and a location was set) — passing `event` handles all of that
 * without every caller re-deriving it.
 */
export default function ShareSheet({ isOpen, onClose, slug, event, qrCodeUrl, title = 'Send Invitation' }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const copyShareUrl = () => {
    navigator.clipboard.writeText(api.inviteUrl(slug)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  const downloadCalendarFile = () => {
    if (!event) return;
    const blob = api.icsBlob(event);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${(event.title || 'invitation').toLowerCase().replace(/[^a-z0-9]/g, '-')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const maps = event ? api.mapLinks(event) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        background: 'rgba(5, 7, 12, 0.85)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          padding: 24,
          borderRadius: 20,
          background: 'rgba(16,18,26,0.99)',
          border: '1px solid rgba(255, 255, 255, 0.11)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Share2 size={18} color="#ffd700" />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '9999px',
              width: 30,
              height: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            <X size={15} strokeWidth={2.2} />
          </button>
        </div>

        <p style={{ fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: 16 }}>
          Everything you need to get this in front of someone, in one place.
        </p>

        {/* QR Code */}
        {qrCodeUrl && (
          <div style={{ textAlign: 'center', padding: '14px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: 14, marginBottom: 16 }}>
            <img
              src={qrCodeUrl}
              alt="Invitation QR code"
              width={140}
              height={140}
              style={{ borderRadius: 10, margin: '0 auto', display: 'block' }}
            />
            <span style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: 6, display: 'block' }}>
              Scan to open the invite
            </span>
          </div>
        )}

        {/* Primary actions — one list, not a scavenger hunt across the page */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            onClick={copyShareUrl}
            className="btn-primary"
            style={{ padding: '12px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? 'Link copied' : 'Copy shareable link'}</span>
          </button>

          {event && (
            <a
              href={api.whatsAppUrl(event)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '12px',
                width: '100%',
                borderRadius: 12,
                background: '#25D366',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.88rem',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: 'pointer'
              }}
            >
              <Send size={15} strokeWidth={2} />
              <span>Send via WhatsApp</span>
            </a>
          )}

          {event && (
            <button
              type="button"
              onClick={downloadCalendarFile}
              className="btn-secondary"
              style={{ padding: '12px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <Download size={16} />
              <span>Add to calendar (.ics)</span>
            </button>
          )}
        </div>

        {/* Map links — only when there is somewhere to point to. Folded in here
            instead of living only inside the unlocked-venue card, since
            "get someone to the venue" is the same job as "get someone the
            invite" and used to be reachable from nowhere but that one card. */}
        {maps && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 9, display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={13} strokeWidth={2} />
              <span>Get there</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {[
                { href: maps.directions, label: 'Directions' },
                { href: maps.google, label: 'Google Maps' },
                { href: maps.osm, label: 'OpenStreetMap' }
              ].map(({ href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '7px 13px',
                    fontSize: '0.78rem',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.16)',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#fff'
                  }}
                >
                  <span>{label}</span>
                  <ExternalLink size={11} />
                </a>
              ))}
            </div>
            {maps.exact && (
              <p style={{ margin: '8px 0 0', fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>
                Exact location pinned by your host
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
