// src/games/chameleon/components/GameExtras.jsx
// Supplemental game UI rendered below the role card during a Chameleon round.
// Shows the 4×4 word grid; highlights the secret tile once the player has
// revealed their role (roleRevealed=true).
import React from 'react';
import { GlassCard } from '../../../components/shared/GlassCard';
import { WordGrid }  from '../../../components/shared/WordGrid';

/**
 * @param {{ assignment: object, state: object, roleRevealed: boolean, module: object }} props
 */
export function ChameleonGameExtras({ assignment, state, roleRevealed, module }) {
  if (!assignment?.wordGrid) return null;

  return (
    <GlassCard className="p-4 flex flex-col gap-2">
      {assignment.category && (
        <p className="text-xs uppercase tracking-widest text-zinc-400 text-center mb-1">
          {assignment.category}
        </p>
      )}
      <WordGrid
        words={assignment.wordGrid}
        seed={state.startingSeed ?? state.seed}
        secretWord={roleRevealed ? assignment.word : undefined}
        roleColor={module.constants.ROLE_COLORS?.[assignment.role]}
      />
    </GlassCard>
  );
}
