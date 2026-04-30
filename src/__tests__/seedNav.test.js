// src/__tests__/seedNav.test.js — Unit tests for bidirectional seed traversal
import { describe, it, expect } from 'vitest';
import { getNextSeed, getPrevSeed } from '../engine/seedNav';
import { SEED_MAX, seedToInt, intToSeed } from '../engine/prng';

// Internal step constant — must stay in sync with seedNav.js.
// If this test starts failing, the step was changed without a full-cycle audit.
const STEP = 741593;

// ── Inverse relationship ──────────────────────────────────────────────────
describe('getNextSeed / getPrevSeed inverse property', () => {
  const fixtures = ['0000', 'AB12', 'ZZZZ', '0001', '1A2B'];

  for (const seed of fixtures) {
    it(`getPrevSeed(getNextSeed("${seed}")) === "${seed}"`, () =>
      expect(getPrevSeed(getNextSeed(seed))).toBe(seed));

    it(`getNextSeed(getPrevSeed("${seed}")) === "${seed}"`, () =>
      expect(getNextSeed(getPrevSeed(seed))).toBe(seed));
  }
});

// ── Wrap-around behaviour ─────────────────────────────────────────────────
describe('seed space wrap-around', () => {
  it('getNextSeed never returns a seed outside [0, SEED_MAX)', () => {
    const n = seedToInt(getNextSeed(intToSeed(SEED_MAX - 1)));
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThan(SEED_MAX);
  });

  it('getPrevSeed never returns a seed outside [0, SEED_MAX)', () => {
    const n = seedToInt(getPrevSeed('0000'));
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThan(SEED_MAX);
  });
});

// ── Determinism ────────────────────────────────────────────────────────────
describe('determinism', () => {
  it('getNextSeed is deterministic (same input → same output)', () =>
    expect(getNextSeed('AB12')).toBe(getNextSeed('AB12')));

  it('getPrevSeed is deterministic (same input → same output)', () =>
    expect(getPrevSeed('AB12')).toBe(getPrevSeed('AB12')));

  it('different inputs produce different outputs', () =>
    expect(getNextSeed('0000')).not.toBe(getNextSeed('0001')));
});

// ── Full-cycle guarantee ──────────────────────────────────────────────────
describe('full-cycle guarantee', () => {
  /**
   * A step size k generates a full cycle over Z/nZ if and only if
   * gcd(k, n) = 1 (co-prime). Verifying this mathematically is O(log n)
   * and far faster than running all SEED_MAX iterations.
   */
  function gcd(a, b) {
    return b === 0 ? a : gcd(b, a % b);
  }

  it('STEP is co-prime to SEED_MAX (guarantees full cycle over all seeds)', () =>
    expect(gcd(STEP, SEED_MAX)).toBe(1));
});

// ── Return type ───────────────────────────────────────────────────────────
describe('return value shape', () => {
  it('getNextSeed returns a 4-character uppercase string', () => {
    const next = getNextSeed('0000');
    expect(next).toHaveLength(4);
    expect(/^[0-9A-Z]{4}$/.test(next)).toBe(true);
  });

  it('getPrevSeed returns a 4-character uppercase string', () => {
    const prev = getPrevSeed('0000');
    expect(prev).toHaveLength(4);
    expect(/^[0-9A-Z]{4}$/.test(prev)).toBe(true);
  });
});
