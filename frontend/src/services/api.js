/**
 * HAVAN Studio — frontend API client.
 *
 * This module is the single point of contact between the React app and the
 * backend API. All calls go through fetch() to the backend; there is no
 * Supabase client in the frontend.
 *
 * The backend proxies Supabase Auth and database RPCs, so the frontend never
 * sees the Supabase URL, keys, or any database-level concern.
 */
import QRCode from 'qrcode';

/* ────────────────────────────── config ────────────────────────────── */

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

/* ────────────────────────────── session storage ────────────────────────────── */

const TOKEN_KEY = 'havan-access-token';
const REFRESH_KEY = 'havan-refresh-token';

function storeSession(session) {
  if (!session) return;
  localStorage.setItem(TOKEN_KEY, session.accessToken);
  localStorage.setItem(REFRESH_KEY, session.refreshToken);
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

/* ────────────────────────────── http client ────────────────────────────── */

/**
 * Core fetch wrapper with auth header injection, JSON parsing, and error handling.
 */
async function request(path, options = {}) {
  const { body, method = 'GET', auth = true, retry = true, ...rest } = options;

  const headers = {
    'Content-Type': 'application/json',
    ...rest.headers,
  };

  if (auth) {
    const token = getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const config = {
    method,
    headers,
    ...rest,
  };

  if (body && method !== 'GET') {
    config.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, config);
  } catch (err) {
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }

  // Token expired — try refresh once
  if (res.status === 401 && retry) {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          storeSession(refreshData.session);
          // Retry original request with new token
          return request(path, { ...options, retry: false });
        }
      } catch {
        // Refresh failed — clear session
      }
      clearSession();
    }
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    let defaultMsg = `Request failed with status ${res.status}`;
    if (res.status === 404) {
      defaultMsg = 'Backend API endpoint not found (404). Please ensure the backend server is running or configure VITE_API_BASE_URL to your active backend API.';
    } else if (res.status === 503 || res.status === 502) {
      defaultMsg = 'Backend API server is currently unavailable (502/503). Please try again in a moment.';
    }
    const err = new Error(errorData.error || defaultMsg);
    err.status = res.status;
    throw err;
  }

  // 204 No Content
  if (res.status === 204) return null;

  return res.json();
}

/* ────────────────────────────── shaping ────────────────────────────── */

/**
 * Normalises the data returned by the backend into the shape the UI renders.
 * Identical to the old toInvite but takes the raw backend response.
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

    venueAddress: row.venue_address ?? null,
    doorCode: row.door_code ?? null,
    venueLat: row.venue_lat != null ? Number(row.venue_lat) : null,
    venueLng: row.venue_lng != null ? Number(row.venue_lng) : null,
    isUnlocked: Boolean(row.is_unlocked),

    repliesCloseAt: row.replies_close_at ? new Date(row.replies_close_at) : null,
    repliesOpen: row.replies_open !== false,

    isHost: Boolean(row.is_host),
    isPrivate: Boolean(row.is_private),
    invitedAs: row.invited_as || null,

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
          updatedAt: row.my_rsvp.updated_at,
        }
      : null,

    theme,
    customization: custom,
    coverImage: custom.coverImage || theme.posterUrl || null,

    createdAt: row.created_at,
  };
}

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
      playlistUrl: row.playlist_url || '',
    },
    stats: {
      hosted: row.hosted_count ?? 0,
      attended: row.attended_count ?? 0,
    },
    isMe: Boolean(row.is_me),
    joinedAt: row.created_at ? new Date(row.created_at) : null,
  };
}

/* ────────────────────────────── api ────────────────────────────── */

// Auth state change listeners
let _authListeners = [];
let _currentUser = null;

function _notifyAuthListeners(user) {
  _currentUser = user;
  _authListeners.forEach((cb) => {
    try { cb(user); } catch {}
  });
}

