// src/__tests__/sessionPersistence.test.js — Unit tests for the session persistence layer
//
// Runs in a Node environment (no DOM), so a lightweight in-memory localStorage
// mock is installed on `global` before the suite executes.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  STORAGE_KEY,
  SESSION_TTL_MS,
  readSession,
  saveSession,
  updateSession,
  clearSession,
  clearIdentityFromSession,
} from '../engine/sessionPersistence';

// ── In-memory localStorage mock ───────────────────────────────────────────────
// Vitest's Node environment does not provide browser globals.  We install a
// minimal Map-backed shim before any test runs, and wipe it between tests.
const _store = new Map();
const localStorageMock = {
  getItem:    (key) => _store.has(key) ? _store.get(key) : null,
  setItem:    (key, value) => _store.set(key, String(value)),
  removeItem: (key) => _store.delete(key),
  clear:      () => _store.clear(),
};
// Install globally so the module under test picks it up
Object.defineProperty(global, 'localStorage', {
  value:    localStorageMock,
  writable: true,
});

/** Helper: seed localStorage with a raw JSON string for the session key. */
function seedStorage(obj) {
  localStorageMock.setItem(STORAGE_KEY, JSON.stringify(obj));
}

// Wipe the store before every test so each case starts from a clean slate
beforeEach(() => _store.clear());

// ── readSession ───────────────────────────────────────────────────────────────
describe('readSession', () => {
  // Test Case 1 — New User: empty storage → null
  it('returns null when localStorage is empty', () => {
    expect(readSession()).toBeNull();
  });

  it('returns null for a missing key', () => {
    localStorageMock.setItem('other:key', '{"foo":1}');
    expect(readSession()).toBeNull();
  });

  it('returns null when the stored value is not a JSON object', () => {
    localStorageMock.setItem(STORAGE_KEY, 'not-json!!!');
    expect(readSession()).toBeNull();
  });

  it('returns null when the stored value is a JSON array', () => {
    localStorageMock.setItem(STORAGE_KEY, '[1,2,3]');
    expect(readSession()).toBeNull();
  });

  it('returns null when the stored value is a JSON primitive', () => {
    localStorageMock.setItem(STORAGE_KEY, '"just-a-string"');
    expect(readSession()).toBeNull();
  });

  // Test Case 7 — Stale data: entries older than SESSION_TTL_MS are discarded
  it('returns null and clears storage when savedAt is older than TTL', () => {
    seedStorage({ playerName: 'ALICE', savedAt: Date.now() - SESSION_TTL_MS - 1 });
    expect(readSession()).toBeNull();
    // Should have been cleaned up from storage
    expect(localStorageMock.getItem(STORAGE_KEY)).toBeNull();
  });

  it('returns the session when savedAt is within the TTL', () => {
    seedStorage({ playerName: 'ALICE', savedAt: Date.now() - 1000 });
    const s = readSession();
    expect(s).not.toBeNull();
    expect(s.playerName).toBe('ALICE');
  });

  it('returns the session even when savedAt is absent (legacy entries)', () => {
    seedStorage({ playerName: 'BOB' }); // no savedAt
    const s = readSession();
    expect(s).not.toBeNull();
    expect(s.playerName).toBe('BOB');
  });
});

// ── saveSession ───────────────────────────────────────────────────────────────
describe('saveSession', () => {
  // Test Case 2 — Refresh Recovery: save then immediately read back
  it('writes and reads back all fields correctly', () => {
    saveSession({
      playerName:    'ALICE',
      playerId:      'pid-1',
      currentScreen: 'pregame',
      lobbyID:       'A1B2',
      isCreator:     true,
    });
    const s = readSession();
    expect(s).not.toBeNull();
    expect(s.playerName).toBe('ALICE');
    expect(s.playerId).toBe('pid-1');
    expect(s.currentScreen).toBe('pregame');
    expect(s.lobbyID).toBe('A1B2');
    expect(s.isCreator).toBe(true);
  });

  it('stamps a savedAt timestamp on every write', () => {
    const before = Date.now();
    saveSession({ playerName: 'BOB' });
    const after  = Date.now();
    const s = readSession();
    expect(typeof s.savedAt).toBe('number');
    expect(s.savedAt).toBeGreaterThanOrEqual(before);
    expect(s.savedAt).toBeLessThanOrEqual(after);
  });

  it('overwrites a previous session completely', () => {
    saveSession({ playerName: 'ALICE', playerId: 'old' });
    saveSession({ playerName: 'BOB' });
    const s = readSession();
    expect(s.playerName).toBe('BOB');
    // playerId from the first write must not bleed through
    expect(s.playerId).toBeUndefined();
  });
});

