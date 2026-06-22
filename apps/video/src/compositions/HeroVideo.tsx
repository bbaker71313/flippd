import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
  Easing,
} from 'remotion';
import { brand } from '../lib/brand';
import { Logo } from '../components/Logo';
import { PhoneFrame } from '../components/PhoneFrame';
import { FlipBadge } from '../components/FlipBadge';
import { ProfitCounter } from '../components/ProfitCounter';
import { CTAPill } from '../components/CTAPill';
import '../lib/fonts';

// Scene 1: 0-90 — logo intro
const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 45], [0.8, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const opacity = interpolate(frame, [0, 45], [0, 1], {
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
      <div style={{ transform: `scale(${scale})`, opacity }}>
        <Logo size={80} color={brand.bg} />
      </div>
    </AbsoluteFill>
  );
};

// Scene 2: 90-240 — hook text
const Scene2: React.FC = () => {
  const frame = useCurrentFrame();
  const translateY = interpolate(frame, [0, 30], [20, 0], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const opacity = interpolate(frame, [0, 30], [0, 1], {
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
      <div
        style={{
          transform: `translateY(${translateY}px)`,
          opacity,
          fontFamily: brand.fontMono,
          fontWeight: 400,
          fontSize: 36,
          color: brand.bg,
          textAlign: 'center',
          maxWidth: 1000,
        }}
      >
        Standing in Goodwill with $40 in your pocket.
      </div>
    </AbsoluteFill>
  );
};

// Scene 3: 240-600 — phone frame with footage (shelf scan HOT result)
const Scene3: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: brand.header,
        justifyContent: 'center',
        alignItems: 'center',
        background: `radial-gradient(circle at center, #2e2410 0%, ${brand.header} 70%)`,
      }}
    >
      <PhoneFrame
        src="footage/screen-20260614-140913.mp4"
        startFrom={28 * 30}
        width={390}
        height={844}
      />
    </AbsoluteFill>
  );
};

// Scene 4: 600-750 — FLIP badge + profit counter
const Scene4: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: brand.green,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        gap: brand.xl,
      }}
    >
      <FlipBadge label="FLIP" fontSize={180} startFrame={0} />
      <ProfitCounter
        from={0}
        to={67}
        startFrame={20}
        durationInFrames={90}
        fontSize={48}
        color="#ffffff"
      />
    </AbsoluteFill>
  );
};

// Scene 5: 750-900 — outro
const Scene5: React.FC = () => {
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

export const HeroVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: brand.header }}>
      <Sequence from={0} durationInFrames={90}>
        <Scene1 />
      </Sequence>
      <Sequence from={90} durationInFrames={150}>
        <Scene2 />
      </Sequence>
      <Sequence from={240} durationInFrames={360}>
        <Scene3 />
      </Sequence>
      <Sequence from={600} durationInFrames={150}>
        <Scene4 />
      </Sequence>
      <Sequence from={750} durationInFrames={150}>
        <Scene5 />
      </Sequence>
    </AbsoluteFill>
  );
};
