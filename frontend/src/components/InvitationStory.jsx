import React, { useState } from 'react';
import { ArrowRight, CalendarDays, MapPin, RotateCcw } from 'lucide-react';
import { Reveal } from '../lib/icons';
import InvitationOpening from './InvitationOpening';
import RevealOnScroll from './RevealOnScroll';

const OPENING_STYLES = [
  {
    id: 'scroll',
    label: 'Story scroll',
    inspiration: 'Cheriyal-inspired · Telangana',
    hostName: 'Aditi & Kabir',
    senderMessage: 'We saved you a place by the music. Come for the qawwali, stay for the chai.',
    title: 'A rooftop mehfil',
    details: 'Saturday · 8:30 PM',
    venue: 'A terrace in Bandra',
    category: 'mehfil',
    primary: '#713e36',
    accent: '#d8a63c'
  },
  {
    id: 'kathputli',
    label: 'Puppet-stage curtain',
    inspiration: 'Kathputli-inspired · Rajasthan',
    hostName: 'Maya & Rohan',
    senderMessage: 'The sangeet will not be the same without you. Save the evening?',
    title: 'Sangeet at ours',
    details: 'Friday · 7:00 PM',
    venue: 'The family courtyard',
    category: 'wedding',
    primary: '#773a42',
    accent: '#e0b35c'
  },
  {
    id: 'warli-circle',
    label: 'Gathering circle',
    inspiration: 'Warli-inspired · Maharashtra',
    hostName: 'Rhea',
    senderMessage: 'Another year, same people I want around me. Come celebrate?',
    title: 'Rhea’s birthday',
    details: 'Sunday · 6:00 PM',
    venue: 'The garden downstairs',
    category: 'birthday',
    primary: '#62513b',
    accent: '#e2bd75'
  },
  {
    id: 'envelope',
    label: 'Personal letter',
    inspiration: 'A simple note from the host',
    hostName: 'Dev & friends',
    senderMessage: 'We are taking the living room back for one night. You in?',
    title: 'Sunday house party',
    details: 'Sunday · 8:00 PM',
    venue: 'A flat near Indiranagar',
    category: 'happyhours',
    primary: '#344d55',
    accent: '#d6a54b'
  }
];

export default function InvitationStory({ onOpenMaker, compact = false }) {
  const [activeStyleId, setActiveStyleId] = useState(OPENING_STYLES[0].id);
  const [previewKey, setPreviewKey] = useState(0);
  const [hasOpened, setHasOpened] = useState(false);
  const activeStyle = OPENING_STYLES.find((style) => style.id === activeStyleId) || OPENING_STYLES[0];
  const theme = {
    primary: activeStyle.primary,
    accent: activeStyle.accent,
    cardBg: '#1c2a4b',
    textColor: '#f5e9cf'
  };

  const selectStyle = (styleId) => {
    setActiveStyleId(styleId);
    setHasOpened(false);
    setPreviewKey((key) => key + 1);
  };

  const replay = () => {
    setHasOpened(false);
    setPreviewKey((key) => key + 1);
  };

  return (
    <section id={compact ? undefined : 'invite-story'} className={`lp-section havan-story-section${compact ? ' havan-story-section--compact' : ''}`}>
      <div className="lp-container">
        <Reveal className="lp-head">
          <div className="lp-eyebrow">A note before the plan</div>
          <h2 className="lp-h2">Let the invitation feel like it came from a person.</h2>
          <p className="lp-sub">
            The host’s name and message arrive first. Choose an opening, tap the note,
            then see the gathering details.
          </p>
        </Reveal>

        <Reveal className="havan-story-layout">
          <div className="havan-story-options" role="group" aria-label="Choose an invitation opening style">
            <p className="havan-story-options-label">Try an opening</p>
            {OPENING_STYLES.map((style) => (
              <button
                key={style.id}
                type="button"
                className="havan-story-option"
                onClick={() => selectStyle(style.id)}
                aria-pressed={activeStyleId === style.id}
              >
                <span className="havan-story-option-title">{style.label}</span>
                <span className="havan-story-option-origin">{style.inspiration}</span>
              </button>
            ))}
            <p className="havan-story-footnote">
              Regional styles are inspirations; the host can choose a different opening or keep it simple.
            </p>
          </div>

          <div className="havan-story-preview">
            <div className="havan-story-preview-label">
              <span>{hasOpened ? 'The gathering' : 'Before the details'}</span>
              {hasOpened && (
                <button type="button" className="havan-story-replay" onClick={replay}>
                  <RotateCcw size={14} aria-hidden="true" />
                  <span>See it again</span>
                </button>
              )}
            </div>

            <InvitationOpening
              key={`${activeStyle.id}-${previewKey}`}
              event={{
                hostName: activeStyle.hostName,
                title: activeStyle.title,
                customization: { revealId: activeStyle.id, senderMessage: activeStyle.senderMessage }
              }}
              theme={theme}
              onOpened={() => setHasOpened(true)}
            >
              <RevealOnScroll revealId={activeStyle.id}>
              <article className="havan-story-card" style={{ '--story-accent': activeStyle.accent }}>
                <div className="havan-story-card-kicker">YOU’RE INVITED</div>
                <h3>{activeStyle.title}</h3>
                <p className="havan-story-host">Hosted by {activeStyle.hostName}</p>
                <div className="havan-story-meta">
                  <span><CalendarDays size={15} aria-hidden="true" />{activeStyle.details}</span>
                  <span><MapPin size={15} aria-hidden="true" />{activeStyle.venue}</span>
                </div>
                <div className="havan-story-rsvp">Your reply unlocks the exact address.</div>
              </article>
              </RevealOnScroll>
            </InvitationOpening>

            <button
              type="button"
              className="lp-btn lp-btn-primary havan-story-cta"
              onClick={() => onOpenMaker(activeStyle.category)}
            >
              <span>Make an invitation like this</span>
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
