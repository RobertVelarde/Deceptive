// src/components/PreGameScreen.jsx — Intermediary screen between lobby and play
//
// Shown when:
//   1. The host clicks "Start Game" from the lobby.
//   2. A player loads a share link (?gs= with isLobby=false).
//
// Displays the player's name, the lobby checksum (for cross-device verification),
// and the current round seed (editable). From here the player clicks "Deal Cards"
// to see their private role card.
import React, { useState, useCallback, useMemo, useRef } from 'react';
import QRCode from 'qrcode';
import { useTheme } from '../styles/ThemeContext';
import { getModule } from '../games/index';
import { buildGameStateParam, GAME_TYPE_IDS } from '../engine/gamestate';
import { GlassCard } from './shared/GlassCard';
import { Button } from './shared/Button';
import { Modal } from './shared/Modal';
import { WordGrid } from './shared/WordGrid';
import { CHAMELEON_WORD_CATEGORIES } from '../games/chameleon/words';
import { CHAMELEON_CUSTOM_CATEGORY, CHAMELEON_SORTED_CATEGORIES } from '../games/chameleon/index';

// How long (ms) the user must hold before the change-player warning fires
const LONG_PRESS_MS = 600;
/** How long (ms) the "Copied!" confirmation badge stays visible. */
const COPY_CONFIRM_MS = 2000;
/** QR code pixel dimensions for the share overlay. */
const QR_WIDTH_PX = 256;
const QR_MARGIN_PX = 2;

