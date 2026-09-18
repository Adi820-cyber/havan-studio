import React from 'react';
import { ArrowRight, Flame } from 'lucide-react';
import { Reveal } from '../lib/icons';
import BrandLogo from './BrandLogo';

/**
 * Footer.
 *
 * The "Platform Tech" column used to advertise implementation details to guests
 * ("60fps Canvas Particle FX", "Spotlight 3D Card Engine"), and the link columns
 * pointed at pages that do not exist. Both are gone — a footer that lists
 * non-functional links reads as unfinished.
 *
 * What remains: one closing call to action and an honest identity line.
 */
export default function Footer({ onOpenMaker }) {
  return (
    <footer style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: '#06070c' }}>
      <div className="lp-container" style={{ padding: '84px 24px 40px' }}>
        <Reveal
          style={{
            textAlign: 'center',
            maxWidth: 580,
            margin: '0 auto 72px'
          }}
        >
          <h2 className="lp-h2" style={{ marginBottom: 14 }}>
            Something worth leaving the house for?
          </h2>
          <p className="lp-sub" style={{ marginBottom: 28 }}>
            Make the invite now. Change anything you like before you send it.
          </p>
          <button type="button" onClick={() => onOpenMaker('all')} className="lp-btn lp-btn-primary">
            <span>Create an invite</span>
            <ArrowRight size={17} strokeWidth={2} />
          </button>
        </Reveal>

        <div
          className="lp-pair"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: 20,
            alignItems: 'center',
            paddingTop: 26,
            borderTop: '1px solid rgba(255,255,255,0.06)',
            fontSize: '0.83rem',
            color: 'rgba(255,255,255,0.4)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <BrandLogo size="sm" showDevanagari={true} />
            <span style={{ opacity: 0.4 }}>·</span>
            <span>For mehfils, house parties, sangeets and 2 AM afterparties</span>
          </div>
          <div>© {new Date().getFullYear()}</div>
        </div>
      </div>
    </footer>
  );
}
