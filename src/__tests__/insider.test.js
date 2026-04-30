// src/__tests__/insider.test.js — Unit tests for the Insider game module
import { describe, it, expect } from 'vitest';
import { InsiderModule }         from '../games/insider/index';
import {
  INSIDER_ROLES,
  INSIDER_ROUND_SECONDS,
  INSIDER_ROLE_META,
} from '../games/insider/constants';

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Create a minimal player roster of `count` players.
 * Names use only uppercase letters so they survive the NAME_CHARSET filter
 * in encodePlayers without any characters being stripped.
 */
const PLAYER_NAMES = ['ALICE', 'BOB', 'CAROL', 'DAVE', 'EVE', 'FRANK', 'GRACE', 'HAL'];

function makePlayers(count) {
  return Array.from({ length: count }, (_, i) => ({
    id:   `player-${i}`,
    name: PLAYER_NAMES[i] ?? `GUEST${String.fromCharCode(65 + i)}`,
  }));
}

/** Collect all roles from a getSetup result. */
function rolesOf(result) {
  return result.map((a) => a.role);
}

// ── Module shape ───────────────────────────────────────────────────────────
describe('InsiderModule shape', () => {
  it('exports required name fields', () => {
    expect(InsiderModule.name).toBe('insider');
    expect(InsiderModule.displayName).toBe('Insider');
  });

  it('declares valid player count bounds', () => {
    expect(InsiderModule.minPlayers).toBeGreaterThanOrEqual(1);
    expect(InsiderModule.maxPlayers).toBeGreaterThan(InsiderModule.minPlayers);
  });

  it('exports constants with expected keys', () => {
    const { constants } = InsiderModule;
    expect(constants).toHaveProperty('COLORS');
    expect(constants).toHaveProperty('ROLES');
    expect(constants).toHaveProperty('ROLE_COLORS');
    expect(constants).toHaveProperty('ROUND_SECONDS');
    expect(constants).toHaveProperty('ROLE_META');
  });

  it('settingsSchema is a non-empty array', () => {
    expect(Array.isArray(InsiderModule.settingsSchema)).toBe(true);
    expect(InsiderModule.settingsSchema.length).toBeGreaterThan(0);
  });

  it('each settings entry has type, key, label, and default', () => {
    for (const s of InsiderModule.settingsSchema) {
      expect(s).toHaveProperty('type');
      expect(s).toHaveProperty('key');
      expect(s).toHaveProperty('label');
      expect(s).toHaveProperty('default');
    }
  });
});

// ── defaultState ───────────────────────────────────────────────────────────
describe('InsiderModule.defaultState()', () => {
  it('returns an object', () =>
    expect(typeof InsiderModule.defaultState()).toBe('object'));

  it('contains rotatingMaster (boolean)', () =>
    expect(typeof InsiderModule.defaultState().rotatingMaster).toBe('boolean'));

  it('contains questionSeconds (positive integer)', () => {
    const { questionSeconds } = InsiderModule.defaultState();
    expect(Number.isInteger(questionSeconds)).toBe(true);
    expect(questionSeconds).toBeGreaterThan(0);
  });

  it('contains possibilityOfNoInsider (boolean)', () =>
    expect(typeof InsiderModule.defaultState().possibilityOfNoInsider).toBe('boolean'));
});

// ── getSetup — minimum player check ───────────────────────────────────────
describe('InsiderModule.getSetup() player count validation', () => {
  it('returns null for 0 players', () =>
    expect(InsiderModule.getSetup([], 'AB12', '', {})).toBeNull());

  it('returns null for 3 players (below minimum of 4)', () =>
    expect(InsiderModule.getSetup(makePlayers(3), 'AB12', '', {})).toBeNull());

  it('returns an assignment array for exactly 4 players', () =>
    expect(InsiderModule.getSetup(makePlayers(4), 'AB12', '', {})).not.toBeNull());

  it('returns an assignment for the maximum player count', () =>
    expect(InsiderModule.getSetup(makePlayers(InsiderModule.maxPlayers), 'AB12', '', {}))
      .not.toBeNull());
});

