// src/components/shared/GlassCard.jsx
import React from 'react';

export function GlassCard({ children, className = '', style }) {
  return (
    <div
      className={`rounded-3xl border border-white/10 backdrop-blur-md bg-white/5 shadow-2xl ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
