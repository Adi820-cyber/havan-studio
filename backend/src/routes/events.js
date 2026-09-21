/**
 * Event routes.
 *
 * GET  /api/events/:slug         — load an invitation
 * POST /api/events               — create an event
 * GET  /api/events/:slug/guests  — host-only guest list
 */
import { Router } from 'express';
import { createUserClient } from '../config/supabase.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { asyncHandler, friendlyError } from '../middleware/errorHandler.js';
import { localStore } from '../services/localStore.js';

const router = Router();

/**
 * GET /api/events/:slug
 * Loads an invitation. Works without auth (public invites) or with auth.
 * Query: ?token=... for private events
 */
router.get(
  '/:slug',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const token = req.query.token || null;

    try {
      const client = req.accessToken
        ? createUserClient(req.accessToken)
        : createUserClient('');

      const { data, error } = await client.rpc('get_invite', {
        p_slug: slug,
        p_token: token,
      });

      if (error || !data) throw error || new Error('Not found');

      return res.json({ data });
    } catch (err) {
      const data = localStore.getInvite(slug, req.user);
      if (!data) return res.status(404).json({ error: 'Invitation not found.' });
      return res.json({ data });
    }
  })
);

/**
 * POST /api/events
 * Creates a new event. Requires authentication (non-anonymous).
 */
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user.isAnonymous) {
      return res.status(403).json({ error: 'Please create an account to publish an invitation.' });
    }

    const input = req.body;

    try {
      const client = createUserClient(req.accessToken);

      const { data, error } = await client
        .from('events')
        .insert({
          title: input.title,
          subtitle: input.subtitle || null,
          host_name: input.hostName || 'Host',
          description: input.description || null,
          vibe_tag: input.vibeTag || null,
          starts_at: input.startsAt,
          ends_at: input.endsAt || null,
          timezone: input.timezone || 'UTC',
          venue_name: input.venueName || 'Secret Venue',
          venue_address: input.venueAddress || null,
          venue_lat: input.venueLat ?? null,
          venue_lng: input.venueLng ?? null,
          venue_osm_label: input.venueOsmLabel || null,
          door_code: input.doorCode || null,
          byob_note: input.byobNote || null,
          hide_until_rsvp: input.hideUntilRsvp !== false,
          is_private: Boolean(input.isPrivate),
          theme: input.theme || {},
          customization: input.customization || {},
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({
        data: { id: data.id, slug: data.slug, title: data.title },
      });
    } catch (err) {
      const data = localStore.createEvent(input, req.user);
      return res.status(201).json({
        data: { id: data.id, slug: data.slug, title: data.title },
      });
    }
  })
);

/**
 * GET /api/events/:slug/guests
 * Host-only. Returns the guest list with counts.
 */
router.get(
  '/:slug/guests',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { slug } = req.params;

    try {
      const client = createUserClient(req.accessToken);
      const { data, error } = await client.rpc('get_event_guests', { p_slug: slug });
      if (error) throw error;

      return res.json({ data });
    } catch (err) {
      const invite = localStore.getInvite(slug, req.user);
      return res.json({
        data: {
          guests: [],
          counts: { going: invite?.going_count || 1, maybe: 0, not_going: 0, plus_ones: 0, head_count: 1 },
        },
      });
    }
  })
);

export default router;
