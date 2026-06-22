import React from 'react';
import { interpolate, useCurrentFrame, Easing } from 'remotion';
import { brand } from '../lib/brand';

const LABEL_COLORS: Record<string, string> = {
  FLIP: '#ffffff',
  HOT: '#ffffff',
  PASS: '#ffffff',
};

const LABEL_BG: Record<string, string> = {
  FLIP: brand.green,
  HOT: brand.red,
  PASS: brand.textMuted,
};

export const FlipBadge: React.FC<{
  label: 'FLIP' | 'HOT' | 'PASS';
  fontSize?: number;
  startFrame?: number;
}> = ({ label, fontSize = 180, startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;

  // scale 0 -> 1.2 -> 1.0 over 20 frames
  const scale = interpolate(
    local,
    [0, 12, 20],
    [0, 1.2, 1.0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    },
  );

  const opacity = interpolate(local, [0, 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        opacity,
        fontFamily: brand.fontDisplay,
        fontWeight: 800,
        fontSize,
        color: LABEL_COLORS[label],
        textTransform: 'uppercase',
        letterSpacing: '0.02em',
        padding: `0 ${brand.xl}px`,
        borderRadius: brand.lg,
        backgroundColor:
          label === 'FLIP' ? 'transparent' : LABEL_BG[label],
      }}
    >
      {label}
    </div>
  );
};
