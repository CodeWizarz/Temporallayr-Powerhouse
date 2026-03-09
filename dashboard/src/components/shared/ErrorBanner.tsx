import { AlertCircle, X } from 'lucide-react';
import { useState } from 'react';

interface ErrorBannerProps {
  message: string;
  dismissible?: boolean;
  onRetry?: () => void;
}

export function ErrorBanner({ message, dismissible = true, onRetry }: ErrorBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="flex items-center gap-3 p-3 bg-red-400/10 border border-red-400/20 rounded-lg text-sm">
      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
      <p className="flex-1 text-red-300 text-xs">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-xs text-red-400 hover:text-red-300 font-medium cursor-pointer">
          Retry
        </button>
      )}
      {dismissible && (
        <button onClick={() => setDismissed(true)} className="text-red-400/60 hover:text-red-400 cursor-pointer">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
