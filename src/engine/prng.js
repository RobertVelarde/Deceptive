// src/engine/prng.js — Deterministic PRNG & seed utilities
// INVARIANT: No React or UI imports in this file.
// Safe to run in Node.js, a Web Worker, or a test runner without modification.

export const SEED_CHARS  = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const SEED_LENGTH = 4;
export const SEED_BASE   = SEED_CHARS.length;        // 36
export const SEED_MAX    = SEED_BASE ** SEED_LENGTH;  // 1,679,616

/** Convert a 4-char base-36 seed string to a non-negative integer. */
export function seedToInt(seed) {
  return parseInt(seed.toUpperCase(), 36);
}

/** Convert an integer to a 4-char base-36 seed string (wraps at SEED_MAX). */
export function intToSeed(n) {
  const mod = ((n % SEED_MAX) + SEED_MAX) % SEED_MAX;
  let s = '';
  let v = mod;
  for (let i = 0; i < SEED_LENGTH; i++) {
    s = SEED_CHARS[v % SEED_BASE] + s;
    v = Math.floor(v / SEED_BASE);
  }
  return s;
}

/** Coerce any string into a valid 4-char uppercase alphanumeric seed. */
export function normalizeSeed(raw) {
  const clean = (raw ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '0');
  return clean.padStart(SEED_LENGTH, '0').slice(0, SEED_LENGTH);
}

/**
 * mulberry32 — high-quality 32-bit PRNG.
 * Returns a closure that produces uniformly distributed [0, 1) floats.
 * Identical seed → identical call sequence on every device and browser.
 */
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Create a PRNG bound to a seed string.
 * Guarantees: same seedString → same call sequence on any device.
 */
export function createPRNG(seedString) {
  const seed = seedToInt(normalizeSeed(seedString));
  const rng  = mulberry32(seed);
  return {
    next:     () => rng(),
    nextInt:  (min, max) => Math.floor(rng() * (max - min)) + min,
    nextFrom: (arr) => arr[Math.floor(rng() * arr.length)],
  };
}

/**
 * Generate a random 4-char base-36 seed derived from the current time.
 * Uses a Knuth multiplicative hash on Date.now() to spread values uniformly
 * across the full seed space. This is intentionally different from
 * getNextSeed / getPrevSeed (which use a fixed co-prime step).
 */
export function generateTimeSeed() {
  // Knuth multiplicative hash — spreads timestamp bits across seed space
  const n = (Math.imul(Date.now() & 0xFFFFFFFF, 0x9e3779b9) >>> 0) % SEED_MAX;
  return intToSeed(n);
}

/** Deterministic Fisher-Yates shuffle driven by a PRNG instance. */
export function deterministicShuffle(arr, prng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(prng.next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
