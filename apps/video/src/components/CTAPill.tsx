import React from 'react';
import { brand } from '../lib/brand';

export const CTAPill: React.FC<{
  text: string;
  fontSize?: number;
}> = ({ text, fontSize = 24 }) => {
  return (
    <div
      style={{
        display: 'inline-block',
        fontFamily: brand.fontMono,
        fontWeight: 500,
        fontSize,
        color: brand.green,
        border: `1.5px solid ${brand.green}`,
        borderRadius: brand.xxl,
        padding: `${brand.sm}px ${brand.lg}px`,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {text}
    </div>
  );
};