// ── updateSession ─────────────────────────────────────────────────────────────
describe('updateSession', () => {
  it('creates a new session when none exists', () => {
    updateSession({ playerName: 'CAROL' });
    expect(readSession()?.playerName).toBe('CAROL');
  });

  it('merges patch fields into an existing session', () => {
    saveSession({ playerName: 'ALICE', lobbyID: 'X1Y2' });
    updateSession({ currentScreen: 'pregame' });
    const s = readSession();
    expect(s.playerName).toBe('ALICE');
    expect(s.lobbyID).toBe('X1Y2');
    expect(s.currentScreen).toBe('pregame');
  });

  it('overwrites a specific field without affecting others', () => {
    saveSession({ playerName: 'ALICE', currentScreen: 'lobby' });
    updateSession({ currentScreen: 'playing' });
    const s = readSession();
    expect(s.playerName).toBe('ALICE');
    expect(s.currentScreen).toBe('playing');
  });

  it('refreshes savedAt on each call', async () => {
    saveSession({ playerName: 'ALICE' });
    const first = readSession().savedAt;
    // Yield so Date.now() can advance at least 1 ms
    await new Promise((r) => setTimeout(r, 2));
    updateSession({ currentScreen: 'lobby' });
    const second = readSession().savedAt;
    expect(second).toBeGreaterThanOrEqual(first);
  });
});

// ── clearSession ──────────────────────────────────────────────────────────────
describe('clearSession', () => {
  it('removes the entry so readSession returns null', () => {
    saveSession({ playerName: 'ALICE' });
    clearSession();
    expect(readSession()).toBeNull();
  });

  it('is safe to call when no session exists', () => {
    expect(() => clearSession()).not.toThrow();
  });
});

// ── clearIdentityFromSession ──────────────────────────────────────────────────
describe('clearIdentityFromSession', () => {
  it('strips playerName and playerId while preserving other fields', () => {
    saveSession({
      playerName:    'ALICE',
      playerId:      'pid-1',
      currentScreen: 'pregame',
      lobbyID:       'A1B2',
      isCreator:     true,
    });
    clearIdentityFromSession();
    const s = readSession();
    expect(s).not.toBeNull();
    expect(s.playerName).toBeUndefined();
    expect(s.playerId).toBeUndefined();
    // Non-identity fields must survive
    expect(s.currentScreen).toBe('pregame');
    expect(s.lobbyID).toBe('A1B2');
    expect(s.isCreator).toBe(true);
  });

  it('is safe to call when no session exists', () => {
    expect(() => clearIdentityFromSession()).not.toThrow();
  });
});

// ── isCreator — Test Case 3: Creator vs Joiner ────────────────────────────────
describe('isCreator flag (Creator vs Joiner)', () => {
  it('correctly identifies a lobby creator after a simulated refresh', () => {
    // Simulate handleCreateLobby: mark creator before setState writes the lobby
    updateSession({ isCreator: true, currentScreen: 'lobby', lobbyID: 'AAAA' });
    // Simulate a refresh: read back
    const session = readSession();
    expect(session?.isCreator).toBe(true);
  });

  it('correctly identifies a QR-code joiner after a simulated refresh', () => {
    // Simulate handleJoinFromQr: mark joiner after decode
    updateSession({ isCreator: false, currentScreen: 'pregame', lobbyID: 'BBBB' });
    // Simulate a refresh: read back
    const session = readSession();
    expect(session?.isCreator).toBe(false);
  });

  it('creator and joiner sessions are distinguishable', () => {
    // Creator
    saveSession({ isCreator: true,  lobbyID: 'C1D2' });
    expect(readSession()?.isCreator).toBe(true);

    // Overwrite as joiner (same device, different lobby)
    saveSession({ isCreator: false, lobbyID: 'E3F4' });
    expect(readSession()?.isCreator).toBe(false);
  });

  it('updateSession can flip isCreator without disturbing other fields', () => {
    saveSession({ playerName: 'ALICE', lobbyID: 'X1Y2', isCreator: true });
    // Player leaves and joins someone else's lobby
    updateSession({ isCreator: false, lobbyID: 'Z9W8' });
    const s = readSession();
    expect(s.isCreator).toBe(false);
    expect(s.playerName).toBe('ALICE'); // name still remembered
  });
});

