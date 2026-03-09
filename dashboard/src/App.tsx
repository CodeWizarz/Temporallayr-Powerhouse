import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Play, Table2, BarChart3, Clock, ChevronDown, ChevronUp,
  Lightbulb, Database, Search, Loader2, Copy, Check,
} from 'lucide-react';
import { api } from '../lib/client';
import { API_BASE_URL, AUTH_KEY } from '../lib/constants';
import type { Dataset } from '../types';
import { Card, Button, Badge } from '../components/ui';
import { ContextSidebar, SidebarNavItem } from '../components/shared/ContextSidebar';
import { PageHeader } from '../components/shared/PageHeader';
import { ErrorBanner } from '../components/shared/ErrorBanner';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { formatNumber } from '../lib/utils';

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Types \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
  execution_time_ms: number;
  chart_data?: Array<Record<string, unknown>>;
}

interface QuerySuggestion {
  label: string;
  query: string;
  description?: string;
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Constants \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

const LS_KEY = 'tl_analytics_last_query';
const LS_DATASET_KEY = 'tl_analytics_last_dataset';

const DEFAULT_SUGGESTIONS: QuerySuggestion[] = [
  { label: 'Recent errors', query: "SELECT * FROM traces WHERE status = 'ERROR' ORDER BY created_at DESC LIMIT 50", description: 'Find the latest error traces' },
  { label: 'Slow requests', query: 'SELECT * FROM traces WHERE duration_ms > 1000 ORDER BY duration_ms DESC LIMIT 50', description: 'Traces exceeding 1s' },
  { label: 'Error rate by service', query: "SELECT tenant_id, COUNT(*) as total, SUM(CASE WHEN status='ERROR' THEN 1 ELSE 0 END) as errors FROM traces GROUP BY tenant_id", description: 'Error breakdown per service' },
  { label: 'Throughput over time', query: "SELECT DATE_TRUNC('hour', created_at) as hour, COUNT(*) as requests FROM traces GROUP BY hour ORDER BY hour", description: 'Hourly request volume' },
  { label: 'P99 latency', query: 'SELECT PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) as p99 FROM traces', description: '99th percentile latency' },
  { label: 'Top incidents', query: 'SELECT severity, status, COUNT(*) as total FROM incidents GROUP BY severity, status ORDER BY total DESC', description: 'Incident summary' },
];

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '\u2014';
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function isTraceId(value: unknown): boolean {
  return typeof value === 'string' && /^[a-f0-9]{16,64}$/i.test(value);
}

function truncateStr(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + '\u2026';
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Sub-components \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

function SuggestionChip({ suggestion, onClick }: { suggestion: QuerySuggestion; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex items-start gap-2 px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)]
        rounded-lg hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5 transition-all text-left cursor-pointer"
    >
      <Lightbulb className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--accent)] mt-0.5 shrink-0" />
      <div>
        <p className="text-xs font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)]">
          {suggestion.label}
        </p>
        {suggestion.description && (
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{suggestion.description}</p>
        )}
      </div>
    </button>
  );
}

