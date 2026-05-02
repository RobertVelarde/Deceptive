// src/games/spyfall/constants.js — Spyfall brand & game constants

export const SPYFALL_COLORS = {
  primary:      '#F59E0B',
  primaryLight: '#FBBF24',
  primaryDark:  '#D97706',
  card:         'rgba(245,158,11,0.10)',
  accent:       '#FEF3C7',
};

export const SPYFALL_ROLES = {
  SPY:      'spy',
  CIVILIAN: 'civilian',
};

export const SPYFALL_ROLE_COLORS = {
  spy:      '#C62828',
  civilian: '#1565C0',
};

export const SPYFALL_ROUND_SECONDS = 480; // 8 minutes

// ROLE_META drives the generic GamePlayScreen.
//   locationReveal:         true  → render the hold-to-reveal location+role card
//   locationRevealDisabled: true  → render the hold button in disabled/placeholder state
export const SPYFALL_ROLE_META = {
  spy: {
    label:                  'SPY',
    desc:                   "You don't know the location. Blend in, answer vaguely, and avoid being caught!",
    showsTimer:             true,
    locationRevealDisabled: true,  // placeholder card visible but reveals nothing (screen-peek prevention)
  },
  civilian: {
    label:          'CIVILIAN',
    desc:           'You know the location. Give clues to expose the spy — without making it too obvious.',
    showsTimer:     true,
    locationReveal: true,  // shows secret location + assigned role
  },
};
