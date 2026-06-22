import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
  Easing,
} from 'remotion';
import { brand } from '../lib/brand';
import { PhoneFrame } from '../components/PhoneFrame';
import { CTAPill } from '../components/CTAPill';
import '../lib/fonts';

// Scene 1: 0-150 — hook (must land before skip button)
const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const subOpacity = interpolate(frame, [60, 75], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: brand.header,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        gap: brand.lg,
      }}
    >
      <div
        style={{
          opacity,
          fontFamily: brand.fontDisplay,
          fontWeight: 800,
          fontSize: 96,
          color: brand.bg,
          textAlign: 'center',
          maxWidth: 1400,
        }}
      >
        Stop <span style={{ color: brand.green }}>guessing</span> at thrift
        stores.
      </div>
      <div
        style={{
          opacity: subOpacity,
          fontFamily: brand.fontMono,
          fontWeight: 400,
          fontSize: 36,
          color: brand.textMuted,
        }}
      >
        There's a better way.
      </div>
    </AbsoluteFill>
  );
};

const ProfitLine: React.FC<{
  label: string;
  value: string;
  color: string;
  delay: number;
}> = ({ label, value, color, delay }) => {
  const frame = useCurrentFrame();
  const local = frame - delay;
  const translateY = interpolate(local, [0, 15], [40, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const opacity = interpolate(local, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        transform: `translateY(${translateY}px)`,
        opacity,
        fontFamily: brand.fontMono,
        fontWeight: 500,
        fontSize: 32,
        textTransform: 'uppercase',
        color,
        display: 'flex',
        justifyContent: 'space-between',
        width: 340,
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
};

// Scene 2: 150-360 — phone frame + profit math overlay
const Demo: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: brand.header,
        background: `radial-gradient(circle at center, #2e2410 0%, ${brand.header} 70%)`,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: brand.xxl * 2,
      }}
    >
      <PhoneFrame
        src="footage/screen-20260614-140913.mp4"
        startFrom={28 * 30}
        width={390}
        height={844}
      />
      <Sequence from={90}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: brand.md,
          }}
        >
          <ProfitLine label="COST" value="$8" color="#ffffff" delay={0} />
          <ProfitLine label="SELL" value="$79" color="#ffffff" delay={8} />
          <ProfitLine
            label="PROFIT"
            value="$67"
            color={brand.green}
            delay={16}
          />
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};

// Scene 3: 360-450 — outro
const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [30, 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: brand.header,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        gap: brand.lg,
      }}
    >
      <div
        style={{
          opacity,
          fontFamily: brand.fontDisplay,
          fontWeight: 700,
          fontSize: 64,
          color: brand.bg,
        }}
      >
        ScanForProfit
      </div>
      <div style={{ opacity }}>
        <CTAPill text="scanforprofit.com — Start Free" fontSize={24} />
      </div>
    </AbsoluteFill>
  );
};

export const YouTubePreroll: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: brand.header }}>
      <Sequence from={0} durationInFrames={150}>
        <Hook />
      </Sequence>
      <Sequence from={150} durationInFrames={210}>
        <Demo />
      </Sequence>
      <Sequence from={360} durationInFrames={90}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
