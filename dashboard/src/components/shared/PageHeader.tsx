import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, subtitle, actions }: PageHeaderProps) {
  const copy = subtitle ?? description;

  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[var(--border)]">
      <div>
        <h1 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h1>
        {copy && <p className="text-xs text-[var(--text-muted)] mt-0.5">{copy}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
