import React from 'react';

/**
 * HeroLogo — Standalone H1 flame logo for hero sections.
 */
export default function HeroLogo({ size = 200, animate = true, style = {} }) {
  return (
    <div
      className="hero-logo-wrapper"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        ...style
      }}
    >
      <img
        src="/h1_logo.png"
        alt="H1 Logo"
        draggable="false"
        style={{
          display: 'block',
          width: size,
          height: size,
          objectFit: 'contain',
          filter: animate ? 'drop-shadow(0 8px 32px rgba(255, 183, 77, 0.3))' : 'none',
          animation: animate ? 'float-gentle 4s ease-in-out infinite' : 'none'
        }}
      />

      <style>
        {`
          @keyframes float-gentle {
            0%, 100% {
              transform: translateY(0px);
            }
            50% {
              transform: translateY(-12px);
            }
          }

          .hero-logo-wrapper:hover img {
            filter: drop-shadow(0 12px 48px rgba(255, 183, 77, 0.5));
            transform: scale(1.05);
            transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          }
        `}
      </style>
    </div>
  );
}
