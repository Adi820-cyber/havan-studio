import React from 'react';

/**
 * BrandLogo — Bombay Deco, Refracted
 *
 * Implements visual direction for havan:
 * - Wordmark: "havan" set in Clash Display / Unbounded font
 * - Second voice: Devanagari "हवन" set in Mukta font
 * - Signature Motif: Cusped Jaipur gate arch + stepped ziggurat base + Deco sunburst flame emblem
 */
export default function BrandLogo({
  size = 'md', // 'sm' | 'md' | 'lg'
  showDevanagari = true,
  showIcon = true,
  showTagline = false,
  textColor = '#E6D5AE', // Jaisalmer stone
  brassColor = '#C0922E', // Brass
  onClick,
  style = {}
}) {
  const sizeMap = {
    sm: { icon: 26, fontSize: '1.15rem', hinSize: '0.85rem', gap: 8 },
    md: { icon: 34, fontSize: '1.45rem', hinSize: '1.05rem', gap: 10 },
    lg: { icon: 48, fontSize: '2.1rem', hinSize: '1.55rem', gap: 14 }
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <div
      className="havan-brand-logo"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: currentSize.gap,
        cursor: onClick ? 'pointer' : 'inherit',
        textDecoration: 'none',
        userSelect: 'none',
        ...style
      }}
    >
      {showIcon && (
        <div
          style={{
            position: 'relative',
            width: currentSize.icon,
            height: currentSize.icon,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          {/* Cusped Jaipur Gate Arch & Sunburst Flame SVG Motif */}
          <svg
            viewBox="0 0 100 100"
            width={currentSize.icon}
            height={currentSize.icon}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="havanArchGlow" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#1C2A4B" />
                <stop offset="100%" stopColor="#2A3C63" />
              </linearGradient>
              <linearGradient id="havanFlameGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#C0922E" />
                <stop offset="50%" stopColor="#E0632B" />
                <stop offset="100%" stopColor="#F0A11C" />
              </linearGradient>
            </defs>

            {/* Stepped Ziggurat Base */}
            <path
              d="M12 90 L12 80 L22 80 L22 70 L78 70 L78 80 L88 80 L88 90 Z"
              fill="#111A32"
              stroke={brassColor}
              strokeWidth="2.5"
              strokeLinejoin="round"
            />

            {/* Cusped Jaipur Arch Structure */}
            <path
              d="M22 70 V46 C22 28 36 18 50 12 C64 18 78 28 78 46 V70"
              fill="url(#havanArchGlow)"
              stroke={brassColor}
              strokeWidth="3.2"
              strokeLinecap="round"
            />

            {/* Cusped Arch Accent Notch */}
            <path
              d="M34 46 C34 32 42 24 50 20 C58 24 66 32 66 46"
              fill="none"
              stroke="#4E8B7C"
              strokeWidth="1.8"
              strokeDasharray="2 2"
            />

            {/* Deco Sunburst Fan Rays */}
            <path d="M50 12 V2" stroke={brassColor} strokeWidth="2.5" strokeLinecap="round" />
            <path d="M40 16 L31 6" stroke={brassColor} strokeWidth="2" strokeLinecap="round" />
            <path d="M60 16 L69 6" stroke={brassColor} strokeWidth="2" strokeLinecap="round" />
            <path d="M30 25 L19 17" stroke={brassColor} strokeWidth="1.8" strokeLinecap="round" />
            <path d="M70 25 L81 17" stroke={brassColor} strokeWidth="1.8" strokeLinecap="round" />

            {/* Central Flame / Diya Icon */}
            <path
              d="M50 32 C42 44 40 54 44 61 C46 64 54 64 56 61 C60 54 58 44 50 32 Z"
              fill="url(#havanFlameGrad)"
            />
            {/* Inner Flame Glow */}
            <path
              d="M50 42 C47 48 46 53 48 56 C49 57 51 57 52 56 C54 53 53 48 50 42 Z"
              fill="#E6D5AE"
            />
          </svg>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', lineHeight: 1 }}>
          <span
            className="havan-wordmark-en"
            style={{
              fontFamily: "'Clash Display', 'Unbounded', sans-serif",
              fontWeight: 600,
              fontSize: currentSize.fontSize,
              letterSpacing: '-0.04em',
              color: textColor,
              display: 'inline-block'
            }}
          >
            havan
          </span>
          {showDevanagari && (
            <span
              className="hin"
              style={{
                fontFamily: "'Mukta', sans-serif",
                fontWeight: 500,
                fontSize: currentSize.hinSize,
                color: brassColor,
                marginLeft: '0.16em',
                letterSpacing: '0em',
                verticalAlign: 'baseline'
              }}
            >
              हवन
            </span>
          )}
        </div>
        {showTagline && (
          <span
            style={{
              fontFamily: "'Mukta', sans-serif",
              fontSize: '0.62rem',
              fontWeight: 400,
              letterSpacing: '0.06em',
              color: 'rgba(230, 213, 174, 0.65)',
              marginTop: '2px',
              textTransform: 'uppercase'
            }}
          >
            Bombay Deco Refracted
          </span>
        )}
      </div>
    </div>
  );
}
