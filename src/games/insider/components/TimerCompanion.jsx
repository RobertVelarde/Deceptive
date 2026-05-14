// src/games/insider/components/TimerCompanion.jsx
// Two optional panels rendered below the round timer during an Insider round:
//
//   Master Rotation strip  — shown when rotatingMaster=true.
//     Players are listed in lobby entry order (seating order), which is the
//     exact order the host typed them in.  The current master is highlighted.
//     This makes it immediately obvious who is master now and who is next.
//
//   Answer-tally panel     — shown when answerTracking=true.
//     The Master answers every question with Yes, No, or "I don't know" —
//     players use this to keep count without losing track.
//     When answerLimit is true, the + buttons for Yes and No are disabled
//     once yes+no totals reach answerLimitCount.
import React, { useState, useRef, useEffect } from 'react';
import { GlassCard } from '../../../components/shared/GlassCard';

const ANSWER_TYPES = [
  {
    key:    'yes',
    label:  'Yes',
    color:  '#4CAF50',
    bg:     'rgba(76,175,80,0.15)',
    border: 'rgba(76,175,80,0.35)',
  },
  {
    key:    'no',
    label:  'No',
    color:  '#EF5350',
    bg:     'rgba(239,83,80,0.15)',
    border: 'rgba(239,83,80,0.35)',
  },
  {
    key:    'idk',
    label:  "IDK",
    color:  '#9E9E9E',
    bg:     'rgba(158,158,158,0.12)',
    border: 'rgba(158,158,158,0.25)',
  },
];

export function InsiderTimerCompanion({ assignment, state }) {
  const rotatingMaster   = state?.rotatingMaster   ?? false;
  const answerTracking   = state?.answerTracking   ?? false;
  const answerLimit      = state?.answerLimit      ?? false;
  const answerLimitCount = state?.answerLimitCount ?? 10;

  const players = state?.players ?? [];
  const round   = state?.round   ?? 1;

  // ── Master-rotation strip ─────────────────────────────────────────────────
  // Players are in lobby entry order — exactly the seating / master-rotation order.
  // Highlight the chip of the player whose turn it is this round.
  const currentMaster      = rotatingMaster && players.length > 0
    ? players[(round - 1) % players.length]
    : null;
  const myId               = assignment?.playerId;
  const accentColor        = '#6d28d9'; // Insider purple
  const masterListRef      = useRef(null);
  const masterCurrentRef   = useRef(null);

  // Scroll so the current master chip is horizontally centred on mount / round change.
  useEffect(() => {
    const chip = masterCurrentRef.current;
    const list = masterListRef.current;
    if (!chip || !list) return;
    requestAnimationFrame(() => {
      const listRect = list.getBoundingClientRect();
      const chipRect = chip.getBoundingClientRect();
      const offset =
        list.scrollLeft +
        chipRect.left -
        listRect.left +
        chipRect.width / 2 -
        list.clientWidth / 2;
      list.scrollTo({ left: offset, behavior: 'instant' });
    });
  }, [round]);

  // ── Answer-tally state ────────────────────────────────────────────────────
  const [counts, setCounts] = useState({ yes: 0, no: 0, idk: 0 });

  if (!rotatingMaster && !answerTracking) return null;

  const increment    = (key) => setCounts((prev) => ({ ...prev, [key]: prev[key] + 1 }));
  const decrement    = (key) => setCounts((prev) => ({ ...prev, [key]: Math.max(0, prev[key] - 1) }));
  const reset        = ()    => setCounts({ yes: 0, no: 0, idk: 0 });
  const yesNoTotal   = counts.yes + counts.no;
  const limitReached = answerLimit && yesNoTotal >= answerLimitCount;

  return (
    <>

      {/* ── Answer-tally panel ─────────────────────────────────────────── */}
      {answerTracking && (
        <GlassCard className="p-3 flex flex-col gap-2 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest text-zinc-400">Answers</span>
              {answerLimit && (
                <span
                  className="text-[10px] tabular-nums font-mono font-bold px-1.5 py-0.5 rounded-md"
                  style={limitReached
                    ? { background: 'rgba(239,83,80,0.15)', color: '#EF5350' }
                    : { background: 'rgba(158,158,158,0.12)', color: '#9E9E9E' }
                  }
                >
                  {yesNoTotal}/{answerLimitCount}
                </span>
              )}
            </div>
            <button
              onClick={reset}
              className="text-[9px] uppercase tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors leading-none"
            >
              reset
            </button>
          </div>

          {/* Three columns — one per answer type */}
          <div className="flex gap-2">
            {ANSWER_TYPES.map(({ key, label, color, bg, border }) => {
              const isLimited = limitReached;
              return (
                <div
                  key={key}
                  className="flex-1 flex flex-col items-center gap-1.5 rounded-xl py-2.5 px-1"
                  style={{ background: bg, border: `1px solid ${border}` }}
                >
                  <span className="text-[9px] uppercase tracking-widest font-semibold leading-none" style={{ color }}>
                    {label}
                  </span>
                  <span className="text-3xl font-black tabular-nums leading-none" style={{ color }}>
                    {counts[key]}
                  </span>
                  <div className="flex gap-1 w-full px-1">
                    <button
                      onClick={() => decrement(key)}
                      className="flex-1 py-1 rounded-lg text-sm font-black active:scale-95 transition-transform select-none leading-none"
                      style={{ background: 'rgba(0,0,0,0.2)', color, opacity: counts[key] === 0 ? 0.3 : 1 }}
                    >
                      −
                    </button>
                    <button
                      onClick={() => !isLimited && increment(key)}
                      className="flex-1 py-1 rounded-lg text-sm font-black active:scale-95 transition-transform select-none leading-none"
                      style={{ background: 'rgba(0,0,0,0.2)', color, opacity: isLimited ? 0.3 : 1 }}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}
    </>
  );
}
