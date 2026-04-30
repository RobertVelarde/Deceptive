// src/games/chameleon/index.js — Chameleon game module
//
// Rules: all players share a secret word. The Chameleon does NOT know it.
// Everyone gives one clue; players vote to expose the Chameleon.
// If caught, the Chameleon can still win by correctly guessing the word.
//
// Interface contract: identical to InsiderModule — no other files change.
import { createPRNG, deterministicShuffle } from '../../engine/prng';
import { encodeSeed, decodeSeed, encodePlayers, decodePlayers } from '../../engine/gamestate';
import { CHAMELEON_WORD_CATEGORIES } from './words';
import {
  CHAMELEON_COLORS,
  CHAMELEON_ROLES,
  CHAMELEON_ROLE_COLORS,
  CHAMELEON_ROUND_SECONDS,
  CHAMELEON_ROLE_META,
} from './constants';

export const ChameleonModule = {
  name:        'chameleon',
  displayName: 'Chameleon',
  minPlayers:  3,
  maxPlayers:  8,
  categories:  Object.keys(CHAMELEON_WORD_CATEGORIES),

  constants: {
    COLORS:        CHAMELEON_COLORS,
    ROLES:         CHAMELEON_ROLES,
    ROLE_COLORS:   CHAMELEON_ROLE_COLORS,
    ROUND_SECONDS: CHAMELEON_ROUND_SECONDS,
    ROLE_META:     CHAMELEON_ROLE_META,
  },

  // ── Compact binary state encoding (for ?gs= URL param) ────────────

  /**
   * Encode the minimum lobby fields to a compact Uint8Array.
   * Payload layout (bytes):
   *   [0]    round-1 (0-based)
   *   [1-3]  seed as big-endian uint24
   *   [4-6]  startingSeed as big-endian uint24
   *   [7]    categoryIndex (index into CHAMELEON_WORD_CATEGORIES keys)
   *   [8..]  encoded player list (encodePlayers format)
   */
  encodeGameState({ players, seed, round, startingSeed, category }) {
    const categoryNames  = Object.keys(CHAMELEON_WORD_CATEGORIES);
    const catIdx         = Math.max(0, categoryNames.indexOf(category ?? ''));
    const seedBytes      = encodeSeed(seed);
    const startSeedBytes = encodeSeed(startingSeed ?? seed);
    const playerBytes    = encodePlayers(players);
    const buf            = new Uint8Array(8 + playerBytes.length);
    buf[0] = (round - 1) & 0xFF;
    buf[1] = seedBytes[0];
    buf[2] = seedBytes[1];
    buf[3] = seedBytes[2];
    buf[4] = startSeedBytes[0];
    buf[5] = startSeedBytes[1];
    buf[6] = startSeedBytes[2];
    buf[7] = catIdx & 0xFF;
    buf.set(playerBytes, 8);
    return buf;
  },

  /**
   * Reconstruct lobby state fields from the compact payload.
   * New ephemeral IDs are assigned to players (originals were not stored).
   */
  decodeGameState(payload) {
    const round         = (payload[0] & 0xFF) + 1;
    const seed          = decodeSeed(payload[1], payload[2], payload[3]);
    const startingSeed  = decodeSeed(payload[4], payload[5], payload[6]);
    const categoryNames = Object.keys(CHAMELEON_WORD_CATEGORIES);
    const category      = categoryNames[payload[7]] ?? categoryNames[0];
    const { players }   = decodePlayers(payload, 8);
    return { gameType: 'chameleon', seed, startingSeed, round, category, players, status: 'lobby' };
  },

  /**
   * Deterministically assign one Chameleon and the rest as Agents.
   * The Chameleon receives word: null; Agents receive the secret word.
   * Same (players, seedString) always yields the exact same result.
   */
  getSetup(players, seedString, category = '') {
    if (players.length < 3) return null;

    const categoryNames = Object.keys(CHAMELEON_WORD_CATEGORIES);
    const categoryKey   = (category && CHAMELEON_WORD_CATEGORIES[category])
      ? category
      : categoryNames[0];
    const wordGrid      = CHAMELEON_WORD_CATEGORIES[categoryKey];

    const prng     = createPRNG(seedString);
    const wordPrng = createPRNG(seedString + '_W');
    const shuffled = deterministicShuffle(players, prng);
    const word     = wordPrng.nextFrom(wordGrid);

    return shuffled.map((player, i) => {
      const role = i === 0 ? CHAMELEON_ROLES.CHAMELEON : CHAMELEON_ROLES.AGENT;
      return {
        playerId:   player.id,
        playerName: player.name,
        role,
        wordGrid,
        word:  role === CHAMELEON_ROLES.AGENT ? word : null,
        color: CHAMELEON_ROLE_COLORS[role],
      };
    });
  },

  /** Returns a list of { label, value } pairs for the pre-game settings summary. */
  getSettingsSummary(state) {
    const categoryNames = Object.keys(CHAMELEON_WORD_CATEGORIES);
    const cat = state.category || categoryNames[0];
    return [{ label: 'Category', value: cat }];
  },
};
