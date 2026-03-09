import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, icon, className = '', ...props }, ref) => (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-medium text-[var(--text-secondary)]">{label}</label>}
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">{icon}</div>}
        <input
          ref={ref}
          className={`w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-md px-3 py-2 text-sm
            text-[var(--text-primary)] placeholder-[var(--text-muted)]
            focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30
            disabled:opacity-50 disabled:cursor-not-allowed
            ${icon ? 'pl-9' : ''} ${error ? 'border-red-400' : ''} ${className}`}
          {...props}
        />
      </div>
      {hint && !error && <p className="text-xs text-[var(--text-muted)]">{hint}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
);
Input.displayName = 'Input';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Array<{ label: string; value: string }>;
}

export function Select({ label, options, className = '', ...props }: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-medium text-[var(--text-secondary)]">{label}</label>}
      <select
        className={`w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-md px-3 py-2 text-sm
          text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]
          ${className}`}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
