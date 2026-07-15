import React, { useEffect, useState } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

const CONFIG: Record<ToastType, {
  icon: React.ReactNode;
  bar: string;
  bg: string;
  border: string;
  title: string;
  text: string;
  close: string;
}> = {
  success: {
    icon: <CheckCircle className="w-5 h-5 text-emerald-500 dark:text-emerald-400 shrink-0" />,
    bar: 'bg-emerald-500',
    bg: 'bg-white dark:bg-slate-800',
    border: 'border-emerald-200 dark:border-emerald-700/60',
    title: 'text-emerald-800 dark:text-emerald-200',
    text: 'text-slate-600 dark:text-slate-300',
    close: 'text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400',
  },
  error: {
    icon: <XCircle className="w-5 h-5 text-red-500 dark:text-red-400 shrink-0" />,
    bar: 'bg-red-500',
    bg: 'bg-white dark:bg-slate-800',
    border: 'border-red-200 dark:border-red-700/60',
    title: 'text-red-800 dark:text-red-200',
    text: 'text-slate-600 dark:text-slate-300',
    close: 'text-slate-400 hover:text-red-600 dark:hover:text-red-400',
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0" />,
    bar: 'bg-amber-500',
    bg: 'bg-white dark:bg-slate-800',
    border: 'border-amber-200 dark:border-amber-700/60',
    title: 'text-amber-800 dark:text-amber-200',
    text: 'text-slate-600 dark:text-slate-300',
    close: 'text-slate-400 hover:text-amber-600 dark:hover:text-amber-400',
  },
  info: {
    icon: <Info className="w-5 h-5 text-blue-500 dark:text-blue-400 shrink-0" />,
    bar: 'bg-blue-500',
    bg: 'bg-white dark:bg-slate-800',
    border: 'border-blue-200 dark:border-blue-700/60',
    title: 'text-blue-800 dark:text-blue-200',
    text: 'text-slate-600 dark:text-slate-300',
    close: 'text-slate-400 hover:text-blue-600 dark:hover:text-blue-400',
  },
};

export function ToastComponent({ toast, onClose }: ToastProps) {
  const duration = toast.duration || 4000;
  const [progress, setProgress] = useState(100);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger slide-in
    const show = requestAnimationFrame(() => setVisible(true));

    // Progress bar countdown
    const start = Date.now();
    const tick = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.max(0, 100 - (elapsed / duration) * 100));
    }, 50);

    // Auto-dismiss
    const dismiss = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onClose(toast.id), 300);
    }, duration);

    return () => {
      cancelAnimationFrame(show);
      clearInterval(tick);
      clearTimeout(dismiss);
    };
  }, [toast.id, duration, onClose]);

  const c = CONFIG[toast.type];

  return (
    <div
      className={`relative w-80 max-w-[calc(100vw-2rem)] rounded-xl border shadow-xl overflow-hidden
        ${c.bg} ${c.border}
        transition-all duration-300 ease-out
        ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}
    >
      {/* Left accent stripe */}
      <div className={`absolute inset-y-0 left-0 w-1 ${c.bar}`} />

      <div className="flex items-start gap-3 pl-4 pr-3 pt-3.5 pb-3">
        <div className="mt-0.5">{c.icon}</div>
        <p className={`flex-1 text-sm font-medium leading-snug ${c.title}`}>
          {toast.message}
        </p>
        <button
          onClick={() => { setVisible(false); setTimeout(() => onClose(toast.id), 300); }}
          className={`mt-0.5 rounded-md p-0.5 transition-colors ${c.close}`}
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Auto-dismiss progress bar */}
      <div className="h-0.5 bg-slate-100 dark:bg-slate-700">
        <div
          className={`h-full ${c.bar} opacity-60 transition-none`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
