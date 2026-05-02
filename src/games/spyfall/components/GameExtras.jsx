// src/games/spyfall/components/GameExtras.jsx
// Supplemental game UI rendered below the role card during a Spyfall round.
// Shows the full location reference list so all players can interrogate properly.
import React from 'react';

/**
 * @param {{ assignment: object }} props
 *   assignment.locationList — all enabled locations for this round
 */
export function SpyfallGameExtras({ assignment }) {
  if (!assignment?.locationList?.length) return null;

  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">
        Locations
        <span className="ml-1.5 text-zinc-700 normal-case tracking-normal">
          {assignment.locationList.length} in play
        </span>
      </p>
      <div className="grid grid-cols-2 gap-1">
        {assignment.locationList.map((loc) => (
          <div
            key={loc}
            className="px-2.5 py-2 rounded-xl text-xs text-center font-medium text-zinc-400 bg-zinc-800/50 border border-white/[0.04]"
          >
            {loc}
          </div>
        ))}
      </div>
    </div>
  );
}
