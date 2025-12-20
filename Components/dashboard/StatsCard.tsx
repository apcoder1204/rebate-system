import React from "react";
import { Card, CardContent } from "@/Components/ui/card";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export default function StatsCard({ title, value, icon, trend, className = "" }: StatsCardProps) {
  return (
    <Card className={`border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-white dark:bg-slate-800 ${className}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">{title}</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
            {trend && (
              <div className={`flex items-center gap-1 mt-2 text-sm ${
                trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                <span className={trend.isPositive ? '↗' : '↘'}>
                  {trend.isPositive ? '↗' : '↘'}
                </span>
                <span>{Math.abs(trend.value)}%</span>
              </div>
            )}
          </div>
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
