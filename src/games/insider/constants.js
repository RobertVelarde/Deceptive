// src/games/insider/constants.js — Insider brand & game constants
// AC 3.1.1: Own style constants for the Insider module (primary: #D32F2F).

export const INSIDER_COLORS = {
  primary:      '#D32F2F',
  primaryLight: '#EF5350',
  primaryDark:  '#B71C1C',
  card:         'rgba(211,47,47,0.08)',
  accent:       '#FFCDD2',
};

export const INSIDER_ROLES = {
  MASTER:  'master',
  INSIDER: 'insider',
  COMMON:  'common',
};

export const INSIDER_ROLE_COLORS = {
  master:  '#1565C0',
  insider: '#D32F2F',
  common:  '#455A64',
};

export const INSIDER_ROUND_SECONDS = 300;

// ROLE_META drives the generic GamePlayScreen — label, emoji, description,
// and whether this role shows the round countdown timer.
export const INSIDER_ROLE_META = {
  master:  {
    label:         'MASTER',
    emoji:         '🎓',
    desc:          'Answer questions about the secret word with either "yes", "no", or "I don\'t know".',
    showsTimer:    true,
    publicRole:    true,   // role identity is public — card shown without hold
    wordNeedsHold: true,   // but the secret word still needs press-and-hold
    timerManual:   true,   // timer waits for an explicit Start button
  },
  insider: {
    label:      'INSIDER',
    emoji:      '🕵️',
    desc:       'Ask questions that help lead to the secret word, but don\'t make it obvious that you know what it is!',
    showsTimer: true,
    timerManual: true,
  },
  common:  {
    label:      'COMMON',
    emoji:      '🔍',
    desc:       'Ask yes/no questions to discover the secret word before time runs out, but also be mindful of who the insider might be!',
    showsTimer: true,
    timerManual: true,
    wordSlot:   true,  // renders a placeholder so card height matches Insider's WordReveal
  },
};
