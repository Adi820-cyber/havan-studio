import React from 'react';

/**
 * BrandLogo — displays just the H1 flame logo artwork, no text.
 */
export default function BrandLogo({
  size = 'md', // 'sm' | 'md' | 'lg' | 'xl' | 'hero'
  onClick,
  style = {}
}) {
  const sizeMap = {
    sm: 44,
    md: 54,
    lg: 76,
    xl: 120,
    hero: 180
  };

  const logoSize = sizeMap[size] || sizeMap.md;

  return (
    <div
      className="havan-brand-logo"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'inherit',
        textDecoration: 'none',
        userSelect: 'none',
        ...style
      }}
    >
      <img
        src="/h1_logo.png"
        alt="Logo"
        draggable="false"
        style={{
          display: 'block',
          width: logoSize,
          height: logoSize,
          objectFit: 'contain',
          flexShrink: 0
        }}
      />
    </div>
  );
}
