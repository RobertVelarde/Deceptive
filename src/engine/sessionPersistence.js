// src/engine/sessionPersistence.js — Refresh-agnostic session persistence.
//
// Stores a minimal session record in localStorage so users resume exactly
// where they left off after a page refresh or a full browser restart.
//
// Stored schema:
//   {
//     playerName:    string,   // player's display name
//     playerId:      string,   // stable player ID
//     currentScreen: string,   // 'lobby' | 'pregame' | 'playing'
//     lobbyID:       string,   // lobby checksum — used to detect stale data
//     isCreator:     boolean,  // true = created the lobby; false = joined via QR
//     savedAt:       number,   // epoch ms at time of last write
//   }
//
// Stale-data guard: entries older than SESSION_TTL_MS are silently discarded
// on read and removed from storage.

export const STORAGE_KEY    = 'deceptive:session';
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Read and validate the persisted session.
 *
 * Returns a session object when one exists and is still fresh.
 * Returns `null` when:
 *   - localStorage has no entry for the key
 *   - the stored value cannot be parsed as a JSON object
 *   - the entry is older than SESSION_TTL_MS
 *
 * @returns {{ playerName: string|undefined, playerId: string|undefined,
 *             currentScreen: string|undefined, lobbyID: string|undefined,
 *             isCreator: boolean|undefined } | null}
 */
export function readSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    // Reject stale sessions
    if (typeof data.savedAt === 'number' && Date.now() - data.savedAt > SESSION_TTL_MS) {
      clearSession();
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Persist a full session record, automatically stamping `savedAt` with the
 * current epoch. Any fields not included in `data` are omitted from storage.
 *
 * @param {{ playerName?: string, playerId?: string, currentScreen?: string,
 *           lobbyID?: string, isCreator?: boolean }} data
 */
export function saveSession(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
  } catch {
    // localStorage quota exceeded or unavailable (e.g. private-browsing limits) — ignore
  }
}

/**
 * Merge `patch` into the existing session record, then re-write.
 * If no session exists yet, a new one is created from `patch` alone.
 * `savedAt` is refreshed on every call.
 *
 * @param {Partial<{playerName, playerId, currentScreen, lobbyID, isCreator}>} patch
 */
export function updateSession(patch) {
  const existing = readSession() ?? {};
  saveSession({ ...existing, ...patch });
}

/**
 * Drop the player identity fields (`playerName`, `playerId`) from the session
 * while keeping the rest of the context intact.
 * Called when the user explicitly changes their name mid-session.
 */
export function clearIdentityFromSession() {
  const session = readSession();
  if (!session) return;
  // eslint-disable-next-line no-unused-vars
  const { playerName: _n, playerId: _i, ...rest } = session;
  saveSession(rest);
}

/**
 * Remove the persisted session entirely.
 * Called when the user navigates back to the home screen or the game ends.
 */
export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
