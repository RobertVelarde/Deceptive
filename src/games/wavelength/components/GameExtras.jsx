// src/games/wavelength/components/GameExtras.jsx
// Supplemental game UI rendered below the role card during a Wavelength round.
// Psychics hold to reveal their secret number on the spectrum; Guessers see
// the spectrum labels without a number.
import React from 'react';
import { SpectrumReveal } from './SpectrumReveal';

/**
 * @param {{ assignment: object }} props
 *   assignment.spectrum     — ['Left label', 'Right label']
 *   assignment.secretNumber — 1-10 (Psychics) or null (Guesser)
 *   assignment.revealNumber — 1-10; when provided, shows correct/wrong coloring for Guesser
 */
export function WavelengthGameExtras({ assignment }) {
  if (!assignment?.spectrum) return null;

  return (
    <SpectrumReveal
      spectrum={assignment.spectrum}
      secretNumber={assignment.secretNumber}
      revealNumber={assignment.revealNumber ?? null}
    />
  );
}
