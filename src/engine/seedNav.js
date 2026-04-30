// src/engine/seedNav.js — Bidirectional seed traversal
// Invariant: getPrevSeed(getNextSeed(s)) === s for all valid seeds.
import { seedToInt, intToSeed, normalizeSeed, SEED_MAX } from './prng';

// Step size: a large prime co-prime to SEED_MAX (36^4 = 1,679,616).
// gcd(741593, 1679616) = 1, guaranteeing a full-cycle traversal over all seeds.
const STEP = 741593;

/** Advance seed by a large co-prime step (full cycle guaranteed). */
export function getNextSeed(seed) {
  const current = seedToInt(normalizeSeed(seed));
  // Use modulo to wrap back to 0 after reaching SEED_MAX
  const next = (current + STEP) % SEED_MAX;
  return intToSeed(next);
}

/** Retreat seed by the same step — the strict inverse. */
export function getPrevSeed(seed) {
  const current = seedToInt(normalizeSeed(seed));
  // Adding SEED_MAX ensures the result is positive before applying modulo
  const prev = (current - STEP + SEED_MAX) % SEED_MAX;
  return intToSeed(prev);
}