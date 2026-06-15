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
import { Logo } from '../components/Logo';
import { CTAPill } from '../components/CTAPill';
import '../lib/fonts';

// screen-20260614-141341.mp4 is ~389 frames at 30fps
const SHELF_CLIP_FRAMES = 389;

// 0-1s — logo fast fade in/out
const LogoFlash: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 8, 22, 30], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: brand.header,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div style={{ opacity }}>
        <Logo size={64} color={brand.bg} />
      </div>
    </AbsoluteFill>
  );
};

// 1-4s — shelf footage full bleed, no overlay
const ShelfFootage: React.FC = () => (
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

// 4-6s — FLIP $67 full screen
const FlipReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 15, 25], [0, 1.2, 1.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const opacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: brand.green,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          opacity,
          fontFamily: brand.fontDisplay,
          fontWeight: 800,
          fontSize: 140,
          color: '#ffffff',
          textTransform: 'uppercase',
          textAlign: 'center',
        }}
      >
        FLIP $67
      </div>
    </AbsoluteFill>
  );
};

// 6-8s — outro
const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], {
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
          fontSize: 48,
          color: brand.bg,
        }}
      >
        scanforprofit.com
      </div>
      <div style={{ opacity }}>
        <CTAPill text="Start Free →" fontSize={24} />
      </div>
    </AbsoluteFill>
  );
};

export const StoryAd: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: brand.header }}>
      <Sequence from={0} durationInFrames={30}>
        <LogoFlash />
      </Sequence>
      <Sequence from={30} durationInFrames={90}>
        <ShelfFootage />
      </Sequence>
      <Sequence from={120} durationInFrames={60}>
        <FlipReveal />
      </Sequence>
      <Sequence from={180} durationInFrames={60}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
