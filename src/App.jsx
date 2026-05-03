// src/App.jsx — Orchestrator
// Responsible only for: URL hash sync, identity persistence, and the
// lobby → playing state machine. All game logic, module resolution, and
// UI primitives live in their own modules under the production structure:
//
//   src/engine/          PRNG, seed navigation, lz-string envelope, state factory
//   src/styles/          ThemeContext
//   src/games/           Module registry + individual game folders
//   src/components/      Shared primitives + LobbyScreen
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ThemeContext }                                     from './styles/ThemeContext';
import { getModule }                                        from './games/index';
import { calculateChecksum }                                from './engine/envelope';
import { parseGameStateParam, buildGameStateParam, GAME_TYPE_IDS, GAME_TYPE_FROM_ID } from './engine/gamestate';
import { createDefaultState }                               from './engine/state';
import { getNextSeed, getPrevSeed }                      from './engine/seedNav';
import { findCachedPlayer, saveLobbyCache }                 from './engine/lobbyCache';
import {
  readSession,
  saveSession,
  updateSession,
  clearSession,
  clearIdentityFromSession,
}                                                           from './engine/sessionPersistence';
import { LobbyScreen }                                      from './components/LobbyScreen';
import { PreGameScreen }                                    from './components/PreGameScreen';
import { GamePlayScreen }                                   from './components/GamePlayScreen';
import { HomeScreen }                                       from './components/HomeScreen';
import { QrScannerModal }                                   from './components/QrScannerModal';
import { IdentityPickerModal }                              from './components/IdentityPickerModal';
import { Toast }                                            from './components/shared/Toast';

