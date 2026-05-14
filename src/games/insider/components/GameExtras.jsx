// src/games/insider/components/GameExtras.jsx
// Slim card listing the current Master, shown to all players except the Master.
import React from 'react';
import { GlassCard } from '../../../components/shared/GlassCard';
import { INSIDER_ROLES, INSIDER_ROLE_COLORS } from '../constants';
import { Badge } from '../../../components/shared/Badge';

export function InsiderGameExtras({ assignment }) {
  if (assignment?.role === INSIDER_ROLES.MASTER) return null;
  if (!assignment?.masterName) return null;

  const masterColor = INSIDER_ROLE_COLORS.master;
  const masterLabel = "Master";

  return (
    <GlassCard
        className="p-5 flex flex-col gap-4"
        style={{ borderColor: masterColor + '44', background: masterColor + '12' }}
    >
        <div className="flex items-center justify-start gap-2">
            <span className="text-white text-xs uppercase font-semibold">{assignment.masterName}</span>
            <span className="text-zinc-400 text-xs uppercase tracking-widest">is the</span>
            <Badge label={masterLabel} color={masterColor} />
        </div>
    </GlassCard>
  );
}
