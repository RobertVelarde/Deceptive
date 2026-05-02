// src/engine/gamestate.js — Compact ?gs= URL encoding
//
// Produces a base64url string that is safe to use as a query-parameter value.
// Format: base64url( [header(1B) | game_payload_bytes] )
//   Header byte: bits [7..5] = gameTypeId (3 bits)  bits [4..0] = 0 (reserved)
//
// The 3-bit game type ID is authoritative — the app uses it to route the
// payload to the correct module's decodeGameState() without inspecting content.
//
// Adding a new game: assign the next ID in GAME_TYPE_IDS and register its
// module with encodeGameState / decodeGameState. Nothing else needs changing.
//
// INVARIANT: No React imports. Safe for Node.js and Web Workers.
import { SEED_CHARS, SEED_BASE, SEED_LENGTH } from './prng';

// ── Game type registry ─────────────────────────────────────────────────────
/** Map game name → 3-bit ID (0-7). Must never be reordered once published. */
export const GAME_TYPE_IDS = {
  insider:    0,
  chameleon:  1,
  spyfall:    2,
  wavelength: 3,
};

/** Reverse map: 3-bit ID → game name. Built automatically from GAME_TYPE_IDS. */
export const GAME_TYPE_FROM_ID = Object.fromEntries(
  Object.entries(GAME_TYPE_IDS).map(([name, id]) => [id, name]),
);

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Build the ?gs= query-parameter value.
 *
 * Header byte layout:
 *   bits [7..5] = gameTypeId (3 bits)
 *   bit  [4]   = isLobby    (1 = editing lobby, 0 = pregame / ready to play)
 *   bits [3..0] = reserved (0)
 *
 * @param {number}     gameTypeId  — 3-bit value from GAME_TYPE_IDS
 * @param {boolean}    isLobby     — true while the lobby editor is open
 * @param {Uint8Array} gamePayload — opaque bytes produced by module.encodeGameState()
 * @returns {string} base64url string (no padding, URL-safe characters)
 */
export function buildGameStateParam(gameTypeId, isLobby, gamePayload) {
  const buf = new Uint8Array(1 + gamePayload.length);
  buf[0] = ((gameTypeId & 0x07) << 5) | (isLobby ? 0x10 : 0x00);
  buf.set(gamePayload, 1);
  return _uint8ToBase64url(buf);
}

/**
 * Parse the ?gs= query-parameter value.
 *
 * @param {string} encoded — base64url string (from buildGameStateParam)
 * @returns {{ gameTypeId: number, isLobby: boolean, gamePayload: Uint8Array }}
 * @throws on invalid base64url input
 */
export function parseGameStateParam(encoded) {
  const buf        = _base64urlToUint8(encoded);
  const gameTypeId = (buf[0] >>> 5) & 0x07;
  const isLobby    = Boolean(buf[0] & 0x10);
  return { gameTypeId, isLobby, gamePayload: buf.slice(1) };
}

// ── Name charset & validation ────────────────────────────────────────────

/**
 * Exactly 32 valid characters (2^5) — one per 5-bit slot.
 * Index 0-25: A-Z  |  26: space  |  27: .  |  28: '  |  29: "  |  30: -  |  31: _
 */
export const NAME_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ .'\"- _";

/** Maximum player-name length. 12 chars × 5 bits = 60 bits. */
export const NAME_MAX_LENGTH = 12;

/**
 * Coerce a raw string into a valid player name:
 *   - Uppercase all letters
 *   - Strip any character not in NAME_CHARSET
 *   - Truncate to NAME_MAX_LENGTH
 */
export function sanitizeName(raw) {
  return (raw ?? '')
    .toUpperCase()
    .split('')
    .filter((c) => NAME_CHARSET.includes(c))
    .slice(0, NAME_MAX_LENGTH)
    .join('');
}

// ── Shared binary helpers (used by game-module encode/decode methods) ──────

/**
 * Encode a 4-char base-36 seed string to 3 bytes (big-endian uint24).
 * Seed space = 36^4 = 1,679,616 < 2^24 — always fits.
 *
 * @param {string} seed — 4-char uppercase base-36 string (e.g. "AB12")
 * @returns {[number, number, number]}
 */
export function encodeSeed(seed) {
  const n = parseInt(seed.toUpperCase(), SEED_BASE);
  return [(n >>> 16) & 0xFF, (n >>> 8) & 0xFF, n & 0xFF];
}

/**
 * Decode 3 bytes (big-endian uint24) back to a 4-char base-36 seed string.
 *
 * @param {number} b0 b1 b2 — raw bytes
 * @returns {string} 4-char uppercase seed (e.g. "AB12")
 */
export function decodeSeed(b0, b1, b2) {
  let n = (b0 << 16) | (b1 << 8) | b2;
  let s = '';
  for (let i = 0; i < SEED_LENGTH; i++) {
    s = SEED_CHARS[n % SEED_BASE] + s;
    n = Math.floor(n / SEED_BASE);
  }
  return s;
}

