// src/games/wavelength/components/GameExtras.jsx
// Supplemental game UI rendered below the role card during a Wavelength round.
// Psychics hold to reveal their secret number on the spectrum; Guessers see
// the spectrum labels without a number.
import React from 'react';
import { GlassCard } from '../../../components/shared/GlassCard';
import { SpectrumReveal } from './SpectrumReveal';
import { WAVELENGTH_ROLES, WAVELENGTH_ROLE_COLORS } from '../constants';
import { Badge } from '../../../components/shared/Badge';

/**
 * @param {{ assignment: object }} props
 *   assignment.spectrum     — ['Left label', 'Right label']
 *   assignment.secretNumber — 1-10 (Psychics) or null (Guesser)
 *   assignment.revealNumber — 1-10; when provided, shows correct/wrong coloring for Guesser
 *   assignment.guesserName  — name of the current Guesser
 */
export function WavelengthGameExtras({ assignment }) {
  if (!assignment?.spectrum) return null;

  const isGuesser    = assignment.role === WAVELENGTH_ROLES.GUESSER;
  const guesserColor = WAVELENGTH_ROLE_COLORS.guesser;
  const guesserLabel = "Guesser";

  return (
    <>
      {!isGuesser && assignment.guesserName && (
        <GlassCard
          className="p-5 flex flex-col gap-4"
          style={{ borderColor: guesserColor + '44', background: guesserColor + '12' }}
        >
          <div className="flex items-center justify-start gap-2">
            <span className="text-white text-xs uppercase font-semibold">{assignment.guesserName}</span>
            <span className="text-zinc-400 text-xs uppercase tracking-widest">is the</span>
            <Badge label={guesserLabel} color={guesserColor} />
          </div>
        </GlassCard>
      )}
      <SpectrumReveal
        spectrum={assignment.spectrum}
        secretNumber={assignment.secretNumber}
        revealNumber={assignment.revealNumber ?? null}
      />
    </>
  );
}
