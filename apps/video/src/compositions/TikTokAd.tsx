import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  Loop,
  OffthreadVideo,
  staticFile,
  interpolate,
  useCurrentFrame,
  Easing,
} from 'remotion';
import { brand } from '../lib/brand';
import { CTAPill } from '../components/CTAPill';
import '../lib/fonts';

// screen-20260614-141341.mp4 is ~389 frames at 30fps
const SHELF_CLIP_FRAMES = 389;

const Background: React.FC = () => (
  <AbsoluteFill>
    <Loop durationInFrames={SHELF_CLIP_FRAMES}>
      <OffthreadVideo
        src={staticFile('footage/screen-20260614-141341.mp4')}
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </Loop>
  </AbsoluteFill>
);

// Scene 1: 0-60 — hook text over footage
const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 20], [1.05, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          transform: `scale(${scale})`,
          opacity,
          fontFamily: brand.fontDisplay,
          fontWeight: 700,
          fontSize: 72,
          color: '#ffffff',
          textShadow: '0 2px 8px rgba(0,0,0,0.8)',
          textAlign: 'center',
          padding: `0 ${brand.xl}px`,
        }}
      >
        POV: $8 thrift find → $67 profit
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
  const translateY = interpolate(local, [0, 15], [60, 0], {
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
        fontSize: 36,
        textTransform: 'uppercase',
        color,
        display: 'flex',
        justifyContent: 'space-between',
        width: 500,
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
};

// Scene 2: 60-360 — phone chrome + profit breakdown
const Breakdown: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* subtle phone chrome overlay */}
      <AbsoluteFill
        style={{
          border: '10px solid rgba(255,255,255,0.08)',
          borderRadius: 24,
          margin: 24,
        }}
      />
      <Sequence from={180}>
        <AbsoluteFill
          style={{
            justifyContent: 'flex-end',
            alignItems: 'center',
            paddingBottom: 220,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: brand.md,
              backgroundColor: 'rgba(58,36,16,0.7)',
              padding: brand.lg,
              borderRadius: brand.md,
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
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

// Scene 3: 360-450 — outro
const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: `rgba(58,36,16,${0.85 * opacity})`,
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
          fontSize: 48,
          color: brand.bg,
        }}
      >
        ScanForProfit
      </div>
      <div style={{ opacity }}>
        <CTAPill text="Free to try →" fontSize={24} />
      </div>
    </AbsoluteFill>
  );
};

export const TikTokAd: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>
      <Background />
      <Sequence from={0} durationInFrames={60}>
        <Hook />
      </Sequence>
      <Sequence from={60} durationInFrames={300}>
        <Breakdown />
      </Sequence>
      <Sequence from={360} durationInFrames={90}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
