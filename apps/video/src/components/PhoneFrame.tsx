import React from 'react';
import { OffthreadVideo, staticFile } from 'remotion';

export const PhoneFrame: React.FC<{
  src: string;
  width?: number;
  height?: number;
  startFrom?: number;
  muted?: boolean;
}> = ({ src, width = 390, height = 844, startFrom = 0, muted = true }) => {
  const radius = 40;
  const bezel = 12;

  return (
    <div
      style={{
        width: width + bezel * 2,
        height: height + bezel * 2,
        backgroundColor: '#ffffff',
        borderRadius: radius + bezel,
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        padding: bezel,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width,
          height,
          borderRadius: radius,
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: '#000000',
        }}
      >
        <OffthreadVideo
          src={staticFile(src)}
          startFrom={startFrom}
          muted={muted}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </div>
    </div>
  );
};
