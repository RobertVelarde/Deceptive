// src/games/chameleon/index.js — Chameleon game module
//
// Rules: all players share a secret word. The Chameleon does NOT know it.
// Everyone gives one clue; players vote to expose the Chameleon.
// If caught, the Chameleon can still win by correctly guessing the word.
//
// Interface contract: identical to InsiderModule — no other files change.
import { createPRNG, deterministicShuffle } from '../../engine/prng';
import { encodeSeed, decodeSeed, encodePlayers, decodePlayers, encodeWordList, decodeWordList } from '../../engine/gamestate';
import { CHAMELEON_WORD_CATEGORIES } from './words';
import { ChameleonGameExtras } from './components/GameExtras';

/** Sentinel value for the custom category. */
export const CHAMELEON_CUSTOM_CATEGORY = '__custom__';
/** Number of words in the board (fixed 4×4). */
const CUSTOM_WORD_COUNT = 16;

/** Alphabetically-sorted list of all non-custom category names. */
export const CHAMELEON_SORTED_CATEGORIES = Object.keys(CHAMELEON_WORD_CATEGORIES).sort();

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

  /** Default game-type-specific state fields for new lobbies. */
  defaultState() {
    return {
      roundSeconds:     120,
      enabledCategories: [...CHAMELEON_SORTED_CATEGORIES],
    };
  },

  /** Called by GamePlayScreen to get the timer duration. */
  getTimerSeconds(state) {
    return state?.roundSeconds ?? CHAMELEON_ROUND_SECONDS;
  },

  /** Word grid and secret-tile highlight rendered below the role card. */
  GameExtras: ChameleonGameExtras,

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
   *   [7-10] uint32 big-endian bitmask of enabled non-custom categories
   *          (bit i = CHAMELEON_SORTED_CATEGORIES[i] is enabled)
   *   [11]   flags: bit 0 = custom category is enabled
   *   [12..] word bytes (only present if custom flag is set), then player bytes
   */
  encodeGameState({ players, seed, round, startingSeed, enabledCategories, customWords }) {
    const enabled      = enabledCategories ?? CHAMELEON_SORTED_CATEGORIES;
    const customOn     = enabled.includes(CHAMELEON_CUSTOM_CATEGORY);
    const seedBytes    = encodeSeed(seed);
    const startSeedBytes = encodeSeed(startingSeed ?? seed);
    const playerBytes  = encodePlayers(players);

    let catMask = 0;
    for (let i = 0; i < CHAMELEON_SORTED_CATEGORIES.length; i++) {
      if (enabled.includes(CHAMELEON_SORTED_CATEGORIES[i])) catMask |= (1 << i);
    }
    catMask = catMask >>> 0; // ensure unsigned

    const flagByte = customOn ? 0x01 : 0x00;

    if (customOn) {
      const words = Array.from({ length: CUSTOM_WORD_COUNT }, (_, i) => customWords?.[i] ?? '');
      const wordBytes = encodeWordList(words);
      const buf = new Uint8Array(12 + wordBytes.length + playerBytes.length);
      buf[0] = (round - 1) & 0xFF;
      buf[1] = seedBytes[0]; buf[2] = seedBytes[1]; buf[3] = seedBytes[2];
      buf[4] = startSeedBytes[0]; buf[5] = startSeedBytes[1]; buf[6] = startSeedBytes[2];
      buf[7]  = (catMask >>> 24) & 0xFF;
      buf[8]  = (catMask >>> 16) & 0xFF;
      buf[9]  = (catMask >>>  8) & 0xFF;
      buf[10] =  catMask         & 0xFF;
      buf[11] = flagByte;
      buf.set(wordBytes, 12);
      buf.set(playerBytes, 12 + wordBytes.length);
      return buf;
    }

    const buf = new Uint8Array(12 + playerBytes.length);
    buf[0] = (round - 1) & 0xFF;
    buf[1] = seedBytes[0]; buf[2] = seedBytes[1]; buf[3] = seedBytes[2];
    buf[4] = startSeedBytes[0]; buf[5] = startSeedBytes[1]; buf[6] = startSeedBytes[2];
    buf[7]  = (catMask >>> 24) & 0xFF;
    buf[8]  = (catMask >>> 16) & 0xFF;
    buf[9]  = (catMask >>>  8) & 0xFF;
    buf[10] =  catMask         & 0xFF;
    buf[11] = flagByte;
    buf.set(playerBytes, 12);
    return buf;
  },

  /**
   * Reconstruct lobby state fields from the compact payload.
   * New ephemeral IDs are assigned to players (originals were not stored).
   */
  decodeGameState(payload) {
    const round        = (payload[0] & 0xFF) + 1;
    const seed         = decodeSeed(payload[1], payload[2], payload[3]);
    const startingSeed = decodeSeed(payload[4], payload[5], payload[6]);
    const catMask      = (
      ((payload[7]  & 0xFF) << 24) |
      ((payload[8]  & 0xFF) << 16) |
      ((payload[9]  & 0xFF) <<  8) |
       (payload[10] & 0xFF)
    ) >>> 0;
    const flagByte     = payload[11] & 0xFF;
    const customOn     = Boolean(flagByte & 0x01);

    const enabledCategories = [
      ...CHAMELEON_SORTED_CATEGORIES.filter((_, i) => (catMask >>> i) & 1),
      ...(customOn ? [CHAMELEON_CUSTOM_CATEGORY] : []),
    ];

    if (customOn) {
      const { words, bitsRead } = decodeWordList(payload, CUSTOM_WORD_COUNT, 12 * 8);
      const wordByteLen = Math.ceil(bitsRead / 8);
      const { players } = decodePlayers(payload, 12 + wordByteLen);
      return { gameType: 'chameleon', seed, startingSeed, round,
               enabledCategories, customWords: words, players, status: 'lobby' };
    }

    const { players } = decodePlayers(payload, 12);
    return { gameType: 'chameleon', seed, startingSeed, round,
             enabledCategories, players, status: 'lobby' };
  },

  /**
   * Deterministically assign one Chameleon and the rest as Agents.
   * The Chameleon receives word: null; Agents receive the secret word.
   * Same (players, seedString) always yields the exact same result.
   */
  getSetup(players, seedString, _category = '', state = {}) {
    if (players.length < 3) return null;

    const enabled = (state.enabledCategories ?? CHAMELEON_SORTED_CATEGORIES)
      .filter((c) => c === CHAMELEON_CUSTOM_CATEGORY || CHAMELEON_WORD_CATEGORIES[c]);
    if (enabled.length === 0) return null;

    // Pick a category deterministically from the enabled set
    const catPrng     = createPRNG(seedString + '_C');
    const pickedCat   = catPrng.nextFrom(enabled);

    let wordGrid;
    if (pickedCat === CHAMELEON_CUSTOM_CATEGORY && state.customWords?.length === CUSTOM_WORD_COUNT) {
      wordGrid = state.customWords;
    } else if (pickedCat === CHAMELEON_CUSTOM_CATEGORY) {
      // Custom selected but words not set — fall back to first real category
      wordGrid = CHAMELEON_WORD_CATEGORIES[CHAMELEON_SORTED_CATEGORIES[0]];
    } else {
      wordGrid = CHAMELEON_WORD_CATEGORIES[pickedCat];
    }

    const prng     = createPRNG(seedString);
    const wordPrng = createPRNG(seedString + '_W');
    const shuffled = deterministicShuffle(players, prng);
    const word     = wordPrng.nextFrom(wordGrid);

    const categoryLabel = pickedCat === CHAMELEON_CUSTOM_CATEGORY ? 'Custom' : pickedCat;

    return shuffled.map((player, i) => {
      const role = i === 0 ? CHAMELEON_ROLES.CHAMELEON : CHAMELEON_ROLES.AGENT;
      return {
        playerId:   player.id,
        playerName: player.name,
        role,
        wordGrid,
        word:      role === CHAMELEON_ROLES.AGENT ? word : null,
        color:     CHAMELEON_ROLE_COLORS[role],
        category:  categoryLabel,
      };
    });
  },

  /** Returns a list of { label, value } pairs for the pre-game settings summary. */
  getSettingsSummary(state) {
    const enabled      = state.enabledCategories ?? CHAMELEON_SORTED_CATEGORIES;
    const nonCustom    = enabled.filter((c) => c !== CHAMELEON_CUSTOM_CATEGORY);
    const total        = CHAMELEON_SORTED_CATEGORIES.length;
    return [{ label: 'Categories', value: `${nonCustom.length + (enabled.includes(CHAMELEON_CUSTOM_CATEGORY) ? 1 : 0)}` }];
  },
};
