// src/components/LobbyScreen.jsx
// Lobby setup: game selection, settings tab, players tab, create lobby.
import React, { useState, useCallback } from 'react';
import { useTheme }                  from '../styles/ThemeContext';
import { getModule, GAME_REGISTRY }  from '../games/index';
import { generatePlayerId }          from '../engine/state';
import { generateTimeSeed }          from '../engine/prng';
import { sanitizeName, NAME_MAX_LENGTH } from '../engine/gamestate';
import { Button }                    from './shared/Button';
import { GlassCard }                 from './shared/GlassCard';
import { calculateChecksum }         from '../engine/envelope';

export function LobbyScreen({ state, onStateChange, onStart, onGoHome }) {
  const { colors } = useTheme();
  const [newName, setNewName] = useState('');
  const [tab, setTab]         = useState('players'); // 'settings' | 'players'

  const module = getModule(state.gameType);

  /** Merge a partial patch; App.jsx recalculates the checksum on every write. */
  const push = useCallback(
    (patch) => onStateChange({ ...state, ...patch }),
    [state, onStateChange],
  );

  const addPlayer = () => {
    const name = sanitizeName(newName).trim();
    if (!name || state.players.some((p) => p.name === name)) return;
    push({ players: [...state.players, { id: generatePlayerId(), name }] });
    setNewName('');
  };

  const removePlayer = (id) =>
    push({ players: state.players.filter((p) => p.id !== id) });

  const canStart = state.players.length >= module.minPlayers;

  // ── Spyfall-specific derived values (used in settings tab) ───────────────
  const enabledLocations = state.enabledLocations ?? module.locations ?? [];
  const spyCount         = state.spyCount ?? 1;
  const randomizeSpies   = state.randomizeSpies ?? false;
  const spiesKnow        = state.spiesKnowEachOther ?? false;
  const maxSpies         = Math.min(
    module.maxSpyCount ?? 3,
    Math.max(1, Math.floor(state.players.length / 2)),
  );
  const toggleLocation   = (loc) => {
    const next = enabledLocations.includes(loc)
      ? enabledLocations.filter((l) => l !== loc)
      : [...enabledLocations, loc];
    push({ enabledLocations: next });
  };

  const hasSettings = (module.categories?.length > 0) || (module.locations?.length > 0) || (module.settingsSchema?.length > 0);

  return (
    <div className="h-full overflow-y-auto flex flex-col items-center">
    <div className="min-h-full flex flex-col items-center justify-center px-3 py-4 gap-3 w-full">

      {/* Title */}
      <div className="text-center select-none">
        <p className="text-xs text-zinc-600 uppercase tracking-[0.25em] mb-1">New Lobby</p>
        <h1
          className="text-4xl font-black tracking-tight leading-none"
          style={{ color: colors.primary }}
        >
          {module.displayName}
        </h1>
      </div>

      <GlassCard className="w-full max-w-sm p-4 flex flex-col gap-4">

        {/* ── Game type selector ─────────────────────────────────────────── */}
        <div>
          <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-2">
            Game
          </label>
          <div className="flex gap-2 flex-wrap">
            {Object.values(GAME_REGISTRY).map((m) => (
              <button
                key={m.name}
                onClick={() => {
                  const extra = m.defaultState ? m.defaultState() : {};
                  push({ gameType: m.name, ...extra });
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                  state.gameType === m.name
                    ? 'text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
                style={state.gameType === m.name ? { backgroundColor: m.constants.COLORS.primary } : undefined}
              >
                {m.displayName}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-white/5" />

        {/* ── Tab selector ───────────────────────────────────────────────── */}
        <div className="flex gap-1 bg-zinc-800/60 rounded-xl p-1">
          {[
            { key: 'settings', label: 'Settings' },
            { key: 'players',  label: `Players (${state.players.length})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                tab === key
                  ? 'bg-zinc-700 text-zinc-100 shadow'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab content — fixed height so the card never shifts ─────────── */}
        <div className="h-52 flex flex-col">

          {/* ── Settings tab ── */}
          {tab === 'settings' && (
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">

              {/* Chameleon: category picker */}
              {module.categories?.length > 0 && (
                <div>
                  <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-2">
                    Category
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {module.categories.map((cat) => {
                      const isActive = (state.category || module.categories[0]) === cat;
                      return (
                        <button
                          key={cat}
                          onClick={() => push({ category: cat })}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            isActive ? 'text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                          }`}
                          style={isActive ? { backgroundColor: colors.primary } : undefined}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Spyfall: spy count + location list */}
              {module.locations?.length > 0 && (
                <>
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-3">
                      Spy Settings
                    </label>
                    <div className="flex flex-col gap-3">

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-300">Number of Spies</span>
                        <div className="flex items-center gap-2">
                          <button
                            className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-300 text-sm font-bold hover:bg-zinc-700 disabled:opacity-30 transition-colors"
                            onClick={() => push({ spyCount: Math.max(1, spyCount - 1) })}
                            disabled={randomizeSpies || spyCount <= 1}
                          >−</button>
                          <span className={`w-6 text-center text-sm font-mono font-bold ${randomizeSpies ? 'text-zinc-600' : 'text-zinc-200'}`}>
                            {randomizeSpies ? '?' : spyCount}
                          </span>
                          <button
                            className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-300 text-sm font-bold hover:bg-zinc-700 disabled:opacity-30 transition-colors"
                            onClick={() => push({ spyCount: Math.min(maxSpies, spyCount + 1) })}
                            disabled={randomizeSpies || spyCount >= maxSpies}
                          >+</button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-300">Randomize spy count</span>
                        <button
                          onClick={() => push({ randomizeSpies: !randomizeSpies })}
                          className={`relative w-10 h-6 rounded-full transition-colors ${randomizeSpies ? '' : 'bg-zinc-700'}`}
                          style={randomizeSpies ? { backgroundColor: colors.primary } : undefined}
                        >
                          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${randomizeSpies ? 'left-5' : 'left-1'}`} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-300">Spies know each other</span>
                        <button
                          onClick={() => push({ spiesKnowEachOther: !spiesKnow })}
                          className={`relative w-10 h-6 rounded-full transition-colors ${spiesKnow ? '' : 'bg-zinc-700'}`}
                          style={spiesKnow ? { backgroundColor: colors.primary } : undefined}
                        >
                          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${spiesKnow ? 'left-5' : 'left-1'}`} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs uppercase tracking-widest text-zinc-500">
                        Locations
                        <span className="ml-2 text-zinc-700 normal-case tracking-normal">
                          {enabledLocations.length}/{module.locations.length}
                        </span>
                      </label>
                      <div className="flex gap-2">
                        <button
                          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                          onClick={() => push({ enabledLocations: [...module.locations] })}
                        >All</button>
                        <button
                          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                          onClick={() => push({ enabledLocations: [] })}
                        >None</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {module.locations.map((loc) => {
                        const on = enabledLocations.includes(loc);
                        return (
                          <button
                            key={loc}
                            onClick={() => toggleLocation(loc)}
                            className={`px-2 py-1.5 rounded-lg text-xs font-medium text-left transition-all ${
                              on ? 'text-white' : 'bg-zinc-800/60 text-zinc-500 hover:bg-zinc-700/60'
                            }`}
                            style={on ? { backgroundColor: colors.primary + 'CC' } : undefined}
                          >
                            {loc}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* Module settingsSchema — renders segmented controls and steppers generically */}
              {module.settingsSchema?.map((entry) => {
                const value = state[entry.key] ?? entry.default;
                if (entry.type === 'segmented') {
                  return (
                    <div key={entry.key}>
                      <div key={entry.key} className="flex items-center justify-between">
                        <span className="block text-xs uppercase tracking-widest text-zinc-500 mb-2">{entry.label}</span>
                        <div className="flex gap-1 bg-zinc-800/60 rounded-xl p-1">
                          {entry.options.map((opt) => (
                            <button
                              key={String(opt.value)}
                              onClick={() => push({ [entry.key]: opt.value })}
                              className={`flex-1 py-1.5 px-1.5 rounded-lg text-xs font-bold transition-all ${
                                value === opt.value
                                  ? 'bg-zinc-700 text-zinc-100 shadow'
                                  : 'text-zinc-500 hover:text-zinc-300'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                }
                if (entry.type === 'stepper') {
                  return (
                    <div key={entry.key} className="flex items-center justify-between">
                      
                      <span className="block text-xs uppercase tracking-widest text-zinc-500 mb-2">{entry.label}</span>
                      <div className="flex items-center gap-2">
                        <button
                          className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-300 text-sm font-bold hover:bg-zinc-700 disabled:opacity-30 transition-colors"
                          onClick={() => push({ [entry.key]: Math.max(entry.min, value - entry.step) })}
                          disabled={value <= entry.min}
                        >−</button>
                        <span className="w-14 text-center text-sm font-mono font-bold text-zinc-200">
                          {entry.format ? entry.format(value) : value}
                        </span>
                        <button
                          className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-300 text-sm font-bold hover:bg-zinc-700 disabled:opacity-30 transition-colors"
                          onClick={() => push({ [entry.key]: Math.min(entry.max, value + entry.step) })}
                          disabled={value >= entry.max}
                        >+</button>
                      </div>
                    </div>
                  );
                }
                return null;
              })}

              {/* No-settings placeholder */}
              {!hasSettings && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-zinc-600 text-xs text-center">No settings for this game</p>
                </div>
              )}
            </div>
          )}

          {/* ── Players tab ── */}
          {tab === 'players' && (
            <>
              {/* Scrollable player list fills all space above the add-row */}
              <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1 pb-2">
                {state.players.length === 0 && (
                  <p className="text-zinc-600 text-xs text-center py-3">
                    Add at least {module.minPlayers} players to start
                  </p>
                )}
                {state.players.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-zinc-800/60 shrink-0"
                  >
                    <span className="font-medium text-zinc-200 flex-1 truncate">{p.name}</span>
                    <button
                      className="text-zinc-600 hover:text-red-400 transition-colors shrink-0"
                      onClick={() => removePlayer(p.id)}
                    >✕</button>
                  </div>
                ))}
              </div>

              {/* Pinned add-player row */}
              <div className="flex gap-2 shrink-0 pt-1">
                <input
                  className="flex-1 bg-zinc-800 text-zinc-100 rounded-xl px-3 py-2 uppercase tracking-wide focus:outline-none focus:ring-1 focus:ring-zinc-500 placeholder:text-zinc-600"
                  placeholder="Player name…"
                  value={newName}
                  maxLength={NAME_MAX_LENGTH}
                  onChange={(e) => setNewName(sanitizeName(e.target.value))}
                  onKeyDown={(e) => { if (e.key === 'Enter') addPlayer(); }}
                />
                <Button variant="secondary" size="sm" onClick={addPlayer} disabled={!newName.trim()}>
                  Add
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="border-t border-white/5" />
        {/* ── Starting seed — shown for all games; Randomise generates a new time-based seed ── */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs uppercase tracking-widest text-zinc-500">Starting Seed</span>
            <span className="text-sm font-mono font-bold text-zinc-300">
              {state.startingSeed ?? state.seed}
            </span>
          </div>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 active:scale-95 transition-all"
            onClick={() => {
              const s = generateTimeSeed();
              push({ startingSeed: s, seed: s });
            }}
          >
            Randomise
          </button>
        </div>

        <div className="border-t border-white/5" />
        {/* ── Create Lobby button ─────────────────────────────────────────── */}
        <Button
          size="lg"
          className="w-full"
          onClick={onStart}
          disabled={!canStart}
        >
          {!canStart
            ? `Need ${module.minPlayers - state.players.length} more player(s)`
            : `Create Lobby · ${calculateChecksum(state)}`}
        </Button>

      </GlassCard>

      {onGoHome && (
        <button
          className="w-full max-w-sm py-3 rounded-2xl text-base font-bold bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 active:scale-95 transition-all"
          onClick={onGoHome}
        >
          Back
        </button>
      )}

    </div>
    </div>
  );
}
