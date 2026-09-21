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
import { adminClient } from '../config/supabase.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/sse/events/:eventId
 * Opens an SSE stream that sends a notification whenever rsvps or comments
 * change on the given event.
 */
router.get(
  '/events/:eventId',
  optionalAuth,
  (req, res) => {
    const { eventId } = req.params;

    if (!eventId) {
      return res.status(400).json({ error: 'Event ID is required.' });
    }

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
    const channelId = `sse:${eventId}:${Math.random().toString(36).slice(2, 10)}`;

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
      .subscribe();

    // Cleanup on client disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
      if (debounceTimer) clearTimeout(debounceTimer);
      adminClient.removeChannel(channel);
    });
  }
);

export default router;
