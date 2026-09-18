import React, { useState, useMemo, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowLeft, ArrowRight, Check, Copy, ExternalLink, Lock, LockOpen, MapPin,
  KeyRound, CalendarDays, Users, Send, X, Eye, ShieldCheck, Sparkles, Shirt
} from 'lucide-react';
import { CATEGORIES, TEMPLATES, THEME_PALETTES } from '../data/templates';
import {
  HOUSE_RULES, houseRuleLine, fontById, soundById,
  DEFAULT_FONT, DEFAULT_REVEAL, DEFAULT_SOUND
} from '../data/vibe';
import { SEEN_HAI } from '../data/seenHai';
import { CATEGORY_ICON, RSVP_ICON } from '../lib/icons';
import { api } from '../services/api';
import { playPop, playCelebrationChord } from '../utils/soundEffects';
import { prepareCoverImage } from '../utils/prepareImage';
import AudioPlayer from './AudioPlayer';
import DateTimePicker from './DateTimePicker';
import InviteeManager from './InviteeManager';
import AddressAutocomplete from './AddressAutocomplete';
import SeenHaiEditor from './SeenHaiEditor';
import VibePicker from './VibePicker';
import RevealOnScroll from './RevealOnScroll';

/**
 * The studio.
 *
 * Two steps:
 *
 *   1. The vibe — occasion, artwork (yours or ours), colour, type, how the card
 *      opens, what it sounds like, dress code.
 *   2. The plan — name, description, host, when, where, house rules, who can see
 *      it, what the reply buttons say.
 *
 * The occasion chips sit at the very top of step one and are answered in a
 * single tap, which is all the recommendations underneath them ever needed — so
 * leading with the vibe costs nothing and gives the host the enjoyable half
 * first.
 *
 * Unchanged and still deliberate: nothing is prefilled. The example text is the
 * *placeholder*, the input is empty, and publishing uses exactly what the
 * preview shows — so what you see is what you get.
 */

/** Default start: Saturday-ish, 8pm. */
function defaultStart() {
  const d = new Date(Date.now() + 5 * 86400000);
  d.setHours(20, 0, 0, 0);
  return d;
}

/**
 * Vibe first, details second.
 *
 * This is the reverse of the previous order, and the reversal is deliberate:
 * choosing the artwork is the part a host *wants* to do and the fields are the
 * part they have to do. Opening on the fields made the studio read as a form
 * with a decoration step bolted on; opening on the artwork makes the form read
 * as finishing something already underway.
 *
 * Changing your mind is one line — swap these two entries and flip the initial
 * value of `step` below. Nothing else in the component depends on the order.
 */
const STEPS = [
  { id: 'vibe', n: '1', label: 'The vibe' },
  { id: 'details', n: '2', label: 'The plan' }
];