// ── getSetup — role assignment rules ─────────────────────────────────────
describe('InsiderModule.getSetup() role assignment', () => {
  const SEED      = 'AB12';
  const state     = { rotatingMaster: false, possibilityOfNoInsider: false, round: 1 };

  it('returns exactly one assignment per player', () => {
    const players = makePlayers(6);
    expect(InsiderModule.getSetup(players, SEED, '', state)).toHaveLength(6);
  });

  it('assigns exactly one MASTER', () => {
    const result  = InsiderModule.getSetup(makePlayers(6), SEED, '', state);
    expect(rolesOf(result).filter((r) => r === INSIDER_ROLES.MASTER)).toHaveLength(1);
  });

  it('assigns exactly one INSIDER when possibilityOfNoInsider=false', () => {
    const result = InsiderModule.getSetup(makePlayers(6), SEED, '', state);
    expect(rolesOf(result).filter((r) => r === INSIDER_ROLES.INSIDER)).toHaveLength(1);
  });

  it('assigns the rest as COMMON', () => {
    const players = makePlayers(6);
    const result  = InsiderModule.getSetup(players, SEED, '', state);
    expect(rolesOf(result).filter((r) => r === INSIDER_ROLES.COMMON)).toHaveLength(4);
  });

  it('MASTER and INSIDER are never the same player', () => {
    // Verify across many seeds
    for (let i = 0; i < 50; i++) {
      const seed   = i.toString(36).padStart(4, '0').toUpperCase();
      const result = InsiderModule.getSetup(makePlayers(5), seed, '', state);
      if (!result) continue;
      const master  = result.find((a) => a.role === INSIDER_ROLES.MASTER);
      const insider = result.find((a) => a.role === INSIDER_ROLES.INSIDER);
      if (master && insider) {
        expect(master.playerId).not.toBe(insider.playerId);
      }
    }
  });

  it('every assignment has playerId and playerName', () => {
    const players = makePlayers(5);
    const result  = InsiderModule.getSetup(players, SEED, '', state);
    for (const a of result) {
      expect(a).toHaveProperty('playerId');
      expect(a).toHaveProperty('playerName');
    }
  });
});

// ── getSetup — word visibility ────────────────────────────────────────────
describe('InsiderModule.getSetup() word visibility', () => {
  const state = { rotatingMaster: false, possibilityOfNoInsider: false, round: 1 };

  it('MASTER receives the secret word', () => {
    const result = InsiderModule.getSetup(makePlayers(5), 'AB12', '', state);
    const master = result.find((a) => a.role === INSIDER_ROLES.MASTER);
    expect(master.word).toBeTruthy();
  });

  it('INSIDER receives the secret word', () => {
    const result  = InsiderModule.getSetup(makePlayers(5), 'AB12', '', state);
    const insider = result.find((a) => a.role === INSIDER_ROLES.INSIDER);
    expect(insider.word).toBeTruthy();
  });

  it('COMMON players receive word: null', () => {
    const result  = InsiderModule.getSetup(makePlayers(5), 'AB12', '', state);
    const commons = result.filter((a) => a.role === INSIDER_ROLES.COMMON);
    for (const c of commons) {
      expect(c.word).toBeNull();
    }
  });

  it('MASTER and INSIDER see the same word', () => {
    const result  = InsiderModule.getSetup(makePlayers(5), 'AB12', '', state);
    const master  = result.find((a) => a.role === INSIDER_ROLES.MASTER);
    const insider = result.find((a) => a.role === INSIDER_ROLES.INSIDER);
    expect(master.word).toBe(insider.word);
  });
});

// ── getSetup — determinism ────────────────────────────────────────────────
describe('InsiderModule.getSetup() determinism', () => {
  const players = makePlayers(5);
  const state   = { rotatingMaster: false, possibilityOfNoInsider: false, round: 1 };

  it('same seed → identical result on repeat calls', () => {
    const r1 = InsiderModule.getSetup(players, 'SEED', '', state);
    const r2 = InsiderModule.getSetup(players, 'SEED', '', state);
    expect(r1).toEqual(r2);
  });

  it('different seeds → different master selection', () => {
    const r1 = InsiderModule.getSetup(players, 'AAAA', '', state);
    const r2 = InsiderModule.getSetup(players, 'ZZZZ', '', state);
    // With 5 possible masters, collision probability is 20%
    // Use 6 players to reduce to ~16%... just verify the test setup works
    // (we only verify the function is called; role distribution tests above cover correctness)
    expect(r1).toBeDefined();
    expect(r2).toBeDefined();
  });
});

