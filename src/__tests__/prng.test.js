// src/__tests__/prng.test.js — Unit tests for the deterministic PRNG & seed utilities
import { describe, it, expect } from 'vitest';
import {
  SEED_CHARS,
  SEED_LENGTH,
  SEED_BASE,
  SEED_MAX,
  seedToInt,
  intToSeed,
  normalizeSeed,
  createPRNG,
  generateTimeSeed,
  deterministicShuffle,
} from '../engine/prng';

// ── Constants ──────────────────────────────────────────────────────────────
describe('prng constants', () => {
  it('SEED_BASE is 36', () => expect(SEED_BASE).toBe(36));
  it('SEED_LENGTH is 4', () => expect(SEED_LENGTH).toBe(4));
  it('SEED_MAX equals 36^4', () => expect(SEED_MAX).toBe(36 ** 4));
  it('SEED_CHARS contains exactly SEED_BASE characters', () =>
    expect(SEED_CHARS.length).toBe(SEED_BASE));
  it('SEED_CHARS contains 0-9 and A-Z', () => {
    expect(SEED_CHARS).toMatch(/^[0-9A-Z]+$/);
  });
});

// ── seedToInt / intToSeed ─────────────────────────────────────────────────
describe('seedToInt', () => {
  it('converts "0000" to 0', () => expect(seedToInt('0000')).toBe(0));
  it('converts "ZZZZ" to SEED_MAX - 1', () =>
    expect(seedToInt('ZZZZ')).toBe(SEED_MAX - 1));
  it('is case-insensitive', () =>
    expect(seedToInt('ab12')).toBe(seedToInt('AB12')));
});

describe('intToSeed', () => {
  it('converts 0 to "0000"', () => expect(intToSeed(0)).toBe('0000'));
  it('returns a 4-char string', () =>
    expect(intToSeed(12345)).toHaveLength(SEED_LENGTH));
  it('only produces characters from SEED_CHARS', () => {
    const seed = intToSeed(99999);
    expect([...seed].every((c) => SEED_CHARS.includes(c))).toBe(true);
  });
  it('wraps at SEED_MAX', () =>
    expect(intToSeed(SEED_MAX)).toBe('0000'));
  it('handles negative values by wrapping to positive', () =>
    expect(intToSeed(-1)).toBe(intToSeed(SEED_MAX - 1)));
});

describe('seedToInt / intToSeed round-trip', () => {
  const pairs = [0, 1, 12345, 999999, SEED_MAX - 1];
  for (const n of pairs) {
    it(`int ${n} survives int → seed → int`, () =>
      expect(seedToInt(intToSeed(n))).toBe(n));
  }

  const seeds = ['0000', 'ZZZZ', 'AB3F', '1A2B'];
  for (const s of seeds) {
    it(`seed "${s}" survives seed → int → seed`, () =>
      expect(intToSeed(seedToInt(s))).toBe(s));
  }
});

// ── normalizeSeed ─────────────────────────────────────────────────────────
describe('normalizeSeed', () => {
  it('pads short seeds with leading zeros', () =>
    expect(normalizeSeed('A')).toBe('000A'));
  it('truncates to SEED_LENGTH', () =>
    expect(normalizeSeed('ABCDE')).toHaveLength(SEED_LENGTH));
  it('replaces invalid characters with "0"', () =>
    expect(normalizeSeed('!@#$')).toBe('0000'));
  it('uppercases lowercase letters', () =>
    expect(normalizeSeed('ab12')).toBe('AB12'));
  it('handles null gracefully', () =>
    expect(normalizeSeed(null)).toBe('0000'));
  it('handles undefined gracefully', () =>
    expect(normalizeSeed(undefined)).toBe('0000'));
  it('handles empty string', () =>
    expect(normalizeSeed('')).toBe('0000'));
  it('preserves a valid 4-char seed unchanged', () =>
    expect(normalizeSeed('AB3F')).toBe('AB3F'));
});

