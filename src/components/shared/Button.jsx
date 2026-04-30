// src/components/shared/Button.jsx
import React from 'react';
import { useTheme } from '../../styles/ThemeContext';

export function Button({
  children, onClick, variant = 'primary', size = 'md',
  disabled, className = '', style: styleProp, ...rest
}) {
  const { colors } = useTheme();

  const base  = 'inline-flex items-center justify-center font-semibold rounded-2xl transition-all duration-200 focus:outline-none select-none';
  const sizes = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-5 py-2.5 text-sm gap-2',
    lg: 'px-7 py-3.5 text-base gap-2',
  };
  const vars = {
    primary:   'text-white shadow-lg hover:brightness-110 active:scale-95',
    secondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 active:scale-95',
    ghost:     'bg-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 active:scale-95',
    danger:    'bg-red-700 text-white hover:bg-red-600 active:scale-95 shadow-lg',
  };
  const inlineStyle =
    variant === 'primary'
      ? { backgroundColor: colors.primary, ...(styleProp || {}) }
      : styleProp;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${vars[variant]} ${
        disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
      } ${className}`}
      style={inlineStyle}
      {...rest}
    >
      {children}
    </button>
  );
}
