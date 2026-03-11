import { type ClassValue } from 'clsx';

/** Merge class names (clsx + tailwind-merge compatible) */
export function cn(...inputs: ClassValue[]): string {
  return inputs.filter(Boolean).join(' ');
}

/** Format date to readable string */
export function formatDate(date: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '\u2014';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...opts,
  });
}

/** Format duration in ms to human readable */
export function formatDuration(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

/** Format number with locale separators */
export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/** Format bytes to human readable */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Format currency */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

/** Format percentage */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/** Copy text to clipboard */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Get relative time (e.g., "2 hours ago") */
export function timeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(d, { hour: undefined, minute: undefined });
}

/** Generate severity color class */
export function severityColor(severity: string): string {
  const colors: Record<string, string> = {
    critical: 'text-red-400 bg-red-400/10 border-red-400/30',
    high: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
    medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
    low: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  };
  return colors[severity] || colors.low;
}

/** Generate status color class */
export function statusColor(status: string): string {
  const colors: Record<string, string> = {
    OK: 'text-emerald-400',
    ERROR: 'text-red-400',
    TIMEOUT: 'text-yellow-400',
    healthy: 'text-emerald-400',
    degraded: 'text-yellow-400',
    down: 'text-red-400',
    open: 'text-red-400',
    acknowledged: 'text-yellow-400',
    resolved: 'text-emerald-400',
  };
  return colors[status] || 'text-gray-400';
}

export const getStatusColor = statusColor;

/** Build a span tree from flat array */
export function buildSpanTree(spans: import('../types').Span[]): import('../types').SpanNode[] {
  type SpanNode = import('../types').SpanNode;
  const map = new Map<string, SpanNode>();
  const roots: SpanNode[] = [];

  for (const span of spans) {
    map.set(span.span_id, { ...span, children: [], depth: 0 });
  }

  for (const node of map.values()) {
    if (node.parent_span_id && map.has(node.parent_span_id)) {
      const parent = map.get(node.parent_span_id)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/** Alias for statusColor used by some pages */
export const getStatusColor = statusColor;
