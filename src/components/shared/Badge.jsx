// src/components/shared/Badge.jsx
import React from 'react';

export function Badge({ label, color }) {
  return (
    <span
      className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider text-white"
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  );
}
