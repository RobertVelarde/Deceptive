// src/games/spyfall/components/SpyfallReveal.jsx
// Displays the secret location and assigned civilian role for Spyfall.
// For the Spy, renders a placeholder of identical height (screen-peek prevention).
import React from 'react';

const cap = (s) => s ? s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : '';

/**
 * @param {{ location: string|null, civilianRole: string|null, disabled: boolean }} props
 *   disabled — true for the spy; renders the card shape with no location info.
 */
export function SpyfallReveal({ location, civilianRole, disabled = false }) {
  const revealed = !disabled;

  return (
    <div
      className="relative rounded-2xl border bg-black/20 p-4 select-none overflow-hidden"
      style={{
        borderColor: revealed ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.08)',
        minHeight:   '6.5rem',
      }}
    >
      <div className="flex flex-col gap-3">

        {/* Secret Location */}
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Secret Location</p>
          <p
            className="text-2xl font-black tracking-tight"
            style={{
              color:         revealed ? 'white' : 'rgba(161,161,170,0.22)',
              letterSpacing: revealed ? undefined : '0.18em',
            }}
          >
            {revealed ? cap(location) : '••••••••'}
          </p>
        </div>

        {/* Assigned Role */}
        <div className="text-center border-t border-white/[0.06] pt-3">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Your Role</p>
          <p
            className="text-2xl font-black tracking-tight"
            style={{ color: revealed ? 'white' : 'rgba(161,161,170,0.22)' }}
          >
            {!civilianRole ? 'Spy' : (revealed ? cap(civilianRole) : '••••••••') }
          </p>
        </div>

      </div>
    </div>
  );
}
