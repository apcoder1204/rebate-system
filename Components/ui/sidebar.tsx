import React from "react";

interface SidebarProps {
  children: React.ReactNode;
}

export function Sidebar({ children }: SidebarProps) {
  return (
    <div className="w-64 bg-white border-r border-slate-200 h-full">
      {children}
    </div>
  );
}
