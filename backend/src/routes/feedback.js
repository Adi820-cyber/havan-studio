/**
 * Optional feedback from signed-in and anonymous visitors.
 */
import { Router } from 'express';
import { adminClient } from '../config/supabase.js';
import { feedbackLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();
const CATEGORIES = new Set(['bug', 'confusing', 'idea', 'other']);
const PAGE_AREAS = new Set(['landing', 'dashboard', 'maker', 'invite', 'profile', 'other']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post(
  '/',
  feedbackLimiter,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const category = typeof body.category === 'string' ? body.category : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const pageArea = typeof body.pageArea === 'string' ? body.pageArea : '';
    const followUpRequested = body.followUpRequested === true;
    const contactEmail = followUpRequested && typeof body.contactEmail === 'string'
      ? body.contactEmail.trim().toLowerCase()
      : null;
    const rating = body.rating == null || body.rating === '' ? null : Number(body.rating);

    if (!CATEGORIES.has(category)) {
      return res.status(400).json({ error: 'Choose what you would like to share.' });
    }
    if (message.length < 3 || message.length > 2000) {
      return res.status(400).json({ error: 'Please keep feedback between 3 and 2,000 characters.' });
    }
    if (!PAGE_AREAS.has(pageArea)) {
      return res.status(400).json({ error: 'We could not identify this part of the app.' });
    }
    if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
      return res.status(400).json({ error: 'Choose a rating from 1 to 5, or leave it blank.' });
    }
    if (followUpRequested && (!contactEmail || contactEmail.length > 254 || !EMAIL_PATTERN.test(contactEmail))) {
      return res.status(400).json({ error: 'Add a valid email so we can reply.' });
    }

    const { error } = await adminClient.from('user_feedback').insert({
      category,
      message,
      rating,
      page_area: pageArea,
      follow_up_requested: followUpRequested,
      contact_email: followUpRequested ? contactEmail : null,
    });

    if (error) {
      console.error('[feedback/submit] Supabase insert failed: ' + (error.message || error));
      return res.status(502).json({ error: 'We could not save that just now. Please try again.' });
    }

    return res.status(201).json({ success: true });
  })
);

export default router;