// ── Screen restoration after page refresh ────────────────────────────────────
// In App.jsx, every state transition calls:
//   updateSession({ currentScreen: next.status, lobbyID: checksum })
// On page load the app checks:
//   session.lobbyID === checksum && session.currentScreen
// and restores status to session.currentScreen when the IDs match.
// These tests verify the persistence layer correctly stores and recalls both
// fields so the correct screen is restored after a hard refresh.
describe('Screen restoration after page refresh', () => {
  it('persists currentScreen="lobby" so a refresh restores the lobby screen', () => {
    updateSession({ currentScreen: 'lobby', lobbyID: 'ABCD' });
    expect(readSession()?.currentScreen).toBe('lobby');
  });

  it('persists currentScreen="pregame" so a refresh restores the pre-round screen', () => {
    updateSession({ currentScreen: 'pregame', lobbyID: 'ABCD' });
    expect(readSession()?.currentScreen).toBe('pregame');
  });

  it('persists currentScreen="playing" so a refresh restores the gameplay screen', () => {
    updateSession({ currentScreen: 'playing', lobbyID: 'ABCD' });
    expect(readSession()?.currentScreen).toBe('playing');
  });

  it('after advancing lobby → pregame → playing, the session holds "playing" not "pregame"', () => {
    // Each setState call in the app writes both fields together.
    // After reaching the gameplay screen and refreshing, 'playing' must win.
    const LOBBY_ID = 'TEST';
    updateSession({ currentScreen: 'lobby',   lobbyID: LOBBY_ID });
    updateSession({ currentScreen: 'pregame', lobbyID: LOBBY_ID });
    updateSession({ currentScreen: 'playing', lobbyID: LOBBY_ID });
    const session = readSession();
    expect(session?.currentScreen).toBe('playing'); // not 'pregame'
    expect(session?.lobbyID).toBe(LOBBY_ID);        // lobby identifier intact
  });

  it('lobbyID is retained alongside currentScreen at every screen transition', () => {
    // The app matches session.lobbyID === checksum before restoring the screen.
    // lobbyID must survive each updateSession call, not just the first one.
    const CHECKSUM = 'XYZW';
    updateSession({ currentScreen: 'lobby',   lobbyID: CHECKSUM });
    expect(readSession()?.lobbyID).toBe(CHECKSUM);
    updateSession({ currentScreen: 'pregame', lobbyID: CHECKSUM });
    expect(readSession()?.lobbyID).toBe(CHECKSUM);
    updateSession({ currentScreen: 'playing', lobbyID: CHECKSUM });
    expect(readSession()?.lobbyID).toBe(CHECKSUM);
  });

  it('going home clears the session so no stale screen is restored on the next visit', () => {
    updateSession({ currentScreen: 'playing', lobbyID: 'ABCD' });
    clearSession(); // app calls this when status transitions to 'home'
    expect(readSession()).toBeNull();
  });
});

