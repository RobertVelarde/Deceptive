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
import React, { useState, useEffect, useRef } from 'react';
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

// ── RoundTimerCard — self-contained timer card, visible from a table ──────────
// Edit mode uses a calculator-style digit buffer: each typed digit pushes
// existing digits left and occupies the rightmost position, displayed as MM:SS.
function RoundTimerCard({ timer, durationSeconds }) {
  const [editing, setEditing] = useState(false);
  // 4-digit buffer: digits[0..1] = minutes, digits[2..3] = seconds
  const [digits, setDigits]   = useState('0000');
  const inputRef = useRef(null);

  const timerRatio  = durationSeconds > 0 ? timer.remaining / durationSeconds : 0;
  const timerColor  = timer.expired
    ? '#EF5350'
    : timerRatio > 0.5 ? '#4CAF50' : timerRatio > 0.25 ? '#FF9800' : '#EF5350';
  const displayMins = String(Math.floor(timer.remaining / 60)).padStart(2, '0');
  const displaySecs = String(timer.remaining % 60).padStart(2, '0');
  const canEdit     = !timer.running && !timer.expired;

  // Derived edit values
  const editMM    = digits.slice(0, 2);
  const editSS    = digits.slice(2, 4);
  const editSsNum = parseInt(editSS, 10);
  const editTotal = parseInt(editMM, 10) * 60 + editSsNum;
  const editValid = editTotal > 0 && editSsNum < 60;

  // Focus the hidden input whenever edit mode activates
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const startEdit = () => { setDigits('0000'); setEditing(true); };

  const commitEdit = () => {
    if (editValid) timer.seek(editTotal);
    setEditing(false);
  };

  const pushDigit = (d) => setDigits(prev => (prev + d).slice(-4));
  const popDigit  = ()  => setDigits(prev => '0' + prev.slice(0, 3));

  // Keyboard: digits push right-to-left, backspace undoes, enter/escape finish
  const handleKeyDown = (e) => {
    if (e.key >= '0' && e.key <= '9') { e.preventDefault(); pushDigit(e.key); }
    else if (e.key === 'Backspace')   { e.preventDefault(); popDigit(); }
    else if (e.key === 'Enter')       { e.preventDefault(); commitEdit(); }
    else if (e.key === 'Escape')      { setEditing(false); }
  };

  // Mobile: watch value length changes on the tel input to infer push/pop
  const handleChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (raw.length > digits.length)      pushDigit(raw[raw.length - 1]);
    else if (raw.length < digits.length) popDigit();
  };

  const editHint = !editValid
    ? (editSsNum >= 60 ? 'seconds must be 00–59' : 'type a duration')
    : 'tap ✓ or press enter to set';

  return (
    <GlassCard className="p-5">
      {/* Header row */}
      <div className="flex items-center justify-between mb-5 h-4">
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">Round Timer</span>
        {!timer.expired && !editing && (
          <button
            onClick={timer.running ? timer.pause : timer.start}
            className="text-xs font-semibold px-3 py-1 rounded-xl transition-all duration-200 active:scale-95 select-none"
            style={timer.running
              ? { background: 'rgba(158,158,158,0.15)', color: '#9E9E9E', border: '1px solid rgba(158,158,158,0.35)' }
              : { background: 'rgba(76,175,80,0.15)',   color: '#4CAF50', border: '1px solid rgba(76,175,80,0.35)' }
            }
          >
            {timer.running ? 'Pause' : 'Start'}
          </button>
        )}
      </div>

      {/* Time display / editor */}
      <div className="flex items-center justify-center">
        {timer.expired ? (
          <span className="text-5xl font-black tracking-widest select-none" style={{ color: '#EF5350' }}>
            TIME&apos;S UP
          </span>
        ) : editing ? (
          <div className="flex items-center gap-1">
            {/* Hidden tel input captures keyboard on desktop and mobile */}
            <input
              ref={inputRef}
              type="tel"
              inputMode="numeric"
              value={digits}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onBlur={commitEdit}
              className="sr-only"
            />
            {/* Visual display — click refocuses the hidden input */}
            <button
              className="flex items-baseline gap-0 text-5xl font-black tabular-nums select-none"
              style={{ fontVariantNumeric: 'tabular-nums', cursor: 'text' }}
              onClick={() => inputRef.current?.focus()}
              tabIndex={-1}
            >
              <span style={{ color: 'white' }}>{editMM}</span>
              <span className="text-zinc-500">:</span>
              <span style={{ color: editSsNum < 60 ? 'white' : '#EF5350' }}>{editSS}</span>
            </button>
            {/* Confirm — mouseDown preventDefault keeps the hidden input focused */}
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={commitEdit}
              className="ml-3 text-sm font-semibold px-3 py-1.5 rounded-xl active:scale-95 select-none transition-colors duration-200"
              style={editValid
                ? { background: 'rgba(76,175,80,0.15)', color: '#4CAF50', border: '1px solid rgba(76,175,80,0.35)' }
                : { background: 'rgba(100,100,100,0.1)', color: '#555',    border: '1px solid rgba(100,100,100,0.2)' }
              }
            >
              ✓
            </button>
          </div>
        ) : (
          <button
            onClick={canEdit ? startEdit : undefined}
            className="text-5xl font-black tabular-nums select-none transition-colors duration-500"
            style={{ color: timerColor, cursor: canEdit ? 'pointer' : 'default', fontVariantNumeric: 'tabular-nums' }}
          >
            {displayMins}:{displaySecs}
          </button>
        )}
      </div>

      {/* Hint */}
      <p className="text-center text-[10px] text-zinc-600 mt-3 select-none">
        {timer.expired ? '\u00a0' : editing ? editHint : canEdit ? 'tap time to edit' : '\u00a0'}
      </p>
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
    autoStart:  false,
  });

  // ── Wake Lock — keep screen awake while the timer is running ─────────────
  useEffect(() => {
    if (!shouldShowTimer || !('wakeLock' in navigator)) return;
    let lock = null;

    const acquire = async () => {
      try { lock = await navigator.wakeLock.request('screen'); } catch { /* denied or unavailable */ }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && timer.running) acquire();
    };

    if (timer.running) acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      lock?.release().catch(() => {});
    };
  }, [timer.running, shouldShowTimer]);

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

            {/* Round timer card — only for roles with showsTimer: true */}
            {shouldShowTimer && (
              <RoundTimerCard timer={timer} durationSeconds={durationSeconds} />
            )}
          </div>
          {/* Bottom fade — fades the scroll area into the page background */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 z-10 bg-gradient-to-t from-[#09090b] to-transparent" />
        </div>

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
