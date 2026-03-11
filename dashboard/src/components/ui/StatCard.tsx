import { createElement, isValidElement, type ComponentType, type ReactNode } from 'react';
import { Card } from './Card';

interface StatCardProps {
  title?: string;
  label?: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode | ComponentType<{ className?: string }>;
  trend?: { value: number; label: string };
  trendInverse?: boolean;
  className?: string;
}

export function StatCard({
  title,
  label,
  value,
  subtitle,
  icon,
  trend,
  trendInverse,
  className = '',
}: StatCardProps) {
  const heading = label ?? title ?? 'Metric';
  const trendPositive = trend ? (trendInverse ? trend.value <= 0 : trend.value >= 0) : true;
  const iconNode =
    icon && !isValidElement(icon) && typeof icon === 'function'
      ? createElement(icon, { className: 'h-5 w-5' })
      : icon;

  return (
    <Card className={className}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">{heading}</p>
          <p className="text-2xl font-semibold text-[var(--text-primary)] tabular-nums">{value}</p>
          {subtitle && <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>}
          {trend && (
            <p className={`text-xs ${trendPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
            </p>
          )}
        </div>
        {iconNode && <div className="text-[var(--text-muted)]">{iconNode}</div>}
      </div>
    </Card>
  );
}
