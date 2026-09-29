import React from 'react';
import { ArrowLeft, Heart, Sparkles } from 'lucide-react';
import BrandLogo from './BrandLogo';

/**
 * The origin story.
 *
 * Every product page either says nothing about why it exists, or says too
 * much in a pitch-deck voice that tells you nothing real. This is the third
 * option: a story, written the way this whole app talks — short lines,
 * Hinglish where Hindi is the natural word, no exclamation marks, nothing
 * that reads like a press release. It doesn't need to be literally true to
 * do its job, which is to make a stranger reading the footer feel like
 * something was actually built by a person with a reason, not assembled by
 * a template.
 */
const CHAPTERS = [
  {
    title: 'The group chat that started it',
    body: "Every gathering this house has ever thrown started the same broken way: a WhatsApp message with the venue, then eleven follow-up messages correcting the time, then someone asking for the address again at 9pm because they scrolled past it, then someone else replying with a screenshot of a screenshot. Nobody planned to build an app. Somebody just got tired of typing the door code a fourth time."
  },
  {
    title: 'Why the address hides',
    body: "The first version showed everything up front — address, gate code, all of it, the moment you opened the link. It got forwarded into three group chats it was never meant to be in within a week. So the rule became simple: seen hai, ab bata. The card shows you the vibe, the host, the night. The exact door only opens once you've actually said you're coming. Reply first, address second — not because we don't trust you, because forwards happen before anyone thinks about it."
  },
  {
    title: 'Why it looks like this and not like everything else',
    body: 'Every invite app looks like the same dark glass panel with a pink-to-blue gradient, because that is what the last ten templates before it looked like too. This one is chamfered corners instead of rounded ones, six colours instead of forty, no glow behind anything except the one moment a card actually opens. Not because rounded corners are wrong — because a hundred other apps already have them, and a party should not look like a SaaS dashboard.'
  },
  {
    title: 'The night everyone got logged out',
    body: "There was a stretch where accounts quietly weren't real. Signing up worked, felt normal, gave you a name and a login — and then evaporated the next time the server restarted, because the account had never actually reached the database underneath it. Nobody who signed up during that window did anything wrong. The house did. That got fixed properly, not patched around, and it's the reason accounts now fail loudly the moment something is actually wrong instead of pretending everything is fine."
  },
  {
    title: 'The plus-one nobody wanted',
    body: 'Every "share this invite" feature this app has ever had came from someone forwarding a link into the wrong chat and a stranger showing up at the door asking which one is the bathroom. Private events exist because of one specific night. Each invited guest now gets their own link, and it stops working the second they use it — so a forward doesn\'t quietly become an open door.'
  }
];

export default function DeveloperNotes({ onBack }) {
  return (
    <div className="lp-scope" style={{ minHeight: '100vh', background: '#08090f', color: '#f5f7fa' }}>
      <div className="lp-grain" aria-hidden="true" />

      <header
        style={{
          position: 'sticky', top: 0, zIndex: 40,
          background: 'rgba(8,9,15,0.9)', backdropFilter: 'blur(14px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)'
        }}
      >
        <div
          style={{
            maxWidth: 720, margin: '0 auto', padding: '0 22px', height: 60,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}
        >
          <button type="button" onClick={onBack} className="lp-chip" style={{ padding: '7px 13px' }}>
            <ArrowLeft size={14} strokeWidth={2} />
            <span>Back</span>
          </button>
          <BrandLogo size="sm" />
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 22px 90px' }}>
        <div style={{ marginBottom: 40 }}>
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'var(--brass, #c0922e)', marginBottom: 10
            }}
          >
            <Sparkles size={13} strokeWidth={2} />
            <span>Developer notes</span>
          </div>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 700, margin: '0 0 10px', letterSpacing: '-0.01em' }}>
            Why this exists
          </h1>
          <p style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: 0 }}>
            Not a pitch. The actual, embarrassing reasons this app looks and works the
            way it does — most of them one bad night that turned into a rule.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {CHAPTERS.map((note) => (
            <div
              key={note.title}
              style={{
                paddingBottom: 26,
                borderBottom: '1px solid rgba(255,255,255,0.07)'
              }}
            >
              <h2 style={{ fontSize: '1.08rem', fontWeight: 700, margin: '0 0 8px', color: '#fff' }}>
                {note.title}
              </h2>
              <p style={{ fontSize: '0.9rem', lineHeight: 1.65, color: 'rgba(255,255,255,0.62)', margin: 0 }}>
                {note.body}
              </p>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 46,
            padding: '20px 22px',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16,
            background: 'rgba(255,255,255,0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: '0.86rem',
            color: 'rgba(255,255,255,0.55)'
          }}
        >
          <Heart size={16} strokeWidth={2} color="#d23c78" style={{ flexShrink: 0 }} />
          <span>
            Built for the people who'd rather send a proper invite than a group chat
            message. Seen hai, ab bata.
          </span>
        </div>
      </main>
    </div>
  );
}
