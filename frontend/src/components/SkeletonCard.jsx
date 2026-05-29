import React from 'react';

export default function SkeletonCard({ width = 160, height = 220 }) {
  return (
    <div
      style={{
        width,
        height,
        background: '#282828',
        borderRadius: 8,
        padding: 12,
        animation: 'pulse 1.5s infinite',
      }}
    />
  );
}