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
import { RevealShield }        from './shared/RevealShield';
import { WordGrid }            from './shared/WordGrid';
import { usePersistentTimer }  from '../engine/usePersistentTimer';

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
        {disabled || !isRevealed ? maskedWord : word.toLowerCase().replace(/\b\w/g, s => s.toUpperCase())}
      </p>
      <p className="text-xs text-zinc-600 mt-2">
        {disabled ? '\u00a0' : isRevealed ? 'tap to conceal' : 'hold to reveal'}
      </p>
    </div>
  );
}
// ── Wavelength spectrum — hold to reveal secret number (Psychics); static for Guesser ──
function SpectrumReveal({ spectrum, secretNumber }) {
  const HOLD_MS = 800;
  const hasNumber = secretNumber != null;

  const [phase,    setPhase]    = useState('hidden');
  const [progress, setProgress] = useState(0);

  const holdTimerRef    = useRef(null);
  const concealTimerRef = useRef(null);
  const phaseRef        = useRef('hidden');

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => () => {
    clearInterval(holdTimerRef.current);
    clearTimeout(concealTimerRef.current);
  }, []);

  const onPressStart = useCallback(() => {
    if (!hasNumber) return;
    const p = phaseRef.current;
    if (p === 'revealed') {
      clearTimeout(concealTimerRef.current);
      setPhase('concealing');
      setProgress(0);
      concealTimerRef.current = setTimeout(() => setPhase('hidden'), 400);
      return;
    }
    if (p !== 'hidden') return;
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
  }, [hasNumber]);

  const onPressEnd = useCallback(() => {
    if (phaseRef.current !== 'holding') return;
    clearInterval(holdTimerRef.current);
    setProgress(0);
    setPhase('hidden');
  }, []);

  const pct        = progress / 100;
  const isRevealed = phase === 'revealed' || phase === 'concealing';
  const [leftLabel, rightLabel] = spectrum ?? ['', ''];

  return (
    <div
      className="relative rounded-2xl border bg-black/20 p-4 flex flex-col gap-3 select-none overflow-hidden"
      style={{
        touchAction:  'none',
        borderColor:  isRevealed ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.08)',
        transition:   'border-color 0.3s ease, transform 0.15s ease',
        cursor:       hasNumber ? 'pointer' : 'default',
      }}
      onPointerDown={onPressStart}
      onPointerUp={onPressEnd}
      onPointerLeave={onPressEnd}
      onPointerCancel={onPressEnd}
    >
      {/* Hold-progress fill */}
      {hasNumber && (
        <div
          className="absolute inset-0 bg-white/[0.04] origin-left"
          style={{
            transform:  `scaleX(${phase === 'holding' ? pct : 0})`,
            opacity:    phase === 'holding' ? 1 : 0,
            transition: 'opacity 0.2s ease',
          }}
        />
      )}

      {/* Spectrum end-labels */}
      <div className="relative flex justify-between items-center px-0.5">
        <span className="text-[11px] font-bold text-zinc-300 max-w-[42%] text-left leading-tight">{leftLabel.toUpperCase()}</span>
        <span className="text-[11px] font-bold text-zinc-300 max-w-[42%] text-right leading-tight">{rightLabel.toUpperCase()}</span>
      </div>

      {/* 10-box spectrum row */}
      <div className="relative flex gap-1">
        {Array.from({ length: 10 }, (_, i) => {
          const num       = i + 1;
          const isTarget  = isRevealed && secretNumber === num;
          return (
            <div
              key={num}
              className="relative flex-1 h-11 rounded-md flex items-center justify-center text-xs font-bold transition-all duration-200"
              style={
                isTarget
                  ? { backgroundColor: '#f59e0b', color: '#1c1917', boxShadow: '0 0 12px rgba(245,158,11,0.6)', border: '1px solid rgba(255,255,255,0.05)' }
                  : { backgroundColor: 'rgba(39,39,42,0.7)', color: 'rgba(161,161,170,0.6)', border: '1px solid rgba(255,255,255,0.05)' }
              }
            >
              {num}
            </div>
          );
        })}
      </div>

      {/* Hint text */}
      <p className="relative text-xs text-zinc-600 text-center">
        {hasNumber
          ? (isRevealed ? 'tap to conceal' : 'hold to reveal')
          : ''}
      </p>
    </div>
  );
}

