import crypto from 'crypto';

class LocalStore {
  constructor() {
    this.users = new Map();
    this.tokens = new Map();
    this.events = new Map();
    this.rsvps = new Map();
    this.comments = new Map();
    this.profiles = new Map();

    this._seed();
  }

  _seed() {
    // Seed Demo User
    const demoUser = {
      id: 'usr_demo_123',
      email: 'host@havan.studio',
      name: 'Priya & Rahul',
      avatar: '✨',
      isAnonymous: false,
    };
    this.users.set(demoUser.id, demoUser);

    // Seed Demo Event
    const demoEvent = {
      id: 'evt_demo_123',
      slug: 'demo',
      title: 'Havan Mehfil & Rooftop Sunset',
      subtitle: 'Bombay Deco Vibe — Bring good energy',
      host_name: 'Priya & Rahul',
      host_id: demoUser.id,
      description: 'Join us for an intimate rooftop gathering with chai, acoustic music, and golden hour vibes.',
      vibe_tag: 'CHILL / ACOUSTIC',
      starts_at: new Date(Date.now() + 86400000 * 2).toISOString(),
      ends_at: new Date(Date.now() + 86400000 * 2 + 14400000).toISOString(),
      timezone: 'Asia/Kolkata',
      venue_name: 'The Skylight Loft',
      venue_address: 'Bandra West, Mumbai',
      door_code: '4000',
      byob_note: 'BYOB — Mixers & snacks provided',
      is_unlocked: true,
      is_private: false,
      replies_open: true,
      going_count: 14,
      maybe_count: 3,
      theme: {
        bg: '#0b0d13',
        cardBg: '#131722',
        accent: '#c0922e',
        posterUrl: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&auto=format&fit=crop&q=80',
      },
      customization: {
        coverImage: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&auto=format&fit=crop&q=80',
      },
      created_at: new Date().toISOString(),
    };
    this.events.set(demoEvent.slug, demoEvent);

    // Seed Demo Comments
    this.comments.set(demoEvent.id, [
      {
        id: 'c1',
        parent_id: null,
        author_name: 'Aarav',
        avatar_emoji: '🎸',
        message: 'Bringing my acoustic guitar! Can’t wait for sunset.',
        created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
        from_host: false,
      },
      {
        id: 'c2',
        parent_id: null,
        author_name: 'Priya',
        avatar_emoji: '✨',
        message: 'Chai is on us! See you all soon.',
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        from_host: true,
      },
    ]);
  }

  createUser({ email, name, avatar, isAnonymous = false }) {
    const id = `usr_${crypto.randomUUID().slice(0, 8)}`;
    const user = { id, email: email || '', name: name || 'Guest', avatar: avatar || '✨', isAnonymous };
    this.users.set(id, user);

    const accessToken = `token_${crypto.randomUUID()}`;
    const refreshToken = `ref_${crypto.randomUUID()}`;
    const session = { accessToken, refreshToken, expiresAt: Math.floor(Date.now() / 1000) + 86400 * 7 };
    this.tokens.set(accessToken, user);

    return { user, session };
  }

  getUserByToken(token) {
    if (!token) return null;
    return this.tokens.get(token) || null;
  }

  createEvent(input, user) {
    const id = `evt_${crypto.randomUUID().slice(0, 8)}`;
    const slug = (input.title || 'event')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '-' + crypto.randomUUID().slice(0, 4);

    const event = {
      id,
      slug,
      title: input.title,
      subtitle: input.subtitle || '',
      host_name: input.hostName || user.name || 'Host',
      host_id: user.id,
      description: input.description || '',
      vibe_tag: input.vibeTag || '',
      starts_at: input.startsAt,
      ends_at: input.endsAt || null,
      timezone: input.timezone || 'UTC',
      venue_name: input.venueName || 'Secret Venue',
      venue_address: input.venueAddress || null,
      door_code: input.doorCode || null,
      byob_note: input.byobNote || null,
      is_unlocked: true,
      is_private: Boolean(input.isPrivate),
      replies_open: true,
      going_count: 1,
      maybe_count: 0,
      theme: input.theme || {},
      customization: input.customization || {},
      created_at: new Date().toISOString(),
    };

    this.events.set(slug, event);
    return event;
  }

  getInvite(slug, user) {
    const event = this.events.get(slug);
    if (!event) return null;

    const rsvpKey = `${event.id}_${user?.id || 'anon'}`;
    const myRsvp = this.rsvps.get(rsvpKey) || null;

    return {
      ...event,
      is_host: user ? event.host_id === user.id : false,
      my_rsvp: myRsvp,
    };
  }

  submitRsvp(slug, user, body) {
    const event = this.events.get(slug);
    if (!event) throw new Error('Event not found.');

    const status = body.status || 'going';
    const rsvp = {
      id: `rsvp_${crypto.randomUUID().slice(0, 8)}`,
      guest_name: body.guestName || user?.name || 'Guest',
      contact: body.contact || '',
      status,
      dietary_notes: body.dietaryNotes || '',
      plus_ones: Number(body.plusOnes) || 0,
      updated_at: new Date().toISOString(),
    };

    const rsvpKey = `${event.id}_${user?.id || 'anon'}`;
    this.rsvps.set(rsvpKey, rsvp);

    if (status === 'going') event.going_count = (event.going_count || 0) + 1;
    else if (status === 'maybe') event.maybe_count = (event.maybe_count || 0) + 1;

    return this.getInvite(slug, user);
  }

  getComments(slug, user) {
    const event = this.events.get(slug);
    if (!event) return [];
    const comments = this.comments.get(event.id) || [];
    return comments.map((c) => ({
      ...c,
      mine: user ? c.author_id === user.id : false,
    }));
  }

  postComment(slug, user, body) {
    const event = this.events.get(slug);
    if (!event) throw new Error('Event not found.');

    const comment = {
      id: `c_${crypto.randomUUID().slice(0, 8)}`,
      parent_id: body.parentId || null,
      author_id: user?.id || 'anon',
      author_name: body.authorName || user?.name || 'Guest',
      avatar_emoji: body.avatar || user?.avatar || '✨',
      message: body.message,
      created_at: new Date().toISOString(),
      from_host: user ? event.host_id === user.id : false,
    };

    const list = this.comments.get(event.id) || [];
    list.push(comment);
    this.comments.set(event.id, list);

    return comment;
  }

  getMyInvites(user) {
    if (!user) return { hosted: [], accepted: [] };
    const hosted = [];
    const accepted = [];

    for (const evt of this.events.values()) {
      if (evt.host_id === user.id) {
        hosted.push(evt);
      } else {
        const rsvp = this.rsvps.get(`${evt.id}_${user.id}`);
        if (rsvp) {
          accepted.push({
            ...evt,
            my_status: rsvp.status,
            my_guest_name: rsvp.guest_name,
          });
        }
      }
    }
    return { hosted, accepted };
  }
}

export const localStore = new LocalStore();
