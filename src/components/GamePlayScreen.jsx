// src/components/GamePlayScreen.jsx — Generic game play screen
//
// Works with any registered game module. All game-specific rendering is driven
// by module.constants.ROLE_META — no per-game component files are required.
//
// ROLE_META shape (each module must include this in its constants):
//   { [roleName]: { label: string, emoji: string, desc: string, showsTimer: boolean } }
import React, { useState, useRef, useCallback, useEffect, use } from 'react';
import { useTheme }     from '../styles/ThemeContext';
import { getModule }    from '../games/index';
import { GlassCard }    from './shared/GlassCard';
import { Badge }        from './shared/Badge';
import { Button }       from './shared/Button';
import { RevealShield } from './shared/RevealShield';
import { RoundTimer }   from './shared/RoundTimer';

// ── Word reveal — hold to reveal, tap to conceal ────────────────────────────
function WordReveal({ word, disabled = false }) {
  const HOLD_MS = 800;

  // phase: 'hidden' | 'holding' | 'revealed' | 'concealing'
  const [phase,    setPhase]    = useState('hidden');
  const [progress, setProgress] = useState(0);

  const holdTimerRef    = useRef(null);
  const concealTimerRef = useRef(null);
  const phaseRef        = useRef('hidden'); // stable mirror — safe to read inside callbacks

  // Keep phaseRef in sync so event handlers never see stale phase
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Cleanup on unmount
  useEffect(() => () => {
    clearInterval(holdTimerRef.current);
    clearTimeout(concealTimerRef.current);
  }, []);

  const onPressStart = useCallback(() => {
    if (disabled) return;
    const p = phaseRef.current;

    if (p === 'revealed') {
      // Tap while revealed → conceal
      clearTimeout(concealTimerRef.current);
      setPhase('concealing');
      setProgress(0);
      concealTimerRef.current = setTimeout(() => setPhase('hidden'), 400);
      return;
    }
    if (p !== 'hidden') return;

    // Begin hold from hidden state
    setPhase('holding');
    const start = Date.now();
    holdTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      if (elapsed >= HOLD_MS) {
        clearInterval(holdTimerRef.current);
        setProgress(100);
        setPhase('revealed');
      } else {
        setProgress((elapsed / HOLD_MS) * 100);
      }
    }, 16);
  }, []);

  const onPressEnd = useCallback(() => {
    // Releasing after reveal is intentionally a no-op
    if (phaseRef.current !== 'holding') return;
    clearInterval(holdTimerRef.current);
    setProgress(0);
    setPhase('hidden');
  }, []);

  const pct        = progress / 100;
  const isRevealed = phase === 'revealed' || phase === 'concealing';
  const maskedWord = '••••••••';

  return (
    <div
      className="relative rounded-2xl border bg-black/20 p-4 text-center select-none overflow-hidden"
      style={{
        touchAction:  'none',
        borderColor:  isRevealed ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.08)',
        transform:    phase === 'holding' ? 'scale(0.985)' : 'scale(1)',
        transition:   'border-color 0.3s ease, transform 0.15s ease',
        cursor:       disabled ? 'default' : 'pointer',
      }}
      onPointerDown={onPressStart}
      onPointerUp={onPressEnd}
      onPointerLeave={onPressEnd}
      onPointerCancel={onPressEnd}
    >
      {/* Full-card fill — sweeps left to right while holding */}
      {!disabled && (
        <div
          className="absolute inset-0 bg-white/[0.04] origin-left"
          style={{
            transform:  `scaleX(${phase === 'holding' ? pct : 0})`,
            opacity:    phase === 'holding' ? 1 : 0,
            transition: 'opacity 0.2s ease',
          }}
        />
      )}

      <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Secret Word</p>
      <p
        className="text-3xl font-black tracking-tight"
        style={disabled ? {
          letterSpacing: '0.18em',
          color: 'rgba(161, 161, 170, 0.22)',
        } : {
          letterSpacing: isRevealed ? undefined : '0.18em',
          color: isRevealed ? 'white' : `rgba(161, 161, 170, ${0.22 + 0.78 * pct})`,
          transition: 'color 0.25s ease, letter-spacing 0.25s ease',
        }}
      >
        {disabled || !isRevealed ? maskedWord : word}
      </p>
      <p className="text-xs text-zinc-600 mt-2">
        {disabled ? '\u00a0' : isRevealed ? 'tap to conceal' : 'hold to reveal'}
      </p>
    </div>
  );
}

