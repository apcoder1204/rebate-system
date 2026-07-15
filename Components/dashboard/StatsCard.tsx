import React from "react";

type CardColor = 'blue' | 'purple' | 'green' | 'amber' | 'rose' | 'slate' | 'teal';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  color?: CardColor;
  className?: string;
}

const GRADIENTS: Record<CardColor, { from: string; shadow: string; ring: string }> = {
  blue:   { from: 'from-blue-500 to-blue-600',     shadow: 'shadow-blue-500/30',   ring: 'ring-blue-400/20' },
  purple: { from: 'from-purple-500 to-purple-600', shadow: 'shadow-purple-500/30', ring: 'ring-purple-400/20' },
  green:  { from: 'from-emerald-500 to-green-600', shadow: 'shadow-emerald-500/30',ring: 'ring-emerald-400/20' },
  amber:  { from: 'from-amber-500 to-orange-500',  shadow: 'shadow-amber-500/30',  ring: 'ring-amber-400/20' },
  rose:   { from: 'from-rose-500 to-pink-600',     shadow: 'shadow-rose-500/30',   ring: 'ring-rose-400/20' },
  slate:  { from: 'from-slate-500 to-slate-600',   shadow: 'shadow-slate-500/20',  ring: 'ring-slate-400/20' },
  teal:   { from: 'from-teal-500 to-cyan-600',     shadow: 'shadow-teal-500/30',   ring: 'ring-teal-400/20' },
};

export default function StatsCard({ title, value, icon, trend, color = 'blue', className = '' }: StatsCardProps) {
  const g = GRADIENTS[color];

  return (
    <div className={`group relative rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60
      shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 overflow-hidden ${className}`}>
      {/* Subtle top accent line */}
      <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${g.from} opacity-80`} />

      <div className="p-5 flex items-start justify-between gap-4">
        {/* Text */}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 truncate">
            {title}
          </p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-50 leading-none break-words">
            {value}
          </p>
          {trend && (
            <div className={`inline-flex items-center gap-1 mt-2 px-1.5 py-0.5 rounded-md text-xs font-semibold ${
              trend.isPositive
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
            }`}>
              <span>{trend.isPositive ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>

        {/* Icon bubble */}
        <div className={`w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br ${g.from} shadow-lg ${g.shadow}
          ring-4 ${g.ring} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
