import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Check } from 'lucide-react';

/**
 * Date and time picker.
 *
 * Replaces `<input type="datetime-local">`, which renders as an OS-styled control
 * that ignores the surrounding design, shows the date in whatever order the
 * machine locale dictates (the studio was showing `20-09-2026` on a page written
 * in English), and offers a tiny calendar glyph as the only affordance.
 *
 * This is a month grid plus a time strip. It also removes the need for the
 * separate "Date Display" and "Time Display" text fields, since the card text is
 * now formatted from the same value the database stores.
 *
 * Value is a `Date`. The caller owns it.
 */
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/** Common party start times, so most picks are one tap. */
const QUICK_TIMES = [
  { h: 18, m: 0 }, { h: 19, m: 0 }, { h: 19, m: 30 }, { h: 20, m: 0 },
  { h: 20, m: 30 }, { h: 21, m: 0 }, { h: 22, m: 0 }, { h: 23, m: 0 }
];

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a, b) =>
  a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function fmtTime(h, m) {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
}

/**
 * A scrollable column of time values. Replaces one half of the native time
 * input's dropdown, but styleable — the selected item takes the theme accent.
 */
function TimeColumn({ label, values, current, format, onSelect, accent }) {
  const listRef = useRef(null);

  // Bring the selected value into view when the column appears.
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-on="true"]');
    if (el) el.scrollIntoView({ block: 'center' });
  }, []);

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontSize: '0.66rem',
          fontWeight: 600,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.3)',
          marginBottom: 5
        }}
      >
        {label}
      </div>
      <div
        ref={listRef}
        style={{
          maxHeight: 112,
          overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 4,
          padding: 4,
          borderRadius: 9,
          background: 'rgba(0,0,0,0.24)',
          border: '1px solid rgba(255,255,255,0.08)'
        }}
      >
        {values.map((v) => {
          const on = v === current;
          return (
            <button
              key={v}
              type="button"
              data-on={on}
              onClick={() => onSelect(v)}
              aria-pressed={on}
              style={{
                padding: '6px 0',
                borderRadius: 7,
                cursor: 'pointer',
                font: 'inherit',
                fontSize: '0.79rem',
                fontWeight: on ? 700 : 500,
                border: on ? `1px solid ${accent}` : '1px solid transparent',
                background: on ? `${accent}2b` : 'rgba(255,255,255,0.03)',
                color: on ? accent : 'rgba(255,255,255,0.7)'
              }}
            >
              {format(v)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DateTimePicker({ value, onChange, label = 'When', accent = '#f5b544' }) {
  const selected = value instanceof Date && !isNaN(value) ? value : null;
  const [open, setOpen] = useState(false);
  const [exact, setExact] = useState(false);
  const [cursor, setCursor] = useState(() => startOfDay(selected || new Date()));
  const wrapRef = useRef(null);

  const hour12 = selected ? (selected.getHours() % 12 === 0 ? 12 : selected.getHours() % 12) : 8;
  const meridiem = selected ? (selected.getHours() >= 12 ? 'PM' : 'AM') : 'PM';

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Month grid, Monday-first, padded to whole weeks.
  const weeks = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    // getDay(): 0=Sun. Shift so Monday is 0.
    const lead = (first.getDay() + 6) % 7;

    const cells = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    }
    while (cells.length % 7 !== 0) cells.push(null);

    const rows = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [cursor]);

  const today = startOfDay(new Date());

  const pickDay = (day) => {
    const base = selected || new Date();
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate(), base.getHours() || 20, base.getMinutes() || 0, 0, 0);
    onChange(next);
  };

  const pickTime = (h, m) => {
    const base = selected || new Date();
    onChange(new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0));
  };

  const summary = selected
    ? `${selected.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long' })} · ${fmtTime(selected.getHours(), selected.getMinutes())}`
    : 'Pick a date and time';

  const cellBase = {
    height: 34,
    borderRadius: 9,
    border: '1px solid transparent',
    background: 'none',
    color: 'rgba(255,255,255,0.82)',
    font: 'inherit',
    fontSize: '0.84rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <span
        style={{
          display: 'block',
          fontSize: '0.78rem',
          fontWeight: 500,
          color: 'rgba(255,255,255,0.5)',
          marginBottom: 6
        }}
      >
        {label}
      </span>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '11px 13px',
          borderRadius: 10,
          border: open ? `1px solid ${accent}88` : '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(255,255,255,0.04)',
          color: selected ? '#fff' : 'rgba(255,255,255,0.4)',
          font: 'inherit',
          fontSize: '0.9rem',
          cursor: 'pointer',
          textAlign: 'left',
          boxSizing: 'border-box'
        }}
      >
        <CalendarDays size={16} strokeWidth={1.8} color="rgba(255,255,255,0.5)" />
        <span style={{ flex: 1 }}>{summary}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose date and time"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            zIndex: 60,
            width: 306,
            maxWidth: '100%',
            padding: 14,
            borderRadius: 15,
            background: 'rgba(17,19,28,0.99)',
            border: '1px solid rgba(255,255,255,0.11)',
            boxShadow: '0 26px 60px -18px rgba(0,0,0,0.85)'
          }}
        >
          {/* Month header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              style={{ ...cellBase, width: 30, height: 30, border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <ChevronLeft size={15} />
            </button>
            <strong style={{ fontSize: '0.88rem', color: '#fff', fontWeight: 600 }}>
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </strong>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              style={{ ...cellBase, width: 30, height: 30, border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Weekday row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {DAYS.map((d, i) => (
              <span
                key={i}
                style={{
                  textAlign: 'center',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.32)',
                  paddingBottom: 4
                }}
              >
                {d}
              </span>
            ))}
          </div>

          {/* Days */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {weeks.flat().map((day, i) => {
              if (!day) return <span key={i} />;
              const isSel = sameDay(day, selected);
              const isToday = sameDay(day, today);
              const isPast = day < today;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={isPast}
                  onClick={() => pickDay(day)}
                  aria-pressed={isSel}
                  style={{
                    ...cellBase,
                    cursor: isPast ? 'not-allowed' : 'pointer',
                    color: isPast
                      ? 'rgba(255,255,255,0.16)'
                      : isSel
                        ? '#0a0b10'
                        : 'rgba(255,255,255,0.85)',
                    background: isSel ? accent : 'none',
                    borderColor: !isSel && isToday ? `${accent}77` : 'transparent',
                    fontWeight: isSel ? 700 : 500
                  }}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          {/* Time */}
          <div style={{ marginTop: 13, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9 }}>
              <Clock size={13} strokeWidth={1.9} color="rgba(255,255,255,0.45)" />
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>
                Start time
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
              {QUICK_TIMES.map(({ h, m }) => {
                const on = selected && selected.getHours() === h && selected.getMinutes() === m;
                return (
                  <button
                    key={`${h}-${m}`}
                    type="button"
                    onClick={() => pickTime(h, m)}
                    aria-pressed={on}
                    style={{
                      padding: '7px 4px',
                      borderRadius: 8,
                      border: on ? `1px solid ${accent}` : '1px solid rgba(255,255,255,0.1)',
                      background: on ? `${accent}29` : 'rgba(255,255,255,0.03)',
                      color: on ? accent : 'rgba(255,255,255,0.75)',
                      font: 'inherit',
                      fontSize: '0.76rem',
                      fontWeight: on ? 700 : 500,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {fmtTime(h, m)}
                  </button>
                );
              })}
            </div>

            {/* Exact time.
                This used to be <input type="time">, whose dropdown is browser
                chrome — an unstyleable grey column list that ignored the rest of
                the design. These are ordinary buttons, so they can carry the
                theme colour and match everything around them. */}
            <button
              type="button"
              onClick={() => setExact((v) => !v)}
              aria-expanded={exact}
              style={{
                marginTop: 10,
                width: '100%',
                padding: '7px',
                borderRadius: 8,
                border: '1px dashed rgba(255,255,255,0.14)',
                background: 'none',
                color: 'rgba(255,255,255,0.45)',
                font: 'inherit',
                fontSize: '0.76rem',
                cursor: 'pointer'
              }}
            >
              {exact ? 'Hide exact time' : 'Set an exact time'}
            </button>

            {exact && (
              <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
                <TimeColumn
                  label="Hour"
                  values={Array.from({ length: 12 }, (_, i) => i + 1)}
                  current={hour12}
                  format={(v) => String(v)}
                  onSelect={(h12) => {
                    const h24 = meridiem === 'PM' ? (h12 % 12) + 12 : h12 % 12;
                    pickTime(h24, selected ? selected.getMinutes() : 0);
                  }}
                  accent={accent}
                />
                <TimeColumn
                  label="Minute"
                  values={[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]}
                  current={selected ? selected.getMinutes() : 0}
                  format={(v) => String(v).padStart(2, '0')}
                  onSelect={(m) => pickTime(selected ? selected.getHours() : 20, m)}
                  accent={accent}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, justifyContent: 'flex-start', paddingTop: 19 }}>
                  {['AM', 'PM'].map((mer) => {
                    const on = meridiem === mer;
                    return (
                      <button
                        key={mer}
                        type="button"
                        onClick={() => {
                          const base = selected ? selected.getHours() % 12 : 8;
                          pickTime(mer === 'PM' ? base + 12 : base, selected ? selected.getMinutes() : 0);
                        }}
                        aria-pressed={on}
                        style={{
                          padding: '7px 11px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          font: 'inherit',
                          fontSize: '0.76rem',
                          fontWeight: on ? 700 : 500,
                          border: on ? `1px solid ${accent}` : '1px solid rgba(255,255,255,0.1)',
                          background: on ? `${accent}26` : 'rgba(255,255,255,0.03)',
                          color: on ? accent : 'rgba(255,255,255,0.65)'
                        }}
                      >
                        {mer}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              width: '100%',
              marginTop: 12,
              padding: '9px',
              borderRadius: 9,
              border: 'none',
              background: accent,
              color: '#0a0b10',
              font: 'inherit',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            <Check size={14} strokeWidth={2.4} />
            Done
          </button>
        </div>
      )}
    </div>
  );
}
