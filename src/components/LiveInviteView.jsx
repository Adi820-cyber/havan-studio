import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  Calendar, MapPin, Lock, Unlock, CheckCircle2, Users,
  Share2, Key, Download, ExternalLink, ArrowLeft, Send, Check, Copy,
  MessageSquare, Shirt, Hourglass, PackageOpen
} from 'lucide-react';
import { playPop, playCelebrationChord, playWhoosh } from '../utils/soundEffects';
import { api } from '../services/api';
import { SEEN_HAI, pickReaction, UI_TO_STATUS, STATUS_TO_UI } from '../data/seenHai';
import { RSVP_ICON } from '../lib/icons';
import { useLiveEvent, useRefreshOnFocus } from '../lib/useLiveEvent';
import SeenHaiReaction from './SeenHaiReaction';
import HostPanel from './HostPanel';
import { fontById, revealById, houseRuleLine } from '../data/vibe';
import RevealOnScroll from './RevealOnScroll';

export default function LiveInviteView({ slug, inviteToken = null, onBackToStudio }) {
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // "Seen Hai" reply state
  const [selectedStatus, setSelectedStatus] = useState(null);
  // The meme reaction shown after a reply. Held here so it survives the invite
  // object being replaced by the RPC response.
  const [reaction, setReaction] = useState(null);
  const lastReaction = useRef({});
  // Which note the guest or host is replying to, plus the draft for it.
  const [replyTo, setReplyTo] = useState(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [isRsvpModalOpen, setIsRsvpModalOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState('going');
  const [guestName, setGuestName] = useState('');
  const [guestContact, setGuestContact] = useState('');
  const [guestNote, setGuestNote] = useState('');
  const [isSubmittingRsvp, setIsSubmittingRsvp] = useState(false);
  const [rsvpError, setRsvpError] = useState('');
  // The invite object itself carries my_rsvp plus the venue fields (which the
  // database fills in only when I'm entitled to them), so there is no separate
  // "unlockedLocation" state to drift out of sync.
  const myRsvp = event?.myRsvp || null;

  // Social Guest Wall
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [commentName, setCommentName] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);

  // Share Modal & QR
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  const cardRef = useRef(null);

  /**
   * Loads the invitation.
   *
   * There is no host key or guest contact to pass any more. Identity comes from
   * the session, and the database decides what this caller may see — so a guest
   * can no longer unlock the venue by putting somebody else's email in a header.
   */
  const loadEvent = async () => {
    try {
      setLoading(true);
      setError('');

      const invite = await api.getInvite(slug, inviteToken);
      if (!invite) {
        // A private event with a missing, wrong or already-used token returns
        // null, identical to a slug that does not exist. Deliberate: saying
        // "this one is private" would confirm the event exists.
        throw new Error("We couldn't open this invitation. The link may be invalid, expired, or already used by someone else.");
      }

      setEvent(invite);
      // On a private invite, greet them with the name the host wrote down.
      if (invite.invitedAs && !invite.myRsvp) setGuestName(invite.invitedAs);
      if (invite.myRsvp) {
        setSelectedStatus(
          invite.myRsvp.status === 'going' ? 'yes' : invite.myRsvp.status === 'maybe' ? 'maybe' : 'no'
        );
        setGuestName(invite.myRsvp.guestName || '');
        setGuestContact(invite.myRsvp.contact || '');
      }

      // The wall is only readable once you've replied, so an empty list here is
      // an expected state rather than an error.
      setComments(await api.getComments(slug));
      setQrCodeUrl(await api.qrDataUrl(slug));
    } catch (err) {
      setError(err.message || 'Failed to load this invitation');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, inviteToken]);

  /**
   * Refresh without a full reload.
   *
   * Pulls counts and the wall again, but leaves `loading` alone so the card does
   * not flash a spinner while someone is reading it. This is what fixes the
   * reported bug: previously a host had to reload the page to see a new reply or
   * note.
   */
  const refreshQuietly = useCallback(async () => {
    try {
      const [invite, notes] = await Promise.all([
        api.getInvite(slug, inviteToken),
        api.getComments(slug)
      ]);
      if (invite) setEvent(invite);
      setComments(notes);
    } catch {
      // A failed background refresh should never disturb what is on screen.
    }
  }, [slug, inviteToken]);

  // Live: someone replied or left a note on this event.
  // The scope keeps this channel distinct from the host panel's, which watches
  // the same event.
  useLiveEvent(event?.id, refreshQuietly, 'invite-view');
  // Safety net for a websocket that dropped while the tab was asleep.
  useRefreshOnFocus(refreshQuietly);





  // Tapping one of the three Seen Hai replies
  const handleRsvpOptionClick = (statusKey) => {
    playPop();
    const backendStatus = UI_TO_STATUS[statusKey] || 'going';
    setPendingStatus(backendStatus);

    if (myRsvp) {
      // Already know who they are — change the reply straight away.
      submitRsvpPayload(backendStatus, myRsvp.guestName, myRsvp.contact);
    } else {
      setIsRsvpModalOpen(true);
    }
  };

  /**
   * Submits the RSVP.
   *
   * One call does everything: saves the reply, posts the optional note, and
   * returns the re-evaluated invite with the venue details if this reply earns
   * them. The previous version fired three requests, sent `name` where the
   * server read `guestName`, and then read `data.data.guest` from a response
   * that had no `data` key — so it threw, alerted, and left the venue locked
   * even though the RSVP had actually saved.
   */
  const submitRsvpPayload = async (status, name, contact, note = '') => {
    // The database refuses this too; stopping here keeps the host from ever
    // seeing an error for something they should not have been offered.
    if (event?.isHost) return;

    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      setRsvpError('Please tell us your name.');
      return;
    }

    setIsSubmittingRsvp(true);
    setRsvpError('');

    try {
      const updated = await api.submitRsvp(slug, {
        guestName: trimmedName,
        contact: (contact || '').trim() || null,
        status,
        note,
        token: inviteToken
      });

      setEvent(updated);
      setSelectedStatus(STATUS_TO_UI[status]);

      // The meme moment. Confetti is fired by SeenHaiReaction so its intensity
      // can match the answer — poppers for a yes, a small puff for a no.
      const next = pickReaction(status, lastReaction.current);
      lastReaction.current = { line: next.line, clip: next.clip };
      setReaction(next);

      if (status === 'going') playCelebrationChord();

      // Posting a note makes the wall readable, so refresh it.
      setComments(await api.getComments(slug));
      setIsRsvpModalOpen(false);
      setGuestNote('');
    } catch (err) {
      setRsvpError(err.message || 'Could not save your reply.');
    } finally {
      setIsSubmittingRsvp(false);
    }
  };

  // Post Standalone Comment/Blessing
  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    const author = commentName.trim() || myRsvp?.guestName || 'Guest';

    setIsPostingComment(true);
    setRsvpError('');
    try {
      // Sends `message`, which is the field the backend actually stores. The old
      // code sent `text`, so every comment was persisted blank.
      await api.postComment(slug, newComment.trim(), author);
      // Refetch rather than splicing locally, so threading stays consistent.
      setComments(await api.getComments(slug));
      setNewComment('');
      playPop();
    } catch (err) {
      setRsvpError(err.message || 'Could not post your message.');
    } finally {
      setIsPostingComment(false);
    }
  };

  /** Reply to a specific note. Used by both the host and other guests. */
  const handlePostReply = async (e, parentId) => {
    e.preventDefault();
    const body = replyDraft.trim();
    if (!body) return;

    setIsPostingComment(true);
    setRsvpError('');
    try {
      const author = event.isHost ? event.hostName : myRsvp?.guestName || commentName.trim() || 'Guest';
      await api.postComment(slug, body, author, parentId);
      setComments(await api.getComments(slug));
      setReplyTo(null);
      setReplyDraft('');
      playPop();
    } catch (err) {
      setRsvpError(err.message || 'Could not post your reply.');
    } finally {
      setIsPostingComment(false);
    }
  };

  // Download .ics Calendar File
  // Built from the event's real start time. Previously every exported file
  // carried a hardcoded DTSTART of 2026-11-14.
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

  const copyShareUrl = () => {
    navigator.clipboard.writeText(api.inviteUrl(slug)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const getWhatsAppShareUrl = () => api.whatsAppUrl(event);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080a12' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(230,213,174,0.15)', borderTopColor: 'var(--brass)', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#080a12', color: '#fff', padding: 24, textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 8 }}>Invitation Not Found</h2>
        <p style={{ color: 'rgba(255, 255, 255, 0.6)', maxWidth: 400, marginBottom: 24 }}>{error || "We couldn't locate this gathering. The link might be expired or invalid."}</p>
        <button onClick={onBackToStudio} className="btn-primary" style={{ padding: '12px 24px' }}>
          <ArrowLeft size={16} />
          <span>Back to Gathering Studio</span>
        </button>
      </div>
    );
  }

  const custom = event.customization || {};
  const rsvpOptions = custom.rsvpOptions || {
    yes: { emoji: '🍾', title: "Hell Yeah, I'm In!", sub: 'Going' },
    maybe: { emoji: '🍹', title: 'Might Slide Through', sub: 'Maybe' },
    no: { emoji: '😴', title: 'FOMO Sleeping In', sub: "Can't Go" }
  };

  // The wax seal is gone. It rendered `seal.icon` as a raw emoji here, which is
  // where the duplicated peacock came from, and it configured nothing a guest
  // cares about.
  //
  // Dress code is now whatever the host typed in the studio. It can legitimately
  // be blank, so the tile is conditional rather than falling back to an invented
  // "Retro Chic" that no host chose.
  const dressCodeText = (custom.dressCode?.title || '').trim();

  // Logistics — BYOB, potluck, splitting costs, plus-ones. The host has always
  // been able to write this in the studio and it has always been stored, but
  // nothing on this page ever rendered it, so every guest saw an invite with the
  // one thing they needed to know silently dropped. Read `customization` first
  // and fall back to the legacy byobNote field so invites published before the
  // rename still show theirs.
  // House rules, as a list. Older invites stored one joined string in
  // `byobNote`; both shapes render the same way here.
  const houseRuleLines = Array.isArray(custom.houseRules) && custom.houseRules.length
    ? custom.houseRules.map((r) => houseRuleLine(r) || r).filter(Boolean)
    : (custom.logistics || event.byobNote || '')
        .split('·')
        .map((x) => x.trim())
        .filter(Boolean);

  const cardFont = fontById(custom.fontId);
  const reveal = revealById(custom.revealId);

  // Replies close before the gathering starts, and the database enforces it. The
  // guest was never told: the buttons stayed live and the refusal only arrived
  // as an error after tapping. `repliesOpen` is the backend's verdict, so this
  // agrees with what a submission would actually do.
  const repliesClosed = event.repliesOpen === false;
  const repliesCloseAt = event.repliesCloseAt;
  const replyLock = repliesClosed || event.isHost;
  const coverImg = event.coverImage || '/media/img3.jpeg';
  // The real number of confirmed guests, counted by the database. The old build
  // read a field the server never sent and then added 12, so every invitation
  // displayed exactly "12 attending" regardless of actual replies.
  const attendingCount = event.goingCount;
  const isVenueUnlocked = event.isUnlocked;

  const formattedDate = event.startsAt
    ? event.startsAt.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
    : 'Date to be announced';
  const formattedTime = event.startsAt
    ? event.startsAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : '';

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: 'var(--indigo-deep)', color: '#fff', overflowX: 'hidden', paddingBottom: 60 }}>
      <div className="lp-grain" aria-hidden="true" />

      {/* Sticky Floating Action Nav */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'blur(20px)',
          background: 'rgba(7, 9, 14, 0.75)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <button
          onClick={onBackToStudio}
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#fff',
            borderRadius: 999,
            padding: '6px 14px',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer'
          }}
        >
          <ArrowLeft size={14} />
          <span>Invite Studio</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setIsShareOpen(true)}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff',
              borderRadius: 999,
              padding: '6px 14px',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer'
            }}
          >
            <Share2 size={14} />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* Main content — side-by-side on desktop, stacked on mobile */}
      <main style={{
        maxWidth: 1100,
        margin: '28px auto 0',
        padding: '0 16px',
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 32,
        alignItems: 'flex-start',
        justifyContent: 'center'
      }}>
        
        {/* Left Column: Card */}
        <div style={{ flex: '1 1 400px', maxWidth: 520, width: '100%' }}>
          {/* The invitation, opening the way the host chose. The reveal lives on
              the wrapper so the card keeps its chamfer, borders and selection. */}
          <RevealOnScroll revealId={reveal.id}>
        <div
          ref={cardRef}
          className="havan-card"
          style={{
            overflow: 'hidden',
            border: '1px solid rgba(230, 213, 174, 0.18)',
            background: 'var(--indigo)'
          }}
        >
          {/* Artwork Stage */}
          <div style={{ position: 'relative', height: 180, overflow: 'hidden' }}>
            <img
              src={coverImg}
              alt={event.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(10, 13, 22, 0.95) 100%)'
              }}
            />

            {/* Vibe badge */}
            {custom.vibeTag && (
              <div style={{ position: 'absolute', top: 16, left: 16 }}>
                <span
                  style={{
                    background: 'rgba(0, 0, 0, 0.55)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 999,
                    padding: '4px 12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#fff'
                  }}
                >
                  {custom.vibeTag}
                </span>
              </div>
            )}

            {/* Title & Host on Artwork */}
            <div style={{ position: 'absolute', bottom: 16, left: 20, right: 20 }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--brass)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Hosted by {event.hostName || 'Host'}
              </div>
              <h1
                style={{
                  fontFamily: cardFont.stack,
                  fontWeight: cardFont.weight,
                  fontSize: '1.78rem',
                  color: 'var(--sand)',
                  lineHeight: 1.12,
                  letterSpacing: '-0.015em',
                  textShadow: '0 2px 10px rgba(0,0,0,0.8)'
                }}
              >
                {event.title}
              </h1>
            </div>
          </div>

          {/* Card Body */}
          <div style={{ padding: '16px 20px' }}>
            {/* Description */}
            {event.description && (
              <p style={{ fontSize: '0.88rem', color: 'rgba(255, 255, 255, 0.75)', lineHeight: 1.5, marginBottom: 16 }}>
                {event.description}
              </p>
            )}

            {/* Event Logistics Grid */}
            <div
              className="lp-pair"
              style={{
                display: 'grid',
                // Tiles stretch to fill rather than leaving a hole when the
                // host left the dress code or the logistics blank.
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 8,
                marginBottom: 16
              }}
            >
              <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 12, padding: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ff407d', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  <Calendar size={13} />
                  <span>Date & Time</span>
                </div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff', marginTop: 4 }}>
                  {formattedDate}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: 2 }}>
                  {formattedTime}
                </div>
              </div>

              {dressCodeText && (
                <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 12, padding: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ffd700', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    <Shirt size={13} strokeWidth={1.9} />
                    <span>Dress Code</span>
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff', marginTop: 4 }}>
                    {dressCodeText}
                  </div>
                </div>
              )}

              {houseRuleLines.length > 0 && (
                <div style={{ background: 'rgba(230, 213, 174, 0.04)', border: '1px solid rgba(230, 213, 174, 0.12)', padding: '10px', clipPath: 'var(--chamfer-sm)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--verdigris)', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    <PackageOpen size={13} strokeWidth={1.9} />
                    <span>House rules</span>
                  </div>
                  <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {houseRuleLines.map((line) => (
                      <li key={line} style={{ fontSize: '0.85rem', color: 'var(--sand)', display: 'flex', gap: 7 }}>
                        <span aria-hidden="true" style={{ color: 'var(--brass)' }}>&mdash;</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Layer 3: Secret Venue Box (Locked vs Unlocked) */}
            <div
              style={{
                borderRadius: 16,
                padding: '12px',
                marginBottom: 16,
                position: 'relative',
                overflow: 'hidden',
                background: isVenueUnlocked
                  ? 'linear-gradient(145deg, rgba(255, 215, 0, 0.12), rgba(16, 185, 129, 0.08))'
                  : 'rgba(255, 255, 255, 0.03)',
                border: isVenueUnlocked
                  ? '1px solid rgba(255, 215, 0, 0.5)'
                  : '1px dashed rgba(255, 255, 255, 0.15)'
              }}
            >
              {!isVenueUnlocked ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Lock size={16} strokeWidth={1.8} color="rgba(255,255,255,0.45)" style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>
                      {event.venueName || 'Venue'}
                    </div>
                    <div style={{ fontSize: '0.77rem', color: 'rgba(255, 255, 255, 0.45)', marginTop: 2 }}>
                      Reply to see the full address
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--brass)' }}>
                    <Unlock size={13} strokeWidth={2} />
                    Address
                  </div>

                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MapPin size={16} color="#ff407d" />
                    <span>{event.venueName}</span>
                  </div>

                  <div style={{ fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.75)', marginTop: 2, marginLeft: 22 }}>
                    {event.venueAddress}
                  </div>

                  {event.doorCode && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '8px 12px', background: 'rgba(0, 0, 0, 0.4)', borderRadius: 8 }}>
                      <Key size={14} color="#ffd700" />
                      <span style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.6)' }}>Gate / Entry Code:</span>
                      <span style={{ fontSize: '0.88rem', fontFamily: 'monospace', fontWeight: 800, color: '#ffd700' }}>
                        {event.doorCode}
                      </span>
                    </div>
                  )}

                  {/* Map links. When the host picked the venue from
                      OpenStreetMap we have coordinates, so these open the exact
                      pin instead of a fuzzy text search. */}
                  {(() => {
                    const maps = api.mapLinks(event);
                    if (!maps) return null;
                    const linkStyle = {
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
                    };
                    return (
                      <div style={{ marginTop: 13 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                          <a href={maps.directions} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                            <MapPin size={12} strokeWidth={2} />
                            <span>Directions</span>
                          </a>
                          <a href={maps.google} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                            <span>Google Maps</span>
                            <ExternalLink size={11} />
                          </a>
                          <a href={maps.osm} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                            <span>OpenStreetMap</span>
                            <ExternalLink size={11} />
                          </a>
                        </div>
                        {maps.exact && (
                          <p style={{ margin: '7px 0 0', fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>
                            Exact location pinned by your host
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Seen Hai — the three replies.
                For the HOST these are shown as a preview and are not clickable.
                Previously a host tapping them got a "Complete Your RSVP" form
                asking them to tell themselves they were coming, and the reply
                would have counted them as their own guest. */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>
                  {event.isHost ? 'What your guests tap' : 'Seen hai. Ab bata?'}
                </span>
                {/* The host already has full counts in the panel above, so this
                    would just repeat a smaller version of them. */}
                {!event.isHost && (
                  <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Users size={13} strokeWidth={1.9} />
                    <strong style={{ color: '#fff' }}>{attendingCount}</strong> aa rahe hain
                  </span>
                )}
              </div>

              {!event.isHost && repliesCloseAt && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '9px 12px',
                    borderRadius: 11,
                    marginBottom: 12,
                    fontSize: '0.81rem',
                    lineHeight: 1.45,
                    color: repliesClosed ? '#fecaca' : 'rgba(255,255,255,0.6)',
                    background: repliesClosed ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)',
                    border: repliesClosed
                      ? '1px solid rgba(239,68,68,0.3)'
                      : '1px solid rgba(255,255,255,0.08)'
                  }}
                >
                  <Hourglass size={14} strokeWidth={1.9} style={{ flexShrink: 0 }} />
                  <span>
                    {repliesClosed
                      ? 'Replies are closed for this one. Message the host if something changed.'
                      : `Replies close ${repliesCloseAt.toLocaleString(undefined, {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}`}
                  </span>
                </div>
              )}

              <div className="lp-trio" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[
                  { ui: 'yes', status: 'going' },
                  { ui: 'maybe', status: 'maybe' },
                  { ui: 'no', status: 'not_going' }
                ].map(({ ui, status }) => {
                  const cfg = SEEN_HAI[status];
                  const Icon = RSVP_ICON[status];
                  const on = selectedStatus === ui;
                  // The host may have written their own reply wording in the studio.
                  const custom = rsvpOptions?.[ui === 'no' ? 'no' : ui]?.title;
                  return (
                    <button
                      key={ui}
                      type="button"
                      // A host cannot reply to their own gathering, and nobody
                      // can once replies have closed.
                      disabled={replyLock}
                      onClick={() => !replyLock && handleRsvpOptionClick(ui)}
                      aria-pressed={on}
                      aria-label={event.isHost ? `Guest option: ${custom || cfg.label}` : undefined}
                      style={{
                        padding: '13px 8px',
                        borderRadius: 14,
                        cursor: replyLock ? 'default' : 'pointer',
                        opacity: replyLock ? 0.6 : 1,
                        fontFamily: 'inherit',
                        textAlign: 'center',
                        border: on ? `1.5px solid ${cfg.tint}` : '1px solid rgba(255,255,255,0.11)',
                        background: on ? `${cfg.tint}22` : 'rgba(255,255,255,0.035)',
                        transition: 'border-color 0.18s ease, background 0.18s ease'
                      }}
                    >
                      <Icon
                        size={19}
                        strokeWidth={1.9}
                        color={on ? cfg.tint : 'rgba(255,255,255,0.48)'}
                        style={{ marginBottom: 6 }}
                      />
                      <span
                        style={{
                          display: 'block',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          color: on ? '#fff' : 'rgba(255,255,255,0.82)',
                          lineHeight: 1.25
                        }}
                      >
                        {custom || cfg.label}
                      </span>
                      <span
                        style={{
                          display: 'block',
                          fontSize: '0.68rem',
                          marginTop: 3,
                          color: on ? cfg.tint : 'rgba(255,255,255,0.4)',
                          fontWeight: 600
                        }}
                      >
                        {event.isHost ? cfg.sub : on ? 'Locked in' : cfg.sub}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Errors from changing an existing reply, where the modal is not open */}
              {rsvpError && !isRsvpModalOpen && (
                <div
                  role="alert"
                  style={{
                    marginTop: 12,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: 12,
                    padding: '10px 12px',
                    fontSize: '0.82rem',
                    color: '#fecaca'
                  }}
                >
                  <Lock size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{rsvpError}</span>
                </div>
              )}

              {selectedStatus === 'yes' && (
                <div
                  style={{
                    marginTop: 12,
                    padding: '10px 14px',
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: '#10b981', fontWeight: 600 }}>
                    <CheckCircle2 size={15} strokeWidth={1.9} />
                    <span>You're in</span>
                  </div>
                  <button
                    onClick={downloadCalendarFile}
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                  >
                    <Download size={12} />
                    <span>Add to calendar</span>
                  </button>
                </div>
              )}
            </div>


          </div>
        </div>
        </RevealOnScroll>
        </div>

        {/* Right column: host panel + notes */}
        <div style={{ flex: '1 1 400px', maxWidth: 520, width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* The host's own view: who replied, what they said, and their details. */}
          {event.isHost && <HostPanel slug={slug} eventId={event.id} />}

        <div
          style={{
            borderRadius: 20,
            padding: '20px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={16} strokeWidth={1.9} color="#f5b544" />
              <span style={{ fontSize: '0.94rem', fontWeight: 700, color: '#fff' }}>
                Notes
              </span>
            </div>
            <span style={{ fontSize: '0.76rem', color: 'rgba(255, 255, 255, 0.45)' }}>
              {(() => {
                const n = comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0);
                return `${n} ${n === 1 ? 'note' : 'notes'}`;
              })()}
            </span>
          </div>

          {/* Form to leave a note */}
          <form onSubmit={handlePostComment} style={{ marginBottom: 20 }}>
            {!myRsvp && (
              <input
                type="text"
                placeholder="Your Name"
                value={commentName}
                onChange={(e) => setCommentName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  fontSize: '0.82rem',
                  marginBottom: 8
                }}
              />
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
              placeholder="Leave a note…"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  fontSize: '0.82rem'
                }}
              />
              <button
                type="submit"
                disabled={isPostingComment}
                style={{
                  padding: '8px 14px',
                  fontSize: '0.82rem',
                  flexShrink: 0,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#fff',
                  borderRadius: 10,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <Send size={14} />
              </button>
            </div>
          </form>

          {/* Notes list.
              Two bugs fixed here: the body rendered `c.text`, but the API returns
              `message`, so every note body was blank and only the name showed.
              And the key was `c._id || Math.random()` — `_id` never existed, so
              every note got a fresh key on every render and React remounted the
              whole list each time. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {comments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px', color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.82rem' }}>
                Koi note nahi hai. Pehla tu likh de.
              </div>
            ) : (
              comments.map((c) => (
                <div
                  key={c.id}
                  style={{
                    padding: '11px 14px',
                    borderRadius: 12,
                    background: c.fromHost ? 'rgba(245,181,68,0.07)' : 'rgba(255, 255, 255, 0.03)',
                    border: c.fromHost ? '1px solid rgba(245,181,68,0.28)' : '1px solid rgba(255, 255, 255, 0.06)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: c.fromHost ? '#f5b544' : '#fff' }}>
                      {c.authorName || 'Guest'}
                    </span>
                    {c.fromHost && (
                      <span
                        style={{
                          fontSize: '0.66rem',
                          fontWeight: 700,
                          padding: '1px 7px',
                          borderRadius: 999,
                          background: 'rgba(245,181,68,0.18)',
                          color: '#f5b544',
                          letterSpacing: '0.05em'
                        }}
                      >
                        HOST
                      </span>
                    )}
                    <span style={{ fontSize: '0.68rem', color: 'rgba(255, 255, 255, 0.35)', marginLeft: 'auto' }}>
                      {new Date(c.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.86rem', color: 'rgba(255, 255, 255, 0.86)', margin: '5px 0 0', lineHeight: 1.5 }}>
                    {c.message}
                  </p>

                  {/* Replies to this note */}
                  {c.replies?.length > 0 && (
                    <div style={{ marginTop: 10, paddingLeft: 12, borderLeft: '2px solid rgba(255,255,255,0.09)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {c.replies.map((r) => (
                        <div key={r.id}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: r.fromHost ? '#f5b544' : '#fff' }}>
                              {r.authorName}
                            </span>
                            {r.fromHost && (
                              <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: 'rgba(245,181,68,0.18)', color: '#f5b544' }}>
                                HOST
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.78)', margin: '3px 0 0', lineHeight: 1.45 }}>
                            {r.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply affordance. The host answering guests was impossible
                      before: comments had no parent_id at all. */}
                  {(event.isHost || myRsvp) && (
                    replyTo === c.id ? (
                      <form
                        onSubmit={(e) => handlePostReply(e, c.id)}
                        style={{ display: 'flex', gap: 7, marginTop: 10 }}
                      >
                        <input
                          type="text"
                          autoFocus
                          value={replyDraft}
                          onChange={(e) => setReplyDraft(e.target.value)}
                          placeholder={event.isHost ? 'Reply to your guest…' : 'Reply…'}
                          aria-label="Your reply"
                          style={{
                            flex: 1,
                            padding: '7px 11px',
                            borderRadius: 8,
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            color: '#fff',
                            fontSize: '0.82rem',
                            fontFamily: 'inherit'
                          }}
                        />
                        <button type="submit" disabled={isPostingComment} className="lp-btn lp-btn-primary" style={{ padding: '7px 13px', fontSize: '0.8rem' }}>
                          <Send size={13} strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          onClick={() => { setReplyTo(null); setReplyDraft(''); }}
                          className="lp-chip"
                          style={{ padding: '7px 11px', fontSize: '0.8rem' }}
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setReplyTo(c.id); setReplyDraft(''); }}
                        style={{
                          marginTop: 8,
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          font: 'inherit',
                          fontSize: '0.76rem',
                          color: 'rgba(255,255,255,0.42)',
                          cursor: 'pointer'
                        }}
                      >
                        Reply
                      </button>
                    )
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        </div>
      </main>

      {/* The meme reaction after a reply. Owns its own confetti so the intensity
          can match the answer. */}
      <SeenHaiReaction reaction={reaction} onClose={() => setReaction(null)} />

      {/* Seen Hai form — name and contact, once, for a first-time guest */}
      {isRsvpModalOpen && (
        <div
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
        >
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              padding: 24,
              borderRadius: 20,
              background: 'rgba(16,18,26,0.99)',
              border: '1px solid rgba(255, 255, 255, 0.11)'
            }}
          >
            <h3 style={{ fontSize: '1.24rem', fontWeight: 700, color: '#fff', marginBottom: 5 }}>
              {event.invitedAs ? `${event.invitedAs}, ek baar naam likh do` : 'Bas naam likh do'}
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'rgba(255, 255, 255, 0.55)', marginBottom: 18, lineHeight: 1.5 }}>
              No account, no password. Your host just needs to know who is coming.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitRsvpPayload(pendingStatus, guestName, guestContact, guestNote);
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
                  Your Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maya Lin"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    fontSize: '0.88rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
                  Phone or Email (for gate code updates) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. maya@gmail.com or +1 (555) 019-2831"
                  value={guestContact}
                  onChange={(e) => setGuestContact(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    fontSize: '0.88rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
                  Note to Host / Blessing (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Can't wait! Bringing vinyl records."
                  value={guestNote}
                  onChange={(e) => setGuestNote(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    fontSize: '0.88rem'
                  }}
                />
              </div>

              {rsvpError && (
                <div
                  role="alert"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: 12,
                    padding: '10px 12px',
                    fontSize: '0.84rem',
                    color: '#fecaca'
                  }}
                >
                  <Lock size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{rsvpError}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => { setIsRsvpModalOpen(false); setRsvpError(''); }}
                  className="btn-secondary"
                  style={{ flex: 1, padding: '12px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRsvp}
                  className="btn-primary"
                  style={{ flex: 2, padding: '12px', opacity: isSubmittingRsvp ? 0.6 : 1 }}
                >
                  {isSubmittingRsvp ? 'Submitting…' : 'Confirm RSVP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share Modal & WhatsApp/QR Sheet */}
      {isShareOpen && (
        <div
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
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>
                  Send Invitation
                </h3>
              </div>
              <button
                onClick={() => setIsShareOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.1rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: 16 }}>
              Send the link however you'd like.
            </p>

            {/* QR Code */}
            {qrCodeUrl && (
              <div style={{ textAlign: 'center', padding: '14px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: 14, marginBottom: 16 }}>
                <img
                  src={qrCodeUrl}
                  alt="Invitation QR Code"
                  style={{ width: 140, height: 140, borderRadius: 10, margin: '0 auto', display: 'block' }}
                />
                <span style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: 6, display: 'block' }}>
                  Scan to RSVP instantly
                </span>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={copyShareUrl}
                className="btn-primary"
                style={{ padding: '12px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span>{copied ? '✓ Link Copied!' : 'Copy Shareable Link'}</span>
              </button>

              <a
                href={getWhatsAppShareUrl()}
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
                <span>💬 Send via WhatsApp</span>
              </a>

              <button
                onClick={downloadCalendarFile}
                className="btn-secondary"
                style={{ padding: '12px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <Download size={16} />
                <span>Download .ICS Calendar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
