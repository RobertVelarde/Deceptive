// src/games/spyfall/index.js — Spyfall game module
//
// Rules: one or more Spies don't know the secret location; everyone else does.
// Players take turns asking questions. Spies must bluff; civilians must expose
// the spy without making the location too obvious.
//
// Interface contract: identical to InsiderModule / ChameleonModule.
// Extra fields in state used by this module (set via defaultState()):
//   spyCount            {number}  1-3  how many spies
//   randomizeSpies      {boolean}      if true, spy count is seeded-random
//   spiesKnowEachOther  {boolean}      if true, spies see each other's names
//   enabledLocations    {string[]}     subset of SPYFALL_LOCATIONS that are active
import { createPRNG, deterministicShuffle } from '../../engine/prng';
import { encodeSeed, decodeSeed, encodePlayers, decodePlayers } from '../../engine/gamestate';
import { SPYFALL_LOCATIONS } from './locations';
import {
  SPYFALL_COLORS,
  SPYFALL_ROLES,
  SPYFALL_ROLE_COLORS,
  SPYFALL_ROUND_SECONDS,
  SPYFALL_ROLE_META,
} from './constants';

export const SpyfallModule = {
  name:        'spyfall',
  displayName: 'Spyfall',
  minPlayers:  4,
  maxPlayers:  12,

  /** Exposed so LobbyScreen can render the location toggle list. */
  locations:   SPYFALL_LOCATIONS,
  maxSpyCount: 3,

  constants: {
    COLORS:        SPYFALL_COLORS,
    ROLES:         SPYFALL_ROLES,
    ROLE_COLORS:   SPYFALL_ROLE_COLORS,
    ROUND_SECONDS: SPYFALL_ROUND_SECONDS,
    ROLE_META:     SPYFALL_ROLE_META,
  },

  /** Called by LobbyScreen when the user switches to this game type. */
  defaultState() {
    return {
      spyCount:           1,
      randomizeSpies:     false,
      spiesKnowEachOther: false,
      enabledLocations:   [...SPYFALL_LOCATIONS],
    };
  },

  // ── Compact binary state encoding (for ?gs= URL param) ────────────────────
  //
  // Payload layout (bytes):
  //   [0]    round-1 (0-based)
  //   [1]    settings:  bits [7-6] = spyCount-1 (0-2)
  //                     bit  [5]   = randomizeSpies
  //                     bit  [4]   = spiesKnowEachOther
  //                     bits [3-0] = reserved
  //   [2-4]  seed (big-endian uint24)
  //   [5-7]  startingSeed (big-endian uint24)
  //   [8-11] location bitmask (big-endian uint32; bit i = SPYFALL_LOCATIONS[i] enabled)
  //   [12..] encoded player list (encodePlayers format)

  encodeGameState({ players, seed, round, startingSeed,
                    spyCount = 1, randomizeSpies = false,
                    spiesKnowEachOther = false, enabledLocations }) {
    const seedBytes      = encodeSeed(seed);
    const startSeedBytes = encodeSeed(startingSeed ?? seed);
    const playerBytes    = encodePlayers(players);

    const settingsByte = (((spyCount - 1) & 0x03) << 6)
      | (randomizeSpies     ? 0x20 : 0)
      | (spiesKnowEachOther ? 0x10 : 0);

    const enabled = enabledLocations ?? SPYFALL_LOCATIONS;
    let locMask = 0;
    for (let i = 0; i < SPYFALL_LOCATIONS.length; i++) {
      if (enabled.includes(SPYFALL_LOCATIONS[i])) locMask |= (1 << i);
    }

    const buf = new Uint8Array(12 + playerBytes.length);
    buf[0]  = (round - 1) & 0xFF;
    buf[1]  = settingsByte;
    buf[2]  = seedBytes[0];
    buf[3]  = seedBytes[1];
    buf[4]  = seedBytes[2];
    buf[5]  = startSeedBytes[0];
    buf[6]  = startSeedBytes[1];
    buf[7]  = startSeedBytes[2];
    buf[8]  = (locMask >>> 24) & 0xFF;
    buf[9]  = (locMask >>> 16) & 0xFF;
    buf[10] = (locMask >>>  8) & 0xFF;
    buf[11] =  locMask         & 0xFF;
    buf.set(playerBytes, 12);
    return buf;
  },

  decodeGameState(payload) {
    const round              = (payload[0] & 0xFF) + 1;
    const settingsByte       = payload[1] & 0xFF;
    const spyCount           = ((settingsByte >>> 6) & 0x03) + 1;
    const randomizeSpies     = Boolean(settingsByte & 0x20);
    const spiesKnowEachOther = Boolean(settingsByte & 0x10);

    const seed         = decodeSeed(payload[2], payload[3], payload[4]);
    const startingSeed = decodeSeed(payload[5], payload[6], payload[7]);

    const locMask = (
      ((payload[8]  & 0xFF) << 24) |
      ((payload[9]  & 0xFF) << 16) |
      ((payload[10] & 0xFF) <<  8) |
       (payload[11] & 0xFF)
    ) >>> 0;

    const enabledLocations = SPYFALL_LOCATIONS.filter((_, i) => (locMask >>> i) & 1);
    const { players } = decodePlayers(payload, 12);

    return {
      gameType: 'spyfall',
      seed, startingSeed, round, players,
      spyCount, randomizeSpies, spiesKnowEachOther, enabledLocations,
      status:   'lobby',
      category: '',
    };
  },

  /**
   * Deterministically assign Spy and Civilian roles.
   *
   * @param {object[]} players       — lobby player list
   * @param {string}   seedString    — 4-char base-36 seed
   * @param {string}   _category     — unused (reserved for interface compat)
   * @param {object}   state         — full game state (carries spyfall settings)
   *
   * Assignment shape:
   *   { playerId, playerName, role, location, locationList, fellowSpies, color }
   *   — location:     null for spies; the secret location string for civilians
   *   — locationList: all enabled locations (shown to both spy and civilian)
   *   — fellowSpies:  array of { playerId, playerName } | null
   */
  getSetup(players, seedString, _category, state) {
    const enabled = (state?.enabledLocations ?? SPYFALL_LOCATIONS)
      .filter((l) => SPYFALL_LOCATIONS.includes(l));

    if (players.length < 4 || enabled.length === 0) return null;

    // Use a dedicated PRNG for spy-count randomisation so the shuffle result
    // is identical regardless of whether randomiseSpies is on or off.
    const shufflePrng = createPRNG(seedString);
    const countPrng   = createPRNG(seedString + '_C');
    const locPrng     = createPRNG(seedString + '_L');

    let spyCount = state?.spyCount ?? 1;
    if (state?.randomizeSpies) {
      const maxRand = Math.min(SpyfallModule.maxSpyCount, Math.floor(players.length / 2));
      spyCount = countPrng.nextInt(1, maxRand + 1);
    }
    // Guard: never more spies than half the players
    spyCount = Math.min(spyCount, Math.max(1, Math.floor(players.length / 2)));

    const spiesKnow = state?.spiesKnowEachOther ?? false;

    const location = locPrng.nextFrom(enabled);
    const shuffled = deterministicShuffle([...players], shufflePrng);

    const spySet = new Set(shuffled.slice(0, spyCount).map((p) => p.id));

    return shuffled.map((player) => {
      const isSpy = spySet.has(player.id);
      const role  = isSpy ? SPYFALL_ROLES.SPY : SPYFALL_ROLES.CIVILIAN;

      const fellowSpies = (spiesKnow && isSpy)
        ? shuffled
            .filter((p) => spySet.has(p.id) && p.id !== player.id)
            .map((p) => ({ playerId: p.id, playerName: p.name }))
        : null;

      return {
        playerId:     player.id,
        playerName:   player.name,
        role,
        location:     isSpy ? null : location,
        locationList: [...enabled],
        fellowSpies,
        color:        SPYFALL_ROLE_COLORS[role],
      };
    });
  },

  /** Returns a list of { label, value } pairs for the pre-game settings summary. */
  getSettingsSummary(state) {
    const spyCount       = state.spyCount ?? 1;
    const randomizeSpies = state.randomizeSpies ?? false;
    const spiesKnow      = state.spiesKnowEachOther ?? false;
    const enabled        = state.enabledLocations ?? SPYFALL_LOCATIONS;
    return [
      { label: 'Spies',              value: randomizeSpies ? 'Random' : String(spyCount) },
      { label: 'Spies know each other', value: spiesKnow ? 'Yes' : 'No' },
      { label: 'Locations',          value: `${enabled.length} of ${SPYFALL_LOCATIONS.length}` },
    ];
  },
};
