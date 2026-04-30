// src/__tests__/envelope.test.js — Unit tests for the lz-string URL envelope
import { describe, it, expect } from 'vitest';
import { ENVELOPE_VERSION, calculateChecksum, encodeState, decodeState } from '../engine/envelope';

/** A complete, valid lobby state used as a shared fixture. */
const BASE_STATE = Object.freeze({
  v:            ENVELOPE_VERSION,
  players:      [
    { id: 'aaa', name: 'ALICE' },
    { id: 'bbb', name: 'BOB' },
  ],
  gameType:     'insider',
  seed:         'AB12',
  startingSeed: 'AB12',
  round:        1,
  status:       'lobby',
  category:     '',
  checksum:     '',
});

// ── calculateChecksum ─────────────────────────────────────────────────────
describe('calculateChecksum', () => {
  it('returns a 4-character uppercase alphanumeric string', () => {
    const c = calculateChecksum(BASE_STATE);
    expect(c).toHaveLength(4);
    expect(/^[0-9A-Z]{4}$/.test(c)).toBe(true);
  });

  it('is deterministic for the same state', () => {
    expect(calculateChecksum(BASE_STATE))
      .toBe(calculateChecksum({ ...BASE_STATE }));
  });

  it('changes when players change', () => {
    const extra = { ...BASE_STATE, players: [...BASE_STATE.players, { id: 'ccc', name: 'CHARLIE' }] };
    expect(calculateChecksum(BASE_STATE)).not.toBe(calculateChecksum(extra));
  });

  it('changes when gameType changes', () => {
    expect(calculateChecksum(BASE_STATE))
      .not.toBe(calculateChecksum({ ...BASE_STATE, gameType: 'chameleon' }));
  });

  it('changes when startingSeed changes', () => {
    expect(calculateChecksum(BASE_STATE))
      .not.toBe(calculateChecksum({ ...BASE_STATE, startingSeed: 'ZZZZ' }));
  });

  it('is insensitive to player array order (sorted internally)', () => {
    const s1 = { ...BASE_STATE, players: [{ id: 'a', name: 'ALICE' }, { id: 'b', name: 'BOB' }] };
    const s2 = { ...BASE_STATE, players: [{ id: 'b', name: 'BOB' }, { id: 'a', name: 'ALICE' }] };
    expect(calculateChecksum(s1)).toBe(calculateChecksum(s2));
  });

  it('is insensitive to runtime-only fields (status, round, seed, checksum)', () => {
    const a = calculateChecksum({ ...BASE_STATE, status: 'lobby',   round: 1, seed: 'AB12' });
    const b = calculateChecksum({ ...BASE_STATE, status: 'playing', round: 5, seed: 'ZZZZ' });
    expect(a).toBe(b);
  });

  it('captures extra game-specific settings fields', () => {
    const withSetting    = { ...BASE_STATE, rotatingMaster: false };
    const changedSetting = { ...BASE_STATE, rotatingMaster: true  };
    expect(calculateChecksum(withSetting))
      .not.toBe(calculateChecksum(changedSetting));
  });
});

// ── encodeState / decodeState ─────────────────────────────────────────────
describe('encodeState / decodeState', () => {
  it('round-trips a full valid state', () => {
    const encoded = encodeState(BASE_STATE);
    const decoded = decodeState(encoded);
    expect(decoded).toEqual(BASE_STATE);
  });

  it('returns a non-empty string', () =>
    expect(encodeState(BASE_STATE).length).toBeGreaterThan(0));

  it('returns null for an empty string', () =>
    expect(decodeState('')).toBeNull());

  it('returns null for non-base64 garbage input', () =>
    expect(decodeState('!!! not valid !!!')).toBeNull());

  it('returns null when the decoded JSON lacks a players array', () => {
    // Encode a minimal object that is valid JSON but missing players
    const encoded = encodeState({ gameType: 'insider' });
    expect(decodeState(encoded)).toBeNull();
  });

  it('returns null when players is not an array', () => {
    const encoded = encodeState({ ...BASE_STATE, players: 'not-an-array' });
    expect(decodeState(encoded)).toBeNull();
  });

  it('preserves all player fields through encode/decode', () => {
    const decoded = decodeState(encodeState(BASE_STATE));
    expect(decoded.players).toEqual(BASE_STATE.players);
  });

  it('produces different encoded strings for different states', () => {
    const e1 = encodeState(BASE_STATE);
    const e2 = encodeState({ ...BASE_STATE, gameType: 'chameleon' });
    expect(e1).not.toBe(e2);
  });
});
