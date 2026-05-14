// src/components/IdentityPickerModal.jsx
// Full-screen overlay asking the user which player they are.
// No dismiss — user must pick a name before they can interact with the game.
// If `cachedPlayer` is provided the matching name is pre-selected and the
// user can just tap "Enter lobby" without re-tapping.
import React, { useState, useEffect } from 'react';
import { useTheme } from '../styles/ThemeContext';
import { GlassCard } from './shared/GlassCard';

export function IdentityPickerModal({ isOpen, players, onPick, cachedPlayer }) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState(null);

  // When the modal opens: pre-select the cached player if known, else clear.
  useEffect(() => {
    if (isOpen) setSelected(cachedPlayer ?? null);
  }, [isOpen, cachedPlayer]);

  if (!isOpen || !players?.length) return null;

  const handleConfirm = () => { if (selected) onPick(selected); };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)' }}
    >
      <GlassCard className="w-full max-w-xs p-6 flex flex-col gap-5">
        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Welcome</p>
          <h2 className="text-xl font-black text-white">Who are you?</h2>
          {cachedPlayer && (
            <p className="text-xs text-zinc-500 mt-1">
              Last seen as <span className="text-zinc-300 font-semibold">{cachedPlayer.name}</span>
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {[...players].sort((a, b) => a.name.localeCompare(b.name)).map((player) => {
            const isSelected = selected?.id === player.id;
            return (
              <button
                key={player.id}
                onClick={() => setSelected(isSelected ? null : player)}
                className="py-3 px-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
                style={
                  isSelected
                    ? {
                        backgroundColor: `${colors.primary}33`,
                        boxShadow: `0 0 0 1.5px ${colors.primary}99`,
                        color: '#fff',
                      }
                    : {
                        backgroundColor: 'rgba(39,39,42,0.8)',
                        color: '#d4d4d8',
                      }
                }
              >
                {player.name}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleConfirm}
          disabled={!selected}
          className="w-full py-3 rounded-xl text-base font-bold transition-all"
          style={
            selected
              ? { backgroundColor: colors.primary, color: '#fff' }
              : { backgroundColor: 'rgba(39,39,42,0.4)', color: '#52525b', cursor: 'default' }
          }
        >
          {selected ? 'Enter Lobby →' : 'Tap your name above'}
        </button>
      </GlassCard>
    </div>
  );
}
