import React, { useMemo, useRef } from 'react';
import { Upload, Sparkles, Shirt, X, ImageIcon, Play, Type } from 'lucide-react';
import { BACKGROUNDS, DRESS_CODES, THEME_PALETTES, recommendBackgrounds } from '../data/templates';
import {
  CARD_FONTS, REVEALS, SOUNDSCAPES, fontById, recommendReveals, recommendSounds
} from '../data/vibe';

/**
 * Step one: what it looks like, sounds like, and how it opens.
 *
 * This runs *before* the details now. That is a reversal of the previous order
 * and it was the right call for a reason that only becomes obvious once the
 * choices exist: picking a vibe is the part a host wants to do, and the fields
 * are the part they have to do. Opening on the fields makes the studio feel like
 * a form with a decoration step bolted on the end. Opening on the artwork makes
 * the form feel like finishing something already underway.
 *
 * The suggestions still work, because the occasion chips sit at the top of this
 * step and are answered in one tap — which is all the recommendations ever
 * needed.
 *
 * Four things the host decides here, in the order they matter:
 *   artwork  · their own upload, a suggestion, or the library
 *   type     · the one place the two-face brand rule is relaxed
 *   opening  · one of twelve reveals, fired when the guest scrolls to the card
 *   sound    · one of twelve, or none
 */
