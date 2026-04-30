// src/components/HomeScreen.jsx — Landing page for Deceptive
//
// Cycles smoothly through all registered game module colors.
// Two entry points: Create Lobby and Join via QR Code.
import React, { useState, useEffect } from 'react';
import { GAME_REGISTRY } from '../games/index';

// Collect primary colors from every registered module — automatically picks
// up new games without any changes here.
const PALETTE  = Object.values(GAME_REGISTRY).map((m) => m.constants.COLORS.primary);
const CYCLE_MS = 3000;   // time between color steps
const TRANS_MS = 1000;   // CSS transition duration (must be < CYCLE_MS)
/** Opacity of the per-game ambient glow painted on the page background (~10%). */
const AMBIENT_ALPHA = 0.1;

export function HomeScreen({ onCreateLobby, onJoinLobby }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % PALETTE.length), CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  const color = PALETTE[idx];
  const transition = `${TRANS_MS}ms ease`;

  useEffect(() => {
    const prev = document.documentElement.style.getPropertyValue('--ambient-main');
    const hexToRgb = (hex) => {
      let h = (hex || '#ffffff').replace('#', '');
      if (h.length === 3) h = h.split('').map((c) => c + c).join('');
      const int = parseInt(h, 16);
      return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
    };
    const { r, g, b } = hexToRgb(color);
    const rgba = `rgba(${r}, ${g}, ${b}, ${AMBIENT_ALPHA})`;
    document.documentElement.style.setProperty('--ambient-main', rgba);
    return () => {
      if (prev) document.documentElement.style.setProperty('--ambient-main', prev);
      else document.documentElement.style.removeProperty('--ambient-main');
    };
  }, [color]);

  return (
    <div className="h-full bg-zinc-950 relative overflow-hidden flex flex-col items-center justify-center p-6 gap-10">

      {/* Animated ambient glow is handled by the centralized background layer */}

      {/* Title */}
      <div className="text-center relative z-10 select-none">
        <h1
          className="text-7xl font-black tracking-tight leading-none"
          style={{ color, transition: `color ${transition}` }}
        >
          Deceptive
        </h1>
        <p className="text-zinc-600 text-xs tracking-[0.3em] uppercase mt-3">
          Social deduction · Local multiplayer
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-3 w-full max-w-sm relative z-10">
        <button
          onClick={onCreateLobby}
          className="py-4 rounded-2xl text-base font-bold text-white shadow-lg hover:brightness-110 active:scale-95"
          style={{
            backgroundColor: color,
            transition: `background-color ${transition}`,
          }}
        >
          Create Lobby
        </button>
        <button
          onClick={onJoinLobby}
          className="py-4 rounded-2xl text-base font-semibold bg-zinc-800 text-zinc-200 hover:bg-zinc-700 active:scale-95 transition-colors"
        >
          Join Lobby
        </button>
      </div>
    </div>
  );
}
