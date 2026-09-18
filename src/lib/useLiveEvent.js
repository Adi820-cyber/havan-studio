import { useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

/**
 * Calls `onChange` whenever a reply or a note lands on this event.
 *
 * Deliberately passes no row data to the caller. The payload is discarded and
 * `onChange` is a plain "something moved, go and re-read" signal, so every render
 * still comes from get_invite / get_event_comments / get_event_guests — the
 * functions that decide what this particular viewer is allowed to see. Rendering
 * a Realtime payload directly would route around that, and the venue lock depends
 * on there being exactly one place that makes disclosure decisions.
 *
 * Realtime also applies RLS per subscriber, so a viewer is only told about rows
 * they could already read. That is a second line of defence, not the one relied
 * on. Verified in supabase/tests/realtime-verification.mjs.
 *
 * @param eventId  uuid of the event, or null/undefined to stay idle
 * @param onChange called with no arguments; keep it cheap and idempotent
 */
export function useLiveEvent(eventId, onChange, scope = 'default') {
  // Held in a ref so a new inline callback on every render does not tear the
  // subscription down and rebuild it.
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!eventId) return;

    let cancelled = false;
    // Coalesce bursts: a reply that also posts a note fires two events, and
    // there is no reason to refetch twice.
    let timer = null;
    const ping = () => {
      if (cancelled) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (!cancelled) cb.current?.();
      }, 220);
    };

    /*
     * The topic must be unique per subscription, not just per event.
     *
     * supabase-js caches channels by topic. Using `invite:${eventId}` meant the
     * guest view and the host panel — which both watch the same event — asked for
     * the same topic, so the second one received the first one's already-subscribed
     * channel and `.on()` threw:
     *
     *   cannot add `postgres_changes` callbacks ... after `subscribe()`
     *
     * That throw escaped the effect and React unmounted the tree, which is the
     * blank page a host saw after publishing. Only hosts render the host panel,
     * so only hosts had two subscriptions on one topic.
     *
     * A fresh random suffix on every effect run also survives StrictMode's
     * mount/unmount/mount cycle, where removeChannel() has not necessarily
     * finished before the effect runs again and would otherwise hand back the
     * same cached, already-subscribed channel.
     */
    const topic = `invite:${eventId}:${scope}:${Math.random().toString(36).slice(2, 10)}`;

    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rsvps', filter: `event_id=eq.${eventId}` },
        ping
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `event_id=eq.${eventId}` },
        ping
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [eventId, scope]);
}

/**
 * Re-runs `onFocus` when the tab becomes visible again.
 *
 * A safety net for the case Realtime cannot cover: a phone that slept through
 * the websocket dropping. Cheap, and it means a host who switches back to the tab
 * always sees current numbers even if a message was missed.
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
