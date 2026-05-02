// src/components/GamePlayScreen.jsx — High-level gameplay layout container.
//
// Renders the round header, the role card (with RevealShield for secret roles),
// game-specific supplemental content (via module.GameExtras), the round timer,
// and navigation buttons.
//
// All game-specific UI is provided by module.GameExtras — GamePlayScreen has
// no knowledge of individual game mechanics. Adding a new game requires only:
//   1. Creating src/games/<name>/components/GameExtras.jsx
//   2. Exporting it from the module as `GameExtras`
import React, { useState } from 'react';
import { useTheme }            from '../styles/ThemeContext';
import { getModule }           from '../games/index';
import { GlassCard }           from './shared/GlassCard';
import { Badge }               from './shared/Badge';
import { Button }              from './shared/Button';
import { RevealShield }        from './shared/RevealShield';
import { usePersistentTimer }  from '../engine/usePersistentTimer';
import { useLongPress }        from '../engine/useLongPress';
import { SpyfallReveal }       from '../games/spyfall/components/SpyfallReveal';

// ── WordReveal — hold to reveal a single secret word, tap to conceal ─────────
// Used for roles whose word is private but whose role identity is public
// (e.g. the Insider Master sees their word after the card is already shown).
function WordReveal({ word, disabled = false }) {
  const { phase, pct, isRevealed, handlers } = useLongPress({ disabled });
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
      {...(disabled ? {} : handlers)}
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
  const durationSeconds = module.getTimerSeconds?.(state) ?? state.roundSeconds ?? module.constants.ROUND_SECONDS ?? 300;
  // Key encodes seed + round so switching rounds automatically resets the timer
  const timerKey        = `deception_timer_${state.seed}_${state.round}`;

  const timer = usePersistentTimer({
    durationSeconds,
    storageKey: timerKey,
    autoStart:  true,
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

  const myAssignment = assignments.find((a) => a.playerId === identity?.id);
  const myMeta       = myAssignment
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
      <div className="w-full max-w-sm flex flex-col overflow-hidden flex-1">

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

            {/* Game-specific supplemental content — delegated to the active module */}
            {myAssignment && module.GameExtras && (
              <module.GameExtras
                assignment={myAssignment}
                state={state}
                roleRevealed={roleRevealed}
                module={module}
              />
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


          </div>
        )}

        {/* Nav buttons — always pinned at bottom of card */}
        <div className="pt-2 border-t border-white/5 flex gap-2 w-full max-w-sm">
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
