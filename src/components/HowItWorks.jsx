import React from 'react';
import { Image, Lock, Send } from 'lucide-react';
import { Reveal } from '../lib/icons';

/**
 * Three steps.
 *
 * Trimmed from a heading, subheading and paragraph per step down to a heading and
 * one sentence. The old copy also claimed "94%+ turnout" and "viral", neither of
 * which is measured, so both are gone.
 */
const STEPS = [
  {
    n: '1',
    Icon: Image,
    title: 'Say what it is',
    body: 'Name, date, address, and whether people are bringing something. Two minutes, no account needed to start.'
  },
  {
    n: '2',
    Icon: Lock,
    title: 'Make it look like something',
    body: 'Upload your own photo or take one of ours. The colours follow whatever you pick.'
  },
  {
    n: '3',
    Icon: Send,
    title: 'Drop the link',
    body: 'Send it wherever. Guests reply in one tap — no app, no signup — and the address unlocks for them.'
  }
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="lp-section">
      <div className="lp-container">
        <Reveal className="lp-head">
          <div className="lp-eyebrow">How it works</div>
          <h2 className="lp-h2">Three steps, about two minutes</h2>
          <p className="lp-sub">
            Yes, the group chat is still free. It's also still the group chat.
          </p>
        </Reveal>

        <div className="lp-steps">
          {STEPS.map((step, i) => (
            <Reveal key={step.n} delay={i * 90}>
              <div className="lp-step">
                <div className="lp-step-n">{step.n}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
                  <step.Icon size={17} strokeWidth={1.8} color="rgba(255,255,255,0.55)" />
                  <h3 style={{ margin: 0, fontSize: '1.06rem', fontWeight: 600, color: '#fff' }}>
                    {step.title}
                  </h3>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.93rem',
                    lineHeight: 1.6,
                    color: 'rgba(255,255,255,0.6)'
                  }}
                >
                  {step.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
