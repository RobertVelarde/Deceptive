// src/engine/usePersistentTimer.js
//
// Refresh-agnostic, drift-resistant countdown timer backed by localStorage.
//
// Design: instead of persisting remaining seconds, the timer persists an
// absolute deadline (Date.now() + duration). Each tick recalculates the
// remaining time from that deadline, so background-tab throttling and device
// sleep cannot cause drift — the timer stays accurate across any gap.
//
// Lifecycle states:
//   Not started — remaining = durationSeconds, running = false
//   Running     — localStorage stores { deadline: <epoch ms> }
//   Paused      — localStorage stores { remaining: <seconds> }
//   Expired     — localStorage entry removed; remaining = 0
import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Read and validate a persisted timer entry from localStorage.
 * Returns a normalised { remaining, running, deadline } state object.
 *
 * Possible stored shapes:
 *   { deadline: number }   — timer was running when the page last unloaded
 *   { remaining: number }  — timer was paused when the page last unloaded
 *
 * @param {string}  storageKey
 * @param {number}  durationSeconds  fallback duration when no saved state exists
 * @param {boolean} autoStart        whether to start immediately with no saved state
 * @returns {{ remaining: number, running: boolean, deadline: number|null }}
 */
function readPersistedState(storageKey, durationSeconds, autoStart) {
  if (storageKey) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw !== null) {
        const data = JSON.parse(raw);

        // Running state: recompute remaining from absolute deadline
        if (typeof data?.deadline === 'number') {
          const remaining = Math.max(0, Math.floor((data.deadline - Date.now()) / 1000));
          if (remaining > 0) {
            return { remaining, running: true, deadline: data.deadline };
          }
          // Deadline has already passed — clean up and surface the expired state
          localStorage.removeItem(storageKey);
          return { remaining: 0, running: false, deadline: null };
        }

        // Paused state: use stored remaining directly
        if (typeof data?.remaining === 'number' && data.remaining > 0) {
          return { remaining: data.remaining, running: false, deadline: null };
        }
      }
    } catch {
      // Corrupt or unrelated entry — ignore and fall through
    }
  }

  // No valid persisted state: initialise from props
  if (autoStart && durationSeconds > 0) {
    const deadline = Date.now() + durationSeconds * 1000;
    return { remaining: durationSeconds, running: true, deadline };
  }
  return { remaining: durationSeconds, running: false, deadline: null };
}

/**
 * usePersistentTimer
 *
 * Countdown timer that survives page refreshes via localStorage.  The stored
 * value is an absolute UTC deadline, not a remaining-seconds snapshot, so the
 * timer stays accurate even when the tab is backgrounded or the device sleeps.
 *
 * @param {object}  opts
 * @param {number}  opts.durationSeconds  Full round duration in seconds
 * @param {string}  opts.storageKey       localStorage key; changing this value
 *                                        resets the timer to a fresh state
 *                                        (reads from the new key if available)
 * @param {boolean} [opts.autoStart]      Start immediately on mount (default: true).
 *                                        Pass false for games where the host
 *                                        manually starts the round timer.
 *
 * @returns {{
 *   remaining: number,   // seconds left (0 when expired)
 *   running:   boolean,  // true while the countdown is active
 *   expired:   boolean,  // true once remaining reaches 0
 *   start:     () => void,
 *   pause:     () => void,
 *   reset:     () => void,  // stops and restores to durationSeconds; clears storage
 * }}
 */
export function usePersistentTimer({ durationSeconds, storageKey, autoStart = true }) {
  // Compute initial values exactly once — using a ref prevents calling
  // readPersistedState twice during React StrictMode's double-invocation.
  const initRef = useRef(null);
  if (initRef.current === null) {
    initRef.current = readPersistedState(storageKey, durationSeconds, autoStart);
  }

  const [remaining, setRemaining] = useState(initRef.current.remaining);
  const [running,   setRunning]   = useState(initRef.current.running);

  // Deadline lives in a ref so the interval callback always reads the latest
  // value without needing to be re-created on every state change.
  const deadlineRef = useRef(initRef.current.deadline);

  // ── Persist on every meaningful change ─────────────────────────────────────
  useEffect(() => {
    if (!storageKey) return;
    try {
      if (running && deadlineRef.current) {
        localStorage.setItem(storageKey, JSON.stringify({ deadline: deadlineRef.current }));
      } else if (!running && remaining > 0) {
        // Paused mid-countdown: store remaining so resume works after a reload
        localStorage.setItem(storageKey, JSON.stringify({ remaining }));
      } else {
        // Expired or not yet started with default duration — nothing useful to persist
        localStorage.removeItem(storageKey);
      }
    } catch {
      // Storage unavailable (private browsing quota exceeded, etc.) — degrade gracefully
    }
  }, [running, remaining, storageKey]);

  // ── Drift-resistant countdown tick ─────────────────────────────────────────
  // The interval fires every second but derives `remaining` from the deadline
  // rather than decrementing a counter, so any scheduling latency is self-
  // correcting on the very next tick.
  useEffect(() => {
    if (!running || !deadlineRef.current) return;

    const id = setInterval(() => {
      const rem = Math.max(0, Math.floor((deadlineRef.current - Date.now()) / 1000));
      setRemaining(rem);
      if (rem <= 0) {
        setRunning(false);
        deadlineRef.current = null;
        if (storageKey) {
          try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
        }
      }
    }, 1000);

    return () => clearInterval(id);
  }, [running, storageKey]); // `remaining` intentionally omitted — deadline drives the value

  // ── Re-initialise when storageKey changes (e.g. player advances to next round) ──
  const prevKeyRef = useRef(storageKey);
  useEffect(() => {
    if (prevKeyRef.current === storageKey) return;
    prevKeyRef.current = storageKey;
    const next = readPersistedState(storageKey, durationSeconds, autoStart);
    deadlineRef.current = next.deadline;
    setRemaining(next.remaining);
    setRunning(next.running);
  }, [storageKey, durationSeconds, autoStart]);

  // ── Controls ────────────────────────────────────────────────────────────────
  const start = useCallback(() => {
    if (remaining <= 0) return;
    const dl = Date.now() + remaining * 1000;
    deadlineRef.current = dl;
    setRunning(true);
  }, [remaining]);

  const pause = useCallback(() => {
    deadlineRef.current = null;
    setRunning(false);
  }, []);

  const reset = useCallback(() => {
    deadlineRef.current = null;
    setRunning(false);
    setRemaining(durationSeconds);
    if (storageKey) {
      try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
    }
  }, [durationSeconds, storageKey]);

  return {
    remaining,
    running,
    expired: remaining <= 0,
    start,
    pause,
    reset,
  };
}
