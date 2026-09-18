import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2, Check, X } from 'lucide-react';

/**
 * Venue search backed by OpenStreetMap (Nominatim).
 *
 * Why this exists: the guest-facing "open in maps" link used to be a text query
 * built from the venue name and address, so Google had to guess. Picking a real
 * OSM place gives us a lat/lng, and the link then points at the exact spot.
 *
 * Nominatim's usage policy allows a maximum of one request per second, so the
 * debounce is deliberately above that and a request only fires from typing —
 * never on mount, never on re-render.
 * https://operations.osmfoundation.org/policies/nominatim/
 *
 * Attribution is required when displaying OSM data and is rendered below the
 * result list.
 *
 * The field degrades to a plain text input: if search fails, is blocked, or the
 * host would rather just type an address, whatever is in the box is used and the
 * coordinates stay null. Nothing depends on the lookup succeeding.
 *
 * Privacy note: the query text reaches Nominatim. That is the host typing their
 * own venue while composing, not a guest capability, but it is a third party and
 * worth knowing.
 */
const DEBOUNCE_MS = 1100;
const ENDPOINT = 'https://nominatim.openstreetmap.org/search';

export default function AddressAutocomplete({
  value,
  onChange,
  onPick,
  placeholder,
  id,
  accent = '#f5b544'
}) {
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState(null);
  const [highlight, setHighlight] = useState(-1);

  const wrapRef = useRef(null);
  const timer = useRef(null);
  const controller = useRef(null);
  // Only search text the user actually typed, so selecting a result does not
  // immediately trigger another lookup for the text we just inserted.
  const suppress = useRef(false);

  useEffect(() => {
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (controller.current) controller.current.abort();
    };
  }, []);

  const search = (q) => {
    if (timer.current) clearTimeout(timer.current);
    if (!q || q.trim().length < 4) {
      setResults([]);
      setOpen(false);
      return;
    }

    timer.current = setTimeout(async () => {
      if (controller.current) controller.current.abort();
      controller.current = new AbortController();
      setLoading(true);
      setFailed(false);

      try {
        const url =
          `${ENDPOINT}?format=jsonv2&limit=6&addressdetails=1&q=${encodeURIComponent(q.trim())}`;
        const res = await fetch(url, {
          signal: controller.current.signal,
          headers: { Accept: 'application/json' }
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        setResults(
          (data || []).map((r) => ({
            id: r.place_id,
            label: r.display_name,
            lat: parseFloat(r.lat),
            lng: parseFloat(r.lon),
            kind: r.type
          }))
        );
        setOpen(true);
        setHighlight(-1);
      } catch (err) {
        if (err.name !== 'AbortError') {
          // Rate limited, offline, or blocked. Typing still works.
          setFailed(true);
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
  };

  const handleType = (e) => {
    const next = e.target.value;
    onChange(next);
    setPicked(null);
    onPick?.({ lat: null, lng: null, label: null });
    if (suppress.current) {
      suppress.current = false;
      return;
    }
    search(next);
  };

  const choose = (r) => {
    suppress.current = true;
    onChange(r.label);
    onPick?.({ lat: r.lat, lng: r.lng, label: r.label });
    setPicked(r);
    setOpen(false);
    setResults([]);
  };

  const onKeyDown = (e) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && highlight >= 0) {
      e.preventDefault();
      choose(results[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <MapPin
          size={15}
          strokeWidth={1.8}
          color={picked ? accent : 'rgba(255,255,255,0.35)'}
          style={{ position: 'absolute', left: 13, top: 13, pointerEvents: 'none' }}
        />
        <input
          id={id}
          type="text"
          value={value}
          onChange={handleType}
          onKeyDown={onKeyDown}
          onFocus={() => results.length && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          style={{
            width: '100%',
            padding: '11px 38px 11px 36px',
            borderRadius: 10,
            border: picked ? `1px solid ${accent}66` : '1px solid rgba(255,255,255,0.12)',
            background: picked ? `${accent}0d` : 'rgba(255,255,255,0.04)',
            color: '#fff',
            font: 'inherit',
            fontSize: '0.9rem',
            boxSizing: 'border-box'
          }}
        />
        <span style={{ position: 'absolute', right: 12, top: 12 }}>
          {loading && <Loader2 size={15} strokeWidth={2} color={accent} style={{ animation: 'spin 0.9s linear infinite' }} />}
          {!loading && picked && <Check size={15} strokeWidth={2.4} color={accent} />}
        </span>
      </div>

      {/* Pinned confirmation, so the host knows the map link will be exact */}
      {picked && (
        <p style={{ margin: '7px 0 0', fontSize: '0.76rem', color: accent, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Check size={12} strokeWidth={2.6} />
          Pinned on the map — your guests get exact directions
        </p>
      )}

      {failed && !picked && (
        <p style={{ margin: '7px 0 0', fontSize: '0.76rem', color: 'rgba(255,255,255,0.4)' }}>
          Map search unavailable right now. Typing the address still works.
        </p>
      )}

      {open && results.length > 0 && (
        <ul
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 70,
            listStyle: 'none',
            margin: 0,
            padding: 5,
            maxHeight: 252,
            overflowY: 'auto',
            borderRadius: 12,
            background: 'rgba(17,19,28,0.99)',
            border: '1px solid rgba(255,255,255,0.11)',
            boxShadow: '0 24px 54px -18px rgba(0,0,0,0.85)'
          }}
        >
          {results.map((r, i) => (
            <li key={r.id} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                onClick={() => choose(r)}
                onMouseEnter={() => setHighlight(i)}
                style={{
                  width: '100%',
                  display: 'flex',
                  gap: 9,
                  padding: '9px 10px',
                  borderRadius: 8,
                  border: 'none',
                  background: i === highlight ? `${accent}1f` : 'none',
                  color: '#fff',
                  font: 'inherit',
                  fontSize: '0.83rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  lineHeight: 1.4
                }}
              >
                <MapPin
                  size={13}
                  strokeWidth={1.8}
                  color={i === highlight ? accent : 'rgba(255,255,255,0.35)'}
                  style={{ flexShrink: 0, marginTop: 3 }}
                />
                <span>{r.label}</span>
              </button>
            </li>
          ))}

          {/* Required when showing OpenStreetMap data */}
          <li
            style={{
              padding: '7px 10px 3px',
              fontSize: '0.68rem',
              color: 'rgba(255,255,255,0.28)',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              marginTop: 4
            }}
          >
            Search by{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'rgba(255,255,255,0.45)' }}
            >
              © OpenStreetMap contributors
            </a>
          </li>
        </ul>
      )}
    </div>
  );
}