// ── Spyfall location + role reveal — hold to reveal, tap to conceal ──────────
function SpyfallReveal({ location, civilianRole, disabled = false }) {
  const HOLD_MS = 800;

  const [phase,    setPhase]    = useState('hidden');
  const [progress, setProgress] = useState(0);

  const holdTimerRef    = useRef(null);
  const concealTimerRef = useRef(null);
  const phaseRef        = useRef('hidden');

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => () => {
    clearInterval(holdTimerRef.current);
    clearTimeout(concealTimerRef.current);
  }, []);

  const pct        = progress / 100;
  const isRevealed = !disabled;
  const cap        = (s) => s ? s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : '';

  return (
    <div
      className="relative rounded-2xl border bg-black/20 p-4 select-none overflow-hidden"
      style={{
        touchAction: 'none',
        borderColor: isRevealed ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.08)',
        transition:  'border-color 0.3s ease, transform 0.15s ease',
        cursor:      disabled ? 'default' : 'pointer',
        minHeight:   '6.5rem',
      }}
    >
      {(
        <div className="flex flex-col gap-3">
          {/* Secret Location */}
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Secret Location</p>
            <p
              className="text-2xl font-black tracking-tight"
              style={{
                color: isRevealed ? 'white' : `rgba(161,161,170,${0.22 + 0.78 * pct})`,
                letterSpacing: isRevealed ? undefined : '0.18em',
                transition: 'color 0.25s ease, letter-spacing 0.25s ease',
              }}
            >
              {isRevealed ? cap(location) : '••••••••'}
            </p>
          </div>

          {/* Assigned Role */}
          {(
            <div className="text-center border-t border-white/[0.06] pt-3">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Your Role</p>
              <p
                className="text-2xl font-black tracking-tight"
                style={{
                  color: isRevealed ? 'white' : `rgba(161,161,170,${0.22 + 0.78 * pct})`,
                  transition: 'color 0.25s ease, letter-spacing 0.25s ease',
                }}
              >
                {civilianRole ? cap(civilianRole) : 'Spy'}
              </p>
            </div>
          )}
        </div>
      )}
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

      {/* Spyfall: location + role reveal (or disabled placeholder for spy) */}
      {(meta.locationReveal || meta.locationRevealDisabled) && (
        <SpyfallReveal
          location={assignment.location}
          civilianRole={assignment.civilianRole}
          disabled={!!meta.locationRevealDisabled}
        />
      )}

      {/* Other games: word / word-grid reveal */ }
      {!meta.locationReveal && !meta.locationRevealDisabled && (
        assignment.wordGrid ? null : assignment.word ? (
          meta.wordNeedsHold
            ? <WordReveal word={assignment.word} />
            : (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center">
                <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Secret Word</p>
                <p className="text-3xl font-black tracking-tight text-white">{assignment.word.toLowerCase().replace(/\b\w/g, s => s.toUpperCase())}</p>
              </div>
            )
        ) : meta.wordSlot ? (
          <WordReveal word="placeholder" disabled />
        ) : null
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
  const [roleRevealed, setRoleRevealed] = useState(false);

  // ── Timer config — derived before early return so hooks are always called ───
  const _preRole        = assignments?.find((a) => a.playerId === identity?.id)?.role;
  const _preMeta        = _preRole ? (module.constants.ROLE_META?.[_preRole] ?? {}) : null;
  const shouldShowTimer = _preMeta?.showsTimer  ?? false;
  const isManualTimer   = _preMeta?.timerManual ?? false;
  const durationSeconds = state.roundSeconds ?? module.constants.ROUND_SECONDS ?? 300;
  // Key encodes seed + round so switching rounds automatically resets the timer
  const timerKey        = `deception_timer_${state.seed}_${state.round}`;

  const timer = usePersistentTimer({
    durationSeconds,
    storageKey: timerKey,
    autoStart:  !isManualTimer,
  });

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

  // Wrap navigation so the timer storage is cleared when leaving the round
  const handleNextRound   = () => { timer.reset(); onNextRound(); };
  const handleBackToLobby = () => { timer.reset(); onBackToLobby(); };

  // Derived timer display values
  const timerMins  = String(Math.floor(timer.remaining / 60)).padStart(2, '0');
  const timerSecs  = String(timer.remaining % 60).padStart(2, '0');
  const timerRatio = durationSeconds > 0 ? timer.remaining / durationSeconds : 0;
  const timerColor = timer.expired
    ? '#EF5350'
    : timerRatio > 0.5 ? '#4CAF50' : timerRatio > 0.25 ? '#FF9800' : '#EF5350';

  return (
    <div className="h-full flex flex-col items-center px-4 pt-6 pb-2 gap-4 overflow-hidden">
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
      <div className="w-full max-w-sm flex flex-col gap-0 overflow-hidden flex-1 border-0 ">

        {/* Scrollable interior — relative wrapper enables the bottom-fade overlay */}
        <div className="relative flex-1 min-h-0">
        <div className="flex flex-col gap-5 overflow-y-auto h-full p-0 pb-14 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>

          {/* Role card — public roles shown immediately; secret roles need hold-to-reveal */}
          {myAssignment && (
            <div>
              {myMeta?.publicRole ? (
                <RoleCard assignment={myAssignment} module={module} state={state} />
              ) : (
                <RevealShield
                  label="Hold to Reveal Your Role"
                  onReveal={() => setRoleRevealed(true)}
                  onConceal={() => setRoleRevealed(false)}
                >
                  <RoleCard assignment={myAssignment} module={module} state={state} />
                </RevealShield>
              )}
            </div>
          )}

          {/* Chameleon: word grid — always visible, highlights secret tile after role is revealed */}
          {myAssignment?.wordGrid && (
            <GlassCard className="p-4 flex flex-col gap-2">
              <WordGrid
                words={myAssignment.wordGrid}
                seed={state.startingSeed ?? state.seed}
                secretWord={roleRevealed ? myAssignment.word : undefined}
                roleColor={module.constants.ROLE_COLORS?.[myAssignment.role]}
              />
            </GlassCard>
          )}

          {/* Wavelength: spectrum row — always visible; Psychics hold to reveal secret number */}
          {myAssignment?.spectrum && (
            <SpectrumReveal
              spectrum={myAssignment.spectrum}
              secretNumber={myAssignment.secretNumber}
            />
          )}

          {/* Spyfall: scannable location reference list (visible to all players) */}
          {myAssignment?.locationList?.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">
                Locations
                <span className="ml-1.5 text-zinc-700 normal-case tracking-normal">
                  {myAssignment.locationList.length} in play
                </span>
              </p>
              <div className="grid grid-cols-2 gap-1">
                {myAssignment.locationList.map((loc) => (
                  <div
                    key={loc}
                    className="px-2.5 py-2 rounded-xl text-xs text-center font-medium text-zinc-400 bg-zinc-800/50 border border-white/[0.04]"
                  >
                    {loc}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* Bottom fade — fades the scroll area into the page background */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 z-10 bg-gradient-to-t from-[#09090b] to-transparent" />
        </div>

        {/* ── Round timer — shown only for roles with showsTimer: true ─────── */}
        {shouldShowTimer && (
          <div className="pt-3 pb-1 px-1 flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 shrink-0">
              Round Timer
            </span>

            {/* Time display */}
            {timer.expired ? (
              <span className="text-sm font-mono font-bold tracking-widest" style={{ color: '#EF5350' }}>
                TIME&apos;S UP
              </span>
            ) : (
              <span
                className="text-sm font-mono font-bold tabular-nums tracking-widest"
                style={{ color: timerColor }}
              >
                {timerMins}:{timerSecs}
              </span>
            )}

            {/* Start / Pause button — only for manual-start roles */}
            {isManualTimer && !timer.expired && (
              <button
                onClick={timer.running ? timer.pause : timer.start}
                className="ml-auto px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all active:scale-95 hover:brightness-110"
                style={{ backgroundColor: timer.running ? '#C62828' : '#2E7D32' }}
              >
                {timer.running
                  ? 'Pause'
                  : timer.remaining === durationSeconds ? 'Start' : 'Resume'}
              </button>
            )}
          </div>
        )}

        {/* Nav buttons — always pinned at bottom of card */}
        <div className="pt-2 border-t border-white/5 flex gap-2">
          <Button variant="secondary" size="md" className="flex-1 " onClick={handleBackToLobby}>
            ← Pre-Round
          </Button>
          <Button size="md" className="flex-1" onClick={handleNextRound}>
            Next Round →
          </Button>
        </div>

      </div>
    </div>
  );
}
