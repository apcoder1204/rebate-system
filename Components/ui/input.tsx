import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      className={`flex h-10 w-full rounded-lg border border-slate-300 dark:border-slate-600
        bg-white dark:bg-slate-700/60
        px-3 py-2 text-sm text-slate-900 dark:text-slate-100
        placeholder:text-slate-400 dark:placeholder:text-slate-500
        transition-colors duration-150
        focus:outline-none focus:ring-2 focus:ring-blue-500/70 dark:focus:ring-blue-400/70
        focus:border-blue-400 dark:focus:border-blue-500
        disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800
        ${className}`}
      {...props}
    />
  );
}
