import React from "react";

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline";
  children: React.ReactNode;
}

export function Badge({ variant = "default", className = "", children, ...props }: BadgeProps) {
  const variants = {
    default: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
    secondary: "bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200",
    destructive: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
    outline: "border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200"
  };
  
  return (
    <div
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
