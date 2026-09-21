/**
 * SSE-based realtime hooks.
 *
 * Replaces the old Supabase Realtime hooks. The backend subscribes to
 * Supabase Realtime and forwards lightweight "something changed" notifications
 * as Server-Sent Events.
 *
 * The API surface is identical to the old useLiveEvent: components don't change.
 */
import { useEffect, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Calls `onChange` whenever a reply or a note lands on this event.
 *
 * Deliberately passes no row data to the caller. The SSE only says
 * "something changed" so the frontend re-fetches through the regular API.
 *
 * @param {string|null} eventId  uuid of the event, or null to stay idle
 * @param {function} onChange    called with no arguments; keep it cheap
 * @param {string} scope         unused, kept for API compatibility
 */
export function useLiveEvent(eventId, onChange, scope = 'default') {
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!eventId) return;

    let eventSource = null;
    let reconnectTimer = null;
    let cancelled = false;
    let retries = 0;
    const MAX_RETRIES = 5;
    const BASE_DELAY = 1000;

    function connect() {
      if (cancelled) return;

      const url = `${API_BASE}/api/sse/events/${eventId}`;
      eventSource = new EventSource(url);

      eventSource.onopen = () => {
        retries = 0; // Reset on successful connection
      };

      eventSource.onmessage = (event) => {
        if (cancelled) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'rsvp_update' || data.type === 'comment_update') {
            cb.current?.();
          }
        } catch {
          // Ignore parse errors (heartbeats, etc.)
        }
      };

      eventSource.onerror = () => {
        if (cancelled) return;
        eventSource?.close();

        if (retries < MAX_RETRIES) {
          retries++;
          const delay = BASE_DELAY * Math.pow(2, retries - 1); // Exponential backoff
          reconnectTimer = setTimeout(connect, delay);
        }
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      eventSource?.close();
    };
  }, [eventId, scope]);
}

/**
 * Re-runs `onFocus` when the tab becomes visible again.
 *
 * Safety net for SSE connections that may have dropped while the tab was hidden.
 */
export function useRefreshOnFocus(onFocus) {
  const cb = useRef(onFocus);
  useEffect(() => {
    cb.current = onFocus;
  }, [onFocus]);

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') cb.current?.();
    };
    document.addEventListener('visibilitychange', handler);
    window.addEventListener('online', handler);
    return () => {
      document.removeEventListener('visibilitychange', handler);
      window.removeEventListener('online', handler);
    };
  }, []);
}