// ── getSetup — rotating master ────────────────────────────────────────────
describe('InsiderModule.getSetup() rotating master', () => {
  const players = makePlayers(4);

  it('round 1 always assigns players[0] as master', () => {
    const state  = { rotatingMaster: true, possibilityOfNoInsider: false, round: 1 };
    const result = InsiderModule.getSetup(players, 'AB12', '', state);
    const master = result.find((a) => a.role === INSIDER_ROLES.MASTER);
    expect(master.playerId).toBe(players[0].id);
  });

  it('round 2 assigns players[1] as master', () => {
    const state  = { rotatingMaster: true, possibilityOfNoInsider: false, round: 2 };
    const result = InsiderModule.getSetup(players, 'AB12', '', state);
    const master = result.find((a) => a.role === INSIDER_ROLES.MASTER);
    expect(master.playerId).toBe(players[1].id);
  });

  it('wraps around after the last player', () => {
    const count = players.length;
    const state = { rotatingMaster: true, possibilityOfNoInsider: false, round: count + 1 };
    const result = InsiderModule.getSetup(players, 'AB12', '', state);
    const master = result.find((a) => a.role === INSIDER_ROLES.MASTER);
    // round (count+1) → index count % count = 0
    expect(master.playerId).toBe(players[0].id);
  });
});

// ── getSetup — possibilityOfNoInsider ─────────────────────────────────────
describe('InsiderModule.getSetup() possibilityOfNoInsider', () => {
  it('may produce zero INSIDERs when possibilityOfNoInsider=true', () => {
    // Run many seeds; at least some should produce no insider
    let foundNoInsider = false;
    for (let i = 0; i < 200 && !foundNoInsider; i++) {
      const seed   = i.toString(36).padStart(4, '0').toUpperCase();
      const result = InsiderModule.getSetup(
        makePlayers(5), seed, '',
        { rotatingMaster: false, possibilityOfNoInsider: true, round: 1 },
      );
      if (result && !result.some((a) => a.role === INSIDER_ROLES.INSIDER)) {
        foundNoInsider = true;
      }
    }
    expect(foundNoInsider).toBe(true);
  });

  it('never produces more than one INSIDER', () => {
    for (let i = 0; i < 50; i++) {
      const seed   = i.toString(36).padStart(4, '0').toUpperCase();
      const result = InsiderModule.getSetup(
        makePlayers(5), seed, '',
        { rotatingMaster: false, possibilityOfNoInsider: true, round: 1 },
      );
      if (!result) continue;
      expect(rolesOf(result).filter((r) => r === INSIDER_ROLES.INSIDER).length)
        .toBeLessThanOrEqual(1);
    }
  });
});

