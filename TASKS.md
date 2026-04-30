# Deception Engine — Development Tasks

---

## TASK-001 · Consistent Card Sizing Across Screens

**As a** player using Deception on any device,  
**I want** the game cards to be a consistent size regardless of which screen I'm on,  
**so that** the UI feels like a cohesive app rather than a collection of differently-sized pages.

### Acceptance Criteria

- [ ] All primary content cards (`GlassCard`) share the same width: `100%` up to a fixed max-width cap (e.g. `max-w-sm` / 384 px) on screens wider than that cap.
- [ ] On mobile viewports (< 640 px) the card fills nearly the full screen width with consistent horizontal padding.
- [ ] On tablet and desktop viewports the card is centered and uses the fixed max-width, not the full viewport width.
- [ ] The fixed max-width and horizontal padding values are defined in one place (e.g. a shared layout constant or a Tailwind component class) so all screens stay in sync automatically.
- [ ] Verified on: HomeScreen, LobbyScreen, PreGameScreen, GamePlayScreen, and any modal-hosted content.

---

## TASK-002 · Insider Master Selection Modes

**As a** host setting up an Insider lobby,  
**I want** to choose between *Random Master* and *Rotating Master* modes,  
**so that** I can control whether the same player might be selected twice in a row or whether every player eventually gets a turn.

### Acceptance Criteria

- [ ] The Insider settings tab in the lobby creation screen displays a binary toggle or segmented control labelled **"Master Selection"** with two options: **Random Master** and **Rotating Master**.
- [ ] The setting is stored as a single boolean bit in game state (`rotatingMaster: true/false`); `false` = Random, `true` = Rotating.
- [ ] **Random Master**: on each round, the master is drawn uniformly at random from the player list using the round seed.
- [ ] **Rotating Master**: the master index is calculated as `(round - 1) % playerCount`, cycling through the player list in order.
- [ ] The selected mode is included in `getSettingsSummary()` so it appears in the PreGameScreen settings summary section.
- [ ] The setting is encoded/decoded correctly in the game state URL parameter so shared links preserve it.
- [ ] The default value for new lobbies is **Random Master**.

---

## TASK-003 · Configurable Starting Seed

**As a** host creating a lobby,  
**I want** the starting seed to be randomly generated from the current time and to be adjustable,  
**so that** each lobby is unique by default while still allowing manual control for reproducibility or re-running a specific game.

### Acceptance Criteria

- [ ] When a new lobby is created, the starting seed is generated from `Date.now()` (or a derivative) rather than a static default — this replaces the previous behaviour of deriving the seed from the checksum.
- [ ] The lobby creation screen displays the current starting seed as a read-only or editable field (4-char base-36) with a **Randomise 🎲** button alongside it.
- [ ] Tapping **Randomise** generates a new seed from `Date.now()` at that moment — this uses a different calculation than `getNextSeed` / `getPrevSeed`.
- [ ] The starting seed persists across lobby edits; it is only regenerated when explicitly randomised or when a brand-new lobby is created.
- [ ] The starting seed is shown on the PreGameScreen (e.g. in or near the Round tile) so players can note it for future reference.
- [ ] Subsequent round seeds continue to be derived via `getNextSeed(seed)` as before.
- [ ] The seed is encoded in the game state URL parameter and survives a round-trip decode.

---

## TASK-004 · Insider Question-Time Limit Setting

**As a** player setting up an Insider game,  
**I want** to configure how many minutes the group has to ask questions,  
**so that** the game can be played at the right pace for my group.

### Acceptance Criteria

- [ ] The Insider settings tab in the lobby creation screen includes a **"Question Time"** numeric stepper (minutes).
- [ ] The default value is **5 minutes**.
- [ ] The minimum value is **1 minute**; the maximum is **30 minutes** (or a similarly reasonable cap).
- [ ] The setting is stored in game state as an integer number of seconds (e.g. `questionSeconds: 300`).
- [ ] The value is passed to `RoundTimer` as `totalSeconds` when the Insider game play screen renders, replacing any previously hard-coded constant.
- [ ] The time limit is included in `getSettingsSummary()` so it appears in the PreGameScreen settings summary (displayed as minutes, e.g. "5 min").
- [ ] The setting survives encode/decode round-trips in the URL parameter.

---

## TASK-005 · Insider Role — Indistinguishable Reveal Shield Backgrounds

**As a** player who has not yet revealed their role card in an Insider game,  
**I want** the blurred/shielded reveal background to look identical whether I am the Common player or the Insider,  
**so that** other players watching over my shoulder cannot infer my role from the colour or appearance of the shield before I reveal it.

### Acceptance Criteria

- [ ] The `RevealShield` component (or the role card container) does **not** use the role-specific `ROLE_COLORS` value for its background, border, or any visible decoration before the card is revealed.
- [ ] Both the *Common* role and the *Insider* role display an identical neutral shield (e.g. solid `bg-zinc-900` or a fixed neutral colour) while unrevealed.
- [ ] Role-specific colours (tinted background/border) are only applied **after** the hold-to-reveal gesture completes and the card content is shown.
- [ ] The fix is validated by side-by-side visual comparison of the unrevealed shield for both roles: they must be pixel-identical (same background, border, blur, and label).
- [ ] No other game's reveal shield is affected by this change.
