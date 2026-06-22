import React from 'react';
import { interpolate, useCurrentFrame, Easing } from 'remotion';
import { brand } from '../lib/brand';

export const ProfitCounter: React.FC<{
  from: number;
  to: number;
  startFrame?: number;
  durationInFrames?: number;
  fontSize?: number;
  color?: string;
  label?: string;
}> = ({
  from,
  to,
  startFrame = 0,
  durationInFrames = 90,
  fontSize = 48,
  color = '#ffffff',
  label = 'EST. PROFIT',
}) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;

  const value = interpolate(
    local,
    [0, durationInFrames],
    [from, to],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    },
  );

  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          fontFamily: brand.fontMono,
          fontWeight: 500,
          fontSize: fontSize * 0.3,
          color,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: brand.sm,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: brand.fontMono,
          fontWeight: 500,
          fontSize,
          color,
        }}
      >
        ${Math.round(value)}
      </div>
    </div>
  );
};
