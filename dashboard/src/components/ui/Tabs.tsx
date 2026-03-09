import type { ReactNode } from 'react';

interface Tab {
  id: string;
  label: string;
  count?: number;
  icon?: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  variant?: 'line' | 'pill';
}

export function Tabs({ tabs, active, onChange, variant = 'line' }: TabsProps) {
  if (variant === 'pill') {
    return (
      <div className="flex gap-1 p-1 bg-[var(--bg-base)] rounded-lg border border-[var(--border)]">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer
              ${active === tab.id
                ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
          >
            <span className="flex items-center gap-1.5">
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && (
                <span className="text-[10px] tabular-nums opacity-60">{tab.count}</span>
              )}
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-0 border-b border-[var(--border)]">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2.5 text-xs font-medium transition-colors relative cursor-pointer
            ${active === tab.id
              ? 'text-[var(--accent)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
        >
          <span className="flex items-center gap-1.5">
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span className="px-1.5 py-0.5 text-[10px] tabular-nums bg-[var(--bg-elevated)] rounded-full">
                {tab.count}
              </span>
            )}
          </span>
          {active === tab.id && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]" />
          )}
        </button>
      ))}
    </div>
  );
}
