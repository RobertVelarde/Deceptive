// src/components/shared/RevealShield.jsx
// Hold 800 ms to reveal private information.
// Tap the revealed card to re-conceal — protects against nearby eyes.
import React, { useState, useEffect, useCallback, useRef } from 'react';

export function RevealShield({ children, label = 'Hold to Reveal', onReveal, onConceal }) {
  const HOLD_MS = 800;

  // phase: 'hidden' | 'holding' | 'revealed' | 'concealing'
  const [phase,    setPhase]    = useState('hidden');
  const [progress, setProgress] = useState(0);

  const holdTimerRef    = useRef(null);
  const concealTimerRef = useRef(null);
  const phaseRef        = useRef('hidden');

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    if (phase === 'revealed') onReveal?.();
    else if (phase === 'hidden') onConceal?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => () => {
    clearInterval(holdTimerRef.current);
    clearTimeout(concealTimerRef.current);
  }, []);

  const onPressStart = useCallback(() => {
    const p = phaseRef.current;

    if (p === 'revealed') {
      clearTimeout(concealTimerRef.current);
      setPhase('concealing');
      setProgress(0);
      concealTimerRef.current = setTimeout(() => setPhase('hidden'), 400);
      return;
    }
    if (p !== 'hidden') return;

    setPhase('holding');
    const start = Date.now();
    holdTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      if (elapsed >= HOLD_MS) {
        clearInterval(holdTimerRef.current);
        setProgress(100);
        setPhase('revealed');
      } else {
        setProgress((elapsed / HOLD_MS) * 100);
      }
    }, 16);
  }, []);

  const onPressEnd = useCallback(() => {
    if (phaseRef.current !== 'holding') return;
    clearInterval(holdTimerRef.current);
    setProgress(0);
    setPhase('hidden');
  }, []);

  const pct        = progress / 100;
  const isRevealed = phase === 'revealed' || phase === 'concealing';

  return (
    <div
      className="relative rounded-2xl overflow-hidden cursor-pointer select-none"
      style={{
        touchAction: 'none',
        transition:  'transform 0.15s ease',
      }}
      onPointerDown={onPressStart}
      onPointerUp={onPressEnd}
      onPointerLeave={onPressEnd}
      onPointerCancel={onPressEnd}
    >
      {/* Content — always rendered to preserve natural height */}
      <div style={{ opacity: isRevealed ? 1 : 0, transition: 'opacity 0.3s ease' }}>
        {children}
      </div>

      {/* Shield overlay — fades out on reveal */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden"
        style={{
          opacity:    isRevealed ? 0 : 1,
          transition: 'opacity 0.3s ease',
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
