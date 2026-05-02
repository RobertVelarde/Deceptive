// src/games/wavelength/constants.js — Wavelength brand & game constants

export const WAVELENGTH_COLORS = {
  primary:      '#7c3aed',
  primaryLight: '#ede9fe',
  primaryDark:  '#4c1d95',
  card:         'rgba(124, 58, 237, 0.10)',
  accent:       '#f59e0b',
};

export const WAVELENGTH_ROLES = {
  GUESSER: 'guesser',
  PSYCHIC: 'psychic',
};

export const WAVELENGTH_ROLE_COLORS = {
  guesser: '#7c3aed',
  psychic: '#f59e0b',
};

export const WAVELENGTH_ROUND_SECONDS = 0;

// ROLE_META drives the generic GamePlayScreen.
export const WAVELENGTH_ROLE_META = {
  guesser: {
    label:           'GUESSER',
    emoji:           '🔮',
    desc:            "Listen to every Psychic's clue, then guess the secret number on the spectrum!",
    showsTimer:      false,
    spectrumGuesser: true,   // show spectrum row (no number revealed)
    publicRole:    true,   // role identity is public — card shown without hold
  },
  psychic: {
    label:         'PSYCHIC',
    emoji:         '🧠',
    desc:          'You know the secret number. Give ONE verbal clue based on the spectrum — no numbers allowed!',
    showsTimer:    false,
    spectrumReveal: true,   // show spectrum row with hold-to-reveal number
    publicRole:    true,   // role identity is public — card shown without hold
  },
};