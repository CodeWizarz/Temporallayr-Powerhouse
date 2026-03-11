import type { ReactNode } from 'react';
import { Card } from '../ui';

export function DashboardSection({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? (
          <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--text-dim)]">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-[32px] font-semibold leading-none tracking-[-0.06em] text-[var(--text-primary)] md:text-[42px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] md:text-[15px]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Surface({
  children,
  className = '',
  tone = 'default',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'default' | 'hero' | 'muted';
}) {
  const toneClass =
    tone === 'hero'
      ? 'bg-[linear-gradient(180deg,rgba(18,24,32,0.96),rgba(11,16,22,0.94))]'
      : tone === 'muted'
        ? 'bg-[linear-gradient(180deg,rgba(14,19,26,0.96),rgba(11,16,22,0.92))]'
        : 'bg-[linear-gradient(180deg,rgba(15,21,28,0.96),rgba(10,14,20,0.94))]';

  return (
    <Card
      padding="none"
      className={[
        'rounded-[22px] border-[var(--border)] shadow-[0_24px_80px_rgba(0,0,0,0.22)]',
        toneClass,
        className,
      ].join(' ')}
    >
      {children}
    </Card>
  );
}

export function SurfaceHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-[var(--border-soft)] px-6 py-5 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-lg font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{title}</h2>
        {description ? <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--text-dim)]">{label}</div>
          <div className="mt-3 text-[34px] font-semibold leading-none tracking-[-0.05em] text-[var(--text-primary)] tabular-nums">
            {value}
          </div>
          {hint ? <div className="mt-3 text-sm text-[var(--text-secondary)]">{hint}</div> : null}
        </div>
        {icon ? (
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-black/20 text-[var(--text-secondary)]">
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-[220px] flex-col items-start justify-center rounded-[20px] border border-dashed border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-6 py-8">
      <div className="text-base font-medium text-[var(--text-primary)]">{title}</div>
      <div className="mt-2 max-w-md text-sm leading-6 text-[var(--text-secondary)]">{description}</div>
    </div>
  );
}
