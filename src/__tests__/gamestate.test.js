// src/__tests__/gamestate.test.js — Unit tests for the compact URL game-state codec
import { describe, it, expect } from 'vitest';
import {
  GAME_TYPE_IDS,
  GAME_TYPE_FROM_ID,
  buildGameStateParam,
  parseGameStateParam,
  NAME_CHARSET,
  NAME_MAX_LENGTH,
  sanitizeName,
  encodeSeed,
  decodeSeed,
  encodePlayers,
  decodePlayers,
  generatePlayerId,
} from '../engine/gamestate';

// ── Game type registry ────────────────────────────────────────────────────
describe('GAME_TYPE_IDS', () => {
  it('all IDs are integers in [0, 7]', () => {
    for (const id of Object.values(GAME_TYPE_IDS)) {
      expect(Number.isInteger(id)).toBe(true);
      expect(id).toBeGreaterThanOrEqual(0);
      expect(id).toBeLessThanOrEqual(7);
    }
  });

  it('contains entries for the three shipped games', () => {
    expect(GAME_TYPE_IDS).toHaveProperty('insider');
    expect(GAME_TYPE_IDS).toHaveProperty('chameleon');
    expect(GAME_TYPE_IDS).toHaveProperty('spyfall');
  });

  it('has no duplicate IDs', () => {
    const ids    = Object.values(GAME_TYPE_IDS);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe('GAME_TYPE_FROM_ID', () => {
  it('is the exact reverse of GAME_TYPE_IDS', () => {
    for (const [name, id] of Object.entries(GAME_TYPE_IDS)) {
      expect(GAME_TYPE_FROM_ID[id]).toBe(name);
    }
  });
});

// ── sanitizeName ─────────────────────────────────────────────────────────
describe('sanitizeName', () => {
  it('converts lowercase to uppercase', () =>
    expect(sanitizeName('hello')).toBe('HELLO'));

  it('strips characters not in NAME_CHARSET', () =>
    expect(sanitizeName('he!llo@')).toBe('HELLO'));

  it('truncates to NAME_MAX_LENGTH', () => {
    const long = 'A'.repeat(NAME_MAX_LENGTH + 10);
    expect(sanitizeName(long)).toHaveLength(NAME_MAX_LENGTH);
  });

  it('preserves valid special characters', () =>
    expect(sanitizeName("O'BRIEN")).toBe("O'BRIEN"));

  it('handles null without throwing', () =>
    expect(sanitizeName(null)).toBe(''));

  it('handles undefined without throwing', () =>
    expect(sanitizeName(undefined)).toBe(''));

  it('accepts all characters in NAME_CHARSET', () => {
    // Every character in the charset should survive the filter unchanged
    const result = sanitizeName(NAME_CHARSET.slice(0, NAME_MAX_LENGTH));
    expect(result.length).toBe(Math.min(NAME_CHARSET.length, NAME_MAX_LENGTH));
  });
});

// ── generatePlayerId ──────────────────────────────────────────────────────
describe('generatePlayerId', () => {
  it('returns a non-empty string', () =>
    expect(typeof generatePlayerId()).toBe('string'));

  it('generates unique IDs across calls', () => {
    const ids = new Set(Array.from({ length: 200 }, () => generatePlayerId()));
    // At 8 base-36 chars the collision probability is negligible
    expect(ids.size).toBe(200);
  });
});

// ── encodeSeed / decodeSeed ───────────────────────────────────────────────
describe('encodeSeed', () => {
  it('returns exactly 3 bytes', () =>
    expect(encodeSeed('AB12')).toHaveLength(3));

  it('each byte is in [0, 255]', () => {
    const bytes = encodeSeed('ZZZZ');
    for (const b of bytes) {
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(255);
    }
  });
});

describe('decodeSeed', () => {
  it('returns a 4-character string', () =>
    expect(decodeSeed(0, 0, 0)).toHaveLength(4));

  it('"0000" encodes to all-zero bytes', () => {
    const [b0, b1, b2] = encodeSeed('0000');
    expect(b0).toBe(0);
    expect(b1).toBe(0);
    expect(b2).toBe(0);
  });
});

describe('encodeSeed / decodeSeed round-trip', () => {
  const seeds = ['0000', 'ZZZZ', 'AB3F', '1A2B', '0001'];
  for (const seed of seeds) {
    it(`"${seed}" survives encode → decode`, () => {
      const [b0, b1, b2] = encodeSeed(seed);
      expect(decodeSeed(b0, b1, b2)).toBe(seed);
    });
  }
});

// ── encodePlayers / decodePlayers ─────────────────────────────────────────
describe('encodePlayers / decodePlayers', () => {
  const players = [
    { id: 'aaa', name: 'ALICE' },
    { id: 'bbb', name: 'BOB' },
    { id: 'ccc', name: 'CHARLIE' },
  ];

  it('round-trips player names', () => {
    const buf             = encodePlayers(players);
    const { players: out } = decodePlayers(buf, 0);
    expect(out.map((p) => p.name)).toEqual(players.map((p) => p.name));
  });

  it('assigns fresh ephemeral IDs (does not restore originals)', () => {
    const buf             = encodePlayers(players);
    const { players: out } = decodePlayers(buf, 0);
    const originalIds     = players.map((p) => p.id);
    for (const p of out) {
      expect(originalIds).not.toContain(p.id);
    }
  });

  it('returns the correct player count', () => {
    const buf             = encodePlayers(players);
    const { players: out } = decodePlayers(buf, 0);
    expect(out).toHaveLength(players.length);
  });

  it('handles an empty player list', () => {
    const buf             = encodePlayers([]);
    const { players: out } = decodePlayers(buf, 0);
    expect(out).toHaveLength(0);
  });

  it('sanitizes names during encoding (strips invalid chars)', () => {
    const dirty           = [{ id: 'x', name: 'hel!lo' }];
    const buf             = encodePlayers(dirty);
    const { players: out } = decodePlayers(buf, 0);
    expect(out[0].name).toBe('HELLO');
  });

  it('respects a non-zero byte offset', () => {
    const buf             = encodePlayers(players);
    // Prepend 4 padding bytes and decode with offset=4
    const padded = new Uint8Array(4 + buf.length);
    padded.set(buf, 4);
    const { players: out } = decodePlayers(padded, 4);
    expect(out.map((p) => p.name)).toEqual(players.map((p) => p.name));
  });
});

// ── buildGameStateParam / parseGameStateParam ─────────────────────────────
describe('buildGameStateParam / parseGameStateParam', () => {
  it('round-trips gameTypeId, isLobby=true, and arbitrary payload', () => {
    const payload   = new Uint8Array([1, 2, 3, 4, 5]);
    const encoded   = buildGameStateParam(1, true, payload);
    const { gameTypeId, isLobby, gamePayload } = parseGameStateParam(encoded);
    expect(gameTypeId).toBe(1);
    expect(isLobby).toBe(true);
    expect(Array.from(gamePayload)).toEqual(Array.from(payload));
  });

  it('round-trips isLobby=false', () => {
    const encoded = buildGameStateParam(0, false, new Uint8Array([0]));
    expect(parseGameStateParam(encoded).isLobby).toBe(false);
  });

  it('preserves all valid gameTypeIds (0-7)', () => {
    for (let id = 0; id <= 7; id++) {
      const encoded = buildGameStateParam(id, false, new Uint8Array([0]));
      expect(parseGameStateParam(encoded).gameTypeId).toBe(id);
    }
  });

  it('produces a URL-safe string (no +, /, or = characters)', () => {
    const encoded = buildGameStateParam(2, true, new Uint8Array([10, 20, 30, 40]));
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it('throws on malformed base64url input', () => {
    expect(() => parseGameStateParam('!!!not-base64!!!')).toThrow();
  });
});