export const api = {
  /* ---------- session ---------- */

  async getCurrentUser() {
    const token = getAccessToken();
    if (!token) return null;

    try {
      const { user } = await request('/api/auth/session');
      _currentUser = user;
      return user;
    } catch {
      clearSession();
      return null;
    }
  },

  onAuthChange(callback) {
    _authListeners.push(callback);

    // Fire immediately with current state
    this.getCurrentUser().then((user) => {
      callback(user);
    });

    // Return unsubscribe function
    return () => {
      _authListeners = _authListeners.filter((cb) => cb !== callback);
    };
  },

  async signIn(email, password) {
    const { user, session } = await request('/api/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
    storeSession(session);
    _notifyAuthListeners(user);
    return user;
  },

  async signUp(email, password, name, avatar = '✨') {
    const result = await request('/api/auth/signup', {
      method: 'POST',
      body: { email, password, name, avatar },
      auth: false,
    });

    if (!result.session) {
      const err = new Error(result.message || 'Check your inbox to confirm your email, then log in.');
      err.needsConfirmation = true;
      throw err;
    }

    storeSession(result.session);
    _notifyAuthListeners(result.user);
    return result.user;
  },

  async signOut() {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } catch {
      // Even if the server call fails, clear local state
    }
    clearSession();
    _notifyAuthListeners(null);
  },

  async ensureSession() {
    const token = getAccessToken();
    if (token) {
      try {
        const { user } = await request('/api/auth/session');
        return user;
      } catch {
        // Token expired or invalid
      }
    }

    // Create anonymous session
    const { user, session } = await request('/api/auth/anonymous', {
      method: 'POST',
      auth: false,
    });
    storeSession(session);
    return user;
  },

  /* ---------- invitations ---------- */

  async getInvite(slug, token = null) {
    const params = token ? `?token=${encodeURIComponent(token)}` : '';
    const { data } = await request(`/api/events/${slug}${params}`, { auth: true });
    return toInvite(data);
  },

  async createEvent(input) {
    const { data } = await request('/api/events', {
      method: 'POST',
      body: input,
    });
    return data;
  },

  async submitRsvp(slug, { guestName, contact, status = 'going', dietaryNotes, plusOnes, note, token } = {}) {
    await this.ensureSession();

    const { data } = await request(`/api/rsvp/${slug}`, {
      method: 'POST',
      body: { guestName, contact, status, dietaryNotes, plusOnes, note, token },
    });
    return toInvite(data);
  },

  /* ---------- private invites ---------- */

  async addInvitee(slug, name, contact = null) {
    const { data } = await request(`/api/invitees/${slug}`, {
      method: 'POST',
      body: { name, contact },
    });
    return {
      id: data.id,
      name: data.name,
      contact: data.contact,
      token: data.token,
      claimed: Boolean(data.claimed),
      link: `${this.inviteUrl(slug)}?k=${data.token}`,
    };
  },

  async listInvitees(slug) {
    const { data } = await request(`/api/invitees/${slug}`);
    return (data || []).map((i) => ({
      id: i.id,
      name: i.name,
      contact: i.contact,
      token: i.token,
      claimed: Boolean(i.claimed),
      claimedAt: i.claimed_at ? new Date(i.claimed_at) : null,
      link: `${this.inviteUrl(slug)}?k=${i.token}`,
    }));
  },

  async removeInvitee(inviteeId) {
    await request(`/api/invitees/${inviteeId}`, { method: 'DELETE' });
    return true;
  },

  /* ---------- hype wall ---------- */

  async getComments(slug) {
    const { data } = await request(`/api/comments/${slug}`);

    const flat = (data || []).map((c) => ({
      id: c.id,
      parentId: c.parent_id || null,
      authorName: c.author_name,
      avatarEmoji: c.avatar_emoji,
      message: c.message,
      createdAt: c.created_at,
      fromHost: Boolean(c.from_host),
      mine: Boolean(c.mine),
    }));

    // Thread it
    const byId = new Map(flat.map((c) => [c.id, { ...c, replies: [] }]));
    const roots = [];
    for (const c of byId.values()) {
      if (c.parentId && byId.has(c.parentId)) byId.get(c.parentId).replies.push(c);
      else roots.push(c);
    }
    return roots;
  },

  async postComment(slug, message, authorName, parentId = null, avatar = '✨') {
    const { data } = await request(`/api/comments/${slug}`, {
      method: 'POST',
      body: { message, authorName, parentId, avatar },
    });
    return {
      id: data.id,
      parentId: data.parent_id || null,
      authorName: data.author_name,
      avatarEmoji: data.avatar_emoji,
      message: data.message,
      createdAt: data.created_at,
      fromHost: Boolean(data.from_host),
      mine: true,
      replies: [],
    };
  },

  async getEventGuests(slug) {
    const { data } = await request(`/api/events/${slug}/guests`);
    return {
      guests: (data?.guests || []).map((g) => ({
        id: g.id,
        name: g.guest_name,
        contact: g.contact,
        status: g.status,
        dietaryNotes: g.dietary_notes,
        plusOnes: g.plus_ones ?? 0,
        repliedAt: g.replied_at ? new Date(g.replied_at) : null,
      })),
      counts: {
        going: data?.counts?.going ?? 0,
        maybe: data?.counts?.maybe ?? 0,
        notGoing: data?.counts?.not_going ?? 0,
        plusOnes: data?.counts?.plus_ones ?? 0,
        headCount: data?.counts?.head_count ?? 0,
      },
    };
  },

  /* ---------- dashboard ---------- */

  async getMyInvites() {
    const { data } = await request('/api/dashboard/invites');

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
      coverImage: e.customization?.coverImage || e.theme?.posterUrl || null,
    });

    return {
      hosted: (data?.hosted || []).map(mapCard),
      accepted: (data?.accepted || []).map(mapCard),
    };
  },

  /* ---------- cover artwork ---------- */

  async uploadCover(blob) {
    // Check we have a real session
    const token = getAccessToken();
    if (!token) {
      throw new Error('Create a free account to upload your own artwork.');
    }

    // 1. Get presigned URL from backend
    const { signedUrl, publicUrl } = await request('/api/upload/presigned-url?contentType=image/jpeg');

    // 2. Upload directly to S3
    const uploadRes = await fetch(signedUrl, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': 'image/jpeg' },
    });

    if (!uploadRes.ok) {
      throw new Error('Failed to upload image to S3.');
    }

    return publicUrl;
  },

  /* ---------- profiles ---------- */

  async getMyProfile() {
    const { data } = await request('/api/profiles/me');
    return toProfile(data);
  },

  async updateMyProfile(input = {}) {
    const { data } = await request('/api/profiles/me', {
      method: 'PUT',
      body: input,
    });
    return toProfile(data);
  },

  async getPublicProfile(handle) {
    const { data } = await request(`/api/profiles/${handle}`, { auth: false });
    return toProfile(data);
  },

  /* ---------- sharing ---------- */

  inviteUrl(slug) {
    return `${window.location.origin}/invite/${slug}`;
  },

  mapLinks(invite) {
    if (!invite) return null;
    const hasCoords = invite.venueLat != null && invite.venueLng != null;

    if (hasCoords) {
      const at = `${invite.venueLat},${invite.venueLng}`;
      return {
        exact: true,
        google: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(at)}`,
        osm: `https://www.openstreetmap.org/?mlat=${invite.venueLat}&mlon=${invite.venueLng}#map=18/${invite.venueLat}/${invite.venueLng}`,
        directions: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(at)}`,
      };
    }

    const q = `${invite.venueName || ''} ${invite.venueAddress || ''}`.trim();
    if (!q) return null;
    return {
      exact: false,
      google: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`,
      osm: `https://www.openstreetmap.org/search?query=${encodeURIComponent(q)}`,
      directions: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`,
    };
  },

  async qrDataUrl(slug) {
    try {
      return await QRCode.toDataURL(this.inviteUrl(slug), {
        width: 260,
        margin: 1,
        color: { dark: '#0b0d13', light: '#ffffff' },
      });
    } catch {
      return '';
    }
  },

  whatsAppUrl(invite) {
    if (!invite) return '';
    const dateObj = invite.startsAt ? (invite.startsAt instanceof Date ? invite.startsAt : new Date(invite.startsAt)) : null;
    const when = dateObj && !isNaN(dateObj)
      ? dateObj.toLocaleString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : '';
    const vibe = invite.vibeTag ? ` • _${invite.vibeTag}_` : '';
    const venue = invite.venueName || 'Secret Venue';
    const host = invite.hostName ? `Host: *${invite.hostName}*` : '';

    // Standard UTF-16 surrogate pairs for universal emojis
    const spark = '\u2728';
    const party = '\uD83C\uDF89';
    const cal = '\uD83D\uDCC5';
    const pin = '\uD83D\uDCCD';
    const lock = '\uD83D\uDD12';
    const userIcon = '\uD83D\uDC64';
    const fire = '\uD83D\uDD25';
    const handDown = '\uD83D\uDC47';

    const text =
      `${spark} *You're Invited!* ${spark}\n\n` +
      `${party} *${invite.title}*${vibe}\n` +
      (when ? `${cal} *When:* ${when}\n` : '') +
      `${pin} *Where:* ${venue}\n` +
      `${lock} _(Exact address & door code unlocks when you reply!)_\n\n` +
      (host ? `${userIcon} ${host}\n\n` : '') +
      `${fire} *Seen hai? Ab bata:* \n` +
      `${handDown} Lock your spot here:\n${this.inviteUrl(invite.slug)}`;
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  },

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
      'END:VCALENDAR',
    ].join('\r\n');

    return new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  },
};

export default api;
