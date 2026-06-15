import React from 'react';
import { brand } from '../lib/brand';

export const ScanMark: React.FC<{ size?: number; dark?: boolean }> = ({
  size = 40,
  dark = true,
}) => {
  const bracketColor = dark ? brand.accent : brand.accentDim;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path
        d="M3 13 V3 H13"
        stroke={bracketColor}
        strokeWidth={2.5}
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <path
        d="M19 29 H29 V19"
        stroke={bracketColor}
        strokeWidth={2.5}
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <rect x="6" y="21" width="4" height="6" fill={brand.green} />
      <rect x="12" y="16" width="4" height="11" fill={brand.green} />
      <rect x="18" y="11" width="4" height="16" fill={brand.green} />
    </svg>
  );
};

export const Logo: React.FC<{
  size?: number;
  color?: string;
  dark?: boolean;
}> = ({ size = 40, color = brand.bg, dark = true }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: size * 0.3,
      }}
    >
      <ScanMark size={size} dark={dark} />
      <div
        style={{
          fontFamily: brand.fontDisplay,
          fontSize: size * 0.85,
          letterSpacing: '0.12em',
          color,
        }}
      >
        <span style={{ fontWeight: 700 }}>SCAN</span>
        <span style={{ fontWeight: 400 }}>FORPROFIT</span>
      </div>
    </div>
  );
};
