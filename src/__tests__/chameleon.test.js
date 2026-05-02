// src/__tests__/chameleon.test.js — Unit tests for the Chameleon game module
import { describe, it, expect } from 'vitest';
import { ChameleonModule, CHAMELEON_CUSTOM_CATEGORY } from '../games/chameleon/index';
import { CHAMELEON_WORD_CATEGORIES } from '../games/chameleon/words';
import {
  CHAMELEON_ROLES,
  CHAMELEON_ROUND_SECONDS,
  CHAMELEON_ROLE_META,
} from '../games/chameleon/constants';

// ── Helpers ────────────────────────────────────────────────────────────────

const PLAYER_NAMES = ['ALICE', 'BOB', 'CAROL', 'DAVE', 'EVE', 'FRANK', 'GRACE', 'HAL'];

function makePlayers(count) {
  return Array.from({ length: count }, (_, i) => ({
    id:   `player-${i}`,
    name: PLAYER_NAMES[i] ?? `GUEST${String.fromCharCode(65 + i)}`,
  }));
}

function rolesOf(result) {
  return result.map((a) => a.role);
}

// ── Word categories ────────────────────────────────────────────────────────

describe('CHAMELEON_WORD_CATEGORIES', () => {
  const categories = Object.entries(CHAMELEON_WORD_CATEGORIES);

  it('exports at least one category', () => {
    expect(categories.length).toBeGreaterThan(0);
  });

  it('every category contains exactly 16 words', () => {
    for (const [name, words] of categories) {
      expect(words, `Category "${name}" should have 16 words`).toHaveLength(16);
    }
  });

  it('every word in every category is a non-empty string', () => {
    for (const [name, words] of categories) {
      for (const word of words) {
        expect(typeof word, `Word in category "${name}" should be a string`).toBe('string');
        expect(word.length, `Word in category "${name}" should not be empty`).toBeGreaterThan(0);
      }
    }
  });

  it('no duplicate words within a single category', () => {
    for (const [name, words] of categories) {
      const unique = new Set(words);
      expect(unique.size, `Category "${name}" has duplicate words`).toBe(words.length);
    }
  });
});

// ── Module shape ────────────────────────────────────────────────────────────

describe('ChameleonModule shape', () => {
  it('exports required name fields', () => {
    expect(ChameleonModule.name).toBe('chameleon');
    expect(ChameleonModule.displayName).toBe('Chameleon');
  });

  it('declares valid player count bounds', () => {
    expect(ChameleonModule.minPlayers).toBeGreaterThanOrEqual(1);
    expect(ChameleonModule.maxPlayers).toBeGreaterThan(ChameleonModule.minPlayers);
  });

  it('exports constants with expected keys', () => {
    const { constants } = ChameleonModule;
    expect(constants).toHaveProperty('COLORS');
    expect(constants).toHaveProperty('ROLES');
    expect(constants).toHaveProperty('ROLE_COLORS');
    expect(constants).toHaveProperty('ROUND_SECONDS');
    expect(constants).toHaveProperty('ROLE_META');
  });

  it('categories array matches CHAMELEON_WORD_CATEGORIES keys', () => {
    expect(ChameleonModule.categories).toEqual(Object.keys(CHAMELEON_WORD_CATEGORIES));
  });
});

// ── defaultState ────────────────────────────────────────────────────────────

describe('ChameleonModule.defaultState()', () => {
  it('returns an object', () =>
    expect(typeof ChameleonModule.defaultState()).toBe('object'));

  it('contains roundSeconds (positive integer)', () => {
    const { roundSeconds } = ChameleonModule.defaultState();
    expect(Number.isInteger(roundSeconds)).toBe(true);
    expect(roundSeconds).toBeGreaterThan(0);
  });
});

// ── getSetup — player count validation ─────────────────────────────────────