export function PreGameScreen({ state, identity, onStateChange, onProceed, onBackToLobby, onChangeIdentity, onPrevRound, onNextRound }) {
  const { colors } = useTheme();
  const module = getModule(state.gameType);
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [editLobbyWarn, setEditLobbyWarn] = useState(false);
  const [changeNameWarn, setChangeNameWarn] = useState(false);
  const [showPlayers, setShowPlayers] = useState(false);
  const [showLocations, setShowLocations] = useState(false);
  const [showRoundTime, setShowRoundTime] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [categoryPreview, setCategoryPreview] = useState(null);

  const holdTimerRef = useRef(null);

  // ── Long-press handlers for "Playing as" name ────────────────────────────
  const startHold = () => {
    holdTimerRef.current = setTimeout(() => setChangeNameWarn(true), LONG_PRESS_MS);
  };
  const cancelHold = () => {
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
  };

  // Build the share URL (isLobby=false so recipients land on pregame)
  const shareUrl = useMemo(() => {
    if (!module.encodeGameState) return window.location.href;
    try {
      const payload = module.encodeGameState(state);
      const param = buildGameStateParam(GAME_TYPE_IDS[state.gameType], false, payload);
      return `${window.location.origin}${window.location.pathname}?gs=${param}`;
    } catch { return window.location.href; }
  }, [state, module]);

  const copyLink = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Join my ' + module.displayName + ' game!',
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), COPY_CONFIRM_MS);
      }
    } catch { /* user cancelled or clipboard unavailable */ }
  }, [shareUrl]);

  const openQr = useCallback(async () => {
    try {
      const dataUrl = await QRCode.toDataURL(shareUrl, {
        width: QR_WIDTH_PX,
        margin: QR_MARGIN_PX,
        color: { dark: '#ffffff', light: '#18181b' }, // white on zinc-900
      });
      setQrDataUrl(dataUrl);
      setCopied(false);
      setQrOpen(true);
    } catch { /* generation failed */ }
  }, [shareUrl]);

  return (
    <div className="h-full overflow-y-auto flex flex-col items-center">
      <div className="min-h-full flex flex-col items-center justify-center p-4 gap-6 w-full">

        {/* Header */}
        <div className="text-center select-none">
          <h1 className="text-4xl font-black" style={{ color: colors.primary }}>
            {module.displayName}
          </h1>
        </div>

        <GlassCard className="w-full max-w-md p-6 flex flex-col gap-5">
          <div className="flex flex-row gap-2 w-full">
            {/* Playing as — half-width button; long-press to trigger change-identity warning */}
            <button
              className="w-2/3 flex flex-col items-center gap-1 py-3 px-2 rounded-2xl bg-zinc-800/60 active:opacity-70 transition-opacity select-none"
              onPointerDown={startHold}
              onPointerUp={cancelHold}
              onPointerLeave={cancelHold}
              onContextMenu={(e) => e.preventDefault()}
            >
              <span className="text-[10px] uppercase tracking-widest text-zinc-500">Playing as</span>
              <span className="text-xl font-black text-white">
                {identity?.name ?? '—'}
              </span>
              <span className="text-[10px] text-zinc-600">
                {identity ? 'Hold to change player' : 'Waiting for selection…'}
              </span>
            </button>

            {/* Players tile — half-width button; tappable */}
            <button
              className="w-1/3 flex flex-col items-center gap-1 py-3 px-2 rounded-2xl bg-zinc-800/60 active:opacity-70 transition-opacity select-none"
              onClick={() => setShowPlayers(true)}
            >
              <span className="text-[10px] uppercase tracking-widest text-zinc-500">Players</span>
              <span className="text-xl font-bold text-zinc-100">{state.players.length}</span>
              <span className="text-[10px] text-zinc-600">Tap to see</span>
            </button>
          </div>

          <div className="border-t border-white/5" />

          {/* Lobby + Round — side-by-side tap buttons */}
          <div className="flex gap-3">
            {/* Lobby + seed button → opens QR / share modal */}
            <button
              className="flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-2xl bg-zinc-800/60 active:opacity-70 transition-opacity select-none"
              onClick={openQr}
            >
              <span className="text-[10px] uppercase tracking-widest text-zinc-500">Lobby</span>
              <span className="text-xl font-mono font-bold tracking-widest text-zinc-100">
                {state.checksum || '——'}
              </span>
              <span className="text-[10px] text-zinc-600">Tap to share</span>
            </button>

            {/* Round tile with − / + stepper */}
            <div className="flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-2xl bg-zinc-800/60 select-none">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500">Round</span>
              <div className="flex items-center gap-2 mt-0.5">
                <button
                  className="w-7 h-7 rounded-lg bg-zinc-700 text-zinc-200 text-base font-bold hover:bg-zinc-600 disabled:opacity-30 transition-colors"
                  onClick={onPrevRound}
                  disabled={state.round <= 1}
                  aria-label="Previous round"
                >−</button>
                <span className="text-xl font-mono font-bold tracking-widest text-zinc-100 min-w-[2.5rem] text-center">
                  {state.round}
                </span>
                <button
                  className="w-7 h-7 rounded-lg bg-zinc-700 text-zinc-200 text-base font-bold hover:bg-zinc-600 disabled:opacity-30 transition-colors"
                  onClick={onNextRound}
                  disabled={state.round >= 999}
                  aria-label="Next round"
                >+</button>
              </div>
            </div>
          </div>

          {/* Settings summary — only shown when the module has configurable settings */}
          {(() => {
            const summary = module.getSettingsSummary?.(state) ?? [];
            const gameSupportsTimer = (module.constants?.ROUND_SECONDS ?? 300) > 0;
            const roundSecs = gameSupportsTimer ? (state.roundSeconds ?? module.constants?.ROUND_SECONDS ?? 300) : 0;
            const roundTimeBubble = { label: 'Round time', value: `${Math.round(roundSecs / 60)} min` };
            // Inject round time for all games; avoid duplicating Spyfall's existing entry
            const summaryWithoutRoundTime = summary.filter((b) => b.label !== 'Round time');
            const seedBubble = { label: 'Seed', value: state.startingSeed ?? state.seed ?? '????' };
            const bubbles = [
              ...(roundSecs > 0 ? [roundTimeBubble] : []),
              ...summaryWithoutRoundTime,
              seedBubble,
            ];
            return (
              <>
                <div className="border-t border-white/5" />
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {bubbles.map(({ label, value }) => {
                      const isLocations = label === 'Locations' && state.gameType === 'spyfall';
                      const isCategories = label === 'Categories' && state.gameType === 'chameleon';
                      if (isCategories) {
                        return (
                          <button
                            key={label}
                            onClick={() => { setCategoryPreview(null); setShowCategories(true); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/60 active:opacity-70 transition-opacity"
                          >
                            <span className="text-[10px] uppercase tracking-widest text-zinc-500">{label}:</span>
                            <span className="text-xs font-bold text-zinc-200">{value}</span>
                          </button>
                        );
                      }
                      if (isLocations) {
                        return (
                          <button
                            key={label}
                            onClick={() => setShowLocations(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/60 active:opacity-70 transition-opacity"
                          >
                            <span className="text-[10px] uppercase tracking-widest text-zinc-500">{label}:</span>
                            <span className="text-xs font-bold text-zinc-200">{value}</span>
                          </button>
                        );
                      }
                      return (
                        <div
                          key={label}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/60"
                        >
                          <span className="text-[10px] uppercase tracking-widest text-zinc-500">{label}:</span>
                          <span className="text-xs font-bold text-zinc-200">{value}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            );
          })()}

          {/* Deal cards */}
          <Button
            size="lg"
            className="w-full"
            onClick={onProceed}
            disabled={!identity}
          >
            {identity ? 'Start Round' : 'Select your name in lobby first'}
          </Button>

        </GlassCard>

        {/* Edit lobby — guarded by warning */}
        <button
          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          onClick={() => setEditLobbyWarn(true)}
        >
          ← Edit Lobby
        </button>

        {/* Chameleon: categories browser modal */}
        {state.gameType === 'chameleon' && (() => {
          const enabled = state.enabledCategories ?? CHAMELEON_SORTED_CATEGORIES;
          const nonCustom = enabled.filter((c) => c !== CHAMELEON_CUSTOM_CATEGORY);
          const hasCustom = enabled.includes(CHAMELEON_CUSTOM_CATEGORY);
          // All enabled categories for the list, sorted alpha + Custom at end
          const listCategories = [
            ...CHAMELEON_SORTED_CATEGORIES.filter((c) => nonCustom.includes(c)),
            ...(hasCustom ? [CHAMELEON_CUSTOM_CATEGORY] : []),
          ];
          const previewWords = categoryPreview === CHAMELEON_CUSTOM_CATEGORY
            ? (state.customWords ?? [])
            : (categoryPreview ? (CHAMELEON_WORD_CATEGORIES[categoryPreview] ?? []) : []);

          // if categoryPreview is null, set it to the first category in the list (if any) so that the modal opens with a preview visible
          if (categoryPreview === null && listCategories.length > 0) {
            setCategoryPreview(listCategories[0]);
          }

          return (
            <Modal
              isOpen={showCategories}
              onClose={() => setShowCategories(false)}
              title={`Categories (${nonCustom.length + (hasCustom ? 1 : 0)})`}
            >
              {listCategories.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-4">No categories enabled</p>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-1.5 max-h-60 overflow-y-auto scrollbar-hide">
                    {listCategories.map((cat) => {
                      const label = cat === CHAMELEON_CUSTOM_CATEGORY ? 'Custom' : cat;
                      const isSelected = categoryPreview === cat;
                      return (
                        <button
                          key={cat}
                          onClick={() => setCategoryPreview(isSelected ? null : cat)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                          isSelected ? 'text-white' : 'bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700/60'}`}
                          style={isSelected ? { backgroundColor: colors.primary + 'CC' } : undefined}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {categoryPreview && (
                    <>
                      <div className="border-t border-white/5" />
                      <p className="text-[10px] uppercase tracking-widest text-zinc-500 text-center">
                        {categoryPreview === CHAMELEON_CUSTOM_CATEGORY ? 'Custom' : categoryPreview}
                      </p>
                      {previewWords.length ? (
                        <WordGrid words={previewWords} seed={state.startingSeed ?? state.seed} />
                      ) : (
                        <p className="text-zinc-500 text-sm text-center py-2">No words added yet</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </Modal>
          );
        })()}

        {/* Enabled locations modal */}
        <Modal
          isOpen={showLocations}
          onClose={() => setShowLocations(false)}
          title={`Locations (${(state.enabledLocations ?? []).length})`}
        >
          {(state.enabledLocations ?? []).length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-4">No locations enabled</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-100 overflow-y-auto scrollbar-hide">
              {(state.enabledLocations ?? []).map((loc) => (
                <div
                  key={loc}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-zinc-800/60 text-zinc-400"
                >
                  {loc}
                </div>
              ))}
            </div>
          )}
        </Modal>

        {/* Players list modal */}
        <Modal isOpen={showPlayers} onClose={() => setShowPlayers(false)} title={`Players · ${state.players.length}`}>
          <div className="flex flex-col gap-2">
            {state.players.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${p.id === identity?.id
                    ? 'bg-zinc-700/50 border-white/10'
                    : 'bg-zinc-800/40 border-white/5'
                  }`}
              >
                <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-bold text-zinc-300 shrink-0">
                  {p.name[0]}
                </div>
                <span className="text-sm font-medium text-zinc-300 flex-1 truncate">{p.name}</span>
                {p.id === identity?.id && (
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500">you</span>
                )}
              </div>
            ))}
          </div>
        </Modal>

        {/* QR code modal — includes Copy Link */}
        <Modal isOpen={qrOpen} onClose={() => setQrOpen(false)} title="Scan to Join">
          <div className="flex flex-col items-center gap-4">
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="Lobby QR code"
                className="rounded-2xl"
                width={256}
                height={256}
              />
            )}
            <button
              onClick={copyLink}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              {copied ? '✓ Copied!' : 'Share Link'}
            </button>
          </div>
        </Modal>

        {/* ── Edit Lobby warning ── */}
        <Modal isOpen={editLobbyWarn} onClose={() => setEditLobbyWarn(false)} title="Edit Lobby?">
          <div className="flex flex-col gap-5">
            <p className="text-sm text-zinc-300 leading-relaxed">
              It is not usually necessary to edit the lobby after a game has started.
              Only proceed if you are the <span className="text-white font-semibold">host</span>.
            </p>
            <div className="flex gap-3">
              <button
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                onClick={() => setEditLobbyWarn(false)}
              >
                Cancel
              </button>
              <button
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
                style={{ backgroundColor: colors.primary }}
                onClick={() => { setEditLobbyWarn(false); onBackToLobby(); }}
              >
                Edit Lobby
              </button>
            </div>
          </div>
        </Modal>

        {/* ── Change player warning — deliberately white to illuminate the screen ── */}
        {changeNameWarn && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-fadeIn"
            style={{ background: 'rgba(255,255,255,0.97)' }}
          >
            <div className="w-full max-w-xs bg-white rounded-3xl shadow-2xl p-7 flex flex-col gap-5">
              <div className="text-center">
                <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Warning</p>
                <h2 className="text-xl font-black text-gray-900">Change player?</h2>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed text-center">
                Changing your player name mid-game is unusual and may affect fairness.
                Are you sure you want to continue?
              </p>
              <div className="flex gap-3">
                <button
                  className="flex-1 py-3 rounded-xl text-sm font-bold bg-gray-100 text-gray-700 active:bg-gray-200 transition-colors"
                  onClick={() => setChangeNameWarn(false)}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-colors"
                  style={{ backgroundColor: '#dc2626' }}
                  onClick={() => { setChangeNameWarn(false); onChangeIdentity?.(); }}
                >
                  Change
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}


