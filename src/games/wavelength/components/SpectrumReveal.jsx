// src/games/wavelength/components/SpectrumReveal.jsx
// Hold-to-reveal panel showing the 10-box spectrum and secret number (Psychics only).
// Guessers see the spectrum with interactive boxes to select and hold-to-submit a guess.
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useLongPress } from '../../../engine/useLongPress';
import { WAVELENGTH_COLORS, WAVELENGTH_ROLE_COLORS } from '../constants';

const HOLD_MS       = 800;
const TAP_THRESHOLD = 250; // ms — quicker than this counts as a tap, longer is a hold attempt

/**
 * @param {{ spectrum: [string, string], secretNumber: number|null, revealNumber?: number|null }} props
 *   spectrum     — two-element array of opposing concept labels, e.g. ['Hot', 'Cold']
 *   secretNumber — 1-10; null for the Guesser (no number to reveal)
 *   revealNumber — 1-10; always provided for Guesser, shown as the correct answer after submission
 */
export function SpectrumReveal({ spectrum, secretNumber, revealNumber = null }) {
  const hasNumber = secretNumber != null;

  // ── Psychic path: hold-to-reveal (unchanged) ──────────────────────
  const { phase, pct, isRevealed, handlers } = useLongPress({ disabled: !hasNumber });

  // ── Guesser path: tap-to-select + hold-to-submit ──────────────────
  const [guessedNumber, setGuessedNumber] = useState(null);
  const [submitted,     setSubmitted]     = useState(false);
  const [holdPct,       setHoldPct]       = useState(0);   // 0–1, drives fill animation

  // Stable refs — safe to read inside interval/timeout callbacks
  const guessedNumberRef = useRef(null);
  const submittedRef     = useRef(false);
  const holdIntervalRef  = useRef(null); // non-null ↔ hold in progress
  const pressStartRef    = useRef(0);
  const pressedBoxRef    = useRef(null); // box number (1-10) that received the pointerdown, or null

  useEffect(() => { guessedNumberRef.current = guessedNumber; }, [guessedNumber]);
  useEffect(() => { submittedRef.current = submitted; }, [submitted]);
  useEffect(() => () => clearInterval(holdIntervalRef.current), []);

  const cancelHold = useCallback(() => {
    clearInterval(holdIntervalRef.current);
    holdIntervalRef.current = null;
    setHoldPct(0);
  }, []);

  // Card-level pointerDown — detects which box (if any) was pressed and starts hold if applicable
  const onCardPointerDown = useCallback((e) => {
    if (hasNumber || submittedRef.current) return;
    const boxEl = e.target.closest('[data-box]');
    pressedBoxRef.current = boxEl ? parseInt(boxEl.dataset.box, 10) : null;
    pressStartRef.current = Date.now();

    // Hold-to-submit only available once a guess is selected
    if (guessedNumberRef.current === null) return;

    const start = Date.now();
    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      if (elapsed >= HOLD_MS) {
        clearInterval(holdIntervalRef.current);
        holdIntervalRef.current = null;
        setHoldPct(1);
        submittedRef.current = true; // block further pointer events immediately
        // Brief 100% flash before locking in results
        setTimeout(() => {
          setHoldPct(0);
          setSubmitted(true);
        }, 200);
      } else {
        setHoldPct(elapsed / HOLD_MS);
      }
    }, 16);
  }, [hasNumber]);

  // Card-level pointerUp — decides whether to treat the press as a tap (select box) or cancelled hold
  const onCardPointerUp = useCallback(() => {
    if (hasNumber || submittedRef.current) return;
    const wasHolding = holdIntervalRef.current !== null;
    cancelHold();
    const elapsed    = Date.now() - pressStartRef.current;
    const pressedBox = pressedBoxRef.current;

    // Count as a box tap when: a box was actually pressed AND (hold never started OR press was quick)
    if (pressedBox !== null && (!wasHolding || elapsed < TAP_THRESHOLD)) {
      setGuessedNumber(pressedBox);
    }
  }, [hasNumber, cancelHold]);

  const onCardPointerCancel = useCallback(() => cancelHold(), [cancelHold]);

  // ── Layout data ───────────────────────────────────────────────────
  const [leftLabel, rightLabel] = spectrum ?? ['', ''];

  // ── Hint text ─────────────────────────────────────────────────────
  let hintText;
  if (hasNumber) {
    hintText = isRevealed ? 'tap to conceal' : 'hold to reveal';
  } else if (submitted) {
    hintText = '\u00A0';
  } else if (guessedNumber !== null) {
    hintText = 'hold to submit';
  } else {
    hintText = 'select your guess';
  }

  // ── Box styles ────────────────────────────────────────────────────
  const BASE_BOX = { border: '1px solid rgba(255,255,255,0.05)' };
  const DIM_BOX  = { ...BASE_BOX, backgroundColor: 'rgba(39,39,42,0.7)', color: 'rgba(161,161,170,0.6)' };

  const { accent, correct, wrong } = WAVELENGTH_COLORS;
  const guesserColor = WAVELENGTH_ROLE_COLORS.guesser; // '#7c3aed'

  const getBoxStyle = (num) => {
    if (hasNumber) {
      const isTarget = isRevealed && secretNumber === num;
      return isTarget
        ? { ...BASE_BOX, backgroundColor: accent,   color: '#1c1917', boxShadow: `0 0 12px ${accent}99` }
        : DIM_BOX;
    }
    // Guesser post-submission: always show correct answer, wrong guess in error color
    if (submitted) {
      if (num === revealNumber) {
        return { ...BASE_BOX, backgroundColor: correct,      color: '#fff', boxShadow: `0 0 12px ${correct}99` };
      }
      if (num === guessedNumber) {
        return { ...BASE_BOX, backgroundColor: wrong,        color: '#fff', boxShadow: `0 0 12px ${wrong}99` };
      }
    } else if (num === guessedNumber) {
      return { ...BASE_BOX, backgroundColor: guesserColor, color: '#fff', boxShadow: `0 0 8px ${guesserColor}80` };
    }
    return DIM_BOX;
  };

  // ── Fill animation ────────────────────────────────────────────────
  const fillPct  = hasNumber ? pct       : holdPct;
  const showFill = hasNumber ? phase === 'holding' : holdPct > 0;

  return (
    <div
      className="relative rounded-2xl border bg-black/20 p-4 flex flex-col gap-3 select-none overflow-hidden"
      style={{
        touchAction: 'none',
        borderColor: isRevealed ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.08)',
        transition:  'border-color 0.3s ease, transform 0.15s ease',
        cursor:      hasNumber ? 'pointer' : (guessedNumber !== null ? 'pointer' : 'default'),
      }}
      {...(hasNumber ? handlers : {
        onPointerDown:   onCardPointerDown,
        onPointerUp:     onCardPointerUp,
        onPointerLeave:  onCardPointerCancel,
        onPointerCancel: onCardPointerCancel,
      })}
    >
      {/* Hold-progress fill */}
      <div
        className="absolute inset-0 bg-white/[0.04] origin-left pointer-events-none"
        style={{
          transform:  `scaleX(${showFill ? fillPct : 0})`,
          opacity:    showFill ? 1 : 0,
          transition: 'opacity 0.2s ease',
        }}
      />

      {/* Spectrum end-labels */}
      <div className="relative flex justify-between items-center px-0.5">
        <span className="text-[11px] font-bold text-zinc-300 max-w-[42%] text-left leading-tight">
          {leftLabel.toUpperCase()}
        </span>
        <span className="text-[11px] font-bold text-zinc-300 max-w-[42%] text-right leading-tight">
          {rightLabel.toUpperCase()}
        </span>
      </div>

      {/* 10-box spectrum row */}
      <div className="relative flex gap-1">
        {Array.from({ length: 10 }, (_, i) => {
          const num = i + 1;
          return (
            <div
              key={num}
              data-box={num}
              className="relative flex-1 h-11 rounded-md flex items-center justify-center text-xs font-bold transition-all duration-200"
              style={getBoxStyle(num)}
            >
              {num}
            </div>
          );
        })}
      </div>

      {/* Hint text */}
      <p className="relative text-xs text-zinc-600 text-center">
        {hintText}
      </p>
    </div>
  );
}
