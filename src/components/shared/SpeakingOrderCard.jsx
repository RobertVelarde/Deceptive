// src/components/shared/SpeakingOrderCard.jsx
// Deterministic speaking order card — shuffles players from the round seed
// with an offset so the order is independent of the game assignment shuffle
// (which would otherwise expose the Chameleon or Spy position).
import React from 'react';
import { GlassCard } from './GlassCard';
import { createPRNG, deterministicShuffle, seedToInt, intToSeed, SEED_MAX } from '../../engine/prng';

// ── Helpers ───────────────────────────────────────────────────────────────────

function ordinal(n) {
  const v = n % 100;
  const suffix = v === 11 || v === 12 || v === 13 ? 'th'
    : n % 10 === 1 ? 'st'
    : n % 10 === 2 ? 'nd'
    : n % 10 === 3 ? 'rd'
    : 'th';
  return `${n}${suffix}`;
}

// Offset by ~half of SEED_MAX so the shuffle is independent of getSetup's
// player shuffle, which also starts from createPRNG(seed).
const SPEAKING_OFFSET = 839808; // Math.floor(SEED_MAX / 2)

function getSpeakingOrder(players, seed) {
  const n = (seedToInt(seed) + SPEAKING_OFFSET) % SEED_MAX;
  return deterministicShuffle([...players], createPRNG(intToSeed(n)));
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * @param {{
 *   players:     Array<{ id: string, name: string }>,
 *   seed:        string,
 *   myId:        string,
 *   accentColor: string,
 * }} props
 */
export function SpeakingOrderCard({ players, seed, myId, accentColor = '#00695C' }) {
  if (!players?.length || !seed) return null;

  const order = getSpeakingOrder(players, seed);
  const myPos = order.findIndex((p) => p.id === myId) + 1; // 1-based, 0 if not found

  return (
    <GlassCard className="p-4 flex flex-col gap-2">
      <p className="text-xs uppercase tracking-widest text-zinc-400">Speaking Order</p>

      <div className="flex flex-wrap gap-1.5">
        {order.map((player, idx) => {
          const isMe = player.id === myId;
          return (
            <div
              key={player.id}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium select-none"
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
              <span className="opacity-70">{ordinal(idx + 1)}</span>
              <span>{player.name}</span>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
