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
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Loader2 className={`${sizeMap[size]} text-[var(--accent)] animate-spin`} />
      <p className="text-xs text-[var(--text-muted)]">{message}</p>
    </div>
  );
}

export function InlineLoader() {
  return <Loader2 className="w-4 h-4 text-[var(--text-muted)] animate-spin" />;
}
