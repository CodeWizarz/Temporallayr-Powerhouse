import type { ReactNode } from 'react';
import { Card } from './Card';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: { value: number; label: string };
  className?: string;
}

export function StatCard({ title, value, subtitle, icon, trend, className = '' }: StatCardProps) {
  return (
    <Card className={className}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-semibold text-[var(--text-primary)] tabular-nums">{value}</p>
          {subtitle && <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>}
          {trend && (
            <p className={`text-xs ${trend.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
            </p>
          )}
        </div>
        {icon && <div className="text-[var(--text-muted)]">{icon}</div>}
      </div>
    </Card>
  );
}
