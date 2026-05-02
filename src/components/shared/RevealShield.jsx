// src/components/shared/RevealShield.jsx
// Hold 800 ms to reveal private information.
// Tap the revealed card to re-conceal — protects against nearby eyes.
import React from 'react';
import { useLongPress } from '../../engine/useLongPress';

export function RevealShield({ children, label = 'Hold to Reveal', onReveal, onConceal }) {
  const { phase, pct, isRevealed, handlers } = useLongPress({ onReveal, onConceal });

  return (
    <div
      className="relative rounded-2xl overflow-hidden cursor-pointer select-none"
      style={{ touchAction: 'none', transition: 'transform 0.15s ease' }}
      {...handlers}
    >
      {/* Content — always rendered to preserve natural height */}
      <div style={{ opacity: isRevealed ? 1 : 0, transition: 'opacity 0.3s ease' }}>
        {children}
      </div>

      {/* Shield overlay — fades out on reveal */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden"
        style={{
          opacity:       isRevealed ? 0 : 1,
          transition:    'opacity 0.3s ease',
          pointerEvents: isRevealed ? 'none' : 'auto',
        }}
      >
        {/* Full-card fill sweeps left to right while holding */}
        <div
          className="absolute inset-0 bg-white/[0.04] origin-left"
          style={{ transform: `scaleX(${phase === 'holding' ? pct : 0})` }}
        />
        <span
          className="relative text-xs font-semibold uppercase tracking-widest"
          style={{ color: `rgba(161,161,170,${0.4 + 0.6 * pct})` }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
