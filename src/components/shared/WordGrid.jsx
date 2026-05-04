// src/components/shared/WordGrid.jsx
// 4×4 word grid used by Chameleon across Lobby, PreGame, and GamePlay screens.
//
// Props:
//   words      — raw 16-element array (unshuffled)
//   seed       — optional string; when supplied the display order is shuffled
//                deterministically so every device shows the same layout
//   secretWord — optional string; that tile is highlighted with roleColor
//   roleColor  — hex/css color used for the highlighted tile background
import React, { useMemo }                  from 'react';
import { createPRNG, deterministicShuffle } from '../../engine/prng';

export function WordGrid({ words = [], seed, secretWord, roleColor }) {
  const display = useMemo(() => {
    if (!seed) return words;
    const prng = createPRNG(seed + '_BOARD');
    return deterministicShuffle(words, prng);
  }, [words, seed]);

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {display.map((w) => {
        const isSecret = secretWord && w === secretWord;
        return (
          <div
            key={w}
            className={`rounded-lg px-1 py-2 text-center text-[10px] font-bold leading-tight transition-all
              flex items-center justify-center min-h-[50px] ${
              isSecret
                ? 'text-white'
                : 'bg-zinc-800/60 text-zinc-400 border border-white/5'
            }`}
            style={isSecret ? { backgroundColor: roleColor } : undefined}
          >
            {w}
          </div>
        );
      })}
    </div>
  );
}
