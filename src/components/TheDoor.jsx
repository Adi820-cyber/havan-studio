import React from 'react';
import { Reveal } from '../lib/icons';

/**
 * Landing content, because there was almost none.
 *
 * The page went hero → template gallery → three how-it-works cards → footer, and
 * a visitor who wanted to know what actually happens when they use this had
 * nowhere to find out. Nothing here is a feature list; each block is a moment in
 * the life of one invitation, in the product's own voice — lowkey, specific,
 * slightly withholding, sentence case, Hinglish where a Hindi word is the
 * natural one.
 */

const MOMENTS = [
  {
    step: '01',
    hin: 'दरवाज़ा',
    title: 'Behind the gate',
    body:
      'Before anyone replies they see the name, the date and the neighbourhood. Bandra West, Saturday, doors at nine. Not the building, not the flat, not the code. That is not a paywall, it is how you would actually tell someone about a party at your house.'
  },
  {
    step: '02',
    hin: 'सीन है',
    title: 'Seen hai. Ab bata.',
    body:
      'Three replies, in your words, not RSVP. Aa raha hoon, dil toh chahta hai, nahi ho paayega. They reply in one tap with no app and no account, the exact address unlocks for them, and the count moves for everybody else.'
  },
  {
    step: '03',
    hin: 'घर के नियम',
    title: 'The stuff nobody says out loud',
    body:
      'BYOB. Shoes off. No plus-ones, tight space. Out by two, building rule. There is a cat. Written once on the invite instead of asked six times in the group, and read before anyone commits rather than discovered at the door.'
  },
  {
    step: '04',
    hin: 'बस',
    title: 'Replies close before it starts',
    body:
      'Two hours before doors, the buttons stop working. Yes at eleven from someone who never answered is how you end up short on food and long on people. Final is final.'
  }
];

export default function TheDoor() {
  return (
    <section id="the-door" className="lp-section">
      <div className="lp-container">
        <Reveal className="lp-head">
          <div className="lp-eyebrow">What actually happens</div>
          <h2 className="lp-h2">
            Every party is a door <span className="havan-hin">हवन</span>
          </h2>
          <p className="lp-sub">
            Something you are either let into or not. The whole product is built on
            that one idea.
          </p>
        </Reveal>

        <div
          className="lp-grid"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2 }}
        >
          {MOMENTS.map((m) => (
            <Reveal
              key={m.step}
              style={{
                padding: '26px 22px 28px',
                border: '1px solid rgba(230,213,174,0.12)',
                background: 'rgba(230,213,174,0.025)'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 10,
                  marginBottom: 14
                }}
              >
                <span className="havan-num" style={{ fontSize: '1.5rem', color: 'var(--brass)' }}>
                  {m.step}
                </span>
                <span className="havan-hin" style={{ fontSize: '1rem', color: 'rgba(230,213,174,0.4)' }}>
                  {m.hin}
                </span>
              </div>

              <h3
                style={{
                  margin: '0 0 9px',
                  fontSize: '1.08rem',
                  fontWeight: 600,
                  color: 'var(--sand)',
                  lineHeight: 1.25
                }}
              >
                {m.title}
              </h3>

              <p
                style={{
                  margin: 0,
                  fontSize: '0.89rem',
                  lineHeight: 1.62,
                  color: 'rgba(230,213,174,0.58)'
                }}
              >
                {m.body}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
