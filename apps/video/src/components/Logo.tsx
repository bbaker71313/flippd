import React from 'react';
import { brand } from '../lib/brand';

export const ScanMark: React.FC<{ size?: number; dark?: boolean }> = ({
  size = 40,
  dark = true,
}) => {
  const ringColor = dark ? brand.accent : brand.accentDim;
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" fill="none">
      <circle cx="64" cy="64" r="56" stroke={ringColor} strokeWidth={2.5} />
      <circle cx="64" cy="64" r="40" stroke={brand.green} strokeWidth={2.5} strokeDasharray="2.5 5" />
      <circle cx="64" cy="64" r="24" stroke={ringColor} strokeWidth={2} />
      <line x1="24" y1="64" x2="104" y2="64" stroke={brand.green} strokeWidth={2.5} />
      <line x1="64" y1="24" x2="64" y2="104" stroke={brand.green} strokeWidth={2.5} />
      <circle cx="64" cy="64" r="4" fill={brand.green} />
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
