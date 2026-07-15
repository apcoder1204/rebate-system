import React from "react";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "destructive" | "outline";
  children: React.ReactNode;
}

export function Badge({ variant = "default", className = "", children, ...props }: BadgeProps) {
  const variants = {
    default:
      "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-700/40",
    secondary:
      "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-600",
    destructive:
      "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-700/40",
    outline:
      "border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 bg-transparent",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
