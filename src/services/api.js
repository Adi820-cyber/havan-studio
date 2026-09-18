import { supabase } from '../lib/supabaseClient';
import QRCode from 'qrcode';

/**
 * HAVAN Studio data layer.
 *
 * Every backend call in the app goes through this module. The previous version
 * exported a similar surface but most components bypassed it with hand-written
 * fetch calls, which is how three field-name mismatches shipped (`name` vs
 * `guestName`, `text` vs `message`, and reading `data.data.guest` from a
 * response that had no `data` key). Keeping one module means one place to get
 * the contract right.
 *
 * Credentials are handled entirely by Supabase Auth — bcrypt-hashed, in
 * auth.users. Nothing here ever sees or stores a password.
 */

/* ────────────────────────────── shaping ────────────────────────────── */

/**
 * Normalises the jsonb returned by get_invite() / submit_rsvp() into the shape
 * the UI renders. Both RPCs return the identical payload, so the view model is
 * built once and reused.
 *
 * `venueAddress` and `doorCode` arrive as null unless the database decided the
 * caller is entitled to them. The UI must treat null as "still locked" rather
 * than assuming it has them.
 */
function toInvite(row) {
  if (!row) return null;

  const custom = row.customization || {};
  const theme = row.theme || {};

  return {
    id: row.id,
    slug: row.slug,

    title: row.title,
    subtitle: row.subtitle || '',
    hostName: row.host_name || 'Host',
    description: row.description || '',
    vibeTag: row.vibe_tag || custom.vibeTag || '',

    startsAt: row.starts_at ? new Date(row.starts_at) : null,
    endsAt: row.ends_at ? new Date(row.ends_at) : null,
    timezone: row.timezone || 'UTC',

    venueName: row.venue_name || 'Secret Venue',
    byobNote: row.byob_note || '',

    // Secrets. Null means the backend withheld them. Coordinates are gated with
    // the address, since a lat/lng pinpoints the venue more precisely than a
    // street line does.
    venueAddress: row.venue_address ?? null,
    doorCode: row.door_code ?? null,
    venueLat: row.venue_lat != null ? Number(row.venue_lat) : null,
    venueLng: row.venue_lng != null ? Number(row.venue_lng) : null,
    isUnlocked: Boolean(row.is_unlocked),

    // The reply deadline. The database has enforced this since the deadline
    // migration — submit_rsvp raises after it passes — but get_invite's answer
    // was never read here, so the UI showed live reply buttons that failed on
    // tap. `repliesOpen` is the backend's own verdict, not a clock comparison
    // done in the browser, so a wrong device clock cannot disagree with it.
    repliesCloseAt: row.replies_close_at ? new Date(row.replies_close_at) : null,
    repliesOpen: row.replies_open !== false,

    isHost: Boolean(row.is_host),
    isPrivate: Boolean(row.is_private),
    // For a private event, the name the host wrote on this person's invite.
    invitedAs: row.invited_as || null,

    // Real counts, computed by the database on every read.
    goingCount: row.going_count ?? 0,
    maybeCount: row.maybe_count ?? 0,

    myRsvp: row.my_rsvp
      ? {
          id: row.my_rsvp.id,
          guestName: row.my_rsvp.guest_name,
          contact: row.my_rsvp.contact,
          status: row.my_rsvp.status,
          dietaryNotes: row.my_rsvp.dietary_notes,
          plusOnes: row.my_rsvp.plus_ones ?? 0,
          updatedAt: row.my_rsvp.updated_at
        }
      : null,

    theme,
    customization: custom,
    coverImage: custom.coverImage || theme.posterUrl || null,

    createdAt: row.created_at
  };
}

function toUser(user) {
  if (!user) return null;
  const meta = user.user_metadata || {};
  return {
    id: user.id,
    email: user.email || '',
    name: meta.display_name || (user.email ? user.email.split('@')[0] : 'Host'),
    avatar: meta.avatar_emoji || '✨',
    isAnonymous: Boolean(user.is_anonymous)
  };
}

/**
 * Normalises a profile row from get_my_profile / get_public_profile.
 *
 * `email` is only ever present on your own profile — the public RPC does not
 * select it — so a component that renders whatever it gets cannot leak one.
 */
function toProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    handle: row.handle || null,
    displayName: row.display_name || 'Host',
    avatar: row.avatar_emoji || '✨',
    avatarUrl: row.avatar_url || '',
    isPublic: row.is_public !== false,
    bio: row.bio || '',
    city: row.city || '',
    socials: {
      instagram: row.instagram || '',
      vsco: row.vsco || '',
      spotify: row.spotify || '',
      playlistUrl: row.playlist_url || ''
    },
    stats: {
      hosted: row.hosted_count ?? 0,
      attended: row.attended_count ?? 0
    },
    isMe: Boolean(row.is_me),
    joinedAt: row.created_at ? new Date(row.created_at) : null
  };
}

/**
 * Turns a Postgres/PostgREST error into something worth showing a person.
 * The raw messages leak schema detail and read like a stack trace.
 */
function friendlyError(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;
  const msg = String(error.message || '');

  if (/duplicate key|already registered|already been registered/i.test(msg)) {
    return 'An account with this email already exists. Try logging in instead.';
  }
  if (/Invalid login credentials/i.test(msg)) {
    return 'That email and password combination did not match.';
  }
  if (/Password should be at least/i.test(msg)) {
    return 'Password must be at least 8 characters and mix upper case, lower case and a digit.';
  }
  if (/password.*(weak|requirement)/i.test(msg)) {
    return 'Please choose a stronger password: at least 8 characters with upper case, lower case and a digit.';
  }
  if (/row-level security|permission denied/i.test(msg)) {
    return 'You do not have access to do that.';
  }
  if (/RSVP first to post/i.test(msg)) {
    return 'RSVP first, then you can post on the wall.';
  }
  if (/Invitation not found/i.test(msg)) {
    return 'That invitation code does not match any gathering.';
  }
  if (/Authentication required|must have a session/i.test(msg)) {
    return 'Please sign in and try again.';
  }
  if (/Failed to fetch|NetworkError|network/i.test(msg)) {
    return 'Cannot reach the server. Check your connection and try again.';
  }
  return msg || fallback;
}

/* ────────────────────────────── api ────────────────────────────── */

