import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

export function LoadingState({ message = 'Loading...', size = 'md' }: LoadingStateProps) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center gap-4 rounded-[24px] border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] px-6 py-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--bg-panel-soft)]">
        <Loader2 className={`${sizeMap[size]} text-[var(--accent)] animate-spin`} />
      </div>
      <p className="text-sm text-[var(--text-secondary)]">{message}</p>
    </div>
  );
}

export function InlineLoader() {
  return <Loader2 className="w-4 h-4 text-[var(--text-muted)] animate-spin" />;
}