function DatasetPicker({
  datasets,
  selected,
  onChange,
  isLoading,
}: {
  datasets: Dataset[];
  selected: string;
  onChange: (id: string) => void;
  isLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = datasets.find(d => d.id === selected || d.name === selected);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-base)] border border-[var(--border)]
          rounded-md text-xs text-[var(--text-primary)] hover:border-[var(--accent)]/40 transition-colors cursor-pointer"
      >
        <Database className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        {isLoading ? (
          <span className="text-[var(--text-muted)]">Loading\u2026</span>
        ) : current ? (
          <span>{current.name}</span>
        ) : (
          <span className="text-[var(--text-muted)]">All datasets</span>
        )}
        <ChevronDown className={`w-3 h-3 text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-[var(--bg-surface)] border border-[var(--border)]
          rounded-lg shadow-xl z-50 py-1 max-h-60 overflow-y-auto">
          <button
            onClick={() => { onChange(''); setOpen(false); }}
            className={`w-full px-3 py-2 text-left text-xs transition-colors cursor-pointer
              ${!selected ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'}`}
          >
            All datasets
          </button>
          {datasets.map(ds => (
            <button
              key={ds.id}
              onClick={() => { onChange(ds.name); setOpen(false); }}
              className={`w-full px-3 py-2 text-left text-xs transition-colors cursor-pointer flex items-center justify-between
                ${selected === ds.name ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'}`}
            >
              <span>{ds.name}</span>
              <span className="text-[10px] text-[var(--text-muted)] tabular-nums">
                {formatNumber(ds.record_count)} rows
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ResultChart({ data }: { data: Array<Record<string, unknown>> }) {
  if (!data || data.length === 0) return null;

  const keys = Object.keys(data[0]);
  const xKey = keys.find(k => k.includes('time') || k.includes('date') || k.includes('hour') || k === 'ts') || keys[0];
  const valueKeys = keys.filter(k => k !== xKey && typeof data[0][k] === 'number');

  const chartColors = ['#818cf8', '#a78bfa', '#22d3ee', '#f472b6', '#fbbf24', '#34d399'];

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <defs>
            {valueKeys.map((key, i) => (
              <linearGradient key={key} id={`analytics-fill-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColors[i % chartColors.length]} stopOpacity={0.3} />
                <stop offset="100%" stopColor={chartColors[i % chartColors.length]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 10, fill: '#8888a0' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => {
              if (typeof v === 'string' && v.includes('T')) {
                return new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              }
              return String(v);
            }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#8888a0' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatNumber(v)}
          />
          <Tooltip
            contentStyle={{
              background: '#1a1a2e',
              border: '1px solid #2e2e3e',
              borderRadius: 8,
              fontSize: 11,
            }}
            labelStyle={{ color: '#e0e0e8' }}
            itemStyle={{ color: '#e0e0e8' }}
          />
          {valueKeys.map((key, i) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={chartColors[i % chartColors.length]}
              strokeWidth={2}
              fill={`url(#analytics-fill-${i})`}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ResultTable({
  columns,
  rows,
  sortCol,
  sortDir,
  onSort,
}: {
  columns: string[];
  rows: Record<string, unknown>[];
  sortCol: string;
  sortDir: 'asc' | 'desc';
  onSort: (col: string) => void;
}) {
  const [copiedCell, setCopiedCell] = useState<string | null>(null);

  const handleCopy = useCallback((value: string, cellKey: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedCell(cellKey);
      setTimeout(() => setCopiedCell(null), 1500);
    });
  }, []);

  return (
    <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
      <table className="w-full min-w-[600px]">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--bg-base)]">
            {columns.map(col => (
              <th
                key={col}
                onClick={() => onSort(col)}
                className="px-4 py-2.5 text-left text-xs font-medium text-[var(--text-muted)]
                  uppercase tracking-wider cursor-pointer hover:text-[var(--text-primary)]
                  transition-colors select-none whitespace-nowrap"
              >
                <span className="flex items-center gap-1">
                  {col}
                  {sortCol === col && (
                    sortDir === 'asc'
                      ? <ChevronUp className="w-3 h-3" />
                      : <ChevronDown className="w-3 h-3" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className={`border-b border-[var(--border)]/50 transition-colors hover:bg-[var(--bg-elevated)]/50
                ${ri % 2 === 1 ? 'bg-[var(--bg-base)]/30' : ''}`}
            >
              {columns.map(col => {
                const raw = row[col];
                const formatted = formatCellValue(raw);
                const cellKey = `${ri}-${col}`;
                const traceLink = isTraceId(raw) && (col.includes('trace') || col.includes('id'));

                return (
                  <td key={col} className="px-4 py-2 text-xs text-[var(--text-secondary)] font-mono whitespace-nowrap group">
                    <span className="flex items-center gap-1.5">
                      {traceLink ? (
                        <a
                          href={`/traces/${raw}`}
                          className="text-[var(--accent)] hover:underline"
                        >
                          {truncateStr(formatted, 24)}
                        </a>
                      ) : (
                        <span title={formatted.length > 48 ? formatted : undefined}>
                          {truncateStr(formatted, 48)}
                        </span>
                      )}
                      {formatted.length > 2 && (
                        <button
                          onClick={() => handleCopy(formatted, cellKey)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-muted)]
                            hover:text-[var(--text-primary)] cursor-pointer"
                        >
                          {copiedCell === cellKey
                            ? <Check className="w-3 h-3 text-emerald-400" />
                            : <Copy className="w-3 h-3" />}
                        </button>
                      )}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Main Component \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

export default function Analytics() {
  const [searchParams, setSearchParams] = useSearchParams();

  /* State */
  const [queryText, setQueryText] = useState(() =>
    searchParams.get('query') || localStorage.getItem(LS_KEY) || ''
  );
  const [dataset, setDataset] = useState(() =>
    searchParams.get('dataset') || localStorage.getItem(LS_DATASET_KEY) || ''
  );
  const [limit, setLimit] = useState(100);
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('table');
  const [sortCol, setSortCol] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* Persist */
  useEffect(() => {
    localStorage.setItem(LS_KEY, queryText);
  }, [queryText]);

  useEffect(() => {
    localStorage.setItem(LS_DATASET_KEY, dataset);
  }, [dataset]);

  /* URL sync */
  useEffect(() => {
    const params: Record<string, string> = {};
    if (dataset) params.dataset = dataset;
    if (queryText) params.query = queryText;
    setSearchParams(params, { replace: true });
  }, [dataset, queryText, setSearchParams]);

  /* Queries */
  const { data: datasets = [], isLoading: datasetsLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => api.datasets.list(),
  });

  /* Run query mutation */
  const queryMutation = useMutation({
    mutationFn: async () => {
      const body = {
        query: queryText,
        dataset: dataset || undefined,
        limit,
      };
      const key = localStorage.getItem(AUTH_KEY);
      const res = await fetch(`${API_BASE_URL}/analytics/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(key ? { 'X-API-Key': key } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `Query failed: ${res.status}`);
      }
      return res.json() as Promise<QueryResult>;
    },
  });

  const result = queryMutation.data;

  /* Sort logic */
  const sortedRows = useMemo(() => {
    if (!result?.rows) return [];
    if (!sortCol) return result.rows;
    return [...result.rows].sort((a, b) => {
      const va = a[sortCol];
      const vb = b[sortCol];
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      const sa = String(va);
      const sb = String(vb);
      return sortDir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
  }, [result?.rows, sortCol, sortDir]);

  /* Handlers */
  const handleRun = useCallback(() => {
    if (!queryText.trim()) return;
    setSortCol('');
    queryMutation.mutate();
  }, [queryText, queryMutation]);

  const handleSort = useCallback((col: string) => {
    setSortCol(prev => {
      if (prev === col) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return col;
      }
      setSortDir('asc');
      return col;
    });
  }, []);

  const handleSuggestionClick = useCallback((suggestion: QuerySuggestion) => {
    setQueryText(suggestion.query);
    setShowSuggestions(false);
    textareaRef.current?.focus();
  }, []);

  /* Keyboard shortcut: Ctrl+Enter / Cmd+Enter */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
    }
  }, [handleRun]);

  /* Auto-grow textarea */
  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQueryText(e.target.value);
    if (!e.target.value.trim()) setShowSuggestions(true);
  }, []);

  const hasChartData = result?.chart_data && result.chart_data.length > 0;

  return (
    <>
      <ContextSidebar title="Analytics">
        <div className="p-3 space-y-1">
          <SidebarNavItem label="Query Explorer" active icon={<Search className="w-3.5 h-3.5" />} />
          <SidebarNavItem
            label="Latency Analysis"
            icon={<Clock className="w-3.5 h-3.5" />}
            onClick={() => {
              setQueryText('SELECT name, avg_ms, p99_ms, error_rate_pct FROM latency ORDER BY p99_ms DESC');
            }}
          />
          <SidebarNavItem
            label="Trends"
            icon={<BarChart3 className="w-3.5 h-3.5" />}
            onClick={() => {
              setQueryText('SELECT date, count, errors FROM trends ORDER BY date');
            }}
          />
        </div>
        {datasets.length > 0 && (
          <div className="px-3 pt-3 border-t border-[var(--border)]">
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2">Datasets</p>
            <div className="space-y-0.5">
              {datasets.map(ds => (
                <SidebarNavItem
                  key={ds.id}
                  label={ds.name}
                  active={dataset === ds.name}
                  icon={<Database className="w-3.5 h-3.5" />}
                  count={ds.record_count}
                  onClick={() => setDataset(ds.name)}
                />
              ))}
            </div>
          </div>
        )}
      </ContextSidebar>

      <div className="ch-workspace">
        <PageHeader
          title="Analytics"
          description="Query and explore your data"
          actions={
            <DatasetPicker
              datasets={datasets}
              selected={dataset}
              onChange={setDataset}
              isLoading={datasetsLoading}
            />
          }
        />

        <div className="ch-workspace-content space-y-4 p-6">
          {/* -- Query Editor -- */}
          <Card padding="none" className="overflow-hidden">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={queryText}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                onFocus={() => { if (!queryText.trim()) setShowSuggestions(true); }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="Enter your query... (e.g., SELECT * FROM traces WHERE status = 'ERROR' LIMIT 50)"
                rows={5}
                spellCheck={false}
                className="w-full bg-[#0d0d14] text-[var(--text-primary)] font-mono text-sm p-4
                  placeholder-[var(--text-muted)]/50 resize-y min-h-[120px] max-h-[400px]
                  focus:outline-none border-none"
                style={{ tabSize: 2 }}
              />
              {/* Line count indicator */}
              <div className="absolute top-2 right-3 text-[10px] text-[var(--text-muted)]/60 tabular-nums">
                {queryText.split('\n').length} lines
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-t border-[var(--border)] bg-[var(--bg-base)]">
              <Button
                size="sm"
                icon={queryMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                onClick={handleRun}
                disabled={!queryText.trim() || queryMutation.isPending}
                loading={queryMutation.isPending}
              >
                Run Query
              </Button>

              <div className="h-4 w-px bg-[var(--border)]" />

              <div className="flex items-center gap-1.5">
                <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Limit</label>
                <input
                  type="number"
                  value={limit}
                  onChange={e => setLimit(Math.max(1, Math.min(10000, Number(e.target.value) || 100)))}
                  className="w-16 bg-[var(--bg-base)] border border-[var(--border)] rounded px-2 py-1
                    text-xs text-[var(--text-primary)] text-center focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="flex-1" />

              <span className="text-[10px] text-[var(--text-muted)] hidden sm:inline">
                <kbd className="px-1.5 py-0.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded text-[10px]">
                  Ctrl+Enter
                </kbd>
                {' '}to run
              </span>
            </div>
          </Card>

          {/* -- Suggestions -- */}
          {showSuggestions && !queryText.trim() && (
            <div className="space-y-2">
              <p className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5" />
                Suggestions
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {DEFAULT_SUGGESTIONS.map((s, i) => (
                  <SuggestionChip key={i} suggestion={s} onClick={() => handleSuggestionClick(s)} />
                ))}
              </div>
            </div>
          )}

          {/* -- Error Banner -- */}
          {queryMutation.isError && (
            <ErrorBanner
              message={queryMutation.error instanceof Error ? queryMutation.error.message : 'Query execution failed'}
              onRetry={handleRun}
            />
          )}

          {/* -- Loading -- */}
          {queryMutation.isPending && (
            <Card>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-[var(--accent)] animate-spin" />
                  <span className="text-xs text-[var(--text-muted)]">Executing query\u2026</span>
                </div>
                <Skeleton className="h-4 w-full" count={5} />
              </div>
            </Card>
          )}

          {/* -- Results -- */}
          {result && !queryMutation.isPending && (
            <div className="space-y-3">
              {/* Results header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <p className="text-xs text-[var(--text-muted)] tabular-nums">
                    <span className="text-[var(--text-primary)] font-medium">{formatNumber(result.total)}</span>
                    {' '}result{result.total !== 1 ? 's' : ''}
                    {' '}in{' '}
                    <span className="text-[var(--text-primary)] font-medium">{result.execution_time_ms}ms</span>
                  </p>
                  {dataset && (
                    <Badge variant="accent">
                      <Database className="w-3 h-3" />
                      {dataset}
                    </Badge>
                  )}
                </div>

                {/* View toggle */}
                {hasChartData && (
                  <div className="flex gap-0.5 p-0.5 bg-[var(--bg-base)] rounded-lg border border-[var(--border)]">
                    <button
                      onClick={() => setViewMode('chart')}
                      className={`px-2.5 py-1 text-xs rounded-md transition-colors cursor-pointer flex items-center gap-1.5
                        ${viewMode === 'chart'
                          ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
                    >
                      <BarChart3 className="w-3 h-3" />
                      Chart
                    </button>
                    <button
                      onClick={() => setViewMode('table')}
                      className={`px-2.5 py-1 text-xs rounded-md transition-colors cursor-pointer flex items-center gap-1.5
                        ${viewMode === 'table'
                          ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
                    >
                      <Table2 className="w-3 h-3" />
                      Table
                    </button>
                  </div>
                )}
              </div>

              {/* Chart view */}
              {viewMode === 'chart' && hasChartData && (
                <Card padding="lg">
                  <ResultChart data={result.chart_data!} />
                </Card>
              )}

              {/* Table view */}
              {(viewMode === 'table' || !hasChartData) && (
                <>
                  {result.rows.length > 0 ? (
                    <ResultTable
                      columns={result.columns}
                      rows={sortedRows}
                      sortCol={sortCol}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                  ) : (
                    <EmptyState
                      icon={<Search className="w-8 h-8" />}
                      title="No results found"
                      description="Your query returned no data. Try adjusting your filters or query."
                    />
                  )}
                </>
              )}
            </div>
          )}

          {/* -- Initial empty state -- */}
          {!result && !queryMutation.isPending && !queryMutation.isError && !showSuggestions && (
            <EmptyState
              icon={<BarChart3 className="w-10 h-10" />}
              title="Run a query to explore your data"
              description="Write a query above and press Run or Ctrl+Enter to see results."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQueryText('');
                    setShowSuggestions(true);
                    textareaRef.current?.focus();
                  }}
                >
                  Browse suggestions
                </Button>
              }
            />
          )}
        </div>
      </div>
    </>
  );
}
