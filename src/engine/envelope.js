// src/engine/envelope.js — URL state envelope (lz-string compression)
// Handles: serialise → compress → URL hash, and the reverse path.
import LZString  from 'lz-string';
import { SEED_MAX } from './prng';

export const ENVELOPE_VERSION = 1;

/**
 * djb2-style 32-bit checksum over all lobby-critical fields.
 * Covers players, game type, category, starting seed, and every game-specific
 * setting — so the code stays stable round-to-round but changes whenever the
 * lobby composition or settings change.
 */
export function calculateChecksum(state) {
  // Collect all keys that are not engine-internal runtime fields.
  const engineKeys = new Set(['v', 'status', 'round', 'seed', 'checksum']);
  const settings = {};
  for (const [k, v] of Object.entries(state)) {
    if (!engineKeys.has(k) && k !== 'players' && k !== 'gameType' && k !== 'category' && k !== 'startingSeed') {
      settings[k] = v;
    }
  }
  const payload = JSON.stringify({
    v:            ENVELOPE_VERSION,
    players:      state.players.map((p) => p.name).sort(),
    gameType:     state.gameType,
    category:     state.category ?? '',
    startingSeed: state.startingSeed ?? '',
    settings,
  });
  let h = 5381;
  for (let i = 0; i < payload.length; i++) {
    h = ((h << 5) + h + payload.charCodeAt(i)) | 0;
  }
  return ((h >>> 0) % SEED_MAX).toString(36).toUpperCase().padStart(4, '0');
}

/** Compress the entire lobby state to a URL-safe string via lz-string. */
export function encodeState(state) {
  return LZString.compressToEncodedURIComponent(JSON.stringify(state));
}

/** Decompress and validate a hash-encoded state string. Returns null on failure. */
export function decodeState(encoded) {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const parsed = JSON.parse(json);
    if (!parsed || !Array.isArray(parsed.players)) return null;
    return parsed;
  } catch {
    return null;
  }
}
