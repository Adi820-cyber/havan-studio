import React, { useState, useEffect } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import InteractiveCard from './InteractiveCard';
import { CATEGORY_ICON, Reveal } from '../lib/icons';

/**
 * Template gallery.
 *
 * Uses the `lp-` classes rather than `.section-header` / `.section-title`, which
 * are defined twice in index.css — the studio's later definition was winning and
 * turning this header into a flex row, so the eyebrow, heading and paragraph sat
 * side by side instead of stacking.
 *
 * Each card previously repeated the full interactive demo plus a "Wax Seal: … /
 * RSVP Preset: …" specification row and two buttons. The seal and preset are
 * implementation vocabulary, not something a host is shopping for, so they are
 * gone. One action per card.
 */
const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'mehfil', label: 'Sufi & Mehfil' },
  { id: 'happyhours', label: 'Happy Hours' },
  { id: 'wedding', label: 'Wedding' },
  { id: 'birthday', label: 'Birthday' }
];

export default function TemplatePlayground({
  templates,
  activeTemplate,
  onSelectTemplate,
  onOpenMaker,
  activeCategory = 'all'
}) {
  const [filter, setFilter] = useState(activeCategory);

  useEffect(() => {
    if (activeCategory) setFilter(activeCategory);
  }, [activeCategory]);

  const filtered = filter === 'all' ? templates : templates.filter((t) => t.category === filter);

  return (
    <section id="templates" className="lp-section">
      <div className="lp-container">
        <Reveal className="lp-head">
          <div className="lp-eyebrow">Start from a style</div>
          <h2 className="lp-h2">Nine ways to say come over</h2>
          <p className="lp-sub">
            A candlelit qawwali mehfil, a rooftop sangeet, a 2 AM house jam. Start from
            one, then change everything — or upload your own artwork and ignore all of
            these.
          </p>

          <div className="lp-chips">
            {CATEGORIES.map((cat) => {
              const Icon = CATEGORY_ICON[cat.id];
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setFilter(cat.id)}
                  className="lp-chip"
                  aria-pressed={filter === cat.id}
                >
                  <Icon size={14} strokeWidth={1.9} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </Reveal>

        <div className="lp-grid">
          {filtered.map((template, i) => {
            const isActive = activeTemplate.id === template.id;
            return (
              <Reveal key={template.id} delay={Math.min(i * 70, 280)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <InteractiveCard template={template} />

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => onSelectTemplate(template)}
                      className="lp-chip"
                      aria-pressed={isActive}
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      {isActive ? <Check size={14} strokeWidth={2.2} /> : null}
                      <span>{isActive ? 'Showing above' : 'Show in hero'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenMaker(template.category || 'all')}
                      className="lp-btn lp-btn-primary"
                      style={{ flex: 1, padding: '9px 16px', fontSize: '0.86rem' }}
                    >
                      <span>Use this</span>
                      <ArrowRight size={15} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
