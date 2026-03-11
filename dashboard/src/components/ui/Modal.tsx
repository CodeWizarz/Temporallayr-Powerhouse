import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative ${sizeMap[size]} max-h-[calc(100vh-3rem)] w-full bg-[linear-gradient(180deg,rgba(17,22,29,0.98),rgba(10,14,20,0.98))] border border-[var(--border-soft)] rounded-[24px] shadow-[0_30px_90px_rgba(0,0,0,0.35)]`}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border-soft)]">
          <h2 className="text-base font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{title}</h2>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-panel-soft)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">{children}</div>
        {footer && <div className="px-6 py-5 border-t border-[var(--border-soft)] flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
