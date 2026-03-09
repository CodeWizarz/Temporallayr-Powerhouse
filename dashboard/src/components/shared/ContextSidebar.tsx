import type { ReactNode } from 'react';

interface ContextSidebarProps {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}

export function ContextSidebar({ title, children, actions }: ContextSidebarProps) {
  return (
    <div className="ch-sidebar-context">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <h2 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">{title}</h2>
        {actions}
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

interface SidebarNavItemProps {
  label: string;
  active?: boolean;
  icon?: ReactNode;
  count?: number;
  onClick?: () => void;
}

export function SidebarNavItem({ label, active, icon, count, onClick }: SidebarNavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs transition-colors cursor-pointer
        ${active
          ? 'bg-[var(--accent)]/10 text-[var(--accent)] font-medium'
          : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50'
        }`}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {count !== undefined && (
        <span className="text-[10px] tabular-nums opacity-60">{count}</span>
      )}
    </button>
  );
}
