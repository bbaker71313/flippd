import React from 'react';
import { Composition } from 'remotion';
import { HeroVideo } from './compositions/HeroVideo';
import { TikTokAd } from './compositions/TikTokAd';
import { SquareAd } from './compositions/SquareAd';
import { YouTubePreroll } from './compositions/YouTubePreroll';
import { StoryAd } from './compositions/StoryAd';

/**
 * Footage inspection (ffprobe), all clips 720x1612 portrait:
 *
 * - screen-20260614-140716.mp4 (48.4s) — camera viewfinder on a Gevalia
 *   coffee maker (thrift shelf context, ~0-2s), then the full FLIP/PASS
 *   scan flow ending in a PASS result with a financial breakdown
 *   (ROI 511%, Net Profit $14.31).
 * - screen-20260614-140913.mp4 (95.7s) — shelf-scan flow ending in a
 *   "Shelf Report" with a HOT badge (ARRIS modem, Est. profit $50.00).
 *   Best real FLIP/HOT scan-result screen — used inside PhoneFrame.
 * - screen-20260614-141341.mp4 (13.0s) — camera viewfinder on Goodwill
 *   teacups with a visible $2.99 Goodwill price tag. Best thrift-shelf
 *   context shot — used for full-bleed background footage.
 */

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="HeroVideo"
        component={HeroVideo}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="TikTokAd"
        component={TikTokAd}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="SquareAd"
        component={SquareAd}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1080}
      />
      <Composition
        id="YouTubePreroll"
        component={YouTubePreroll}
        durationInFrames={450}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="StoryAd"
        component={StoryAd}
        durationInFrames={240}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
