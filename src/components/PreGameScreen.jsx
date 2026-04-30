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
import QRCode            from 'qrcode';
import { useTheme }      from '../styles/ThemeContext';
import { getModule }     from '../games/index';
import { buildGameStateParam, GAME_TYPE_IDS } from '../engine/gamestate';
import { GlassCard }     from './shared/GlassCard';
import { Button }        from './shared/Button';
import { Modal }         from './shared/Modal';

// How long (ms) the user must hold before the change-player warning fires
const LONG_PRESS_MS = 600;
/** How long (ms) the "Copied!" confirmation badge stays visible. */
const COPY_CONFIRM_MS = 2000;
/** QR code pixel dimensions for the share overlay. */
const QR_WIDTH_PX  = 256;
const QR_MARGIN_PX = 2;

export function PreGameScreen({ state, identity, onStateChange, onProceed, onBackToLobby, onChangeIdentity, onPrevRound, onNextRound }) {
  const { colors } = useTheme();
  const module = getModule(state.gameType);
  const [copied, setCopied]                  = useState(false);
  const [qrOpen, setQrOpen]                  = useState(false);
  const [qrDataUrl, setQrDataUrl]            = useState(null);
  const [editLobbyWarn, setEditLobbyWarn]    = useState(false);
  const [changeNameWarn, setChangeNameWarn]  = useState(false);

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
      const param   = buildGameStateParam(GAME_TYPE_IDS[state.gameType], false, payload);
      return `${window.location.origin}${window.location.pathname}?gs=${param}`;
    } catch { return window.location.href; }
  }, [state, module]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_CONFIRM_MS);
    } catch { /* clipboard unavailable */ }
  }, [shareUrl]);

  const openQr = useCallback(async () => {
    try {
      const dataUrl = await QRCode.toDataURL(shareUrl, {
        width:   QR_WIDTH_PX,
        margin:  QR_MARGIN_PX,
        color:   { dark: '#ffffff', light: '#18181b' }, // white on zinc-900
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

      <GlassCard className="w-full max-w-sm p-6 flex flex-col gap-5">

        {/* Playing as — full-width button; long-press to trigger change-identity warning */}
        <button
          className="w-full flex flex-col items-center gap-1 py-3 px-2 rounded-2xl bg-zinc-800/60 active:opacity-70 transition-opacity select-none"
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
          if (!summary.length) return null;
          return (
            <>
              <div className="border-t border-white/5" />
              <div className="flex flex-col gap-2">
                <span className="text-[10px] uppercase tracking-widest text-zinc-500 text-center">
                  Settings
                </span>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {summary.map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/60"
                    >
                      <span className="text-[10px] uppercase tracking-widest text-zinc-500">{label}:</span>
                      <span className="text-xs font-bold text-zinc-200">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          );
        })()}

        <div className="border-t border-white/5" />

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
          <p className="text-xs text-zinc-500 text-center">
            Scan with your phone camera to join this lobby
          </p>
          <button
            onClick={copyLink}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            {copied ? '✓ Copied!' : 'Copy Link'}
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


