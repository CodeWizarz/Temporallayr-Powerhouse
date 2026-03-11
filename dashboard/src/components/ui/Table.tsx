import type { ReactNode } from 'react';

interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  rowKey: (item: T) => string;
}

export function Table<T>({ columns, data, loading, emptyMessage = 'No data', onRowClick, rowKey }: TableProps<T>) {
  if (loading) {
    return (
      <div className="w-full overflow-hidden rounded-[20px] border border-[var(--border-soft)]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)]">
              {columns.map(col => (
                <th key={col.key} className="px-4 py-3 text-left text-[11px] font-medium text-[var(--text-dim)] uppercase tracking-[0.18em]">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-[var(--border-soft)]">
                {columns.map(col => (
                  <td key={col.key} className="px-4 py-3">
                    <div className="h-4 bg-[var(--bg-elevated)] rounded animate-pulse" style={{ width: col.width || '80%' }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[var(--text-muted)]">
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto overflow-hidden rounded-[20px] border border-[var(--border-soft)]">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)]">
            {columns.map(col => (
              <th
                key={col.key}
                className={`px-4 py-3 text-[11px] font-medium text-[var(--text-dim)] uppercase tracking-[0.18em]
                  ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                style={{ width: col.width }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(item => (
            <tr
              key={rowKey(item)}
              onClick={() => onRowClick?.(item)}
              className={`border-b border-[var(--border-soft)] transition-colors
                ${onRowClick ? 'cursor-pointer hover:bg-white/3' : ''}`}
            >
              {columns.map(col => (
                <td
                  key={col.key}
                  className={`px-4 py-3 text-sm text-[var(--text-secondary)]
                    ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                >
                  {col.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
