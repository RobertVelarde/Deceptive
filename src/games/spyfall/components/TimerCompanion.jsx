// src/games/spyfall/components/TimerCompanion.jsx
// Horizontally-scrollable speaking order chip strip rendered below the round timer.
// On mount the strip scrolls to horizontally centre the current player's chip.
import React, { useEffect, useRef } from 'react';
import { GlassCard } from '../../../components/shared/GlassCard';
import {
  createPRNG,
  deterministicShuffle,
  seedToInt,
  intToSeed,
  SEED_MAX,
} from '../../../engine/prng';

// Offset mirrors SpeakingOrderCard so the order is independent of the
// game-assignment shuffle (avoids leaking spy position).
const SPEAKING_OFFSET = 839808; // Math.floor(SEED_MAX / 2)

function getSpeakingOrder(players, seed) {
  const n = (seedToInt(seed) + SPEAKING_OFFSET) % SEED_MAX;
  return deterministicShuffle([...players], createPRNG(intToSeed(n)));
}

function ordinal(n) {
  const v = n % 100;
  const s = (v === 11 || v === 12 || v === 13) ? 'th'
    : n % 10 === 1 ? 'st'
    : n % 10 === 2 ? 'nd'
    : n % 10 === 3 ? 'rd'
    : 'th';
  return `${n}${s}`;
}

/**
 * @param {{ assignment: object, state: object, module: object }} props
 */
export function SpyfallTimerCompanion({ assignment, state, module: mod }) {
  const { players, seed } = state;
  const myId        = assignment?.playerId;
  const accentColor = mod.constants.COLORS?.primary ?? '#F59E0B';

  const order   = getSpeakingOrder(players, seed);
  const myRef   = useRef(null);
  const listRef = useRef(null);

  // Scroll so the current player's chip is horizontally centred on mount.
  // Uses getBoundingClientRect (same as the gamemode strip in LobbyScreen) so
  // the measurement is accurate after the first paint.
  useEffect(() => {
    const chip = myRef.current;
    const list = listRef.current;
    if (!chip || !list) return;

    requestAnimationFrame(() => {
      const listRect = list.getBoundingClientRect();
      const chipRect = chip.getBoundingClientRect();
      const offset =
        list.scrollLeft +
        chipRect.left -
        listRect.left +
        chipRect.width / 2 -
        list.clientWidth / 2;
      list.scrollTo({ left: offset, behavior: 'instant' });
    });
  }, []);

  return (
    <GlassCard className="p-3 flex flex-col gap-2 overflow-hidden">
      <span className="text-xs uppercase tracking-widest text-zinc-400 shrink-0">Speaking Order</span>

      {/* Horizontal scroll strip — scrollbar hidden on all platforms */}
      <div
        ref={listRef}
        className="flex gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none' }}
      >
        {order.map((player, idx) => {
          const isMe = player.id === myId;
          return (
            <div
              key={player.id}
              ref={isMe ? myRef : null}
              className="flex flex-col items-center shrink-0 px-3 py-2 rounded-xl select-none"
              style={isMe ? {
                background: accentColor + '22',
                border:     `1px solid ${accentColor}66`,
                color:      accentColor,
              } : {
                background: 'rgba(255,255,255,0.04)',
                border:     '1px solid rgba(255,255,255,0.06)',
                color:      '#71717a',
              }}
            >
              <span className="text-[9px] uppercase tracking-widest opacity-60 leading-none mb-1">
                {ordinal(idx + 1)}
              </span>
              <span className="text-xs font-semibold leading-none">{player.name}</span>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

