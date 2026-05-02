// src/components/LobbyScreen.jsx
// Lobby setup: game selection, settings, players. Three distinct sections.
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTheme }                     from '../styles/ThemeContext';
import { getModule, GAME_REGISTRY }     from '../games/index';
import { generatePlayerId }             from '../engine/state';
import { generateTimeSeed }             from '../engine/prng';
import { sanitizeName, NAME_MAX_LENGTH } from '../engine/gamestate';
import { Button }                       from './shared/Button';
import { GlassCard }                    from './shared/GlassCard';
import { WordGrid }                     from './shared/WordGrid';
import { calculateChecksum }            from '../engine/envelope';
import { CHAMELEON_CUSTOM_CATEGORY }    from '../games/chameleon/index';
import { CHAMELEON_WORD_CATEGORIES }    from '../games/chameleon/words';

export function LobbyScreen({ state, onStateChange, onStart, onGoHome }) {
  const { colors } = useTheme();
  const [newName, setNewName] = useState('');
  const [newTile, setNewTile] = useState('');
  const scrollRef       = useRef(null);
  const inputRef        = useRef(null);
  const tileInputRef    = useRef(null);
  const inputFocused    = useRef(false);

  // Keep scrolled to bottom whenever the player list grows and the input is active
  useEffect(() => {
    if (inputFocused.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'instant' });
    }
  }, [state.players.length]);

  const module = getModule(state.gameType);

  const push = useCallback(
    (patch) => onStateChange({ ...state, ...patch }),
    [state, onStateChange],
  );

  const addPlayer = () => {
    const name = sanitizeName(newName).trim();
    if (!name || state.players.some((p) => p.name === name)) return;
    push({ players: [...state.players, { id: generatePlayerId(), name }] });
    setNewName('');
    // Re-focus after the new row renders so the effect above can fire
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const removePlayer = (id) =>
    push({ players: state.players.filter((p) => p.id !== id) });

  const canStart = state.players.length >= module.minPlayers;

  // Chameleon custom: need all 16 tiles filled
  const isCustomChameleon = state.gameType === 'chameleon' && state.category === CHAMELEON_CUSTOM_CATEGORY;
  const customWords = state.customWords ?? [];
  const customTilesFilled = !isCustomChameleon || customWords.length === 16;

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

  const hasSettings =
    (module.categories?.length > 0) ||
    (module.locations?.length > 0) ||
    (module.settingsSchema?.length > 0);

  return (
    <div className="h-full flex flex-col items-center">

      {/* ── Fixed header: logo + gamemode ────────────────────────────────── */}
      <div className="w-full max-w-sm px-3 pt-6 pb-3 flex flex-col gap-4 shrink-0">
        {/* ── Section 1: Gamemode ──────────────────────────────────────────── */}
        <GlassCard className="w-full p-5 flex flex-col gap-3">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">Gamemode</p>
          
          {/* Added overflow-x-auto and flex-nowrap to allow horizontal scrolling */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-nowrap">
            {Object.values(GAME_REGISTRY).map((m) => (
              <button
                key={m.name}
                onClick={() => {
                  const extra = m.defaultState ? m.defaultState() : {};
                  push({ gameType: m.name, ...extra });
                }}
                /* Changed flex-1 to shrink-0 to prevent buttons from squishing.
                  Added w-28 (or any fixed width) to make them all the same size.
                */
                className={`shrink-0 w-28 flex flex-col items-center gap-0.5 py-3 px-2 rounded-2xl transition-all ${
                  state.gameType === m.name
                    ? 'text-white shadow-lg'
                    : 'bg-zinc-800/60 text-zinc-400'
                }`}
                style={state.gameType === m.name ? { backgroundColor: m.constants.COLORS.primary } : undefined}
              >
                <span className="text-sm font-black tracking-tight">{m.displayName}</span>
                <span className={`text-[10px] font-normal normal-case tracking-normal ${state.gameType === m.name ? 'text-white/60' : 'text-zinc-600'}`}>
                  {m.minPlayers}–{m.maxPlayers} players
                </span>
              </button>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* ── Scrollable body: settings + players ──────────────────────────── */}
      <div className="flex-1 min-h-0 relative w-full max-w-sm">
        {/* Bottom fade */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 z-10 bg-gradient-to-t from-[#09090b] to-transparent" />

        <div ref={scrollRef} className="h-full overflow-y-auto px-3 scrollbar-hide">
        <div className="flex flex-col gap-4 pt-1 pb-6">

          {/* ── Section 2: Settings ──────────────────────────────────────────── */}
          <GlassCard className="w-full p-5 flex flex-col gap-3">

          <p className="text-[10px] uppercase tracking-widest text-zinc-500">Settings</p>


            {/* Starting Seed */}
            <button
              className="flex items-center justify-between px-3 py-2.5 rounded-2xl bg-zinc-800/60 w-full active:opacity-70 transition-opacity select-none"
              onClick={() => {
                const s = generateTimeSeed();
                push({ startingSeed: s, seed: s });
              }}
            >
              <div className="flex flex-col items-start gap-0.5">
                <span className="text-[10px] uppercase tracking-widest text-zinc-500">Starting Seed</span>
                <span className="text-sm font-mono font-bold text-zinc-300">
                  {state.startingSeed ?? state.seed}
                </span>
              </div>
              <span className="text-[10px] text-zinc-600">Tap to randomize</span>
            </button>

            {/* Round Time — hidden for games that don't use a timer */}
            {(module.constants.ROUND_SECONDS ?? 300) > 0 && (() => {
              const roundSecs = state.roundSeconds ?? module.constants.ROUND_SECONDS ?? 300;
              return (
                <div className="flex items-center justify-between px-3 py-2.5 rounded-2xl bg-zinc-800/60">
                  <span className="text-sm text-zinc-300">Round Time</span>
                  <div className="flex items-center gap-2">
                    <button
                      className="w-7 h-7 rounded-lg bg-zinc-700 text-zinc-300 text-sm font-bold hover:bg-zinc-600 disabled:opacity-30 transition-colors"
                      onClick={() => push({ roundSeconds: Math.max(60, roundSecs - 60) })}
                      disabled={roundSecs <= 60}
                    >−</button>
                    <span className="w-14 text-center text-sm font-mono font-bold text-zinc-200">
                      {Math.round(roundSecs / 60)} min
                    </span>
                    <button
                      className="w-7 h-7 rounded-lg bg-zinc-700 text-zinc-300 text-sm font-bold hover:bg-zinc-600 disabled:opacity-30 transition-colors"
                      onClick={() => push({ roundSeconds: Math.min(1800, roundSecs + 60) })}
                      disabled={roundSecs >= 1800}
                    >+</button>
                  </div>
                </div>
              );
            })()}

            <div className="border-t border-white/5" />

          {/* Chameleon: category picker */}
          {module.categories?.length > 0 && (() => {
            const activeCategory = state.category || module.categories[0];
            const isCustom       = activeCategory === CHAMELEON_CUSTOM_CATEGORY;

            return (
              <div className="flex flex-col gap-2">
                <span className="text-[10px] uppercase tracking-widest text-zinc-600">Categories</span>
                <div className="flex flex-wrap gap-1.5">
                  {module.categories.map((cat) => {
                    const active = activeCategory === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => push({ category: cat })}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                          active ? 'text-white' : 'bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700/60'
                        }`}
                        style={active ? { backgroundColor: colors.primary } : undefined}
                      >
                        {cat}
                      </button>
                    );
                  })}
                  {/* Custom category button */}
                  <button
                    onClick={() => push({
                      category: CHAMELEON_CUSTOM_CATEGORY,
                      customWords: state.customWords ?? [],
                    })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                      isCustom ? 'text-white' : 'bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700/60'
                    }`}
                    style={isCustom ? { backgroundColor: colors.primary } : undefined}
                  >
                    Custom
                  </button>
                </div>

                {/* Non-custom: show a preview of the word grid */}
                {!isCustom && (() => {
                  const words = CHAMELEON_WORD_CATEGORIES[activeCategory] ?? [];
                  if (!words.length) return null;
                  return (
                    <><span className="text-[10px] uppercase tracking-widest text-zinc-600 pt-2">Tiles</span>
                    <div className="mt-1">
                      <WordGrid words={words} seed={state.startingSeed ?? state.seed} />
                    </div></>
                  );
                })()}

                {/* Custom: expanding tile list */}
                {isCustomChameleon && (() => {
                  const addTile = () => {
                    const name = sanitizeName(newTile).trim();
                    if (!name || customWords.length >= 16) return;
                    push({ customWords: [...customWords, name] });
                    setNewTile('');
                    setTimeout(() => tileInputRef.current?.focus(), 0);
                  };
                  const removeTile = (i) =>
                    push({ customWords: customWords.filter((_, idx) => idx !== i) });

                  return (
                    <div className="flex flex-col gap-1.5 mt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-widest text-zinc-600">Custom Tiles</span>
                        <span className={`text-[10px] tabular-nums ${
                          customWords.length === 16 ? 'text-zinc-500' : 'text-amber-500'
                        }`}>
                          {customWords.length} / 16
                        </span>
                      </div>

                      {customWords.length === 0 ? (
                        <p className="text-zinc-600 text-xs text-center py-2">Add 16 custom tile names</p>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {customWords.map((w, i) => (
                            <div key={i} className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-zinc-800/60">
                              <span className="font-medium text-zinc-200 flex-1 truncate text-sm uppercase tracking-wide">{w}</span>
                              <button
                                className="text-zinc-600 hover:text-red-400 transition-colors"
                                onClick={() => removeTile(i)}
                              >✕</button>
                            </div>
                          ))}
                        </div>
                      )}

                      {customWords.length < 16 && (
                        <div className="flex gap-2">
                          <input
                            ref={tileInputRef}
                            className="flex-1 bg-zinc-800/60 text-zinc-100 rounded-2xl px-3 py-2.5 text-sm uppercase tracking-wide focus:outline-none focus:ring-1 focus:ring-zinc-500 placeholder:text-zinc-600"
                            placeholder="Tile name…"
                            value={newTile}
                            maxLength={NAME_MAX_LENGTH}
                            onChange={(e) => setNewTile(sanitizeName(e.target.value))}
                            onKeyDown={(e) => { if (e.key === 'Enter') addTile(); }}
                          />
                          <Button variant="secondary" size="sm" onClick={addTile} disabled={!newTile.trim()}>
                            Add
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* Spyfall: spy settings + location list */}
          {module.locations?.length > 0 && (
            <>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between px-3 py-2.5 rounded-2xl bg-zinc-800/60">
                  <span className="text-sm text-zinc-300">Number of Spies</span>
                  <div className="flex items-center gap-2">
                    <button
                      className="w-7 h-7 rounded-lg bg-zinc-700 text-zinc-300 text-sm font-bold hover:bg-zinc-600 disabled:opacity-30 transition-colors"
                      onClick={() => push({ spyCount: Math.max(1, spyCount - 1) })}
                      disabled={randomizeSpies || spyCount <= 1}
                    >−</button>
                    <span className={`w-5 text-center text-sm font-mono font-bold ${randomizeSpies ? 'text-zinc-600' : 'text-zinc-200'}`}>
                      {randomizeSpies ? '?' : spyCount}
                    </span>
                    <button
                      className="w-7 h-7 rounded-lg bg-zinc-700 text-zinc-300 text-sm font-bold hover:bg-zinc-600 disabled:opacity-30 transition-colors"
                      onClick={() => push({ spyCount: Math.min(maxSpies, spyCount + 1) })}
                      disabled={randomizeSpies || spyCount >= maxSpies}
                    >+</button>
                  </div>
                </div>

                <div className="flex items-center justify-between px-3 py-2.5 rounded-2xl bg-zinc-800/60">
                  <span className="text-sm text-zinc-300">Randomize spy count</span>
                  <button
                    onClick={() => push({ randomizeSpies: !randomizeSpies })}
                    className={`relative w-10 h-6 rounded-full transition-colors ${randomizeSpies ? '' : 'bg-zinc-700'}`}
                    style={randomizeSpies ? { backgroundColor: colors.primary } : undefined}
                  >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${randomizeSpies ? 'left-5' : 'left-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between px-3 py-2.5 rounded-2xl bg-zinc-800/60">
                  <span className="text-sm text-zinc-300">Allied Spies</span>
                  <button
                    onClick={() => push({ spiesKnowEachOther: !spiesKnow })}
                    className={`relative w-10 h-6 rounded-full transition-colors ${spiesKnow ? '' : 'bg-zinc-700'}`}
                    style={spiesKnow ? { backgroundColor: colors.primary } : undefined}
                  >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${spiesKnow ? 'left-5' : 'left-1'}`} />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-600">
                    Locations
                    <span className="ml-1.5 text-zinc-700 normal-case tracking-normal">
                      {enabledLocations.length}/{module.locations.length}
                    </span>
                  </span>
                  <div className="flex gap-3">
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
                        className={`px-2 py-1.5 rounded-xl text-xs font-medium text-center transition-all ${
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

          {/* Generic settingsSchema (Insider and future games) */}
          {module.settingsSchema?.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {module.settingsSchema.map((entry) => {
                const value = state[entry.key] ?? entry.default;

                if (entry.type === 'segmented') {
                  return (
                    <div key={entry.key} className="flex items-center justify-between px-3 py-2.5 rounded-2xl bg-zinc-800/60">
                      <span className="text-sm text-zinc-300">{entry.label}</span>
                      <div className="flex gap-0.5 bg-zinc-700/60 rounded-xl p-0.5">
                        {entry.options.map((opt) => (
                          <button
                            key={String(opt.value)}
                            onClick={() => push({ [entry.key]: opt.value })}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                              value === opt.value
                                ? 'bg-zinc-600 text-zinc-100 shadow'
                                : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }

                if (entry.type === 'stepper') {
                  return (
                    <div key={entry.key} className="flex items-center justify-between px-3 py-2.5 rounded-2xl bg-zinc-800/60">
                      <span className="text-sm text-zinc-300">{entry.label}</span>
                      <div className="flex items-center gap-2">
                        <button
                          className="w-7 h-7 rounded-lg bg-zinc-700 text-zinc-300 text-sm font-bold hover:bg-zinc-600 disabled:opacity-30 transition-colors"
                          onClick={() => push({ [entry.key]: Math.max(entry.min, value - entry.step) })}
                          disabled={value <= entry.min}
                        >−</button>
                        <span className="w-14 text-center text-sm font-mono font-bold text-zinc-200">
                          {entry.format ? entry.format(value) : value}
                        </span>
                        <button
                          className="w-7 h-7 rounded-lg bg-zinc-700 text-zinc-300 text-sm font-bold hover:bg-zinc-600 disabled:opacity-30 transition-colors"
                          onClick={() => push({ [entry.key]: Math.min(entry.max, value + entry.step) })}
                          disabled={value >= entry.max}
                        >+</button>
                      </div>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          )}

          {/* No-settings placeholder */}
          {!hasSettings && (
            <p className="text-zinc-600 text-xs text-center py-2">No settings for this game</p>
          )}
        </GlassCard>

          {/* ── Section 3: Players ───────────────────────────────────────────── */}
          <GlassCard className="w-full p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">Players</p>
            <span className={`text-[10px] tabular-nums ${
              state.players.length >= module.minPlayers ? 'text-zinc-500' : 'text-amber-500'
            }`}>
              {state.players.length} / {module.maxPlayers}
            </span>
          </div>

          {state.players.length === 0 ? (
            <p className="text-zinc-600 text-xs text-center py-2">
              Add at least {module.minPlayers} players to start
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {state.players.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-zinc-800/60"
                >
                  <span className="font-medium text-zinc-200 flex-1 truncate text-sm">{p.name}</span>
                  <button
                    className="text-zinc-600 hover:text-red-400 transition-colors"
                    onClick={() => removePlayer(p.id)}
                  >✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Add player row */}
          <div className="flex gap-2">
            <input
              className="flex-1 bg-zinc-800/60 text-zinc-100 rounded-2xl px-3 py-2.5 text-sm uppercase tracking-wide focus:outline-none focus:ring-1 focus:ring-zinc-500 placeholder:text-zinc-600"
              ref={inputRef}
              placeholder="Player name…"
              value={newName}
              maxLength={NAME_MAX_LENGTH}
              onChange={(e) => setNewName(sanitizeName(e.target.value))}
              onKeyDown={(e) => { if (e.key === 'Enter') addPlayer(); }}
              onFocus={() => {
                inputFocused.current = true;
                scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
              }}
              onBlur={() => { inputFocused.current = false; }}
            />
            <Button variant="secondary" size="sm" onClick={addPlayer} disabled={!newName.trim()}>
              Add
            </Button>
          </div>
        </GlassCard>

        </div>
        </div>
      </div>




      {/* ── Fixed footer: back button ─────────────────────────────────────── */}
      {onGoHome && (
        <div className="w-full max-w-sm px-3 pt-2 pb-2 shrink-0">
          {/* Create Lobby */}
          <Button
            size="lg"
            className="w-full py-3 rounded-2xl text-base font-bold active:scale-95 transition-all mb-2"
            onClick={onStart}
            disabled={!canStart || !customTilesFilled}
          >
            {!canStart
              ? `Need ${module.minPlayers - state.players.length} more player(s)`
              : !customTilesFilled
                ? `Need ${16 - customWords.length} more tile(s)`
                : `Create Lobby · ${calculateChecksum(state)}`}
          </Button>

          <button
            className="w-full py-3 rounded-2xl text-base font-bold bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700/60 hover:text-zinc-200 active:scale-95 transition-all"
            onClick={onGoHome}
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
}
