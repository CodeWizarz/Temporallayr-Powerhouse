import type { ReactNode } from 'react';

type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral' | 'accent' | 'default';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
  error: 'bg-red-400/10 text-red-400 border-red-400/20',
  warning: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
  info: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
  neutral: 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border-[var(--border)]',
  accent: 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20',
  default: 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border)]',
};

export function Badge({ variant = 'neutral', children, className = '', dot }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full border ${variantStyles[variant]} ${className}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