describe('ChameleonModule.getSetup() player count validation', () => {
  const cat   = Object.keys(CHAMELEON_WORD_CATEGORIES)[0];
  const state = {};

  it('returns null for 0 players', () =>
    expect(ChameleonModule.getSetup([], 'AB12', cat, state)).toBeNull());

  it('returns null for 2 players (below minimum of 3)', () =>
    expect(ChameleonModule.getSetup(makePlayers(2), 'AB12', cat, state)).toBeNull());

  it('returns an assignment array for exactly 3 players', () =>
    expect(ChameleonModule.getSetup(makePlayers(3), 'AB12', cat, state)).not.toBeNull());

  it('returns an assignment for the maximum player count', () =>
    expect(ChameleonModule.getSetup(makePlayers(ChameleonModule.maxPlayers), 'AB12', cat, state))
      .not.toBeNull());
});

// ── getSetup — role assignment rules ───────────────────────────────────────

describe('ChameleonModule.getSetup() role assignment', () => {
  const cat   = Object.keys(CHAMELEON_WORD_CATEGORIES)[0];
  const state = {};

  it('returns exactly one assignment per player', () => {
    const players = makePlayers(5);
    expect(ChameleonModule.getSetup(players, 'AB12', cat, state)).toHaveLength(5);
  });

  it('assigns exactly one CHAMELEON', () => {
    const result = ChameleonModule.getSetup(makePlayers(5), 'AB12', cat, state);
    expect(rolesOf(result).filter((r) => r === CHAMELEON_ROLES.CHAMELEON)).toHaveLength(1);
  });

  it('assigns the rest as AGENT', () => {
    const players = makePlayers(5);
    const result  = ChameleonModule.getSetup(players, 'AB12', cat, state);
    expect(rolesOf(result).filter((r) => r === CHAMELEON_ROLES.AGENT)).toHaveLength(4);
  });

  it('every assignment has playerId, playerName, role, and wordGrid', () => {
    const result = ChameleonModule.getSetup(makePlayers(4), 'AB12', cat, state);
    for (const a of result) {
      expect(a).toHaveProperty('playerId');
      expect(a).toHaveProperty('playerName');
      expect(a).toHaveProperty('role');
      expect(a).toHaveProperty('wordGrid');
    }
  });
});

// ── getSetup — word visibility ──────────────────────────────────────────────

describe('ChameleonModule.getSetup() word visibility', () => {
  const cat   = Object.keys(CHAMELEON_WORD_CATEGORIES)[0];
  const state = {};

  it('AGENT receives the secret word', () => {
    const result = ChameleonModule.getSetup(makePlayers(4), 'AB12', cat, state);
    const agent  = result.find((a) => a.role === CHAMELEON_ROLES.AGENT);
    expect(agent.word).toBeTruthy();
  });

  it('CHAMELEON receives word: null', () => {
    const result    = ChameleonModule.getSetup(makePlayers(4), 'AB12', cat, state);
    const chameleon = result.find((a) => a.role === CHAMELEON_ROLES.CHAMELEON);
    expect(chameleon.word).toBeNull();
  });

  it('all AGENTs see the same word', () => {
    const result = ChameleonModule.getSetup(makePlayers(5), 'AB12', cat, state);
    const words  = result
      .filter((a) => a.role === CHAMELEON_ROLES.AGENT)
      .map((a) => a.word);
    expect(new Set(words).size).toBe(1);
  });

  it('secret word is a member of the selected category wordGrid', () => {
    const result = ChameleonModule.getSetup(makePlayers(4), 'AB12', cat, state);
    const agent  = result.find((a) => a.role === CHAMELEON_ROLES.AGENT);
    expect(agent.wordGrid).toContain(agent.word);
  });

  it('wordGrid has exactly 16 entries', () => {
    const result = ChameleonModule.getSetup(makePlayers(4), 'AB12', cat, state);
    for (const a of result) {
      expect(a.wordGrid).toHaveLength(16);
    }
  });
});

// ── getSetup — determinism ──────────────────────────────────────────────────

describe('ChameleonModule.getSetup() determinism', () => {
  const cat     = Object.keys(CHAMELEON_WORD_CATEGORIES)[0];
  const players = makePlayers(5);
  const state   = {};

  it('same seed → identical result on repeat calls', () => {
    const r1 = ChameleonModule.getSetup(players, 'SEED', cat, state);
    const r2 = ChameleonModule.getSetup(players, 'SEED', cat, state);
    expect(r1).toEqual(r2);
  });

  it('different seeds → potentially different chameleon assignment', () => {
    expect(ChameleonModule.getSetup(players, 'AAAA', cat, state)).toBeDefined();
    expect(ChameleonModule.getSetup(players, 'ZZZZ', cat, state)).toBeDefined();
  });
});