export default function App() {
  // ── Initialise — hydrate from hash if present ──────────────────────────────
  const [state, _setState] = useState(() => {
    try {
      const params       = new URLSearchParams(window.location.search);
      const gsParam      = params.get('gs');
      if (gsParam) {
        const { gameTypeId, isLobby, gamePayload } = parseGameStateParam(gsParam);
        const gameTypeName = GAME_TYPE_FROM_ID[gameTypeId];
        if (gameTypeName) {
          const mod = getModule(gameTypeName);
          if (mod?.decodeGameState) {
            const decoded = mod.decodeGameState(gamePayload);
            if (decoded?.players && Array.isArray(decoded.players)) {
              // Merge with defaultState so fields not encoded in the URL (e.g. Chameleon
              // roundSeconds) still get their defaults → consistent checksum across reloads.
              const withDefaults = { ...(mod.defaultState?.() ?? {}), ...decoded };
              const baseStatus   = isLobby ? 'lobby' : 'pregame';
              const withStatus   = { ...withDefaults, status: baseStatus };
              const withChecksum = { ...withStatus, checksum: calculateChecksum(withStatus) };
              // Restore the exact screen the player was on before reloading
              try {
                const session = readSession();
                if (session?.lobbyID === withChecksum.checksum && session?.currentScreen) {
                  return { ...withChecksum, status: session.currentScreen };
                }
              } catch { /* ignore */ }
              return withChecksum;
            }
          }
        }
      }
    } catch { /* malformed param — fall through */ }
    return createDefaultState();
  });

  const [identity, _setIdentity] = useState(null);
  const [identityPickerOpen, setIdentityPickerOpen] = useState(false);

  // Cached player for the current lobby checksum (null = no cache hit)
  const [cachedPlayer, setCachedPlayer] = useState(null);
  const [toast, setToast] = useState(null);
  const [qrOpen, setQrOpen] = useState(false);

  // Set to true by handleChangeIdentity so the next picker open skips auto-select
  const forcePickerRef = useRef(false);

  // Checksum captured when the user enters the lobby from an active game;
  // used to detect lobby edits that warrant a round reset.
  const preLobbyChecksumRef = useRef(null);

  // ── Sync state → ?gs= URL ──────────────────────────────────────────
  useEffect(() => {
    if (state.status === 'home') {
      history.replaceState(null, '', window.location.pathname);
      return;
    }
    const mod = getModule(state.gameType);
    if (!mod?.encodeGameState) return;
    try {
      const payload = mod.encodeGameState(state);
      const isLobby = state.status === 'lobby';
      const param   = buildGameStateParam(GAME_TYPE_IDS[state.gameType], isLobby, payload);
      history.replaceState(null, '', `${window.location.pathname}?gs=${param}`);
    } catch { /* encoding error — leave URL as-is */ }
  }, [state]);

  // ── Update document title based on current screen ────────────────────────
  useEffect(() => {
    if (state.status === 'pregame' || state.status === 'playing') {
      const mod = getModule(state.gameType);
      const gameName = mod?.displayName ?? state.gameType;
      document.title = `${gameName} • ${state.checksum}`;
    } else {
      document.title = 'Deceptive';
    }
  }, [state.status, state.gameType, state.checksum]);

  // ── Persist identity so it survives page refreshes ────────────────────────
  useEffect(() => {
    if (identity) {
      updateSession({ playerName: identity.name, playerId: identity.id });
    }
  }, [identity]);

  // ── Open identity picker whenever entering a game without a name ──────────
  useEffect(() => {
    const needsPicker = (state.status === 'pregame' || state.status === 'playing') && !identity;
    if (!needsPicker) {
      setIdentityPickerOpen(false);
      return;
    }
    // Player explicitly requested a change — show picker even if cache hit exists
    if (forcePickerRef.current) {
      forcePickerRef.current = false;
      setIdentityPickerOpen(true);
      return;
    }
    // Check persisted session first — survives refreshes and browser restarts
    try {
      const session = readSession();
      if (session?.playerId || session?.playerName) {
        const match = state.players.find(
          (p) => p.id === session.playerId || p.name === session.playerName,
        );
        if (match) {
          _setIdentity(match);
          setIdentityPickerOpen(false);
          return;
        }
      }
    } catch { /* ignore */ }
    // Fall back to lobby cache (cross-device, keyed by checksum)
    const cached = findCachedPlayer(state.checksum, state.players);
    if (cached) {
      _setIdentity(cached);
      setIdentityPickerOpen(false);
    } else {
      setCachedPlayer(null);
      setIdentityPickerOpen(true);
    }
  }, [state.status, state.checksum, identity]);

  // ── Cache the identity as soon as the player reaches the pregame screen ───
  useEffect(() => {
    if (state.status === 'pregame' && identity) {
      saveLobbyCache(state.checksum, identity);
    }
  }, [state.status, state.checksum, identity]);

  // ── Mutators ───────────────────────────────────────────────────────────────
  /** Recalculates checksum on every write so the URL hash is always current. */
  const setState = useCallback((next) => {
    const withChecksum = { ...next, checksum: calculateChecksum(next) };
    // Persist current screen so a reload lands on the same page
    if (next.status === 'home') {
      clearSession();
    } else {
      updateSession({ currentScreen: next.status, lobbyID: withChecksum.checksum });
    }
    _setState(withChecksum);
  }, []);

  const setIdentity = useCallback((player) => { _setIdentity(player); }, []);

  const handlePick = useCallback((player) => {
    saveLobbyCache(state.checksum, player);
    _setIdentity(player);
  }, [state.checksum]);

  // Re-opens the identity picker so the player can change their name
  const handleChangeIdentity = useCallback(() => {
    clearIdentityFromSession();
    forcePickerRef.current = true;
    setCachedPlayer(findCachedPlayer(state.checksum, state.players));
    _setIdentity(null);
  }, [state.checksum, state.players]);

  const handleStart = useCallback(() => {
    const prev = preLobbyChecksumRef.current;
    preLobbyChecksumRef.current = null;

    // Fresh lobby (no prior round) OR lobby composition changed → reset to round 1
    // and use the lobby's startingSeed as the deterministic round-1 seed.
    const isNewLobby       = prev === null;
    const checksumChanged  = prev !== null && state.checksum !== prev;
    const shouldReset      = isNewLobby || checksumChanged;

    setState({
      ...state,
      status: 'pregame',
      round:  shouldReset ? 1 : state.round,
      seed:   shouldReset ? (state.startingSeed ?? state.checksum) : state.seed,
    });
  }, [state, setState]);

  const handleCreateLobby = useCallback(() => {
    updateSession({ isCreator: true });
    setState({ ...createDefaultState(), status: 'lobby' });
  }, [setState]);

  const handleJoinFromQr = useCallback((gsParam) => {
    setQrOpen(false);
    // Brief delay lets the QR modal backdrop clear before the screen fades in
    setTimeout(() => {
      try {
        const { gameTypeId, isLobby, gamePayload } = parseGameStateParam(gsParam);
        const gameTypeName = GAME_TYPE_FROM_ID[gameTypeId];
        if (!gameTypeName) throw new Error('Unknown game type');
        const mod     = getModule(gameTypeName);
        const decoded = mod?.decodeGameState?.(gamePayload);
        if (!decoded?.players || !Array.isArray(decoded.players)) throw new Error('Invalid payload');
        const withDefaults = { ...(mod.defaultState?.() ?? {}), ...decoded };
        const withStatus = { ...withDefaults, status: isLobby ? 'lobby' : 'pregame' };
        const joined = { ...withStatus, checksum: calculateChecksum(withStatus) };
        updateSession({ isCreator: false });
        setState(joined);
      } catch {
        setToast('Invalid QR code — could not join lobby');
      }
    }, 350);
  }, [setState]);

  const handleGoHome = useCallback(() => {
    _setIdentity(null);
    // clearSession() is called automatically by setState when status === 'home'
    setState({ ...createDefaultState(), status: 'home' });
  }, [setState]);

  const handleProceedToPlay = useCallback(() => {
    setState({ ...state, status: 'playing' });
  }, [state, setState]);

  const handleNextRound = useCallback(() => {
    setState({
      ...state,
      seed:   getNextSeed(state.seed),
      round:  state.round + 1,
      status: 'pregame',
    });
  }, [state, setState]);

  const handleBackToLobby = useCallback(() => {
    // Snapshot current checksum so handleStart can detect changes
    preLobbyChecksumRef.current = state.checksum;
    setState({ ...state, status: 'lobby' });
  }, [state, setState]);

  const handleBackToPregame = useCallback(() => {
    setState({ ...state, status: 'pregame' });
  }, [state, setState]);

  const handlePrevRound = useCallback(() => {
    if (state.round <= 1) return;
    setState({
      ...state,
      seed:   getPrevSeed(state.seed),
      round:  state.round - 1,
      status: 'pregame',
    });
  }, [state, setState]);

  // ── Theme injection ────────────────────────────────────────────────────────
  const module = getModule(state.gameType);
  const colors = module.constants.COLORS;

  return (
    <ThemeContext.Provider value={{ colors }}>
      <div
        className="h-full overflow-hidden"
        style={
          state.status === 'home'
            ? { background: '#09090b' }
            : { background: `radial-gradient(ellipse at top, ${colors.primary}1A 0%, #09090b 55%)` }
        }
      >
        <div key={state.status} className="animate-fadeIn h-full">

        {state.status === 'home' && (
          <HomeScreen
            onCreateLobby={handleCreateLobby}
            onJoinLobby={() => setQrOpen(true)}
          />
        )}

        {state.status === 'lobby' && (
          <LobbyScreen
            state={state}
            onStateChange={setState}
            onStart={handleStart}
            onGoHome={handleGoHome}
          />
        )}

        {state.status === 'pregame' && (
          <PreGameScreen
            state={state}
            identity={identity}
            onStateChange={setState}
            onProceed={handleProceedToPlay}
            onBackToLobby={handleBackToLobby}
            onChangeIdentity={handleChangeIdentity}
            onPrevRound={handlePrevRound}
            onNextRound={handleNextRound}
          />
        )}

        {state.status === 'playing' && (
          <GamePlayScreen
            state={state}
            identity={identity}
            onNextRound={handleNextRound}
            onBackToLobby={handleBackToPregame}
          />
        )}

        {toast && <Toast message={toast} onDone={() => setToast(null)} />}

        </div>
      </div>

      <QrScannerModal
        isOpen={qrOpen}
        onClose={() => setQrOpen(false)}
        onScanned={handleJoinFromQr}
      />

      <IdentityPickerModal
        isOpen={identityPickerOpen}
        players={state.players}
        onPick={handlePick}
        cachedPlayer={cachedPlayer}
      />
    </ThemeContext.Provider>
  );
}
