// src/engine/useLongPress.js — Reusable hold-to-reveal interaction hook.
//
// Encapsulates the "hold HOLD_MS to reveal, tap to conceal" state machine
// that is shared by RevealShield, WordReveal, and SpectrumReveal. Abstracting
// the logic here eliminates the repeated timer-management code that previously
// appeared in each component.
import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useLongPress
 *
 * Manages the four-phase reveal cycle: hidden → holding → revealed → concealing.
 * Returns stable event handlers that can be spread directly onto a DOM element.
 *
 * @param {object}   [opts]
 * @param {number}   [opts.holdMs=800]  Duration in ms the user must hold before
 *                                      the component transitions to 'revealed'.
 * @param {boolean}  [opts.disabled]    When true, all pointer events are ignored.
 * @param {Function} [opts.onReveal]    Called once when state reaches 'revealed'.
 * @param {Function} [opts.onConceal]   Called once when state returns to 'hidden'.
 *
 * @returns {{
 *   phase:      'hidden' | 'holding' | 'revealed' | 'concealing',
 *   progress:   number,   // 0–100, increases while holding
 *   pct:        number,   // progress / 100  (convenient for CSS transforms)
 *   isRevealed: boolean,  // true while 'revealed' or 'concealing'
 *   handlers: {
 *     onPointerDown:   () => void,
 *     onPointerUp:     () => void,
 *     onPointerLeave:  () => void,
 *     onPointerCancel: () => void,
 *   }
 * }}
 */
export function useLongPress({ holdMs = 800, disabled = false, onReveal, onConceal } = {}) {
  const [phase,    setPhase]    = useState('hidden');
  const [progress, setProgress] = useState(0);

  const holdTimerRef    = useRef(null);
  const concealTimerRef = useRef(null);
  // Stable mirror of phase — safe to read inside interval/timeout callbacks
  const phaseRef        = useRef('hidden');

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Fire lifecycle callbacks when the phase changes
  useEffect(() => {
    if (phase === 'revealed') onReveal?.();
    else if (phase === 'hidden') onConceal?.();
  // onReveal / onConceal are intentionally excluded from the dep array so that
  // inline arrow functions passed as props don't retrigger on every parent render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Cleanup on unmount to prevent state updates on an unmounted component
  useEffect(() => () => {
    clearInterval(holdTimerRef.current);
    clearTimeout(concealTimerRef.current);
  }, []);

  const onPointerDown = useCallback(() => {
    if (disabled) return;
    const p = phaseRef.current;

    if (p === 'revealed') {
      // Tap while revealed → begin concealing
      clearTimeout(concealTimerRef.current);
      setPhase('concealing');
      setProgress(0);
      concealTimerRef.current = setTimeout(() => setPhase('hidden'), 400);
      return;
    }
    if (p !== 'hidden') return;

    // Begin hold from hidden state
    setPhase('holding');
    const start = Date.now();
    holdTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      if (elapsed >= holdMs) {
        clearInterval(holdTimerRef.current);
        setProgress(100);
        setPhase('revealed');
      } else {
        setProgress((elapsed / holdMs) * 100);
      }
    }, 16);
  }, [disabled, holdMs]);

  const onPointerUp = useCallback(() => {
    // Releasing before the hold threshold cancels the animation
    if (phaseRef.current !== 'holding') return;
    clearInterval(holdTimerRef.current);
    setProgress(0);
    setPhase('hidden');
  }, []);

  return {
    phase,
    progress,
    pct: progress / 100,
    isRevealed: phase === 'revealed' || phase === 'concealing',
    handlers: {
      onPointerDown,
      onPointerUp,
      onPointerLeave:  onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}
