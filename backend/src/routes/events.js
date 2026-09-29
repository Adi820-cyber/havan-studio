/**
 * Event routes.
 *
 * GET  /api/events/:slug         — load an invitation
 * POST /api/events               — create an event
 * PUT  /api/events/:slug         — update an event as its host
 * GET  /api/events/:slug/guests  — host-only guest list
 */
import { Router } from 'express';
import { createUserClient } from '../config/supabase.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { asyncHandler, friendlyError } from '../middleware/errorHandler.js';
import { localStore } from '../services/localStore.js';
import { USE_LOCAL_FALLBACK } from '../config/env.js';

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

      if (error) throw error;
      if (!data) {
        if (USE_LOCAL_FALLBACK) {
          const localInvite = localStore.getInvite(slug, req.user);
          if (localInvite) return res.json({ data: localInvite });
        }
        return res.status(404).json({ error: 'Invitation not found.' });
      }

      return res.json({ data });
    } catch (err) {
      console.error(`[events/get] Supabase call failed for slug "${slug}": ${err.message || err}`);

      if (USE_LOCAL_FALLBACK) {
        const data = localStore.getInvite(slug, req.user);
        if (!data) return res.status(404).json({ error: 'Invitation not found.' });
        return res.json({ data });
      }

      // A genuine "not found" and a Supabase outage used to look identical to
      // the caller, both quietly served from the same demo data. Distinguish
      // them: a real database error is a 502, not a 404.
      return res.status(502).json({ error: friendlyError(err, 'Could not load this invitation right now. Please try again.') });
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

    const input = req.body || {};
    const requiredText = [input.title, input.hostName, input.venueName, input.venueAddress];
    if (!requiredText.every((value) => typeof value === 'string' && value.trim())
      || typeof input.startsAt !== 'string' || Number.isNaN(Date.parse(input.startsAt))) {
      return res.status(400).json({ error: 'Add the event name, host, date and time, venue, and full address before publishing.' });
    }

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
      console.error(`[events/create] Supabase call failed for user ${req.user?.id}: ${err.message || err}`);

      // This is the exact bug reported in production: a host who "published"
      // successfully here, on the strength of a silent fallback, would have an
      // event that only ever existed in one serverless instance's memory — it
      // would not be on their dashboard, would not accept real RSVPs, and
      // would 404 for every guest they sent the link to.
      if (USE_LOCAL_FALLBACK) {
        const data = localStore.createEvent(input, req.user);
        return res.status(201).json({
          data: { id: data.id, slug: data.slug, title: data.title },
        });
      }

      return res.status(502).json({ error: friendlyError(err, 'Could not publish your invitation. Please try again.') });
    }
  })
);

/**
 * PUT /api/events/:slug
 * A host can update the invitation and attach a short attendee notice. RLS
 * remains the final ownership check at the database boundary.
 */
router.put(
  '/:slug',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user.isAnonymous) {
      return res.status(403).json({ error: 'Only the host can edit this invitation.' });
    }

    const input = req.body || {};
    const requiredText = [input.title, input.hostName, input.venueName, input.venueAddress];
    if (!requiredText.every((value) => typeof value === 'string' && value.trim())
      || typeof input.startsAt !== 'string' || Number.isNaN(Date.parse(input.startsAt))) {
      return res.status(400).json({ error: 'Add the event name, host, date and time, venue, and full address before saving.' });
    }

    try {
      const client = createUserClient(req.accessToken);
      const { data, error } = await client
        .from('events')
        .update({
          title: input.title.trim(),
          subtitle: input.subtitle || null,
          host_name: input.hostName.trim(),
          description: input.description || null,
          vibe_tag: input.vibeTag || null,
          starts_at: input.startsAt,
          ends_at: input.endsAt || null,
          timezone: input.timezone || 'UTC',
          venue_name: input.venueName.trim(),
          venue_address: input.venueAddress.trim(),
          venue_lat: input.venueLat ?? null,
          venue_lng: input.venueLng ?? null,
          venue_osm_label: input.venueOsmLabel || null,
          door_code: input.doorCode || null,
          byob_note: input.byobNote || null,
          hide_until_rsvp: input.hideUntilRsvp !== false,
          is_private: Boolean(input.isPrivate),
          theme: input.theme || {},
          customization: input.customization || {},
          last_update_message: (input.updateMessage || '').trim().slice(0, 300)
            || 'The host updated this invitation. Please check the latest details.'
        })
        .eq('slug', req.params.slug)
        .select('id,slug,title')
        .maybeSingle();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Invitation not found or you are not its host.' });
      return res.json({ data });
    } catch (err) {
      console.error(`[events/update] Supabase call failed for user ${req.user?.id}: ${err.message || err}`);
      if (USE_LOCAL_FALLBACK) {
        const data = localStore.updateEvent(req.params.slug, input, req.user);
        if (!data) return res.status(404).json({ error: 'Invitation not found or you are not its host.' });
        return res.json({ data });
      }
      return res.status(502).json({ error: friendlyError(err, 'Could not save your changes. Please try again.') });
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
      console.error(`[events/guests] Supabase call failed for slug "${slug}": ${err.message || err}`);

      if (USE_LOCAL_FALLBACK) {
        const invite = localStore.getInvite(slug, req.user);
        return res.json({
          data: {
            guests: [],
            counts: { going: invite?.going_count || 1, maybe: 0, not_going: 0, plus_ones: 0, head_count: 1 },
          },
        });
      }

      // The host's real guest list must never silently be replaced with an
      // empty one — that reads as "nobody has replied yet" when the truth is
      // "the database call failed", which a host has no way to tell apart.
      return res.status(502).json({ error: friendlyError(err, 'Could not load your guest list right now. Please try again.') });
    }
  })
);

export default router;
