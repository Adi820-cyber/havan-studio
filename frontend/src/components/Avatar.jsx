import React from 'react';

/**
 * Initial avatar.
 *
 * Replaces the eight-emoji picker. Emoji avatars had three problems: the choice
 * was arbitrary (why a peacock?), the glyph rendered differently on every OS, and
 * a 1.1rem emoji inside a 36px circle sat visually off-centre because emoji have
 * their own internal padding.
 *
 * This takes the first letter of the name and picks one of six palette entries by
 * hashing the name, so a given person always gets the same colour without anyone
 * choosing anything.
 */
const PALETTE = [
  { bg: 'rgba(52, 211, 153, 0.16)', fg: '#34d399', ring: 'rgba(52, 211, 153, 0.36)' },
  { bg: 'rgba(245, 181, 68, 0.16)', fg: '#f5b544', ring: 'rgba(245, 181, 68, 0.36)' },
  { bg: 'rgba(236, 72, 153, 0.16)', fg: '#f472b6', ring: 'rgba(236, 72, 153, 0.36)' },
  { bg: 'rgba(139, 92, 246, 0.16)', fg: '#a78bfa', ring: 'rgba(139, 92, 246, 0.36)' },
  { bg: 'rgba(56, 189, 248, 0.16)', fg: '#38bdf8', ring: 'rgba(56, 189, 248, 0.36)' },
  { bg: 'rgba(251, 113, 133, 0.16)', fg: '#fb7185', ring: 'rgba(251, 113, 133, 0.36)' }
];

function paletteFor(seed) {
  const s = String(seed || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
  return PALETTE[h % PALETTE.length];
}

/** First letter of the first word, uppercased. Falls back to a dot. */
function initialOf(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '·';
  // Intl-safe first character, so accented and Devanagari names work.
  return [...trimmed][0].toUpperCase();
}

export default function Avatar({ name, avatarUrl, size = 34, title, style }) {
  const p = paletteFor(name);
  return (
    <span
      title={title || name || undefined}
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        background: avatarUrl ? 'transparent' : p.bg,
        border: avatarUrl ? 'none' : `1px solid ${p.ring}`,
        color: p.fg,
        fontSize: Math.round(size * 0.42),
        fontWeight: 700,
        letterSpacing: 0,
        lineHeight: 1,
        userSelect: 'none',
        overflow: 'hidden',
        ...style
      }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name ? `${name}'s avatar` : 'Avatar'}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        initialOf(name)
      )}
    </span>
  );
}
