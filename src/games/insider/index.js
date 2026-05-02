// src/games/insider/index.js — Insider game module
//
// Standard game module interface exported by every game:
//   name, displayName, minPlayers, maxPlayers
//   constants:    { COLORS, ROLES, ROLE_COLORS, ROUND_SECONDS, ROLE_META }
//   defaultState(): game-specific state defaults for new lobbies
//   settingsSchema: (optional) generic control descriptors for LobbyScreen
//   getTimerSeconds(state): round duration in seconds
//   getSetup(players[], seedString, category, state) → Assignment[] | null
//   encodeGameState(state) → Uint8Array
//   decodeGameState(payload) → object
//   getSettingsSummary?(state) → { label, value }[]
//   GameExtras: ReactComponent | null  — game-specific UI below the role card
import { createPRNG, deterministicShuffle } from '../../engine/prng';
import { encodeSeed, decodeSeed, encodePlayers, decodePlayers } from '../../engine/gamestate';
import { INSIDER_WORDS } from './words';
import {
  INSIDER_COLORS,
  INSIDER_ROLES,
  INSIDER_ROLE_COLORS,
  INSIDER_ROUND_SECONDS,
  INSIDER_ROLE_META,
} from './constants';

export const InsiderModule = {
  name:        'insider',
  displayName: 'Insider',
  minPlayers:  4,
  maxPlayers:  8,

  constants: {
    COLORS:        INSIDER_COLORS,
    ROLES:         INSIDER_ROLES,
    ROLE_COLORS:   INSIDER_ROLE_COLORS,
    ROUND_SECONDS: INSIDER_ROUND_SECONDS,
    ROLE_META:     INSIDER_ROLE_META,
  },

  /** Default game-type-specific state fields for new lobbies. */
  defaultState() {
    return {
      rotatingMaster:        false,
      roundSeconds:          300,
      possibilityOfNoInsider: false,
    };
  },

  /**
   * Settings schema consumed by LobbyScreen to render generic controls.
   * type 'segmented' → pill-style toggle; type 'stepper' → − value + control.
   */
  settingsSchema: [
    {
      type:    'segmented',
      key:     'rotatingMaster',
      label:   'Master Selection',
      default: false,
      options: [
        { value: false, label: 'Random' },
        { value: true,  label: 'Rotating' },
      ],
    },
    {
      type:    'segmented',
      key:     'possibilityOfNoInsider',
      label:   'Insider in play?',
      default: false,
      options: [
        { value: false, label: 'Always' },
        { value: true,  label: 'Maybe' },
      ],
    },
  ],

  // ── Compact binary state encoding (for ?gs= URL param) ────────────
  //
  // Payload layout (bytes):
  //   [0]    round-1 (0-based)
  //   [1-3]  current seed (big-endian uint24)
  //   [4-6]  startingSeed (big-endian uint24)
  //   [7]    settings: bit0=rotatingMaster, bits[6:1]=questionMinutes-1 (0-29)
  //   [8..]  encoded player list (encodePlayers format)

  encodeGameState({ players, seed, round, startingSeed, rotatingMaster = false, roundSeconds = 300, possibilityOfNoInsider = false }) {
    const seedBytes      = encodeSeed(seed);
    const startSeedBytes = encodeSeed(startingSeed ?? seed);
    const playerBytes    = encodePlayers(players);
    const qMins          = Math.max(1, Math.min(30, Math.round(roundSeconds / 60)));
    const settingsByte   = (rotatingMaster ? 0x01 : 0x00) | (((qMins - 1) & 0x1F) << 1) | (possibilityOfNoInsider ? 0x40 : 0x00);

    const buf = new Uint8Array(8 + playerBytes.length);
    buf[0] = (round - 1) & 0xFF;
    buf[1] = seedBytes[0];
    buf[2] = seedBytes[1];
    buf[3] = seedBytes[2];
    buf[4] = startSeedBytes[0];
    buf[5] = startSeedBytes[1];
    buf[6] = startSeedBytes[2];
    buf[7] = settingsByte;
    buf.set(playerBytes, 8);
    return buf;
  },

  decodeGameState(payload) {
    const round          = (payload[0] & 0xFF) + 1;
    const seed           = decodeSeed(payload[1], payload[2], payload[3]);
    const startingSeed   = decodeSeed(payload[4], payload[5], payload[6]);
    const settingsByte   = payload[7] & 0xFF;
    const rotatingMaster         = Boolean(settingsByte & 0x01);
    const qMins                  = ((settingsByte >> 1) & 0x1F) + 1;
    const roundSeconds            = qMins * 60;
    const possibilityOfNoInsider  = Boolean(settingsByte & 0x40);
    const { players }             = decodePlayers(payload, 8);
    return {
      gameType: 'insider', seed, startingSeed, round, players,
      rotatingMaster, roundSeconds, possibilityOfNoInsider,
      status: 'lobby', category: '',
    };
  },

  /**
   * Deterministically assign roles and a secret word.
   * Same (players, seedString, state) always yields the exact same result.
   *
   * Master selection:
   *   rotatingMaster=false → master is first player in seed-shuffled order (random)
   *   rotatingMaster=true  → master rotates: players[(round-1) % playerCount]
   * Insider: first player in shuffled order who is not the master.
   */
  getSetup(players, seedString, _category, state) {
    if (players.length < 4) return null;

    const rotatingMaster         = state?.rotatingMaster         ?? false;
    const possibilityOfNoInsider = state?.possibilityOfNoInsider ?? false;
    const round                  = state?.round ?? 1;

    const prng         = createPRNG(seedString);
    const wordPrng     = createPRNG(seedString + '_W');
    const noInsiderPrng = createPRNG(seedString + '_NI');
    const shuffled     = deterministicShuffle(players, prng);
    const word         = deterministicShuffle(INSIDER_WORDS, wordPrng)[0];

    // Determine master player ID
    const masterId = rotatingMaster
      ? players[(round - 1) % players.length].id
      : shuffled[0].id;

    // 1-in-N chance that no player is the insider this round
    const hasNoInsider = possibilityOfNoInsider && (noInsiderPrng.next() < 1 / players.length);

    // Insider: first shuffled player who is not the master (skipped when no insider)
    const insiderId = hasNoInsider ? null : shuffled.find((p) => p.id !== masterId).id;

    return players.map((player) => {
      let role;
      if (player.id === masterId)                   role = INSIDER_ROLES.MASTER;
      else if (!hasNoInsider && player.id === insiderId) role = INSIDER_ROLES.INSIDER;
      else                                          role = INSIDER_ROLES.COMMON;

      const seesWord = role === INSIDER_ROLES.MASTER || role === INSIDER_ROLES.INSIDER;
      return {
        playerId:   player.id,
        playerName: player.name,
        role,
        word:  seesWord ? word : null,
        color: INSIDER_ROLE_COLORS[role],
      };
    });
  },

  /** Insider has no supplemental game UI below the role card. */
  GameExtras: null,

  /** Returns timer seconds for the current round. */
  getTimerSeconds(state) {
    return state?.roundSeconds ?? INSIDER_ROUND_SECONDS;
  },

  /** Returns a list of { label, value } pairs for the pre-game settings summary. */
  getSettingsSummary(state) {
    const rotatingMaster         = state?.rotatingMaster         ?? false;
    const possibilityOfNoInsider = state?.possibilityOfNoInsider ?? false;
    return [
      { label: 'Master',  value: rotatingMaster ? 'Rotating' : 'Random' },
      { label: 'Insider', value: possibilityOfNoInsider ? 'Maybe' : 'Always' },
    ];
  },
};