export default function InvitationCardMaker({
  initialCategory = 'all',
  onBack,
  currentUser,
  onOpenAuth
}) {
  const [step, setStep] = useState(STEPS[0].id);
  const [category, setCategory] = useState(initialCategory);

  const pickTemplate = (cat) => {
    if (cat && cat !== 'all') {
      const m = TEMPLATES.find((t) => t.category === cat);
      if (m) return m;
    }
    return TEMPLATES[0];
  };

  const [template, setTemplate] = useState(() => pickTemplate(initialCategory));
  const [themeId, setThemeId] = useState(() => pickTemplate(initialCategory).theme);
  const [cover, setCover] = useState(() => pickTemplate(initialCategory).image);

  // A host's own artwork, prepared in the browser and held until publish. It is
  // uploaded at publish time rather than on selection so abandoning the studio
  // leaves nothing behind in the bucket.
  const [coverUpload, setCoverUpload] = useState(null); // { blob, previewUrl, name }
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Every text field starts empty. The example supplies the placeholder only.
  const [title, setTitle] = useState('');
  const [host, setHost] = useState('');
  const [venue, setVenue] = useState('');
  const [address, setAddress] = useState('');
  const [doorCode, setDoorCode] = useState('');
  const [description, setDescription] = useState('');
  const [dressCode, setDressCode] = useState('');

  // House rules are a *set*. The old single-choice field made a host pick which
  // of "BYOB", "no plus-ones" and "out by two" mattered most and drop the rest,
  // which is not how a party works — all three are normally true at once.
  const [houseRules, setHouseRules] = useState([]);
  const [houseNote, setHouseNote] = useState('');

  // How the card presents itself. Chosen in step one.
  const [fontId, setFontId] = useState(DEFAULT_FONT);
  const [revealId, setRevealId] = useState(DEFAULT_REVEAL);
  const [soundId, setSoundId] = useState(DEFAULT_SOUND);

  const [startsAt, setStartsAt] = useState(defaultStart);
  const [isPrivate, setIsPrivate] = useState(false);
  const [previewUnlocked, setPreviewUnlocked] = useState(false);

  const [geo, setGeo] = useState({ lat: null, lng: null, label: null });

  const [replies, setReplies] = useState({
    yes: { title: SEEN_HAI.going.label, sub: SEEN_HAI.going.sub },
    maybe: { title: SEEN_HAI.maybe.label, sub: SEEN_HAI.maybe.sub },
    no: { title: SEEN_HAI.not_going.label, sub: SEEN_HAI.not_going.sub }
  });

  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [published, setPublished] = useState(null);
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);

  const theme = useMemo(
    () => THEME_PALETTES.find((t) => t.id === themeId) || THEME_PALETTES[0],
    [themeId]
  );

  const cardFont = useMemo(() => fontById(fontId), [fontId]);
  const soundscape = useMemo(() => soundById(soundId), [soundId]);

  // The rules as the guest will read them, plus whatever the host typed.
  const ruleLines = useMemo(() => {
    const lines = houseRules.map(houseRuleLine).filter(Boolean);
    const extra = houseNote.trim();
    return extra ? [...lines, extra] : lines;
  }, [houseRules, houseNote]);

  const toggleRule = (id) => {
    setHouseRules((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
    playPop();
  };

  // Object URLs are a manual resource. Without this the studio leaks one per
  // image the host tries.
  useEffect(() => {
    return () => {
      if (coverUpload?.previewUrl) URL.revokeObjectURL(coverUpload.previewUrl);
    };
  }, [coverUpload]);

  /** What the card shows: the typed value, or the placeholder in a lighter tone. */
  const shown = (value, fallback) => ({
    text: value.trim() || fallback || '',
    ghost: !value.trim()
  });

  const f = {
    title: shown(title, template.title),
    host: shown(host, currentUser?.name || template.host),
    venue: shown(venue, template.venue),
    address: shown(address, `${template.venue}, City Center`),
    doorCode: shown(doorCode, template.doorCode || 'Ring the bell'),
    description: shown(description, template.description),
    dressCode: shown(dressCode, template.dressCode)
  };

  const selectCategory = (catId) => {
    setCategory(catId);
    const m = pickTemplate(catId);
    setTemplate(m);
    // Only follow the example's look while the host is still on defaults — once
    // they have uploaded their own artwork, changing the occasion must not throw
    // it away.
    if (!coverUpload) {
      setThemeId(m.theme);
      setCover(m.image);
    }
    playPop();
  };

  /* ---------- artwork ---------- */

  const handleUploadFile = async (file) => {
    setUploadError('');
    setUploadBusy(true);
    try {
      const prepared = await prepareCoverImage(file);
      if (coverUpload?.previewUrl) URL.revokeObjectURL(coverUpload.previewUrl);
      setCoverUpload({ blob: prepared.blob, previewUrl: prepared.previewUrl, name: file.name });
      setCover(prepared.previewUrl);
      playPop();
    } catch (err) {
      setUploadError(err.message || 'Could not use that image.');
    } finally {
      setUploadBusy(false);
    }
  };

  const clearUpload = () => {
    if (coverUpload?.previewUrl) URL.revokeObjectURL(coverUpload.previewUrl);
    setCoverUpload(null);
    setCover(template.image);
    setUploadError('');
  };

  const pickBackground = (bg) => {
    if (coverUpload?.previewUrl) URL.revokeObjectURL(coverUpload.previewUrl);
    setCoverUpload(null);
    setCover(bg.src);
    // The palette was chosen against this artwork, so take both.
    if (bg.palette) {
      setThemeId(bg.palette);
      const pal = THEME_PALETTES.find((t) => t.id === bg.palette);
      if (pal?.soundId) setSoundId(pal.soundId);
    }
    playPop();
  };

  /* ---------- publishing ---------- */

  const handlePublish = async () => {
    setPublishError('');

    if (!title.trim() && !template.title) {
      setPublishError('Give your gathering a name.');
      return;
    }
    if (!currentUser) {
      setPublishError('Create a free account to publish. Your guests still reply without one.');
      if (onOpenAuth) onOpenAuth('register');
      return;
    }

    setPublishing(true);
    try {
      // The blob URL in `cover` only exists in this tab, so an uploaded image
      // has to become a real URL before it can go on an invitation. If the
      // upload fails we say so and stop, rather than publishing an invite whose
      // artwork is a dead link.
      let coverUrl = cover;
      if (coverUpload) {
        coverUrl = await api.uploadCover(coverUpload.blob);
      }

      // Publish exactly what the preview shows.
      const ev = await api.createEvent({
        title: f.title.text,
        subtitle: null,
        hostName: f.host.text,
        description: f.description.text,
        startsAt: startsAt.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        venueName: f.venue.text,
        venueAddress: f.address.text,
        venueLat: geo.lat,
        venueLng: geo.lng,
        venueOsmLabel: geo.label,
        doorCode: f.doorCode.text,
        // One string for the legacy column, the structured list for the invite.
        byobNote: ruleLines.join(' · '),
        hideUntilRsvp: true,
        isPrivate,
        vibeTag: template.vibeTag,
        theme: { presetId: themeId, posterUrl: coverUrl },
        customization: {
          vibeTag: template.vibeTag,
          coverImage: coverUrl,
          dressCode: { title: f.dressCode.text },
          houseRules: ruleLines,
          fontId,
          revealId,
          soundId,
          rsvpOptions: {
            yes: { title: replies.yes.title.trim() || SEEN_HAI.going.label, sub: SEEN_HAI.going.sub },
            maybe: { title: replies.maybe.title.trim() || SEEN_HAI.maybe.label, sub: SEEN_HAI.maybe.sub },
            no: { title: replies.no.title.trim() || SEEN_HAI.not_going.label, sub: SEEN_HAI.not_going.sub }
          },
          soundFreqs: soundscape.freqs.length ? soundscape.freqs : theme.soundFreqs
        }
      });

      setPublished(ev);
      setQr(await api.qrDataUrl(ev.slug));
      playCelebrationChord();
      confetti({
        particleCount: 90, angle: 60, spread: 62, origin: { x: 0, y: 0.95 },
        startVelocity: 52, colors: ['#C0922E', '#4E8B7C', '#E6D5AE', '#D23C78'],
        disableForReducedMotion: true
      });
      confetti({
        particleCount: 90, angle: 120, spread: 62, origin: { x: 1, y: 0.95 },
        startVelocity: 52, colors: ['#C0922E', '#4E8B7C', '#E6D5AE', '#D23C78'],
        disableForReducedMotion: true
      });
    } catch (err) {
      setPublishError(err.message || 'Could not publish.');
    } finally {
      setPublishing(false);
    }
  };

  /* ────────────────── shared styles ────────────────── */
  const label = {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 6
  };

  const input = {
    width: '100%',
    padding: '11px 13px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    font: 'inherit',
    fontSize: '0.9rem',
    boxSizing: 'border-box'
  };

  const block = { marginBottom: 18 };

  const sectionHead = (text) => (
    <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '34px 0 16px' }}>
      <span
        aria-hidden="true"
        style={{
          width: 3, height: 14, borderRadius: 2,
          background: `linear-gradient(${theme.primary}, ${theme.accent})`,
          flexShrink: 0
        }}
      />
      <span
        style={{
          fontSize: '0.73rem', fontWeight: 600, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)'
        }}
      >
        {text}
      </span>
    </div>
  );

  const ghostStyle = (ghost) => ({
    color: ghost
      ? (theme.textColorMuted || 'rgba(255,255,255,0.34)')
      : (theme.textColor || '#fff')
  });

  const goToDetails = () => {
    setStep('details');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToVibe = () => {
    setStep('vibe');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      className="lp-scope"
      style={{
        minHeight: '100vh',
        background: '#08090f',
        color: '#f5f7fa',
        '--lp-accent': theme.accent
      }}
    >
      <div className="lp-grain" aria-hidden="true" />

      {/* ───────── header ───────── */}
      <header
        style={{
          position: 'sticky', top: 0, zIndex: 40,
          background: 'rgba(8,9,15,0.9)',
          backdropFilter: 'blur(14px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)'
        }}
      >
        <div
          style={{
            maxWidth: 1240, margin: '0 auto', padding: '0 22px', height: 60,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14
          }}
        >
          <button type="button" onClick={onBack} className="lp-chip" style={{ padding: '7px 13px' }}>
            <ArrowLeft size={14} strokeWidth={2} />
            <span>Back</span>
          </button>

          {/* Step indicator, and a way back to step one. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {STEPS.map((s, i) => {
              const on = step === s.id;
              return (
                <React.Fragment key={s.id}>
                  {i > 0 && (
                    <span aria-hidden="true" style={{ width: 16, height: 1, background: 'rgba(255,255,255,0.16)' }} />
                  )}
                  <button
                    type="button"
                    onClick={() => setStep(s.id)}
                    aria-current={on ? 'step' : undefined}
                    className="lp-chip"
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.79rem',
                      borderColor: on ? `${theme.accent}88` : undefined,
                      background: on ? `${theme.accent}14` : undefined,
                      color: on ? '#fff' : 'rgba(255,255,255,0.5)'
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 17, height: 17, borderRadius: '50%',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.66rem', fontWeight: 700,
                        color: on ? '#0b0d14' : 'rgba(255,255,255,0.6)',
                        background: on ? theme.accent : 'rgba(255,255,255,0.1)'
                      }}
                    >
                      {s.n}
                    </span>
                    <span>{s.label}</span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AudioPlayer soundscape={soundscape} />
            {step === 'details' ? (
              <button
                type="button"
                onClick={handlePublish}
                disabled={publishing}
                className="lp-btn lp-btn-primary"
                style={{ padding: '9px 20px', fontSize: '0.88rem', opacity: publishing ? 0.6 : 1 }}
              >
                <span>{publishing ? 'Publishing…' : 'Publish'}</span>
                {!publishing && <ArrowRight size={15} strokeWidth={2.1} />}
              </button>
            ) : (
              <button
                type="button"
                onClick={goToDetails}
                className="lp-btn lp-btn-primary"
                style={{ padding: '9px 20px', fontSize: '0.88rem' }}
              >
                <span>Next</span>
                <ArrowRight size={15} strokeWidth={2.1} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ───────── 50 / 50 ───────── */}
      <main
        className="lp-studio-main"
        style={{
          maxWidth: 1240, margin: '0 auto', padding: '26px 22px 60px',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'start'
        }}
      >
        {/* ── LEFT: the card ── */}
        <div className="lp-studio-preview" style={{ position: 'sticky', top: 86 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Eye size={13} strokeWidth={1.9} />
              What your guests see
            </span>
            <button
              type="button"
              onClick={() => setPreviewUnlocked((v) => !v)}
              className="lp-chip"
              style={{ padding: '5px 11px', fontSize: '0.75rem' }}
            >
              {previewUnlocked ? <LockOpen size={12} strokeWidth={2} /> : <Lock size={12} strokeWidth={2} />}
              <span>{previewUnlocked ? 'After reply' : 'Before reply'}</span>
            </button>
          </div>

          <RevealOnScroll key={revealId} revealId={revealId}>
            <div
              style={{
                borderRadius: 20, overflow: 'hidden',
                border: `1px solid ${theme.border}`,
                background: theme.cardBg,
                color: theme.textColor || '#f5f7fa',
                boxShadow: '0 26px 60px -22px rgba(0,0,0,0.8)'
              }}
            >
            <div style={{ position: 'relative', aspectRatio: '5 / 4', background: '#0b0d14' }}>
              <img src={cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <div
                style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(to top, rgba(8,9,15,0.96) 4%, rgba(8,9,15,0.3) 50%, transparent 78%)'
                }}
              />
              <div style={{ position: 'absolute', left: 20, right: 20, bottom: 16 }}>
                <div
                  style={{
                    fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.1em',
                    textTransform: 'uppercase', color: theme.accent, marginBottom: 7
                  }}
                >
                  {template.vibeTag}
                </div>
                <h2
                  style={{
                    margin: 0,
                    fontFamily: cardFont.stack,
                    fontWeight: cardFont.weight,
                    fontSize: '1.34rem',
                    lineHeight: 1.15, letterSpacing: '-0.02em',
                    ...ghostStyle(f.title.ghost)
                  }}
                >
                  {f.title.text}
                </h2>
              </div>
            </div>

            <div style={{ padding: '17px 20px 20px' }}>
              {/* The description, where the guest actually reads it. */}
              {f.description.text && (
                <p
                  style={{
                    margin: '0 0 13px', fontSize: '0.85rem', lineHeight: 1.55,
                    ...ghostStyle(f.description.ghost)
                  }}
                >
                  {f.description.text}
                </p>
              )}

              <div
                style={{
                  display: 'flex', flexWrap: 'wrap', gap: '5px 13px',
                  fontSize: '0.82rem', color: theme.textColorMuted || 'rgba(255,255,255,0.6)', marginBottom: 15
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <CalendarDays size={14} strokeWidth={1.75} />
                  {startsAt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
                <span style={{ opacity: 0.35 }}>·</span>
                <span>{startsAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
                <span style={{ opacity: 0.35 }}>·</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Users size={14} strokeWidth={1.75} />
                  Hosted by <span style={ghostStyle(f.host.ghost)}>{f.host.text}</span>
                </span>
                {f.dressCode.text && (
                  <>
                    <span style={{ opacity: 0.35 }}>·</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Shirt size={14} strokeWidth={1.75} />
                      <span style={ghostStyle(f.dressCode.ghost)}>{f.dressCode.text}</span>
                    </span>
                  </>
                )}
              </div>

              {ruleLines.length > 0 && (
                <div style={{ marginBottom: 15 }}>
                  <div
                    style={{
                      fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.1em',
                      textTransform: 'uppercase', color: 'rgba(230,213,174,0.42)', marginBottom: 6
                    }}
                  >
                    House rules
                  </div>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {ruleLines.map((line) => (
                      <li
                        key={line}
                        style={{ fontSize: '0.82rem', color: 'rgba(230,213,174,0.78)', display: 'flex', gap: 7 }}
                      >
                        <span aria-hidden="true" style={{ color: theme.accent }}>—</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* The lock, in both states, so a host can see what a guest sees */}
              <div
                style={{
                  padding: '12px 14px', borderRadius: 12, marginBottom: 15,
                  border: previewUnlocked ? `1px solid ${theme.accent}55` : '1px dashed rgba(255,255,255,0.16)',
                  background: previewUnlocked ? `${theme.accent}12` : 'rgba(255,255,255,0.03)'
                }}
              >
                {previewUnlocked ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8, fontSize: '0.67rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.accent }}>
                      <LockOpen size={12} strokeWidth={2.2} />
                      Address unlocked
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
                      <MapPin size={14} strokeWidth={1.75} color="rgba(255,255,255,0.45)" style={{ marginTop: 2, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.87rem', ...ghostStyle(f.address.ghost) }}>{f.address.text}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <KeyRound size={14} strokeWidth={1.75} color="rgba(255,255,255,0.45)" style={{ marginTop: 2, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.82rem', ...ghostStyle(f.doorCode.ghost) }}>{f.doorCode.text}</span>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Lock size={15} strokeWidth={1.8} color={theme.textColorMuted || 'rgba(255,255,255,0.38)'} style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.85rem', color: theme.textColor || '#fff' }}>
                        <span style={ghostStyle(f.venue.ghost)}>{f.venue.text}</span>
                      </div>
                      <div style={{ fontSize: '0.77rem', color: theme.textColorMuted || 'rgba(255,255,255,0.42)', marginTop: 1 }}>
                        Exact address appears once they reply
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Seen Hai replies — mirrors whatever the host typed below */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {[
                  { s: 'going', k: 'yes' },
                  { s: 'maybe', k: 'maybe' },
                  { s: 'not_going', k: 'no' }
                ].map(({ s, k }) => {
                  const cfg = SEEN_HAI[s];
                  const Icon = RSVP_ICON[s];
                  const written = replies[k]?.title?.trim();
                  return (
                    <div
                      key={s}
                      style={{
                        padding: '10px 5px', borderRadius: 11, textAlign: 'center',
                        border: `1px solid ${cfg.tint}2e`, background: `${cfg.tint}0d`
                      }}
                    >
                      <Icon size={16} strokeWidth={1.9} color={cfg.tint} />
                      <div
                        style={{
                          fontSize: '0.73rem', fontWeight: 600, marginTop: 4, lineHeight: 1.2,
                          color: written ? (theme.textColor || '#fff') : (theme.textColorMuted || 'rgba(255,255,255,0.34)')
                        }}
                      >
                        {written || cfg.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          </RevealOnScroll>
        </div>

        {/* ── RIGHT: the fields ── */}
        <div>
          {step === 'details' ? (
            <>
              {sectionHead('The details')}

              <div style={block}>
                <label htmlFor="m-title" style={label}>Name of the gathering</label>
                <input
                  id="m-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={template.title}
                  style={input}
                />
              </div>

              {/* Was "One line about it", which read like a tagline field and so
                  got tagline answers. It is the description, it goes on the card,
                  and now it says both. */}
              <div style={block}>
                <label htmlFor="m-desc" style={label}>
                  Description
                  <span style={{ color: theme.accent }}> — this appears on the card</span>
                </label>
                <textarea
                  id="m-desc"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={template.description}
                  style={{ ...input, resize: 'vertical', lineHeight: 1.5 }}
                />
              </div>

              <div style={block}>
                <label htmlFor="m-host" style={label}>Hosted by</label>
                <input
                  id="m-host"
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder={currentUser?.name || template.host}
                  style={input}
                />
              </div>

              <div style={block}>
                <DateTimePicker value={startsAt} onChange={setStartsAt} label="When" accent={theme.accent} />
              </div>

              {sectionHead('Where')}

              <div style={block}>
                <label htmlFor="m-venue" style={label}>Venue name — everyone sees this</label>
                <input
                  id="m-venue"
                  type="text"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder={template.venue}
                  style={input}
                />
              </div>

              <div style={block}>
                <label htmlFor="m-address" style={label}>
                  Full address
                  <span style={{ color: theme.accent }}> — hidden until they reply</span>
                </label>
                <AddressAutocomplete
                  id="m-address"
                  value={address}
                  onChange={setAddress}
                  onPick={setGeo}
                  placeholder="Search for the venue, or type the address"
                  accent={theme.accent}
                />
              </div>

              <div style={block}>
                <label htmlFor="m-code" style={label}>
                  How to get in
                  <span style={{ color: '#f5b544' }}> — hidden until they reply</span>
                </label>
                <input
                  id="m-code"
                  type="text"
                  value={doorCode}
                  onChange={(e) => setDoorCode(e.target.value)}
                  placeholder={template.doorCode || 'Ring the bell'}
                  style={input}
                />
              </div>

              {/* ── house rules ──
                  Was "Food and drink note", then "Logistics" — both of which
                  sound like a shipping form. These are the things a host says at
                  the door, so they are called house rules.

                  Multi-select, which is the real fix. BYOB *and* no plus-ones
                  *and* out by two is one ordinary party; the old single-choice
                  field made a host pick which of those mattered most and drop the
                  rest. */}
              {sectionHead('House rules')}

              <p style={{ margin: '-6px 0 13px', fontSize: '0.84rem', lineHeight: 1.5, color: 'rgba(230,213,174,0.48)' }}>
                Pick as many as are true. Everyone sees these before they reply, which
                is the point — nobody should find out about the shoes at the door.
              </p>

              <div
                role="group"
                aria-label="House rules"
                style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}
              >
                {HOUSE_RULES.map((r) => {
                  const active = houseRules.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggleRule(r.id)}
                      aria-pressed={active}
                      title={r.detail}
                      className="lp-chip"
                      style={{ fontSize: '0.79rem', padding: '7px 12px' }}
                    >
                      {active && <Check size={12} strokeWidth={2.4} />}
                      <span>{r.title}</span>
                    </button>
                  );
                })}
              </div>

              <div style={block}>
                <label htmlFor="m-housenote" style={label}>
                  Anything else
                  <span style={{ color: 'rgba(230,213,174,0.32)' }}> — one more line, in your words</span>
                </label>
                <input
                  id="m-housenote"
                  type="text"
                  value={houseNote}
                  onChange={(e) => setHouseNote(e.target.value)}
                  placeholder="Buzzer is broken, call when you're outside"
                  style={input}
                />
              </div>

              {sectionHead('Seen Hai · your reply buttons')}
              <div style={{ marginBottom: 6 }}>
                <SeenHaiEditor value={replies} onChange={setReplies} accent={theme.accent} />
              </div>

              {sectionHead('Who can see it')}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
                {[
                  { v: false, t: 'Anyone with the link', d: 'Share it wherever. Whoever opens it can reply.' },
                  { v: true, t: 'Only people I invite', d: 'Each guest gets their own link that stops working once used.' }
                ].map((opt) => (
                  <button
                    key={String(opt.v)}
                    type="button"
                    onClick={() => setIsPrivate(opt.v)}
                    aria-pressed={isPrivate === opt.v}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 11,
                      padding: '13px 14px', borderRadius: 12, cursor: 'pointer',
                      textAlign: 'left', font: 'inherit',
                      border: isPrivate === opt.v ? '1px solid rgba(245,181,68,0.5)' : '1px solid rgba(255,255,255,0.1)',
                      background: isPrivate === opt.v ? 'rgba(245,181,68,0.07)' : 'rgba(255,255,255,0.03)'
                    }}
                  >
                    <span
                      style={{
                        width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                        border: isPrivate === opt.v ? '5px solid #f5b544' : '1px solid rgba(255,255,255,0.3)',
                        background: 'transparent'
                      }}
                    />
                    <span>
                      <span style={{ display: 'block', fontSize: '0.88rem', color: '#fff', fontWeight: 500 }}>{opt.t}</span>
                      <span style={{ display: 'block', fontSize: '0.79rem', color: 'rgba(255,255,255,0.45)', marginTop: 2, lineHeight: 1.45 }}>
                        {opt.d}
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              {publishError && (
                <div
                  role="alert"
                  style={{
                    display: 'flex', gap: 8, padding: '11px 13px',
                    background: 'rgba(210,60,120,0.12)', border: '1px solid rgba(210,60,120,0.4)',
                    fontSize: '0.85rem', color: '#f0b8cd', marginBottom: 16,
                    clipPath: 'var(--chamfer-sm)'
                  }}
                >
                  <ShieldCheck size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{publishError}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={goToVibe}
                  className="lp-chip"
                  style={{ padding: '13px 16px', fontSize: '0.9rem' }}
                >
                  <ArrowLeft size={15} strokeWidth={2} />
                  <span>Back to the vibe</span>
                </button>
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={publishing}
                  className="lp-btn lp-btn-primary"
                  style={{ flex: 1, minWidth: 220, padding: '14px', fontSize: '0.94rem', opacity: publishing ? 0.6 : 1 }}
                >
                  <span>{publishing ? 'Publishing' : 'Publish and get the link'}</span>
                  {!publishing && <ArrowRight size={16} strokeWidth={2.1} />}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* The occasion, answered in one tap. Every suggestion below —
                  artwork, reveal, sound, dress code — is ordered against this,
                  so it has to be the first thing on the page. */}
              {sectionHead('What kind of thing is it')}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 4 }}>
                {CATEGORIES.map((cat) => {
                  const Icon = CATEGORY_ICON[cat.id];
                  const on = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => selectCategory(cat.id)}
                      className="lp-chip"
                      aria-pressed={on}
                      style={{ fontSize: '0.82rem', padding: '7px 13px' }}
                    >
                      {Icon && <Icon size={13} strokeWidth={1.9} />}
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>

              <VibePicker
                category={category === 'all' ? template.category : category}
                cover={cover}
                uploadedName={coverUpload?.name}
                uploadBusy={uploadBusy}
                uploadError={uploadError}
                onUploadFile={handleUploadFile}
                onClearUpload={clearUpload}
                onPickBackground={pickBackground}
                themeId={themeId}
                onPickTheme={(id) => {
                  setThemeId(id);
                  const pal = THEME_PALETTES.find((t) => t.id === id);
                  if (pal?.soundId) setSoundId(pal.soundId);
                  playPop();
                }}
                fontId={fontId}
                onPickFont={(id) => { setFontId(id); playPop(); }}
                revealId={revealId}
                onPickReveal={(id) => { setRevealId(id); playPop(); }}
                soundId={soundId}
                onPickSound={(id) => { setSoundId(id); playPop(); }}
                dressCode={dressCode}
                dressCodeShown={f.dressCode.text}
                onDressCode={setDressCode}
                theme={theme}
                sectionHead={sectionHead}
                label={label}
                input={input}
              />

              <button
                type="button"
                onClick={goToDetails}
                className="lp-btn lp-btn-primary"
                style={{ width: '100%', padding: '14px', fontSize: '0.94rem' }}
              >
                <span>Next — who, where, when</span>
                <ArrowRight size={16} strokeWidth={2.1} />
              </button>
            </>
          )}
        </div>
      </main>

      {/* ───────── published ───────── */}
      {published && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Invitation published"
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
            background: 'rgba(5,6,11,0.86)', backdropFilter: 'blur(10px)', overflowY: 'auto'
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setPublished(null); }}
        >
          <div
            style={{
              width: '100%', maxWidth: 470, margin: 'auto', borderRadius: 20, padding: 26,
              background: 'rgba(16,18,26,0.99)', border: '1px solid rgba(255,255,255,0.11)',
              position: 'relative'
            }}
          >
            <button
              type="button"
              onClick={() => setPublished(null)}
              aria-label="Close"
              style={{
                position: 'absolute', top: 14, right: 14, width: 30, height: 30,
                borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.07)',
                color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <X size={15} strokeWidth={2.2} />
            </button>

            <div style={{ textAlign: 'center', marginBottom: 22 }}>
              <Sparkles size={22} strokeWidth={1.9} color="#f5b544" />
              <h2 style={{ margin: '10px 0 5px', fontSize: '1.24rem', fontWeight: 700, color: '#fff' }}>
                It's live
              </h2>
              <p style={{ margin: 0, fontSize: '0.87rem', color: 'rgba(255,255,255,0.5)' }}>
                {isPrivate ? 'Now add the people you want to invite.' : 'Share the link and watch the replies come in.'}
              </p>
            </div>

            {!isPrivate && (
              <div style={{ display: 'flex', gap: 7, marginBottom: 18 }}>
                <input
                  type="text"
                  readOnly
                  aria-label="Invitation link"
                  value={api.inviteUrl(published.slug)}
                  style={{ ...input, fontSize: '0.83rem' }}
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(api.inviteUrl(published.slug)).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1800);
                    });
                  }}
                  className="lp-btn lp-btn-primary"
                  style={{ padding: '11px 15px', fontSize: '0.85rem', flexShrink: 0 }}
                >
                  {copied ? <Check size={14} strokeWidth={2.4} /> : <Copy size={14} strokeWidth={2} />}
                </button>
              </div>
            )}

            {isPrivate && (
              <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <InviteeManager slug={published.slug} />
              </div>
            )}

            {qr && !isPrivate && (
              <div style={{ textAlign: 'center', marginBottom: 18 }}>
                <img
                  src={qr}
                  alt={`QR code for ${f.title.text}`}
                  width={128}
                  height={128}
                  style={{ borderRadius: 10, display: 'block', margin: '0 auto' }}
                />
                <span style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.35)', marginTop: 6, display: 'block' }}>
                  Or let them scan it
                </span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <button
                type="button"
                onClick={() => { window.location.href = `/invite/${published.slug}`; }}
                className="lp-btn lp-btn-primary"
                style={{ width: '100%', padding: '12px' }}
              >
                <ExternalLink size={15} strokeWidth={2} />
                <span>Open the invitation</span>
              </button>

              {!isPrivate && (
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `🎉 ${f.title.text}\n📍 ${f.venue.text} — address reveals once you reply\n\nSeen hai? Ab bata:\n${api.inviteUrl(published.slug)}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lp-btn lp-btn-ghost"
                  style={{ width: '100%', padding: '12px', textDecoration: 'none' }}
                >
                  <Send size={15} strokeWidth={2} />
                  <span>Send on WhatsApp</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