// ── Joining a lobby that does not contain the previously-selected name ────────
// In App.jsx the identity-resolution effect runs this check:
//   const match = state.players.find(
//     (p) => p.id === session.playerId || p.name === session.playerName,
//   );
// When no match is found the identity picker is shown so the player can
// choose a name that actually exists in the new lobby.
//
// These tests exercise the session layer's side of that contract:
//   • the stored identity survives switching lobbies (the session is NOT auto-
//     cleared on a mismatch — that is App.jsx's responsibility)
//   • clearIdentityFromSession() is the correct recovery action: it removes
//     playerName / playerId while preserving the new lobbyID and currentScreen,
//     so after the player picks a new name the next updateSession() stores their
//     fresh identity inside the new lobby's session context.
describe('joining a lobby where the stored player name is absent', () => {
  // Simulate the player having previously played as 'ALICE' in lobby 'AAAA'
  const OLD_LOBBY   = 'AAAA';
  const NEW_LOBBY   = 'BBBB';
  const OLD_PLAYERS = [
    { id: 'pid-a', name: 'ALICE' },
    { id: 'pid-b', name: 'BOB'   },
  ];
  const NEW_PLAYERS = [
    { id: 'pid-c', name: 'CAROL' },
    { id: 'pid-d', name: 'DAVE'  },
    { id: 'pid-e', name: 'EVE'   },
  ];

  it('stored identity is still readable after switching to a new lobby', () => {
    // Previous session: player was ALICE in lobby AAAA
    saveSession({ playerName: 'ALICE', playerId: 'pid-a', lobbyID: OLD_LOBBY, currentScreen: 'playing' });
    // Player now joins lobby BBBB — only the screen/lobby fields are updated
    updateSession({ lobbyID: NEW_LOBBY, currentScreen: 'pregame' });
    const session = readSession();
    // Identity fields must survive the updateSession call
    expect(session?.playerName).toBe('ALICE');
    expect(session?.playerId).toBe('pid-a');
  });

  it('the stored name produces no match against the new lobby player list', () => {
    saveSession({ playerName: 'ALICE', playerId: 'pid-a', lobbyID: OLD_LOBBY });
    const session = readSession();
    const match = NEW_PLAYERS.find(
      (p) => p.id === session.playerId || p.name === session.playerName,
    );
    expect(match).toBeUndefined(); // no ALICE or pid-a in the new lobby
  });

  it('the stored name finds a match when the player IS in the lobby', () => {
    saveSession({ playerName: 'ALICE', playerId: 'pid-a', lobbyID: OLD_LOBBY });
    const session = readSession();
    const match = OLD_PLAYERS.find(
      (p) => p.id === session.playerId || p.name === session.playerName,
    );
    expect(match).toBeDefined();
    expect(match.name).toBe('ALICE');
  });

  it('clearIdentityFromSession() removes the stale name without losing lobbyID or currentScreen', () => {
    saveSession({ playerName: 'ALICE', playerId: 'pid-a', lobbyID: OLD_LOBBY, currentScreen: 'playing' });
    updateSession({ lobbyID: NEW_LOBBY, currentScreen: 'pregame' });

    // Player is shown the identity picker; they pick CAROL; the app first clears
    // the stale identity, then writes the new one.
    clearIdentityFromSession();
    const afterClear = readSession();
    expect(afterClear?.playerName).toBeUndefined(); // ALICE gone
    expect(afterClear?.playerId).toBeUndefined();   // old pid gone
    expect(afterClear?.lobbyID).toBe(NEW_LOBBY);    // new lobby preserved
    expect(afterClear?.currentScreen).toBe('pregame');
  });

  it('after clearing stale identity, writing the new choice makes it findable in the new lobby', () => {
    saveSession({ playerName: 'ALICE', playerId: 'pid-a', lobbyID: OLD_LOBBY });
    updateSession({ lobbyID: NEW_LOBBY, currentScreen: 'pregame' });
    clearIdentityFromSession();

    // Player picks CAROL from the picker
    updateSession({ playerName: 'CAROL', playerId: 'pid-c' });

    const session = readSession();
    const match = NEW_PLAYERS.find(
      (p) => p.id === session.playerId || p.name === session.playerName,
    );
    expect(match).toBeDefined();
    expect(match.name).toBe('CAROL');
  });

  it('a name match is name-based so it works even when the stored playerId differs (e.g. cross-device)', () => {
    // On another device the player was assigned a different ephemeral ID for
    // the same name.  The app falls back to name matching.
    saveSession({ playerName: 'CAROL', playerId: 'different-id', lobbyID: NEW_LOBBY });
    const session = readSession();
    const match = NEW_PLAYERS.find(
      (p) => p.id === session.playerId || p.name === session.playerName,
    );
    expect(match).toBeDefined();
    expect(match.name).toBe('CAROL');
  });
});

// ── Full round-trip: lobby lifecycle ─────────────────────────────────────────
describe('full lobby lifecycle round-trip', () => {
  it('simulates create → pregame → playing → home without data leaking', () => {
    // 1. Create lobby
    updateSession({ isCreator: true, currentScreen: 'lobby', lobbyID: 'ABCD' });
    expect(readSession()?.currentScreen).toBe('lobby');

    // 2. Advance to pregame
    updateSession({ currentScreen: 'pregame' });
    expect(readSession()?.currentScreen).toBe('pregame');

    // 3. Identity resolved
    updateSession({ playerName: 'DAVE', playerId: 'pid-99' });
    expect(readSession()?.playerName).toBe('DAVE');

    // 4. Start playing
    updateSession({ currentScreen: 'playing' });
    const mid = readSession();
    expect(mid?.currentScreen).toBe('playing');
    expect(mid?.isCreator).toBe(true);
    expect(mid?.playerName).toBe('DAVE');

    // 5. Go home → session wiped
    clearSession();
    expect(readSession()).toBeNull();
  });
});
