import { createElement, isValidElement, type ComponentType, type ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode | ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode | { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const renderedIcon = icon && !isValidElement(icon) && typeof icon === 'function'
    ? createElement(icon, { className: 'h-8 w-8' })
    : icon;

  const renderedAction =
    action && typeof action === 'object' && 'label' in action && 'onClick' in action ? (
      <button
        onClick={action.onClick}
        className="inline-flex items-center rounded-md bg-[var(--accent)] px-3 py-2 text-xs font-medium text-black transition-colors hover:bg-[var(--accent-hover)]"
      >
        {action.label}
      </button>
    ) : (
      action
    );

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {renderedIcon && <div className="mb-4 text-[var(--text-muted)]">{renderedIcon}</div>}
      <h3 className="text-sm font-medium text-[var(--text-primary)] mb-1">{title}</h3>
      {description && <p className="text-xs text-[var(--text-muted)] max-w-sm mb-4">{description}</p>}
      {renderedAction}
    </div>
  );
}
