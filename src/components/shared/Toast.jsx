// src/components/shared/Toast.jsx
import React, { useEffect } from 'react';

export function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-zinc-800 text-zinc-100 text-sm font-medium shadow-2xl border border-white/10">
      {message}
    </div>
  );
}
