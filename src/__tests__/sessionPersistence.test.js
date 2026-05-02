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