export default function VibePicker({
  category,
  cover,
  uploadedName,
  uploadBusy,
  uploadError,
  onUploadFile,
  onClearUpload,
  onPickBackground,
  themeId,
  onPickTheme,
  fontId,
  onPickFont,
  revealId,
  onPickReveal,
  soundId,
  onPickSound,
  dressCode,
  dressCodeShown,
  onDressCode,
  theme,
  sectionHead,
  label,
  input
}) {
  const fileRef = useRef(null);

  const suggested = useMemo(() => recommendBackgrounds(category, 4), [category]);
  const suggestedIds = useMemo(() => new Set(suggested.map((b) => b.id)), [suggested]);
  const rest = useMemo(() => BACKGROUNDS.filter((b) => !suggestedIds.has(b.id)), [suggestedIds]);

  const suggestedReveals = useMemo(() => recommendReveals(category, 4), [category]);
  const suggestedReveals4 = useMemo(
    () => new Set(suggestedReveals.map((r) => r.id)),
    [suggestedReveals]
  );
  const otherReveals = useMemo(
    () => REVEALS.filter((r) => !suggestedReveals4.has(r.id)),
    [suggestedReveals4]
  );

  const suggestedSounds = useMemo(() => recommendSounds(category, 4), [category]);
  const suggestedSoundIds = useMemo(
    () => new Set(suggestedSounds.map((s) => s.id)),
    [suggestedSounds]
  );
  const otherSounds = useMemo(
    () => SOUNDSCAPES.filter((s) => !suggestedSoundIds.has(s.id)),
    [suggestedSoundIds]
  );

  /** Dress-code chips, with the ones that suit this occasion first. */
  const dressSuggestions = useMemo(() => {
    const rank = (d) => (d.category === category ? 0 : d.category === 'all' ? 1 : 2);
    return [...DRESS_CODES].sort((a, b) => rank(a) - rank(b));
  }, [category]);

  const activeFont = fontById(fontId);

  const tile = (bg, isSuggested) => {
    const active = cover === bg.src;
    return (
      <button
        key={bg.id}
        type="button"
        onClick={() => onPickBackground(bg)}
        aria-pressed={active}
        title={`${bg.name} — ${bg.credit}`}
        className="havan-plain"
        style={{
          position: 'relative',
          padding: 0,
          overflow: 'hidden',
          cursor: 'pointer',
          background: 'none',
          aspectRatio: '4 / 3',
          clipPath: 'var(--chamfer-sm)',
          border: active ? '2px solid var(--brass)' : '1px solid rgba(230,213,174,0.18)'
        }}
      >
        <img
          src={bg.src}
          alt={bg.name}
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        {isSuggested && (
          <span
            style={{
              position: 'absolute',
              top: 6,
              left: 6,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 7px',
              fontSize: '0.62rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--ink)',
              background: 'var(--brass)'
            }}
          >
            <Sparkles size={9} strokeWidth={2.4} />
            Fits
          </span>
        )}
      </button>
    );
  };

  /** A selectable row: title, one line of explanation, optional preview action. */
  const optionRow = (key, active, title, note, onClick, extra) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 11,
        width: '100%',
        padding: '11px 13px',
        cursor: 'pointer',
        textAlign: 'left',
        font: 'inherit',
        clipPath: 'var(--chamfer-sm)',
        border: active ? '1px solid var(--brass)' : '1px solid rgba(230,213,174,0.14)',
        background: active ? 'rgba(192,146,46,0.13)' : 'rgba(230,213,174,0.03)'
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 13,
          height: 13,
          flexShrink: 0,
          marginTop: 4,
          border: active ? '4px solid var(--brass)' : '1px solid rgba(230,213,174,0.35)'
        }}
      />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: '0.89rem', color: 'var(--sand)', fontWeight: 500 }}>
          {title}
        </span>
        <span
          style={{
            display: 'block',
            fontSize: '0.79rem',
            color: 'rgba(230,213,174,0.45)',
            marginTop: 2,
            lineHeight: 1.45
          }}
        >
          {note}
        </span>
      </span>
      {extra}
    </button>
  );

  return (
    <div>
      {/* ── your own artwork ── */}
      {sectionHead('Your own artwork')}

      <p style={{ margin: '-6px 0 13px', fontSize: '0.84rem', lineHeight: 1.5, color: 'rgba(230,213,174,0.48)' }}>
        A photo from the last one, a flyer you made, the view from the roof. This
        becomes the top of the card.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reset first, so picking the same file twice still fires a change.
          e.target.value = '';
          if (file) onUploadFile(file);
        }}
        style={{ display: 'none' }}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: uploadError ? 10 : 6 }}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploadBusy}
          className="lp-btn lp-btn-ghost"
          style={{ padding: '11px 16px', fontSize: '0.87rem', opacity: uploadBusy ? 0.6 : 1 }}
        >
          <Upload size={15} strokeWidth={1.9} />
          <span>{uploadBusy ? 'Reading image' : uploadedName ? 'Choose a different image' : 'Upload an image'}</span>
        </button>

        {uploadedName && (
          <button
            type="button"
            onClick={onClearUpload}
            className="lp-chip"
            style={{ padding: '9px 13px', fontSize: '0.82rem' }}
          >
            <X size={13} strokeWidth={2.1} />
            <span>Remove</span>
          </button>
        )}
      </div>

      {uploadedName && !uploadError && (
        <p
          style={{
            margin: '0 0 6px',
            fontSize: '0.8rem',
            color: 'rgba(230,213,174,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <ImageIcon size={13} strokeWidth={1.9} />
          <span>{uploadedName} — uploads when you publish</span>
        </p>
      )}

      {uploadError && (
        <p role="alert" style={{ margin: '0 0 6px', fontSize: '0.82rem', color: '#e8a0a0' }}>
          {uploadError}
        </p>
      )}

      {/* ── suggestions ── */}
      {sectionHead('Suggested for your vibe')}

      <p style={{ margin: '-6px 0 13px', fontSize: '0.84rem', lineHeight: 1.5, color: 'rgba(230,213,174,0.48)' }}>
        Picked against what you are throwing. Tapping one sets the colours too.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))',
          gap: 9,
          marginBottom: 4
        }}
      >
        {suggested.map((bg) => tile(bg, true))}
      </div>

      {/* ── the rest ── */}
      {sectionHead('Everything else')}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
          gap: 8,
          marginBottom: 4
        }}
      >
        {rest.map((bg) => tile(bg, false))}
      </div>

      {/* ── colour ──
          No labels and no copy. A palette is chosen by looking at it, and the
          names were describing a decision the swatch already makes obvious. */}
      {sectionHead('Colour')}
      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 4 }}>
        {THEME_PALETTES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onPickTheme(t.id)}
            aria-pressed={themeId === t.id}
            aria-label={t.name}
            className="havan-plain"
            style={{
              width: 42,
              height: 42,
              cursor: 'pointer',
              padding: 0,
              clipPath: 'var(--chamfer-sm)',
              border: themeId === t.id ? '2px solid var(--sand)' : '1px solid rgba(230,213,174,0.2)',
              background: `linear-gradient(135deg, ${t.primary} 0%, ${t.accent} 100%)`
            }}
          />
        ))}
      </div>

      {/* ── type ──
          The product chrome is locked to two faces. The card is the one place a
          host gets a say, because a qawwali baithak and a warehouse thing should
          not be set identically. */}
      {sectionHead('Type')}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: 8,
          marginBottom: 12
        }}
      >
        {CARD_FONTS.map((f) => {
          const active = fontId === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onPickFont(f.id)}
              aria-pressed={active}
              title={f.note}
              style={{
                padding: '13px 12px',
                cursor: 'pointer',
                textAlign: 'left',
                font: 'inherit',
                clipPath: 'var(--chamfer-sm)',
                border: active ? '1px solid var(--brass)' : '1px solid rgba(230,213,174,0.14)',
                background: active ? 'rgba(192,146,46,0.13)' : 'rgba(230,213,174,0.03)'
              }}
            >
              <span
                style={{
                  display: 'block',
                  fontFamily: f.stack,
                  fontWeight: f.weight,
                  fontSize: '1.08rem',
                  color: 'var(--sand)',
                  lineHeight: 1.15,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                Aditi&rsquo;s rooftop
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: '0.72rem',
                  color: 'rgba(230,213,174,0.45)',
                  marginTop: 5
                }}
              >
                {f.name}
              </span>
            </button>
          );
        })}
      </div>

      <p style={{ margin: '0 0 4px', fontSize: '0.8rem', lineHeight: 1.5, color: 'rgba(230,213,174,0.4)', display: 'flex', gap: 6 }}>
        <Type size={13} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>{activeFont.note}</span>
      </p>

      {/* ── how it opens ── */}
      {sectionHead('How it opens')}

      <p style={{ margin: '-6px 0 13px', fontSize: '0.84rem', lineHeight: 1.5, color: 'rgba(230,213,174,0.48)' }}>
        Plays once, when your guest scrolls to the card. Twelve of them.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 12 }}>
        {suggestedReveals.map((r) =>
          optionRow(
            r.id,
            revealId === r.id,
            r.name,
            r.note,
            () => onPickReveal(r.id),
            <span
              style={{
                fontSize: '0.62rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--ink)',
                background: 'var(--brass)',
                padding: '3px 7px',
                flexShrink: 0,
                marginTop: 2
              }}
            >
              Fits
            </span>
          )
        )}
      </div>

      <details style={{ marginBottom: 4 }}>
        <summary
          style={{
            cursor: 'pointer',
            fontSize: '0.83rem',
            color: 'rgba(230,213,174,0.5)',
            padding: '6px 0'
          }}
        >
          The other eight
        </summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 9 }}>
          {otherReveals.map((r) =>
            optionRow(r.id, revealId === r.id, r.name, r.note, () => onPickReveal(r.id), null)
          )}
        </div>
      </details>


      {/* ── dress code ── */}
      {sectionHead('Dress code')}

      <div style={{ marginBottom: 18 }}>
        <label htmlFor="m-dress" style={label}>
          What people should wear
          <span style={{ color: 'rgba(230,213,174,0.32)' }}> — shows on the card</span>
        </label>
        <input
          id="m-dress"
          type="text"
          value={dressCode}
          onChange={(e) => onDressCode(e.target.value)}
          placeholder="Come as you are"
          style={input}
        />
        <div
          role="group"
          aria-label="Dress code suggestions"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 }}
        >
          {dressSuggestions.map((d) => {
            const active = dressCodeShown === d.title;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onDressCode(active ? '' : d.title)}
                aria-pressed={active}
                className="lp-chip"
                style={{ fontSize: '0.79rem', padding: '6px 11px' }}
              >
                <Shirt size={12} strokeWidth={1.9} />
                <span>{d.title}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