export const api = {
  /* ---------- session ---------- */

  /** Current signed-in user, or null. Async because the session may be rehydrating. */
  async getCurrentUser() {
    const { data } = await supabase.auth.getSession();
    return toUser(data?.session?.user);
  },

  /**
   * Subscribes to auth changes. Fires immediately with the current state so a
   * caller does not need a separate initial fetch.
   * Returns an unsubscribe function.
   */
  onAuthChange(callback) {
    supabase.auth.getSession().then(({ data }) => {
      callback(toUser(data?.session?.user));
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(toUser(session?.user));
    });

    return () => subscription.unsubscribe();
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });
    if (error) throw new Error(friendlyError(error, 'Could not sign you in.'));
    return toUser(data.user);
  },

  async signUp(email, password, name, avatar = '✨') {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          display_name: (name || '').trim() || email.split('@')[0],
          avatar_emoji: avatar
        }
      }
    });
    if (error) throw new Error(friendlyError(error, 'Could not create your account.'));

    // With email confirmation enabled there is no session yet. Surface that
    // rather than pretending the user is signed in.
    if (!data.session) {
      const err = new Error('Check your inbox to confirm your email, then log in.');
      err.needsConfirmation = true;
      throw err;
    }
    return toUser(data.user);
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  /**
   * Guarantees some session exists, creating an anonymous one if needed.
   *
   * This is what lets a guest RSVP without signing up while still getting a
   * real auth.uid(). Because RSVP rows are keyed on that uid, one guest cannot
   * overwrite another's reply by claiming their email — which the old backend
   * allowed.
   */
  async ensureSession() {
    const { data } = await supabase.auth.getSession();
    if (data?.session) return toUser(data.session.user);

    const { data: anon, error } = await supabase.auth.signInAnonymously();
    if (error) throw new Error(friendlyError(error, 'Could not start a guest session.'));
    return toUser(anon.user);
  },

  /* ---------- invitations ---------- */

  /**
   * Loads an invitation by slug. Works without a session.
   * Returns null when the slug matches nothing — there is no listing or
   * substring search, so a wrong code reveals nothing.
   */
  /**
   * @param slug  the invitation slug
   * @param token personal invite token from `?k=` — required for private events
   */
  async getInvite(slug, token = null) {
    const { data, error } = await supabase.rpc('get_invite', {
      p_slug: slug,
      p_token: token
    });
    if (error) throw new Error(friendlyError(error, 'Could not load this invitation.'));
    return toInvite(data);
  },

  /** Publishing requires a real (non-anonymous) account. */
  async createEvent(input) {
    const { data, error } = await supabase
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
        customization: input.customization || {}
      })
      .select()
      .single();

    if (error) {
      if (/row-level security/i.test(error.message || '')) {
        throw new Error('Please create an account or log in to publish an invitation.');
      }
      throw new Error(friendlyError(error, 'Could not publish your invitation.'));
    }
    // host_id and slug were assigned by database triggers, not by this client.
    return { id: data.id, slug: data.slug, title: data.title };
  },

  /**
   * Submits or updates the caller's RSVP and returns the re-evaluated invite,
   * including the venue details if the reply entitles them.
   *
   * One request, one shape. Replaces the old three-request flow whose response
   * key the client read incorrectly.
   */
  async submitRsvp(
    slug,
    { guestName, contact, status = 'going', dietaryNotes, plusOnes, note, token } = {}
  ) {
    await this.ensureSession();

    const { data, error } = await supabase.rpc('submit_rsvp', {
      p_slug: slug,
      p_guest_name: guestName,
      p_contact: contact || null,
      p_status: status,
      p_dietary_notes: dietaryNotes || null,
      p_plus_ones: plusOnes || 0,
      p_note: note || null,
      p_token: token || null
    });
    if (error) throw new Error(friendlyError(error, 'Could not save your reply.'));
    return toInvite(data);
  },

  /* ---------- private invites ---------- */

  /** Host-only. Adds a named invitee and returns their personal link. */
  async addInvitee(slug, name, contact = null) {
    const { data, error } = await supabase.rpc('add_event_invitee', {
      p_slug: slug,
      p_name: name,
      p_contact: contact
    });
    if (error) throw new Error(friendlyError(error, 'Could not add that guest.'));
    return {
      id: data.id,
      name: data.name,
      contact: data.contact,
      token: data.token,
      claimed: Boolean(data.claimed),
      link: `${this.inviteUrl(slug)}?k=${data.token}`
    };
  },

  /** Host-only. Every named invitee, with their personal link. */
  async listInvitees(slug) {
    const { data, error } = await supabase.rpc('list_event_invitees', { p_slug: slug });
    if (error) throw new Error(friendlyError(error, 'Could not load your invite list.'));
    return (data || []).map((i) => ({
      id: i.id,
      name: i.name,
      contact: i.contact,
      token: i.token,
      claimed: Boolean(i.claimed),
      claimedAt: i.claimed_at ? new Date(i.claimed_at) : null,
      link: `${this.inviteUrl(slug)}?k=${i.token}`
    }));
  },

  /** Host-only. Revokes an invitee's link. */
  async removeInvitee(inviteeId) {
    const { error } = await supabase.rpc('remove_event_invitee', { p_invitee_id: inviteeId });
    if (error) throw new Error(friendlyError(error, 'Could not remove that guest.'));
    return true;
  },

  /* ---------- hype wall ---------- */

  /**
   * Notes for an invitation, oldest first, with replies threaded under parents.
   * `parentId` is null on a top-level note; `fromHost` marks the host's answers.
   */
  async getComments(slug) {
    const { data, error } = await supabase.rpc('get_event_comments', {
      p_slug: slug,
      p_limit: 200
    });
    if (error) return [];

    const flat = (data || []).map((c) => ({
      id: c.id,
      parentId: c.parent_id || null,
      authorName: c.author_name,
      avatarEmoji: c.avatar_emoji,
      message: c.message,
      createdAt: c.created_at,
      fromHost: Boolean(c.from_host),
      mine: Boolean(c.mine)
    }));

    // Thread it here rather than in the component, so every consumer gets the
    // same shape.
    const byId = new Map(flat.map((c) => [c.id, { ...c, replies: [] }]));
    const roots = [];
    for (const c of byId.values()) {
      if (c.parentId && byId.has(c.parentId)) byId.get(c.parentId).replies.push(c);
      else roots.push(c);
    }
    return roots;
  },

  /** Posts a note, or a reply when parentId is supplied. */
  async postComment(slug, message, authorName, parentId = null, avatar = '✨') {
    const { data, error } = await supabase.rpc('post_comment', {
      p_slug: slug,
      p_message: message,
      p_author_name: authorName || null,
      p_avatar: avatar,
      p_parent_id: parentId
    });
    if (error) throw new Error(friendlyError(error, 'Could not post your message.'));
    return {
      id: data.id,
      parentId: data.parent_id || null,
      authorName: data.author_name,
      avatarEmoji: data.avatar_emoji,
      message: data.message,
      createdAt: data.created_at,
      fromHost: Boolean(data.from_host),
      mine: true,
      replies: []
    };
  },

  /**
   * The guest list, for the host of the event only.
   *
   * The database raises rather than returning a filtered list, so a failure here
   * genuinely means "not the host" and not "no guests yet".
   */
  async getEventGuests(slug) {
    const { data, error } = await supabase.rpc('get_event_guests', { p_slug: slug });
    if (error) throw new Error(friendlyError(error, 'Could not load your guest list.'));
    return {
      guests: (data?.guests || []).map((g) => ({
        id: g.id,
        name: g.guest_name,
        contact: g.contact,
        status: g.status,
        dietaryNotes: g.dietary_notes,
        plusOnes: g.plus_ones ?? 0,
        repliedAt: g.replied_at ? new Date(g.replied_at) : null
      })),
      counts: {
        going: data?.counts?.going ?? 0,
        maybe: data?.counts?.maybe ?? 0,
        notGoing: data?.counts?.not_going ?? 0,
        plusOnes: data?.counts?.plus_ones ?? 0,
        headCount: data?.counts?.head_count ?? 0
      }
    };
  },

  /* ---------- dashboard ---------- */

  /**
   * The caller's own invitations. Takes no arguments on purpose: identity comes
   * from the session, so there is no parameter through which to request
   * somebody else's list.
   */
  async getMyInvites() {
    const { data, error } = await supabase.rpc('get_my_invites');
    if (error) throw new Error(friendlyError(error, 'Could not load your invitations.'));

    const mapCard = (e) => ({
      id: e.id,
      slug: e.slug,
      title: e.title,
      subtitle: e.subtitle || '',
      startsAt: e.starts_at ? new Date(e.starts_at) : null,
      venueName: e.venue_name,
      goingCount: e.going_count ?? 0,
      myStatus: e.my_status || null,
      myGuestName: e.my_guest_name || null,
      coverImage: e.customization?.coverImage || e.theme?.posterUrl || null
    });

    return {
      hosted: (data?.hosted || []).map(mapCard),
      accepted: (data?.accepted || []).map(mapCard)
    };
  },

  /* ---------- cover artwork ---------- */

  /**
   * Uploads a host's own artwork and returns a public URL for it.
   *
   * The path is `<uid>/<random>.jpg` because the storage policy checks that the
   * first folder segment equals auth.uid() — that is what stops one host writing
   * into another's folder or overwriting their cover. Anonymous guest sessions
   * are refused by the same policy, so a guest who is only replying to an invite
   * cannot use the bucket as free image hosting.
   *
   * The blob is already downscaled and re-encoded by prepareCoverImage().
   */
  async uploadCover(blob) {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user || user.is_anonymous) {
      throw new Error('Create a free account to upload your own artwork.');
    }

    const rand =
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const path = `${user.id}/${rand}.jpg`;

    const { error } = await supabase.storage.from('event-covers').upload(path, blob, {
      contentType: 'image/jpeg',
      cacheControl: '31536000',
      upsert: false
    });
    if (error) {
      if (/Bucket not found/i.test(error.message || '')) {
        throw new Error('Image uploads are not set up on this project yet. Run the latest migration.');
      }
      throw new Error(friendlyError(error, 'Could not upload that image.'));
    }

    const { data } = supabase.storage.from('event-covers').getPublicUrl(path);
    return data.publicUrl;
  },

  /* ---------- profiles ---------- */

  /**
   * The caller's own profile. Takes no arguments — identity comes from the
   * session, so there is no parameter through which to request somebody else's.
   * Returns null for an anonymous guest, who has no profile row by design.
   */
  async getMyProfile() {
    const { data, error } = await supabase.rpc('get_my_profile');
    if (error) throw new Error(friendlyError(error, 'Could not load your profile.'));
    return toProfile(data);
  },

  /**
   * Saves the editable fields. Anything omitted is left alone rather than
   * blanked, so a partial save from one section of the form cannot wipe another.
   */
  async updateMyProfile(input = {}) {
    const { data, error } = await supabase.rpc('update_my_profile', {
      p_display_name: input.displayName ?? null,
      p_handle: input.handle ?? null,
      p_bio: input.bio ?? null,
      p_city: input.city ?? null,
      p_avatar_emoji: input.avatar ?? null,
      p_avatar_url: input.avatarUrl ?? null,
      p_is_public: input.isPublic ?? null,
      p_instagram: input.instagram ?? null,
      p_vsco: input.vsco ?? null,
      p_spotify: input.spotify ?? null,
      p_playlist_url: input.playlistUrl ?? null
    });
    if (error) {
      if (/handle_taken/i.test(error.message || '')) {
        throw new Error('That handle is already taken. Try another.');
      }
      if (/handle_invalid/i.test(error.message || '')) {
        throw new Error('Handles can use letters, numbers, dots and underscores, 2–30 characters.');
      }
      throw new Error(friendlyError(error, 'Could not save your profile.'));
    }
    return toProfile(data);
  },

  /**
   * Somebody else's public profile, by handle. Deliberately narrow: display
   * identity, socials the person chose to publish, and two counts. No email, no
   * event list, no guest lists.
   */
  async getPublicProfile(handle) {
    const { data, error } = await supabase.rpc('get_public_profile', { p_handle: handle });
    if (error) throw new Error(friendlyError(error, 'Could not load that profile.'));
    return toProfile(data);
  },

  /* ---------- sharing ---------- */

  /** Absolute link to an invitation. Uses the current origin, so the scheme is always right. */
  inviteUrl(slug) {
    return `${window.location.origin}/invite/${slug}`;
  },

  /**
   * Map links for an unlocked invitation.
   *
   * With coordinates from the OpenStreetMap picker these point at the exact
   * spot. Without them we fall back to a text query, which is what the old
   * single link always did — and why it could open the wrong "Terrace Garden".
   */
  mapLinks(invite) {
    if (!invite) return null;
    const hasCoords = invite.venueLat != null && invite.venueLng != null;

    if (hasCoords) {
      const at = `${invite.venueLat},${invite.venueLng}`;
      return {
        exact: true,
        google: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(at)}`,
        osm: `https://www.openstreetmap.org/?mlat=${invite.venueLat}&mlon=${invite.venueLng}#map=18/${invite.venueLat}/${invite.venueLng}`,
        // Opens turn-by-turn from wherever the guest is.
        directions: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(at)}`
      };
    }

    const q = `${invite.venueName || ''} ${invite.venueAddress || ''}`.trim();
    if (!q) return null;
    return {
      exact: false,
      google: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`,
      osm: `https://www.openstreetmap.org/search?query=${encodeURIComponent(q)}`,
      directions: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`
    };
  },

  /**
   * QR code as a data URL, rendered locally.
   *
   * The old backend built a URL for a third-party QR image service, which both
   * hardcoded `http://` and handed the invite slug to that service. Since the
   * slug is what grants access to the invitation, generating the code in the
   * browser keeps it from leaving.
   */
  async qrDataUrl(slug) {
    try {
      return await QRCode.toDataURL(this.inviteUrl(slug), {
        width: 260,
        margin: 1,
        color: { dark: '#0b0d13', light: '#ffffff' }
      });
    } catch {
      return '';
    }
  },

  whatsAppUrl(invite) {
    if (!invite) return '';
    const when = invite.startsAt
      ? invite.startsAt.toLocaleString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })
      : '';
    const text =
      `🎉 ${invite.title}\n` +
      (when ? `🗓️ ${when}\n` : '') +
      `📍 ${invite.venueName} — address reveals once you reply\n\n` +
      `Seen hai? Ab bata:\n${this.inviteUrl(invite.slug)}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  },

  /** RFC 5545 .ics built from the event's real timestamps. */
  icsBlob(invite) {
    const fmt = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const start = invite.startsAt || new Date();
    const end = invite.endsAt || new Date(start.getTime() + 4 * 3600000);
    const location = invite.venueAddress
      ? `${invite.venueName}, ${invite.venueAddress}`
      : invite.venueName;
    const escape = (s) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//HAVAN Studio//Invitation//EN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${invite.slug}@havan.studio`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${escape(invite.title)}`,
      `DESCRIPTION:${escape(invite.description)} Host: ${escape(invite.hostName)}`,
      `LOCATION:${escape(location)}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    return new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  }
};

export default api;
