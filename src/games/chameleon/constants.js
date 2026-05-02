// src/games/chameleon/constants.js — Chameleon brand & game constants

export const CHAMELEON_COLORS = {
  primary:      '#00695C',
  primaryLight: '#00897B',
  primaryDark:  '#004D40',
  card:         'rgba(0,105,92,0.10)',
  accent:       '#B2DFDB',
};

export const CHAMELEON_ROLES = {
  CHAMELEON: 'chameleon',
  AGENT:     'agent',
};

export const CHAMELEON_ROLE_COLORS = {
  chameleon: '#00695C',
  agent:     '#1565C0',
};

export const CHAMELEON_ROUND_SECONDS = 0;

// ROLE_META drives the generic GamePlayScreen — no game-specific component needed.
export const CHAMELEON_ROLE_META = {
  chameleon: {
    label:      'CHAMELEON',
    desc:       "You don't know the secret word. Blend in, avoid detection, and find out the secret word!",
    showsTimer: false,
  },
  agent: {
    label:      'AGENT',
    desc:       'You know the secret word. Say a word related to it, but avoid revealing it to the Chameleon!',
    showsTimer: false,
  },
};