// ── createPRNG ────────────────────────────────────────────────────────────
describe('createPRNG', () => {
  it('next() returns values in [0, 1)', () => {
    const prng = createPRNG('AB12');
    for (let i = 0; i < 100; i++) {
      const v = prng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('same seed → identical call sequence', () => {
    const a = createPRNG('TEST');
    const b = createPRNG('TEST');
    for (let i = 0; i < 20; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('different seeds → different sequences', () => {
    const a = Array.from({ length: 10 }, () => createPRNG('AAAA').next());
    const b = Array.from({ length: 10 }, () => createPRNG('BBBB').next());
    // The sequences must differ at least once (astronomically unlikely to match)
    const aVals = [];
    const bVals = [];
    const pa = createPRNG('AAAA');
    const pb = createPRNG('BBBB');
    for (let i = 0; i < 10; i++) { aVals.push(pa.next()); bVals.push(pb.next()); }
    expect(aVals).not.toEqual(bVals);
  });

  it('nextInt(min, max) returns integers in [min, max)', () => {
    const prng = createPRNG('AB12');
    for (let i = 0; i < 100; i++) {
      const v = prng.nextInt(5, 15);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(15);
    }
  });

  it('nextFrom(arr) always picks an element from the array', () => {
    const arr  = ['alpha', 'beta', 'gamma'];
    const prng = createPRNG('AB12');
    for (let i = 0; i < 50; i++) {
      expect(arr).toContain(prng.nextFrom(arr));
    }
  });

  it('is deterministic across separate PRNG instances with the same seed', () => {
    const arr = ['a', 'b', 'c', 'd'];
    const p1  = createPRNG('SEED');
    const p2  = createPRNG('SEED');
    for (let i = 0; i < 20; i++) {
      expect(p1.nextFrom(arr)).toBe(p2.nextFrom(arr));
    }
  });
});

// ── generateTimeSeed ──────────────────────────────────────────────────────
describe('generateTimeSeed', () => {
  it('returns a 4-character string', () =>
    expect(generateTimeSeed()).toHaveLength(SEED_LENGTH));

  it('only contains valid base-36 characters', () => {
    const seed = generateTimeSeed();
    expect([...seed].every((c) => SEED_CHARS.includes(c))).toBe(true);
  });

  it('produces values inside the valid seed space', () => {
    for (let i = 0; i < 5; i++) {
      const n = seedToInt(generateTimeSeed());
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(SEED_MAX);
    }
  });
});

// ── deterministicShuffle ──────────────────────────────────────────────────
describe('deterministicShuffle', () => {
  it('returns all input elements (no additions or removals)', () => {
    const arr  = [1, 2, 3, 4, 5];
    const prng = createPRNG('SHUF');
    const result = deterministicShuffle(arr, prng);
    expect([...result].sort((a, b) => a - b)).toEqual([...arr].sort((a, b) => a - b));
  });

  it('does not mutate the input array', () => {
    const arr  = [1, 2, 3];
    const orig = [...arr];
    deterministicShuffle(arr, createPRNG('SHUF'));
    expect(arr).toEqual(orig);
  });

  it('same seed → same shuffle order', () => {
    const arr = [1, 2, 3, 4, 5, 6];
    expect(deterministicShuffle(arr, createPRNG('SAME')))
      .toEqual(deterministicShuffle(arr, createPRNG('SAME')));
  });

  it('different seeds typically produce different orders', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const r1  = deterministicShuffle(arr, createPRNG('AAAA'));
    const r2  = deterministicShuffle(arr, createPRNG('ZZZZ'));
    // With 8! = 40320 permutations, a collision is extremely unlikely
    expect(r1).not.toEqual(r2);
  });

  it('handles an empty array', () => {
    expect(deterministicShuffle([], createPRNG('SHUF'))).toEqual([]);
  });

  it('handles a single-element array', () => {
    expect(deterministicShuffle([42], createPRNG('SHUF'))).toEqual([42]);
  });

  it('shuffled name order is identical for arrays with the same names in the same positions but different object IDs', () => {
    // Simulates two devices decoding the same QR code: decodePlayers() assigns
    // fresh ephemeral IDs on each device while preserving name order.  The
    // shuffle result must depend only on the PRNG (seed) and the element
    // positions — never on the identity of the objects being shuffled.
    const device1 = [
      { id: 'old-1', name: 'ALICE' },
      { id: 'old-2', name: 'BOB'   },
      { id: 'old-3', name: 'CAROL' },
      { id: 'old-4', name: 'DAVE'  },
      { id: 'old-5', name: 'EVE'   },
    ];
    const device2 = [
      { id: 'new-1', name: 'ALICE' },
      { id: 'new-2', name: 'BOB'   },
      { id: 'new-3', name: 'CAROL' },
      { id: 'new-4', name: 'DAVE'  },
      { id: 'new-5', name: 'EVE'   },
    ];
    const shuffled1 = deterministicShuffle(device1, createPRNG('AB12'));
    const shuffled2 = deterministicShuffle(device2, createPRNG('AB12'));
    expect(shuffled1.map((p) => p.name)).toEqual(shuffled2.map((p) => p.name));
  });
});