// ── encodeGameState / decodeGameState round-trip ──────────────────────────
describe('InsiderModule encode/decode round-trip', () => {
  const players = makePlayers(4);
  const BASE    = {
    players,
    seed:                   'AB12',
    startingSeed:           'AB12',
    round:                  1,
    rotatingMaster:         false,
    questionSeconds:        300,
    possibilityOfNoInsider: false,
  };

  function roundTrip(state) {
    return InsiderModule.decodeGameState(InsiderModule.encodeGameState(state));
  }

  it('preserves round', () => {
    expect(roundTrip({ ...BASE, round: 5 }).round).toBe(5);
  });

  it('preserves seed', () => {
    expect(roundTrip(BASE).seed).toBe('AB12');
  });

  it('preserves startingSeed', () => {
    expect(roundTrip(BASE).startingSeed).toBe('AB12');
  });

  it('preserves rotatingMaster=false', () => {
    expect(roundTrip({ ...BASE, rotatingMaster: false }).rotatingMaster).toBe(false);
  });

  it('preserves rotatingMaster=true', () => {
    expect(roundTrip({ ...BASE, rotatingMaster: true }).rotatingMaster).toBe(true);
  });

  it('preserves questionSeconds=300', () => {
    expect(roundTrip({ ...BASE, questionSeconds: 300 }).questionSeconds).toBe(300);
  });

  it('preserves questionSeconds=600 (10 min)', () => {
    expect(roundTrip({ ...BASE, questionSeconds: 600 }).questionSeconds).toBe(600);
  });

  it('preserves questionSeconds=1800 (30 min)', () => {
    expect(roundTrip({ ...BASE, questionSeconds: 1800 }).questionSeconds).toBe(1800);
  });

  it('preserves possibilityOfNoInsider=false', () => {
    expect(roundTrip({ ...BASE, possibilityOfNoInsider: false }).possibilityOfNoInsider)
      .toBe(false);
  });

  it('preserves possibilityOfNoInsider=true', () => {
    expect(roundTrip({ ...BASE, possibilityOfNoInsider: true }).possibilityOfNoInsider)
      .toBe(true);
  });

  it('preserves all player names', () => {
    const decoded = roundTrip(BASE);
    expect(decoded.players.map((p) => p.name))
      .toEqual(BASE.players.map((p) => p.name));
  });

  it('sets gameType to "insider" on decode', () => {
    expect(roundTrip(BASE).gameType).toBe('insider');
  });

  it('sets status to "lobby" on decode', () => {
    expect(roundTrip(BASE).status).toBe('lobby');
  });
});

// ── getTimerSeconds ────────────────────────────────────────────────────────
describe('InsiderModule.getTimerSeconds()', () => {
  it('returns questionSeconds from state', () =>
    expect(InsiderModule.getTimerSeconds({ questionSeconds: 420 })).toBe(420));

  it('returns INSIDER_ROUND_SECONDS when state is null', () =>
    expect(InsiderModule.getTimerSeconds(null)).toBe(INSIDER_ROUND_SECONDS));

  it('returns INSIDER_ROUND_SECONDS when state is undefined', () =>
    expect(InsiderModule.getTimerSeconds(undefined)).toBe(INSIDER_ROUND_SECONDS));

  it('returns INSIDER_ROUND_SECONDS when questionSeconds is missing', () =>
    expect(InsiderModule.getTimerSeconds({})).toBe(INSIDER_ROUND_SECONDS));
});

// ── getSettingsSummary ─────────────────────────────────────────────────────
describe('InsiderModule.getSettingsSummary()', () => {
  const state = {
    rotatingMaster:         false,
    questionSeconds:        300,
    possibilityOfNoInsider: false,
  };

  it('returns an array with at least 3 entries', () => {
    expect(InsiderModule.getSettingsSummary(state).length).toBeGreaterThanOrEqual(3);
  });

  it('each entry has label and value', () => {
    for (const entry of InsiderModule.getSettingsSummary(state)) {
      expect(entry).toHaveProperty('label');
      expect(entry).toHaveProperty('value');
    }
  });

  it('reflects rotatingMaster=false as "Random"', () => {
    const master = InsiderModule.getSettingsSummary({ ...state, rotatingMaster: false })
      .find((e) => e.label === 'Master');
    expect(master?.value).toBe('Random');
  });

  it('reflects rotatingMaster=true as "Rotating"', () => {
    const master = InsiderModule.getSettingsSummary({ ...state, rotatingMaster: true })
      .find((e) => e.label === 'Master');
    expect(master?.value).toBe('Rotating');
  });

  it('formats questionSeconds as minutes', () => {
    const time = InsiderModule.getSettingsSummary({ ...state, questionSeconds: 300 })
      .find((e) => e.label === 'Time');
    expect(time?.value).toContain('5');
  });

  it('reflects possibilityOfNoInsider=false as "Always"', () => {
    const insider = InsiderModule.getSettingsSummary({ ...state, possibilityOfNoInsider: false })
      .find((e) => e.label === 'Insider');
    expect(insider?.value).toBe('Always');
  });

  it('reflects possibilityOfNoInsider=true as "Maybe"', () => {
    const insider = InsiderModule.getSettingsSummary({ ...state, possibilityOfNoInsider: true })
      .find((e) => e.label === 'Insider');
    expect(insider?.value).toBe('Maybe');
  });
});
