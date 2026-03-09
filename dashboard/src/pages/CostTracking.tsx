import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
} from 'recharts'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface CostSummary {
    total_cost: number
    total_tokens: number
    llm_calls: number
    avg_cost_per_span: number
}

interface CostBreakdownItem {
    group: string
    total_cost: number
    total_tokens: number
    call_count: number
    pct: number
}

interface CostTrendPoint {
    date: string
    cost: number
    tokens: number
    calls: number
}

interface CostForecast {
    projected_cost: number
    trend_direction: 'up' | 'down' | 'flat'
    trend_pct: number
    confidence: number
}

interface TopTrace {
    trace_id: string
    total_cost: number
    total_tokens: number
    span_count: number
    start_time: string
    model: string | null
}

/* ------------------------------------------------------------------ */
/*  API helpers (mirrors api/client.ts pattern)                        */
/* ------------------------------------------------------------------ */
const BASE = () => (import.meta as any).env?.VITE_API_URL || '/api'
const KEY = () => localStorage.getItem('tl_api_key') || ''

async function req<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE()}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${KEY()}`,
        },
    })
    if (!res.ok) {
        const e = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(e.detail || `HTTP ${res.status}`)
    }
    return res.json()
}

const costApi = {
    summary: (days: number) => req<CostSummary>(`/analytics/cost?days=${days}`),
    breakdown: (groupBy: string, days: number) =>
        req<CostBreakdownItem[]>(
            `/analytics/cost/breakdown?group_by=${groupBy}&days=${days}`
        ),
    trends: (days: number, granularity = 'day') =>
        req<CostTrendPoint[]>(
            `/analytics/cost/trends?days=${days}&granularity=${granularity}`
        ),
    forecast: (forecastDays: number) =>
        req<CostForecast>(`/analytics/cost/forecast?forecast_days=${forecastDays}`),
    topTraces: (days: number, limit = 20) =>
        req<TopTrace[]>(`/analytics/cost/top-traces?days=${days}&limit=${limit}`),
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const TIME_RANGES = [
    { label: '7d', days: 7 },
    { label: '14d', days: 14 },
    { label: '30d', days: 30 },
    { label: '90d', days: 90 },
]

const GROUP_BY_OPTIONS = [
    { label: 'Model', value: 'model' },
    { label: 'Service', value: 'service' },
    { label: 'Span Kind', value: 'span_kind' },
]

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function formatCost(n: number): string {
    if (n >= 1) return `$${n.toFixed(2)}`
    if (n >= 0.01) return `$${n.toFixed(3)}`
    if (n >= 0.001) return `$${n.toFixed(4)}`
    return `$${n.toFixed(6)}`
}

function formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toLocaleString()
}

function formatDate(dateStr: string): string {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function trendArrow(dir: string): string {
    if (dir === 'up') return '\u2191'
    if (dir === 'down') return '\u2193'
    return '\u2192'
}

function trendColor(dir: string): string {
    if (dir === 'up') return 'var(--error)'
    if (dir === 'down') return 'var(--success)'
    return 'var(--text-muted)'
}

/* ------------------------------------------------------------------ */
/*  Custom Recharts tooltip                                            */
/* ------------------------------------------------------------------ */
function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null
    return (
        <div
            style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                fontSize: 12,
            }}
        >
            <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>
                {formatDate(label)}
            </div>
            {payload.map((p: any) => (
                <div
                    key={p.dataKey}
                    style={{
                        color: p.color,
                        display: 'flex',
                        gap: 8,
                        justifyContent: 'space-between',
                    }}
                >
                    <span>{p.name}:</span>
                    <strong>
                        {p.dataKey === 'cost'
                            ? formatCost(p.value)
                            : formatTokens(p.value)}
                    </strong>
                </div>
            ))}
        </div>
    )
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function CostTrackingPage() {
    const [days, setDays] = useState(30)
    const [groupBy, setGroupBy] = useState('model')

    /* ---- Queries ---- */
    const {
        data: summary,
        isLoading: summaryLoading,
        error,
    } = useQuery<CostSummary>({
        queryKey: ['cost', 'summary', days],
        queryFn: () => costApi.summary(days),
        retry: 1,
    })

    const { data: breakdown } = useQuery<CostBreakdownItem[]>({
        queryKey: ['cost', 'breakdown', groupBy, days],
        queryFn: () => costApi.breakdown(groupBy, days),
        retry: 1,
    })

    const { data: trends } = useQuery<CostTrendPoint[]>({
        queryKey: ['cost', 'trends', days],
        queryFn: () => costApi.trends(days),
        retry: 1,
    })

    const { data: forecast } = useQuery<CostForecast>({
        queryKey: ['cost', 'forecast', days],
        queryFn: () => costApi.forecast(days),
        retry: 1,
    })

    const { data: topTraces } = useQuery<TopTrace[]>({
        queryKey: ['cost', 'topTraces', days],
        queryFn: () => costApi.topTraces(days),
        retry: 1,
    })

    /* ---- Breakdown max for percentage bars ---- */
    const breakdownMax = useMemo(
        () => breakdown?.reduce((m, b) => Math.max(m, b.total_cost), 0) || 1,
        [breakdown]
    )

    /* ---- Error state ---- */
    const errMsg = error instanceof Error ? error.message : ''
    const is503 =
        errMsg.includes('503') || errMsg.toLowerCase().includes('clickhouse')

    return (
        <>
            {/* Context sidebar */}
            <div className="ch-sidebar-context">
                <div className="ch-context-header">
                    <div className="ch-context-tab active">Cost Analytics</div>
                </div>
                <div className="ch-context-content">
                    <div className="text-xs text-text-muted mb-4 uppercase tracking-wider font-semibold">
                        Quick Stats
                    </div>
                    {summary && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div>
                                <div className="text-xs text-text-muted">Total Spend</div>
                                <div className="text-lg font-bold text-text-primary font-mono">
                                    {formatCost(summary.total_cost)}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-text-muted">Total Tokens</div>
                                <div className="text-sm font-semibold text-text-primary font-mono">
                                    {formatTokens(summary.total_tokens)}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-text-muted">LLM Calls</div>
                                <div className="text-sm font-semibold text-text-primary font-mono">
                                    {summary.llm_calls.toLocaleString()}
                                </div>
                            </div>
                            {forecast && (
                                <div className="mt-4">
                                    <div className="text-xs text-text-muted mb-1">
                                        {days}d Forecast
                                    </div>
                                    <div
                                        className="text-sm font-bold font-mono"
                                        style={{ color: trendColor(forecast.trend_direction) }}
                                    >
                                        {trendArrow(forecast.trend_direction)}{' '}
                                        {formatCost(forecast.projected_cost)}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {!summary && !summaryLoading && (
                        <div className="text-sm text-text-muted">No cost data</div>
                    )}
                </div>
            </div>

            {/* Main workspace */}
            <main className="ch-workspace bg-bg-base">
                <header className="ch-topbar">
                    <div className="ch-topbar-title flex flex-col justify-center">
                        <div className="text-sm text-text-primary font-bold">
                            Cost Tracking
                        </div>
                    </div>
                    <div className="ch-topbar-actions bg-bg-surface border border-border-subtle rounded-md p-1">
                        {TIME_RANGES.map(r => (
                            <button
                                key={r.days}
                                onClick={() => setDays(r.days)}
                                className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                                    days === r.days
                                        ? 'bg-bg-elevated text-text-primary shadow-sm'
                                        : 'text-text-muted hover:text-text-secondary'
                                }`}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>
                </header>

                <div className="ch-workspace-scroll">
                    <div
                        className="p-8 max-w-6xl mx-auto"
                        style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
                    >
                        {/* Error banners */}
                        {is503 && (
                            <div className="error-banner flex items-center gap-2">
                                <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                    />
                                </svg>
                                <strong className="text-sm">
                                    ClickHouse not connected -- cost analytics unavailable
                                </strong>
                            </div>
                        )}
                        {error && !is503 && (
                            <div className="error-banner flex items-center gap-2">
                                <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                                <strong className="text-sm mr-2">Error:</strong>
                                <span className="text-sm">{errMsg}</span>
                            </div>
                        )}

                        {/* Stat cards row */}
                        <div className="stat-cards-grid">
                            <div className="stat-card">
                                <div className="stat-value font-mono">
                                    {summaryLoading ? (
                                        <div
                                            className="skeleton"
                                            style={{ width: 80, height: 28 }}
                                        ></div>
                                    ) : (
                                        formatCost(summary?.total_cost ?? 0)
                                    )}
                                </div>
                                <div className="stat-label flex items-center gap-2">
                                    <svg
                                        className="w-3.5 h-3.5"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                    Total Cost
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-value font-mono">
                                    {summaryLoading ? (
                                        <div
                                            className="skeleton"
                                            style={{ width: 60, height: 28 }}
                                        ></div>
                                    ) : (
                                        formatTokens(summary?.total_tokens ?? 0)
                                    )}
                                </div>
                                <div className="stat-label flex items-center gap-2">
                                    <svg
                                        className="w-3.5 h-3.5"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                        />
                                    </svg>
                                    Total Tokens
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-value font-mono">
                                    {summaryLoading ? (
                                        <div
                                            className="skeleton"
                                            style={{ width: 48, height: 28 }}
                                        ></div>
                                    ) : (
                                        (summary?.llm_calls ?? 0).toLocaleString()
                                    )}
                                </div>
                                <div className="stat-label flex items-center gap-2">
                                    <svg
                                        className="w-3.5 h-3.5"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M13 10V3L4 14h7v7l9-11h-7z"
                                        />
                                    </svg>
                                    LLM Calls
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-value font-mono">
                                    {summaryLoading ? (
                                        <div
                                            className="skeleton"
                                            style={{ width: 64, height: 28 }}
                                        ></div>
                                    ) : (
                                        formatCost(summary?.avg_cost_per_span ?? 0)
                                    )}
                                </div>
                                <div className="stat-label flex items-center gap-2">
                                    <svg
                                        className="w-3.5 h-3.5"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                        />
                                    </svg>
                                    Avg Cost/Span
                                </div>
                            </div>
                        </div>

                        {/* Cost trend chart */}
                        <div className="card">
                            <div className="card-header">
                                <div className="text-sm font-semibold text-text-primary">
                                    Cost Trend
                                </div>
                                <div className="text-xs text-text-muted">
                                    Daily cost over {days} days
                                </div>
                            </div>
                            <div style={{ width: '100%', height: 300 }}>
                                {trends && trends.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart
                                            data={trends}
                                            margin={{
                                                top: 8,
                                                right: 16,
                                                left: 8,
                                                bottom: 8,
                                            }}
                                        >
                                            <CartesianGrid
                                                strokeDasharray="3 3"
                                                stroke="rgba(255,255,255,0.05)"
                                            />
                                            <XAxis
                                                dataKey="date"
                                                tickFormatter={formatDate}
                                                stroke="var(--text-muted)"
                                                fontSize={11}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <YAxis
                                                tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                                                stroke="var(--text-muted)"
                                                fontSize={11}
                                                tickLine={false}
                                                axisLine={false}
                                                width={60}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Line
                                                type="monotone"
                                                dataKey="cost"
                                                name="Cost"
                                                stroke="var(--accent)"
                                                strokeWidth={2}
                                                dot={false}
                                                activeDot={{
                                                    r: 4,
                                                    fill: 'var(--accent)',
                                                    stroke: 'var(--bg-surface)',
                                                    strokeWidth: 2,
                                                }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-full">
                                        {summaryLoading ? (
                                            <div className="loading-spinner"></div>
                                        ) : (
                                            <div className="text-sm text-text-muted">
                                                No trend data available
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Forecast + Breakdown row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            {/* Forecast card */}
                            <div className="card">
                                <div className="card-header">
                                    <div className="text-sm font-semibold text-text-primary">
                                        Forecast
                                    </div>
                                    <div className="text-xs text-text-muted">
                                        Next {days} days projection
                                    </div>
                                </div>
                                {forecast ? (
                                    <div>
                                        <div
                                            className="text-2xl font-bold font-mono mb-2"
                                            style={{
                                                color: trendColor(forecast.trend_direction),
                                            }}
                                        >
                                            {trendArrow(forecast.trend_direction)}{' '}
                                            {formatCost(forecast.projected_cost)}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span
                                                className="badge"
                                                style={{
                                                    background:
                                                        forecast.trend_direction === 'up'
                                                            ? 'var(--error-dim)'
                                                            : forecast.trend_direction === 'down'
                                                            ? 'var(--success-dim)'
                                                            : 'var(--bg-elevated)',
                                                    color:
                                                        forecast.trend_direction === 'up'
                                                            ? 'var(--error)'
                                                            : forecast.trend_direction === 'down'
                                                            ? 'var(--success)'
                                                            : 'var(--text-muted)',
                                                }}
                                            >
                                                {forecast.trend_pct > 0 ? '+' : ''}
                                                {forecast.trend_pct.toFixed(1)}%
                                            </span>
                                            <span className="text-xs text-text-muted">
                                                vs previous {days}d
                                            </span>
                                        </div>
                                        <div className="mt-4">
                                            <div className="text-xs text-text-muted mb-1">
                                                Confidence
                                            </div>
                                            <div
                                                style={{
                                                    height: 4,
                                                    background: 'var(--bg-elevated)',
                                                    borderRadius: 2,
                                                    overflow: 'hidden',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: `${forecast.confidence * 100}%`,
                                                        height: '100%',
                                                        background: 'var(--accent)',
                                                        borderRadius: 2,
                                                    }}
                                                />
                                            </div>
                                            <div className="text-xs text-text-muted mt-1">
                                                {(forecast.confidence * 100).toFixed(0)}%
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center py-4">
                                        {summaryLoading ? (
                                            <div className="loading-spinner"></div>
                                        ) : (
                                            <div className="text-sm text-text-muted">
                                                No forecast data
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Breakdown mini bar chart */}
                            <div className="card">
                                <div className="card-header">
                                    <div className="text-sm font-semibold text-text-primary">
                                        Cost by{' '}
                                        {groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}
                                    </div>
                                </div>
                                {breakdown && breakdown.length > 0 ? (
                                    <div style={{ width: '100%', height: 200 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={breakdown.slice(0, 6)}
                                                layout="vertical"
                                                margin={{
                                                    top: 0,
                                                    right: 16,
                                                    left: 0,
                                                    bottom: 0,
                                                }}
                                            >
                                                <CartesianGrid
                                                    strokeDasharray="3 3"
                                                    stroke="rgba(255,255,255,0.05)"
                                                    horizontal={false}
                                                />
                                                <XAxis
                                                    type="number"
                                                    tickFormatter={(v: number) =>
                                                        `$${v.toFixed(2)}`
                                                    }
                                                    stroke="var(--text-muted)"
                                                    fontSize={10}
                                                    tickLine={false}
                                                    axisLine={false}
                                                />
                                                <YAxis
                                                    type="category"
                                                    dataKey="group"
                                                    stroke="var(--text-muted)"
                                                    fontSize={11}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    width={90}
                                                />
                                                <Tooltip
                                                    formatter={(v: number) => [
                                                        formatCost(v),
                                                        'Cost',
                                                    ]}
                                                    contentStyle={{
                                                        background: 'var(--bg-surface)',
                                                        border: '1px solid var(--border)',
                                                        borderRadius: 'var(--radius-sm)',
                                                        fontSize: 12,
                                                    }}
                                                />
                                                <Bar
                                                    dataKey="total_cost"
                                                    fill="var(--accent)"
                                                    radius={[0, 3, 3, 0]}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center py-4">
                                        <div className="text-sm text-text-muted">
                                            No breakdown data
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Cost breakdown table */}
                        <div className="card p-0 overflow-hidden">
                            <div
                                className="px-4 py-3 flex items-center justify-between"
                                style={{
                                    borderBottom: '1px solid var(--border-subtle)',
                                }}
                            >
                                <div className="text-sm font-semibold text-text-primary">
                                    Cost Breakdown
                                </div>
                                <div className="flex items-center gap-2">
                                    {GROUP_BY_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setGroupBy(opt.value)}
                                            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                                                groupBy === opt.value
                                                    ? 'bg-bg-elevated text-text-primary'
                                                    : 'text-text-muted hover:text-text-secondary'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <table className="table w-full whitespace-nowrap">
                                <thead>
                                    <tr>
                                        <th>
                                            {groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}
                                        </th>
                                        <th className="text-right">Cost</th>
                                        <th className="text-right">Tokens</th>
                                        <th className="text-right">Calls</th>
                                        <th style={{ width: 200 }}>Share</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {!breakdown?.length ? (
                                        <tr>
                                            <td colSpan={5}>
                                                <div className="empty-state" style={{ padding: '40px 20px' }}>
                                                    <div className="empty-state-icon">&#x25C8;</div>
                                                    <div className="empty-state-title">
                                                        No cost data yet
                                                    </div>
                                                    <div className="empty-state-desc">
                                                        LLM span costs will appear here once tracked.
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        breakdown.map(b => (
                                            <tr key={b.group}>
                                                <td className="font-mono text-sm font-semibold text-text-primary">
                                                    {b.group}
                                                </td>
                                                <td className="text-right font-mono text-sm">
                                                    {formatCost(b.total_cost)}
                                                </td>
                                                <td className="text-right font-mono text-sm text-text-secondary">
                                                    {formatTokens(b.total_tokens)}
                                                </td>
                                                <td className="text-right text-sm">
                                                    {b.call_count.toLocaleString()}
                                                </td>
                                                <td>
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className="flex-1"
                                                            style={{
                                                                height: 6,
                                                                background: 'var(--bg-elevated)',
                                                                borderRadius: 3,
                                                                overflow: 'hidden',
                                                            }}
                                                        >
                                                            <div
                                                                style={{
                                                                    width: `${Math.max(
                                                                        2,
                                                                        (b.total_cost / breakdownMax) *
                                                                            100
                                                                    )}%`,
                                                                    height: '100%',
                                                                    background: 'var(--accent)',
                                                                    borderRadius: 3,
                                                                    transition: 'width 0.3s ease',
                                                                }}
                                                            />
                                                        </div>
                                                        <span
                                                            className="text-xs text-text-muted font-mono"
                                                            style={{
                                                                width: 40,
                                                                textAlign: 'right',
                                                                flexShrink: 0,
                                                            }}
                                                        >
                                                            {b.pct.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Top expensive traces */}
                        <div className="card p-0 overflow-hidden">
                            <div
                                className="px-4 py-3 flex items-center justify-between"
                                style={{
                                    borderBottom: '1px solid var(--border-subtle)',
                                }}
                            >
                                <div className="text-sm font-semibold text-text-primary">
                                    Most Expensive Traces
                                </div>
                                <div className="text-xs text-text-muted">
                                    Top 20 in last {days} days
                                </div>
                            </div>
                            <table className="table w-full whitespace-nowrap">
                                <thead>
                                    <tr>
                                        <th>Trace ID</th>
                                        <th>Model</th>
                                        <th className="text-right">Cost</th>
                                        <th className="text-right">Tokens</th>
                                        <th className="text-right">Spans</th>
                                        <th className="text-right">Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {!topTraces?.length ? (
                                        <tr>
                                            <td colSpan={6}>
                                                <div
                                                    className="empty-state"
                                                    style={{ padding: '40px 20px' }}
                                                >
                                                    <div className="empty-state-title">
                                                        No traces with cost data
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        topTraces.map(t => (
                                            <tr key={t.trace_id}>
                                                <td className="font-mono text-xs text-info">
                                                    <a
                                                        href={`/traces/${t.trace_id}`}
                                                        className="hover:text-text-primary transition-colors"
                                                        style={{
                                                            textDecoration: 'none',
                                                            color: 'var(--info)',
                                                        }}
                                                    >
                                                        {t.trace_id.slice(0, 12)}...
                                                    </a>
                                                </td>
                                                <td className="font-mono text-xs text-text-secondary">
                                                    {t.model || '--'}
                                                </td>
                                                <td className="text-right font-mono text-sm font-medium text-text-primary">
                                                    {formatCost(t.total_cost)}
                                                </td>
                                                <td className="text-right font-mono text-sm text-text-secondary">
                                                    {formatTokens(t.total_tokens)}
                                                </td>
                                                <td className="text-right text-sm">
                                                    {t.span_count}
                                                </td>
                                                <td className="text-right text-xs text-text-muted">
                                                    {new Date(t.start_time).toLocaleString(
                                                        'en-US',
                                                        {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        }
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {!summaryLoading && summary && (
                            <div className="text-center text-xs text-text-muted">
                                Showing cost data for the last {days} days &bull;{' '}
                                {formatCost(summary.total_cost)} total across{' '}
                                {summary.llm_calls.toLocaleString()} calls
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </>
    )
}