// ── encode/decode round-trip ────────────────────────────────────────────────

describe('ChameleonModule encode/decode round-trip', () => {
  const cat     = Object.keys(CHAMELEON_WORD_CATEGORIES)[0];
  const players = makePlayers(3);
  const BASE    = {
    players,
    seed:         'AB12',
    startingSeed: 'AB12',
    round:        1,
    category:     cat,
  };

  function roundTrip(state) {
    return ChameleonModule.decodeGameState(ChameleonModule.encodeGameState(state));
  }

  it('preserves round', () =>
    expect(roundTrip({ ...BASE, round: 3 }).round).toBe(3));

  it('preserves seed', () =>
    expect(roundTrip(BASE).seed).toBe('AB12'));

  it('preserves startingSeed', () =>
    expect(roundTrip(BASE).startingSeed).toBe('AB12'));

  it('preserves category', () =>
    expect(roundTrip(BASE).category).toBe(cat));

  it('preserves all player names', () => {
    const decoded = roundTrip(BASE);
    expect(decoded.players.map((p) => p.name))
      .toEqual(BASE.players.map((p) => p.name));
  });

  it('sets gameType to "chameleon" on decode', () =>
    expect(roundTrip(BASE).gameType).toBe('chameleon'));

  it('sets status to "lobby" on decode', () =>
    expect(roundTrip(BASE).status).toBe('lobby'));

  it('preserves custom words', () => {
    const customWords = [
      'APPLE', 'BRIDGE', 'CASTLE', 'DESERT',
      'EAGLE', 'FOREST', 'GARDEN', 'HARBOR',
      'ISLAND', 'JUNGLE', 'KITTEN', 'LEMON',
      'MANGO', 'NAPKIN', 'ORANGE', 'PLANET',
    ];
    const decoded = roundTrip({ ...BASE, category: CHAMELEON_CUSTOM_CATEGORY, customWords });
    expect(decoded.category).toBe(CHAMELEON_CUSTOM_CATEGORY);
    expect(decoded.customWords).toEqual(customWords);
  });
});

// ── getTimerSeconds ─────────────────────────────────────────────────────────

describe('ChameleonModule.getTimerSeconds()', () => {
  it('returns roundSeconds from state', () =>
    expect(ChameleonModule.getTimerSeconds({ roundSeconds: 180 })).toBe(180));

  it('returns CHAMELEON_ROUND_SECONDS when state is null', () =>
    expect(ChameleonModule.getTimerSeconds(null)).toBe(CHAMELEON_ROUND_SECONDS));

  it('returns CHAMELEON_ROUND_SECONDS when state is undefined', () =>
    expect(ChameleonModule.getTimerSeconds(undefined)).toBe(CHAMELEON_ROUND_SECONDS));

  it('returns CHAMELEON_ROUND_SECONDS when roundSeconds is missing', () =>
    expect(ChameleonModule.getTimerSeconds({})).toBe(CHAMELEON_ROUND_SECONDS));
});

// ── getSettingsSummary ──────────────────────────────────────────────────────

describe('ChameleonModule.getSettingsSummary()', () => {
  const cat   = Object.keys(CHAMELEON_WORD_CATEGORIES)[0];
  const state = { category: cat };

  it('returns a non-empty array', () =>
    expect(ChameleonModule.getSettingsSummary(state).length).toBeGreaterThan(0));

  it('each entry has label and value', () => {
    for (const entry of ChameleonModule.getSettingsSummary(state)) {
      expect(entry).toHaveProperty('label');
      expect(entry).toHaveProperty('value');
    }
  });

  it('includes a Categories entry matching the active category', () => {
    const entry = ChameleonModule.getSettingsSummary(state)
      .find((e) => e.label === 'Categories');
    expect(entry?.value).toBe(cat);
  });

  it('labels custom category as "Custom"', () => {
    const entry = ChameleonModule.getSettingsSummary({ category: CHAMELEON_CUSTOM_CATEGORY })
      .find((e) => e.label === 'Categories');
    expect(entry?.value).toBe('Custom');
  });
});
