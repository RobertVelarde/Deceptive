// src/games/wavelength/index.js — Wavelength game module
//
// Rules: one player is the Guesser (rotates each round); everyone else is a Psychic.
// All players see the same Spectrum (two opposing concepts on a 1-10 scale).
// Psychics know the secret number. Each gives ONE verbal clue based on the spectrum.
// The Guesser listens to all clues and then picks a number.
//
// Interface contract: identical to InsiderModule — no other files change.
import { createPRNG } from '../../engine/prng';
import { encodeSeed, decodeSeed, encodePlayers, decodePlayers } from '../../engine/gamestate';
import { WAVELENGTH_SPECTRUMS } from './words';
import {
  WAVELENGTH_COLORS,
  WAVELENGTH_ROLES,
  WAVELENGTH_ROLE_COLORS,
  WAVELENGTH_ROUND_SECONDS,
  WAVELENGTH_ROLE_META,
} from './constants';
import { WavelengthGameExtras } from './components/GameExtras';

export const WavelengthModule = {
  name:        'wavelength',
  displayName: 'Wavelength',
  minPlayers:  2,
  maxPlayers:  12,

  /** No extra lobby state needed for Wavelength. */
  defaultState() {
    return {};
  },

  /** No timer for Wavelength. */
  getTimerSeconds(_state) {
    return 0;
  },

  /** Spectrum reveal panel rendered below the role card. */
  GameExtras: WavelengthGameExtras,

  constants: {
    COLORS:        WAVELENGTH_COLORS,
    ROLES:         WAVELENGTH_ROLES,
    ROLE_COLORS:   WAVELENGTH_ROLE_COLORS,
    ROUND_SECONDS: WAVELENGTH_ROUND_SECONDS,
    ROLE_META:     WAVELENGTH_ROLE_META,
  },

  // ── Compact binary state encoding (for ?gs= URL param) ────────────
  //
  // Payload layout (bytes):
  //   [0]    round-1 (0-based)
  //   [1-3]  seed as big-endian uint24
  //   [4-6]  startingSeed as big-endian uint24
  //   [7]    reserved (0x00)
  //   [8..]  encoded player list (encodePlayers format)

  encodeGameState({ players, seed, round, startingSeed }) {
    const seedBytes      = encodeSeed(seed);
    const startSeedBytes = encodeSeed(startingSeed ?? seed);
    const playerBytes    = encodePlayers(players);
    const buf = new Uint8Array(8 + playerBytes.length);
    buf[0] = (round - 1) & 0xFF;
    buf[1] = seedBytes[0]; buf[2] = seedBytes[1]; buf[3] = seedBytes[2];
    buf[4] = startSeedBytes[0]; buf[5] = startSeedBytes[1]; buf[6] = startSeedBytes[2];
    buf[7] = 0x00;
    buf.set(playerBytes, 8);
    return buf;
  },

  decodeGameState(payload) {
    const round        = (payload[0] & 0xFF) + 1;
    const seed         = decodeSeed(payload[1], payload[2], payload[3]);
    const startingSeed = decodeSeed(payload[4], payload[5], payload[6]);
    const { players }  = decodePlayers(payload, 8);
    return { gameType: 'wavelength', seed, startingSeed, round, players, status: 'lobby' };
  },

  /**
   * Assign one Guesser (rotates by round) and the rest as Psychics.
   * All players receive the same spectrum. Psychics also get the secret number (1-10).
   * Same (players, seedString, state.round) always yields the exact same result.
   */
  getSetup(players, seedString, _category = '', state = {}) {
    if (players.length < 2) return null;

    const prng         = createPRNG(seedString);
    const spectrum     = prng.nextFrom(WAVELENGTH_SPECTRUMS);        // ['Hot', 'Cold']
    const secretNumber = Math.floor(prng.next() * 10) + 1;           // 1-10

    const round        = state.round ?? 1;
    const guesserIndex = (round - 1) % players.length;

    const guesserName = players[guesserIndex]?.name ?? null;

    return players.map((player, i) => {
      const isGuesser = i === guesserIndex;
      const role      = isGuesser ? WAVELENGTH_ROLES.GUESSER : WAVELENGTH_ROLES.PSYCHIC;
      return {
        playerId:     player.id,
        playerName:   player.name,
        role,
        spectrum,                                      // visible to all players
        secretNumber: isGuesser ? null : secretNumber,  // guesser does not know the number
        revealNumber: isGuesser ? secretNumber : null,  // revealed to guesser only after submission
        color:        WAVELENGTH_ROLE_COLORS[role],
        guesserName,
      };
    });
  },

  /** No configurable settings beyond starting seed. */
  getSettingsSummary(_state) {
    return [];
  },
};
