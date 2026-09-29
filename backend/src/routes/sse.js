/**
 * Server-Sent Events (SSE) route for realtime updates.
 *
 * Replaces the direct Supabase Realtime WebSocket connection that was in the
 * browser. The backend subscribes to Supabase Realtime on behalf of the client
 * and forwards change notifications as SSE events.
 *
 * The payload is deliberately empty — the SSE only says "something changed" so
 * the frontend re-fetches through the regular API. This preserves the RLS gating:
 * every re-read goes through get_invite / get_event_comments / get_event_guests,
 * which decide what this particular viewer is allowed to see.
 *
 * GET /api/sse/events/:eventId
 */
import { Router } from 'express';
import crypto from 'crypto';
import { adminClient } from '../config/supabase.js';
import { optionalAuth } from '../middleware/auth.js';
import { sseLimiter } from '../middleware/rateLimit.js';

const router = Router();
const activeStreamsByIp = new Map();
const MAX_ACTIVE_STREAMS_PER_IP = 6;
const EVENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * GET /api/sse/events/:eventId
 * Opens an SSE stream that sends a notification whenever rsvps or comments
 * change on the given event.
 */
router.get(
  '/events/:eventId',
  sseLimiter,
  optionalAuth,
  (req, res) => {
    const { eventId } = req.params;

    if (!EVENT_ID_PATTERN.test(eventId || '')) {
      return res.status(400).json({ error: 'A valid event ID is required.' });
    }

    const clientIp = req.ip || 'unknown';
    const activeCount = activeStreamsByIp.get(clientIp) || 0;
    if (activeCount >= MAX_ACTIVE_STREAMS_PER_IP) {
      return res.status(429).json({ error: 'Too many live connections. Close another invitation and try again.' });
    }
    activeStreamsByIp.set(clientIp, activeCount + 1);

    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    // Send initial connection confirmation
    res.write(`data: ${JSON.stringify({ type: 'connected', eventId })}\n\n`);

    // Heartbeat every 30 seconds to keep the connection alive through ALB/proxies
    const heartbeat = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, 30000);

    // Coalesce bursts: a reply + note fires two changes, no need to send both
    let debounceTimer = null;
    const notify = (type) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        try {
          res.write(`data: ${JSON.stringify({ type })}\n\n`);
        } catch {
          // Client disconnected
        }
      }, 250);
    };

    // Subscribe to Supabase Realtime for this event
    const channelId = `sse:${eventId}:${crypto.randomUUID()}`;

    const channel = adminClient
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rsvps', filter: `event_id=eq.${eventId}` },
        () => notify('rsvp_update')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `event_id=eq.${eventId}` },
        () => notify('comment_update')
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${eventId}` },
        () => notify('event_update')
      )
      .subscribe();

    // Cleanup on client disconnect
    res.on('close', () => {
      clearInterval(heartbeat);
      if (debounceTimer) clearTimeout(debounceTimer);
      adminClient.removeChannel(channel);
      const remaining = Math.max(0, (activeStreamsByIp.get(clientIp) || 1) - 1);
      if (remaining === 0) activeStreamsByIp.delete(clientIp);
      else activeStreamsByIp.set(clientIp, remaining);
    });
  }
);

export default router;