// ── Private role card — reads all display data from module.constants ──────────
function RoleCard({ assignment, module, state }) {
  const meta      = module.constants.ROLE_META?.[assignment.role]
    ?? { label: assignment.role.toUpperCase(), emoji: '?', desc: '', showsTimer: false };
  const roleColor = module.constants.ROLE_COLORS?.[assignment.role] ?? '#555';

  return (
    <GlassCard
      className="p-5 flex flex-col gap-4"
      style={{ borderColor: roleColor + '55', background: roleColor + '12' }}
    >
      <div className="flex items-center justify-start gap-2">
      <span className="text-zinc-400 text-xs uppercase tracking-widest">
        You are the
      </span>
      <Badge label={meta.label} color={roleColor} />
      </div>

      <div className="text-justify py-1">
        <p className="text-sm text-zinc-300 leading-relaxed">{meta.desc}</p>
      </div>

      {assignment.wordGrid ? (
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2 text-center">
            {assignment.word ? 'Your word is highlighted' : 'Find the secret word'}
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {assignment.wordGrid.map((w) => {
              const isSecret = assignment.word && w === assignment.word;
              return (
                <div
                  key={w}
                  className={`rounded-lg px-1 py-2 text-center text-[10px] font-bold leading-tight transition-all ${
                    isSecret
                      ? 'text-white'
                      : 'bg-zinc-800/60 text-zinc-400 border border-white/5'
                  }`}
                  style={isSecret ? { backgroundColor: roleColor } : undefined}
                >
                  {w}
                </div>
              );
            })}
          </div>
        </div>
      ) : assignment.word ? (
        meta.wordNeedsHold
          ? <WordReveal word={assignment.word} />
          : (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center">
              <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Secret Word</p>
              <p className="text-3xl font-black tracking-tight text-white">{assignment.word}</p>
            </div>
          )
      ) : meta.wordSlot ? (
        // Render an identical-height placeholder so all role cards are the same size
        // regardless of whether this role has a secret word. Prevents size-based inference.
        <WordReveal word="placeholder" disabled />
      ) : null}

      {meta.showsTimer && (
        <div className="mt-1 border-t border-white/10 pt-4 flex flex-col items-center gap-3">
          <RoundTimer
            totalSeconds={module.getTimerSeconds?.(state) ?? module.constants.ROUND_SECONDS}
            timerManual={meta.timerManual ?? false}
          />
        </div>
      )}
    </GlassCard>
  );
}

// ── Other-player row — intentionally reveals nothing about role ───────────────
function OtherPlayerRow({ assignment }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-zinc-800/40 border border-white/5">
      <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-bold text-zinc-300 shrink-0">
        {assignment.playerName[0]}
      </div>
      <span className="text-sm font-medium text-zinc-300 flex-1 truncate">
        {assignment.playerName}
      </span>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function GamePlayScreen({ state, identity, onNextRound, onBackToLobby }) {
  const { colors } = useTheme();
  const module      = getModule(state.gameType);
  const assignments = module.getSetup(state.players, state.seed, state.category ?? '', state);

  if (!assignments) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <GlassCard className="p-8 text-center max-w-sm w-full">
          <p className="text-zinc-400 mb-4">
            Not enough players for <strong>{module.displayName}</strong>.
          </p>
          <Button onClick={onBackToLobby}>← Back to Lobby</Button>
        </GlassCard>
      </div>
    );
  }

  const myAssignment     = assignments.find((a) => a.playerId === identity?.id);
  const otherAssignments = assignments.filter((a) => a.playerId !== identity?.id);
  const myMeta           = myAssignment
    ? (module.constants.ROLE_META?.[myAssignment.role] ?? {})
    : null;

  return (
    <div className="h-full flex flex-col items-center px-4 pt-6 pb-4 gap-4 overflow-hidden">
      {/* Header — fixed, never scrolls */}
      <div className="w-full max-w-sm select-none shrink-0 flex items-center justify-between gap-3">
        {/* Left: game + round — primary hierarchy */}
        <div>
          <h1 className="text-2xl font-black leading-none" style={{ color: colors.primary }}>
            {module.displayName}
          </h1>
          <p className="text-xs text-zinc-500 uppercase tracking-widest mt-0.5">
            Round {state.round}
          </p>
        </div>
        {/* Right: player name + verification crumbs */}
        <div className="text-right">
          {identity?.name && (
            <p className="text-sm font-semibold text-zinc-300 leading-none">{identity.name}</p>
          )}
          <p className="text-[10px] font-mono text-zinc-700 mt-1 leading-none">
            {state.checksum && <span title="Lobby code">{state.checksum}</span>}
            {state.checksum && state.seed && <span className="mx-1 text-zinc-800">·</span>}
            {state.seed && <span title="Seed">{state.seed}</span>}
          </p>
        </div>
      </div>

      {/* Card only as big as the content, centered vertically */}
      <GlassCard className="w-full max-w-sm flex flex-col gap-6 overflow-hidden flex-1">

        {/* Scrollable interior */}
        <div className="flex flex-col gap-5 overflow-y-auto flex-1 min-h-0 p-5">

          {/* Role card — public roles shown immediately; secret roles need hold-to-reveal */}
          {myAssignment && (
            <div>
              {myMeta?.publicRole ? (
                <RoleCard assignment={myAssignment} module={module} state={state} />
              ) : (
                <RevealShield label="Hold to Reveal Your Role">
                  <RoleCard assignment={myAssignment} module={module} state={state} />
                </RevealShield>
              )}
            </div>
          )}
        </div>

        {/* Nav buttons — always pinned at bottom of card */}
        <div className="shrink-0 px-5 pb-5 pt-3 border-t border-white/5 flex gap-3">
          <Button variant="secondary" size="md" className="flex-1" onClick={onBackToLobby}>
            ← Pre-Round
          </Button>
          <Button size="md" className="flex-1" onClick={onNextRound}>
            Next Round →
          </Button>
        </div>

      </GlassCard>
    </div>
  );
}
