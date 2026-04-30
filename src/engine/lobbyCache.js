// src/engine/lobbyCache.js — Persists recent lobby↔player-name associations.
//
// When a player joins a lobby whose checksum is already cached, their name
// is auto-selected. Changing identity via the warning flow still writes a new
// entry, preventing any soft-lock situation.
//
// ── Configuration ────────────────────────────────────────────────────────────
const LOBBY_CACHE_SIZE = 5; // number of recent lobbies to remember
// ─────────────────────────────────────────────────────────────────────────────

const LS_KEY = 'deceptive_lobby_cache';

function read() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) ?? []; }
  catch { return []; }
}

function write(entries) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(entries)); }
  catch { /* localStorage quota exceeded — silently skip */ }
}

/**
 * Looks up the player the user chose last time for this lobby checksum.
 * Returns the matching player object from `players`, or null if not found.
 */
export function findCachedPlayer(checksum, players) {
  if (!checksum || !players?.length) return null;
  const entry = read().find((e) => e.checksum === checksum);
  if (!entry) return null;
  // Prefer id match; fall back to name match (handles re-generated player ids)
  return players.find((p) => p.id === entry.playerId)
      ?? players.find((p) => p.name === entry.playerName)
      ?? null;
}

/**
 * Saves (or updates) the checksum→player mapping.
 * The most-recent entry is always at index 0; old entries beyond the limit drop off.
 */
export function saveLobbyCache(checksum, player) {
  if (!checksum || !player) return;
  const cache = read().filter((e) => e.checksum !== checksum); // deduplicate
  cache.unshift({ checksum, playerId: player.id, playerName: player.name });
  write(cache.slice(0, LOBBY_CACHE_SIZE));
}