/**
 * Encode a player list using 5-bit-per-character packing.
 * Layout (bit stream): [count:8] ([nameLen:4] [charIdx:5]×nameLen) ...
 * Player IDs are intentionally omitted — they are session-ephemeral keys.
 *
 * @param {{ id: string, name: string }[]} players
 * @returns {Uint8Array}
 */
export function encodePlayers(players) {
  const names     = players.map((p) => sanitizeName(p.name));
  const totalBits = 8 + names.reduce((s, n) => s + 4 + n.length * 5, 0);
  const buf       = new Uint8Array(Math.ceil(totalBits / 8)); // zero-filled
  let pos = 0;
  pos = _writeBits(buf, pos, players.length, 8);
  for (const name of names) {
    pos = _writeBits(buf, pos, name.length, 4);
    for (const ch of name) {
      pos = _writeBits(buf, pos, NAME_CHARSET.indexOf(ch), 5);
    }
  }
  return buf;
}

/**
 * Decode a player list from a Uint8Array view starting at byte `offset`.
 * New ephemeral IDs are generated for each player (IDs were not stored).
 *
 * @param {Uint8Array} view
 * @param {number}     offset — byte index within view where player data starts
 * @returns {{ players: {id:string, name:string}[], bytesRead: number }}
 */
export function decodePlayers(view, offset = 0) {
  let bitPos      = offset * 8;
  let r           = _readBits(view, bitPos, 8); bitPos = r.pos;
  const count     = r.value;
  const players   = [];
  for (let i = 0; i < count; i++) {
    r = _readBits(view, bitPos, 4); bitPos = r.pos;
    const len = r.value;
    let name = '';
    for (let j = 0; j < len; j++) {
      r = _readBits(view, bitPos, 5); bitPos = r.pos;
      name += NAME_CHARSET[r.value] ?? '';
    }
    players.push({ id: generatePlayerId(), name });
  }
  return { players, bytesRead: Math.ceil((bitPos - offset * 8) / 8) };
}

/**
 * Encode a fixed-length array of words using 5-bit-per-character packing.
 * Each word: [nameLen:4][charIdx:5]×nameLen — same charset as NAME_CHARSET.
 * Words are sanitized and truncated to NAME_MAX_LENGTH before encoding.
 *
 * @param {string[]} words
 * @returns {Uint8Array}
 */
export function encodeWordList(words) {
  const sanitized = words.map((w) => sanitizeName(w));
  const totalBits = sanitized.reduce((s, w) => s + 4 + w.length * 5, 0);
  const buf = new Uint8Array(Math.ceil(totalBits / 8));
  let pos = 0;
  for (const word of sanitized) {
    pos = _writeBits(buf, pos, word.length, 4);
    for (const ch of word) {
      pos = _writeBits(buf, pos, NAME_CHARSET.indexOf(ch), 5);
    }
  }
  return buf;
}

/**
 * Decode `count` words from a Uint8Array starting at bit position `startBit`.
 * Returns the decoded words and the total number of bits consumed.
 *
 * @param {Uint8Array} view
 * @param {number}     count        — number of words to decode
 * @param {number}     [startBit=0] — bit offset within view to start from
 * @returns {{ words: string[], bitsRead: number }}
 */
export function decodeWordList(view, count, startBit = 0) {
  let bitPos = startBit;
  const words = [];
  for (let i = 0; i < count; i++) {
    let r = _readBits(view, bitPos, 4); bitPos = r.pos;
    const len = r.value;
    let word = '';
    for (let j = 0; j < len; j++) {
      r = _readBits(view, bitPos, 5); bitPos = r.pos;
      word += NAME_CHARSET[r.value] ?? '';
    }
    words.push(word);
  }
  return { words, bitsRead: bitPos - startBit };
}

// ── Internal helpers ───────────────────────────────────────────────────────

/**
 * Generate a short random session-ephemeral player ID.
 * IDs are stable keys within a single session and are never persisted or
 * included in encoded game state — they do not affect game logic.
 */
export function generatePlayerId() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Write `n` bits of `value` (MSB-first) into `buf` starting at bit position `pos`.
 * Returns the new bit position.
 */
function _writeBits(buf, pos, value, n) {
  for (let i = n - 1; i >= 0; i--) {
    const bit = (value >>> i) & 1;
    buf[pos >> 3] |= bit << (7 - (pos & 7));
    pos++;
  }
  return pos;
}

/**
 * Read `n` bits (MSB-first) from `buf` starting at bit position `pos`.
 * Returns { value, pos } where pos is the new bit position.
 */
function _readBits(buf, pos, n) {
  let value = 0;
  for (let i = 0; i < n; i++) {
    value = (value << 1) | ((buf[pos >> 3] >>> (7 - (pos & 7))) & 1);
    pos++;
  }
  return { value, pos };
}

/** Encode a Uint8Array to a URL-safe base64 string (no padding). */
function _uint8ToBase64url(buf) {
  let binary = '';
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Decode a URL-safe base64 string (with or without padding) to Uint8Array. */
function _base64urlToUint8(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded  = base64 + '=='.slice(0, (4 - (base64.length % 4)) % 4);
  const binary  = atob(padded);
  const buf     = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf;
}
