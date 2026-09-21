import React, { useEffect, useState } from 'react';
import { UserPlus, Copy, Check, Trash2, Link2, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import Avatar from './Avatar';

/**
 * Invite named people to a private event.
 *
 * Each person gets their own link. The link stops working once somebody has used
 * it to reply, so forwarding it into a group chat does not quietly widen the
 * guest list — which is the whole point of a private party.
 *
 * Only rendered for the host; every RPC behind it refuses anyone else.
 */
export default function InviteeManager({ slug }) {
  const [invitees, setInvitees] = useState([]);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const load = async () => {
    try {
      setInvitees(await api.listInvitees(slug));
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api.addInvitee(slug, name.trim(), contact.trim() || null);
      setName('');
      setContact('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    setError('');
    try {
      await api.removeInvitee(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const copy = (invitee) => {
    navigator.clipboard.writeText(invitee.link).then(() => {
      setCopiedId(invitee.id);
      setTimeout(() => setCopiedId(null), 1800);
    });
  };

  const field = {
    padding: '9px 11px',
    borderRadius: 9,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    font: 'inherit',
    fontSize: '0.86rem',
    boxSizing: 'border-box',
    width: '100%'
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <ShieldCheck size={15} strokeWidth={1.9} color="#f5b544" />
        <strong style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 600 }}>
          Who's invited
        </strong>
      </div>
      <p style={{ margin: '0 0 14px', fontSize: '0.81rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
        Each person gets their own link. Once someone replies with it, that link
        stops working for anyone else.
      </p>

      <form onSubmit={add} className="lp-pair" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 7, marginBottom: 14 }}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          aria-label="Guest name"
          style={field}
        />
        <input
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Phone or email (optional)"
          aria-label="Guest contact"
          style={field}
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="lp-btn lp-btn-primary"
          style={{ padding: '9px 15px', fontSize: '0.84rem', opacity: busy || !name.trim() ? 0.5 : 1 }}
        >
          <UserPlus size={14} strokeWidth={2} />
          <span>Add</span>
        </button>
      </form>

      {error && (
        <div role="alert" style={{ marginBottom: 12, fontSize: '0.82rem', color: '#fecaca' }}>
          {error}
        </div>
      )}

      {invitees.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.83rem', color: 'rgba(255,255,255,0.35)' }}>
          Nobody added yet. Add a name and share their personal link.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {invitees.map((i) => (
            <li
              key={i.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 11px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)'
              }}
            >
              <Avatar name={i.name} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.86rem', color: '#fff', fontWeight: 500 }}>{i.name}</div>
                <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {i.claimed ? 'Link used — opened and replied' : i.contact || 'Link not used yet'}
                </div>
              </div>

              {i.claimed ? (
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: 999,
                    background: 'rgba(52,211,153,0.15)',
                    color: '#34d399'
                  }}
                >
                  REPLIED
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => copy(i)}
                  className="lp-chip"
                  style={{ padding: '6px 11px', fontSize: '0.78rem' }}
                  aria-label={`Copy invite link for ${i.name}`}
                >
                  {copiedId === i.id ? <Check size={13} strokeWidth={2.4} /> : <Link2 size={13} strokeWidth={2} />}
                  <span>{copiedId === i.id ? 'Copied' : 'Copy link'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => remove(i.id)}
                aria-label={`Remove ${i.name}`}
                title="Remove and revoke their link"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 5,
                  cursor: 'pointer',
                  color: 'rgba(255,255,255,0.3)',
                  display: 'flex'
                }}
              >
                <Trash2 size={14} strokeWidth={1.9} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
