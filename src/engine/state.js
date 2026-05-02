// src/engine/state.js — Default state factory & shared runtime utilities
import { ENVELOPE_VERSION } from './envelope';
import { intToSeed, SEED_MAX, generateTimeSeed } from './prng';
export { generatePlayerId } from './gamestate';

/** Produce a blank lobby state with a freshly randomized starting seed. */
export function createDefaultState() {
  const startingSeed = generateTimeSeed();
  return {
    v:            ENVELOPE_VERSION,
    players:      [],
    gameType:     'insider',
    seed:         startingSeed,
    startingSeed,
    round:        1,
    status:       'home', // 'home' | 'lobby' | 'pregame' | 'playing'
    category:     '',
    checksum:     '',
  };
}
