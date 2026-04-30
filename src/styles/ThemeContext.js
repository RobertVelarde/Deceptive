// src/styles/ThemeContext.js — Global design-token context
// Components call useTheme() to read the active game module's color tokens
// instead of hardcoding any game name — enabling hot-swap theming via registry.
import { createContext, useContext } from 'react';

// Default palette matches Insider to prevent a flash of unstyled content
// before the module is resolved. The real value is injected by App.jsx.
const DEFAULT_COLORS = {
  primary:      '#D32F2F',
  primaryLight: '#EF5350',
  primaryDark:  '#B71C1C',
  card:         'rgba(211,47,47,0.08)',
  accent:       '#FFCDD2',
};

export const ThemeContext = createContext({ colors: DEFAULT_COLORS });
export const useTheme = () => useContext(ThemeContext);
