// src/components/shared/RoundTimer.jsx
import React, { useState, useEffect } from 'react';

/** Maximum configurable timer value in seconds (99:59). */
const MAX_TIMER_SECONDS = 5999;

/** Parse a "MM:SS" or plain-minutes string into a clamped integer second count. */
function parseEditValue(raw) {
  const trimmed = raw.trim();
  let total;
  const colon = trimmed.indexOf(':');
  if (colon !== -1) {
    const m = parseInt(trimmed.slice(0, colon), 10) || 0;
    const s = parseInt(trimmed.slice(colon + 1), 10) || 0;
    total = m * 60 + s;
  } else {
    total = (parseFloat(trimmed) || 0) * 60;
  }
  return Math.max(1, Math.min(MAX_TIMER_SECONDS, Math.round(total)));
}

export function RoundTimer({ totalSeconds = 300, timerManual = false }) {
  const [initial,   setInitial]   = useState(totalSeconds);
  const [remaining, setRemaining] = useState(totalSeconds);
  const [running,   setRunning]   = useState(!timerManual);
  const [editing,   setEditing]   = useState(false);
  const [editValue, setEditValue] = useState('');

  // Reset when the prop changes (e.g. navigating between rounds)
  useEffect(() => {
    setInitial(totalSeconds);
    setRemaining(totalSeconds);
    setRunning(!timerManual);
  }, [totalSeconds, timerManual]);

  useEffect(() => {
    if (!running || remaining <= 0) return;
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [running, remaining]);

  const mins  = String(Math.floor(remaining / 60)).padStart(2, '0');
  const secs  = String(remaining % 60).padStart(2, '0');
  const ratio = initial > 0 ? remaining / initial : 0;
  const color = ratio > 0.5 ? '#4CAF50' : ratio > 0.25 ? '#FF9800' : '#EF5350';
  const R     = 20;
  const circ  = 2 * Math.PI * R;

  const openEdit = () => {
    setEditValue(`${mins}:${secs}`);
    setEditing(true);
  };

  const applyEdit = (raw) => {
    const total = parseEditValue(raw);
    setInitial(total);
    setRemaining(total);
    setEditing(false);
  };

  const toggleRunning = () => {
    if (remaining <= 0) {
      setRemaining(initial);
      setRunning(true);
    } else {
      setRunning((r) => !r);
    }
  };

  const buttonLabel = remaining <= 0
    ? 'Restart Timer'
    : running
      ? 'Stop Timer'
      : initial === remaining ? 'Start Timer' : 'Resume Timer';

  return (
    <div className="flex flex-col items-center gap-3">

      {/* Ring + time display — side by side */}
      <div className="flex items-center gap-4">
        {/* Start / Stop / Resume button — only for manual-start timers */}
        {timerManual && (
          <button
            onClick={toggleRunning}
            className="px-6 py-2.5 rounded-2xl text-sm font-bold text-white shadow-lg transition-all hover:brightness-110 active:scale-95"
            style={{ backgroundColor: running ? '#C62828' : '#2E7D32' }}
          >
            {buttonLabel}
          </button>
        )}

        {editing ? (
          <input
            className="w-28 bg-zinc-800 text-zinc-100 rounded-xl px-3 py-1 font-mono font-bold text-center focus:outline-none focus:ring-1 focus:ring-zinc-500 ![font-size:1.875rem]"
            value={editValue}
            autoFocus
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => applyEdit(editValue)}
            onKeyDown={(e) => {
              if (e.key === 'Enter')  applyEdit(editValue);
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <button
            className="text-4xl font-mono font-bold tracking-widest active:opacity-70 transition-opacity select-none"
            style={{ color }}
            onClick={openEdit}
            title="Tap to edit"
          >
            {mins}:{secs}
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-44 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${ratio * 100}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
