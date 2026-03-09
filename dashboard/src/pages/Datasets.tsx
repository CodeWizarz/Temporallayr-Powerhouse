import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Dataset {
    name: string
    row_count: number
    storage_bytes: number
    field_count: number
    ttl_days: number | null
}

interface FieldSchema {
    name: string
    type: string
    default_value: string | null
    comment: string | null
}

interface DatasetDetail {
    name: string
    row_count: number
    storage_bytes: number
    field_count: number
    ttl_days: number | null
    engine: string
    partition_key: string | null
    order_by: string | null
    created_at: string | null
}

interface FieldStat {
    name: string
    type: string
    cardinality: number
    null_count: number
    sample_values: string[]
}

/* ------------------------------------------------------------------ */
/*  API helpers (mirrors api/client.ts pattern)                        */
/* ------------------------------------------------------------------ */
const BASE = () => (import.meta as any).env?.VITE_API_URL || '/api'
const KEY = () => localStorage.getItem('tl_api_key') || ''

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE()}${path}`, {
        ...opts,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY()}`, ...opts.headers },
    })
    if (!res.ok) {
        const e = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(e.detail || `HTTP ${res.status}`)
    }
    return res.json()
}

const datasetsApi = {
    list: () => req<Dataset[]>('/datasets'),
    detail: (name: string) => req<DatasetDetail>(`/datasets/${name}`),
    schema: (name: string) => req<FieldSchema[]>(`/datasets/${name}/schema`),
    stats: (name: string) => req<FieldStat[]>(`/datasets/${name}/stats`),
    updateRetention: (name: string, ttl_days: number) =>
        req<{ success: boolean }>(`/datasets/${name}/retention`, {
            method: 'PUT',
            body: JSON.stringify({ ttl_days }),
        }),
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`
}

function formatNumber(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toLocaleString()
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function DatasetsPage() {
    const queryClient = useQueryClient()
    const [expanded, setExpanded] = useState<string | null>(null)
    const [autoRefresh, setAutoRefresh] = useState(false)
    const [ttlInput, setTtlInput] = useState<string>('')
    const [editingTtl, setEditingTtl] = useState<string | null>(null)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    /* ---- List query ---- */
    const { data: datasets, isLoading, error, refetch } = useQuery<Dataset[]>({
        queryKey: ['datasets'],
        queryFn: datasetsApi.list,
        retry: 1,
    })

    /* ---- Detail query (only when expanded) ---- */
    const { data: detail } = useQuery<DatasetDetail>({
        queryKey: ['datasets', expanded, 'detail'],
        queryFn: () => datasetsApi.detail(expanded!),
        enabled: !!expanded,
    })

    /* ---- Schema query ---- */
    const { data: schema, isLoading: schemaLoading } = useQuery<FieldSchema[]>({
        queryKey: ['datasets', expanded, 'schema'],
        queryFn: () => datasetsApi.schema(expanded!),
        enabled: !!expanded,
    })

    /* ---- Stats query ---- */
    const { data: stats } = useQuery<FieldStat[]>({
        queryKey: ['datasets', expanded, 'stats'],
        queryFn: () => datasetsApi.stats(expanded!),
        enabled: !!expanded,
    })

    /* ---- Retention mutation ---- */
    const retentionMutation = useMutation({
        mutationFn: ({ name, ttl }: { name: string; ttl: number }) =>
            datasetsApi.updateRetention(name, ttl),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['datasets'] })
            setEditingTtl(null)
        },
    })

    /* ---- Auto-refresh ---- */
    useEffect(() => {
        if (autoRefresh) {
            intervalRef.current = setInterval(() => refetch(), 15_000)
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [autoRefresh, refetch])

    const toggle = useCallback((name: string) => {
        setExpanded(prev => (prev === name ? null : name))
        setEditingTtl(null)
    }, [])

    /* ---- Derived: max storage for relative bars ---- */
    const maxStorage = datasets?.reduce((m, d) => Math.max(m, d.storage_bytes), 0) || 1

    /* ---- Error handling ---- */
    const errMsg = error instanceof Error ? error.message : ''
    const is503 = errMsg.includes('503') || errMsg.toLowerCase().includes('clickhouse')

    return (
        <>
            {/* Context sidebar */}
            <div className="ch-sidebar-context">
                <div className="ch-context-header">
                    <div className="ch-context-tab active">Tables</div>
                </div>
                <div className="ch-context-content">
                    <div className="text-xs text-text-muted mb-4 uppercase tracking-wider font-semibold">ClickHouse Tables</div>
                    {datasets?.map(d => (
                        <div
                            key={d.name}
                            onClick={() => toggle(d.name)}
                            className={`text-sm px-2 py-1.5 rounded cursor-pointer mb-1 transition-colors ${
                                expanded === d.name
                                    ? 'bg-bg-elevated text-text-primary font-medium'
                                    : 'text-text-secondary hover:bg-white/5'
                            }`}
                        >
                            {d.name}
                        </div>
                    ))}
                    {!datasets?.length && !isLoading && (
                        <div className="text-sm text-text-muted">No tables found</div>
                    )}
                </div>
            </div>

            {/* Main workspace */}
            <main className="ch-workspace bg-bg-base">
                <header className="ch-topbar">
                    <div className="ch-topbar-title flex flex-col justify-center">
                        <div className="text-sm text-text-primary font-bold">Datasets</div>
                    </div>
                    <div className="ch-topbar-actions flex items-center gap-3">
                        {/* Auto-refresh toggle */}
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-text-muted">
                            <input
                                type="checkbox"
                                checked={autoRefresh}
                                onChange={e => setAutoRefresh(e.target.checked)}
                                className="ch-checkbox"
                            />
                            Auto-refresh
                        </label>
                        {/* Refresh button */}
                        <button onClick={() => refetch()} className="btn btn-secondary btn-sm">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Refresh
                        </button>
                    </div>
                </header>

                <div className="ch-workspace-scroll">
                    <div className="p-8 max-w-6xl mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {/* Error banners */}
                        {is503 && (
                            <div className="error-banner flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <strong className="text-sm">ClickHouse not connected -- datasets unavailable</strong>
                            </div>
                        )}
                        {error && !is503 && (
                            <div className="error-banner flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <strong className="text-sm mr-2">Error:</strong>
                                <span className="text-sm">{errMsg}</span>
                            </div>
                        )}

                        {/* Stat cards */}
                        <div className="stat-cards-grid">
                            <div className="stat-card">
                                <div className="stat-value font-mono">{datasets?.length ?? 0}</div>
                                <div className="stat-label flex items-center gap-2">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                                    </svg>
                                    Tables
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-value font-mono">
                                    {formatNumber(datasets?.reduce((s, d) => s + d.row_count, 0) ?? 0)}
                                </div>
                                <div className="stat-label flex items-center gap-2">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Total Rows
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-value font-mono">
                                    {formatBytes(datasets?.reduce((s, d) => s + d.storage_bytes, 0) ?? 0)}
                                </div>
                                <div className="stat-label flex items-center gap-2">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                    </svg>
                                    Storage Used
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-value font-mono">
                                    {datasets?.reduce((s, d) => s + d.field_count, 0) ?? 0}
                                </div>
                                <div className="stat-label flex items-center gap-2">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                    </svg>
                                    Total Fields
                                </div>
                            </div>
                        </div>

                        {/* Storage usage visualization */}
                        {datasets && datasets.length > 0 && (
                            <div className="card">
                                <div className="card-header">
                                    <div className="text-sm font-semibold text-text-primary">Storage Usage</div>
                                    <div className="text-xs text-text-muted">Relative table sizes</div>
                                </div>
                                <div className="flex-col" style={{ display: 'flex', gap: 12 }}>
                                    {[...datasets]
                                        .sort((a, b) => b.storage_bytes - a.storage_bytes)
                                        .map(d => (
                                            <div key={d.name} className="flex items-center gap-3">
                                                <div
                                                    className="font-mono text-xs text-text-secondary"
                                                    style={{ width: 180, flexShrink: 0 }}
                                                >
                                                    {d.name}
                                                </div>
                                                <div
                                                    className="flex-1"
                                                    style={{
                                                        height: 8,
                                                        background: 'var(--bg-elevated)',
                                                        borderRadius: 4,
                                                        overflow: 'hidden',
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            width: `${Math.max(2, (d.storage_bytes / maxStorage) * 100)}%`,
                                                            height: '100%',
                                                            background: 'var(--accent)',
                                                            borderRadius: 4,
                                                            transition: 'width 0.3s ease',
                                                        }}
                                                    />
                                                </div>
                                                <div
                                                    className="font-mono text-xs text-text-muted"
                                                    style={{ width: 70, textAlign: 'right', flexShrink: 0 }}
                                                >
                                                    {formatBytes(d.storage_bytes)}
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}

                        {/* Dataset table */}
                        <div className="card p-0 overflow-hidden">
                            <table className="table w-full whitespace-nowrap">
                                <thead>
                                    <tr>
                                        <th style={{ width: 28 }}></th>
                                        <th>Table Name</th>
                                        <th className="text-right">Rows</th>
                                        <th className="text-right">Storage</th>
                                        <th className="text-right">Fields</th>
                                        <th className="text-right">TTL (days)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        Array.from({ length: 4 }).map((_, i) => (
                                            <tr key={i}>
                                                <td><div className="skeleton w-4"></div></td>
                                                <td><div className="skeleton" style={{ width: 128 }}></div></td>
                                                <td><div className="skeleton ml-auto" style={{ width: 64 }}></div></td>
                                                <td><div className="skeleton ml-auto" style={{ width: 64 }}></div></td>
                                                <td><div className="skeleton ml-auto" style={{ width: 48 }}></div></td>
                                                <td><div className="skeleton ml-auto" style={{ width: 48 }}></div></td>
                                            </tr>
                                        ))
                                    ) : !datasets?.length ? (
                                        <tr>
                                            <td colSpan={6}>
                                                <div className="empty-state">
                                                    <div className="empty-state-icon">&#x25C8;</div>
                                                    <div className="empty-state-title">No datasets found</div>
                                                    <div className="empty-state-desc">
                                                        ClickHouse tables will appear here once data is ingested.
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        datasets.map(d => (
                                            <>
                                                {/* Main row */}
                                                <tr
                                                    key={d.name}
                                                    onClick={() => toggle(d.name)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <td style={{ width: 28, paddingRight: 0 }}>
                                                        <svg
                                                            className="w-3.5 h-3.5 text-text-muted transition-transform"
                                                            style={{
                                                                transform:
                                                                    expanded === d.name
                                                                        ? 'rotate(90deg)'
                                                                        : 'rotate(0deg)',
                                                            }}
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={2}
                                                                d="M9 5l7 7-7 7"
                                                            />
                                                        </svg>
                                                    </td>
                                                    <td className="font-mono text-sm font-semibold text-text-primary">
                                                        {d.name}
                                                    </td>
                                                    <td className="text-right font-mono text-sm">
                                                        {formatNumber(d.row_count)}
                                                    </td>
                                                    <td className="text-right font-mono text-sm">
                                                        {formatBytes(d.storage_bytes)}
                                                    </td>
                                                    <td className="text-right text-sm">{d.field_count}</td>
                                                    <td className="text-right">
                                                        {d.ttl_days != null ? (
                                                            <span className="badge badge-info">{d.ttl_days}d</span>
                                                        ) : (
                                                            <span className="badge badge-neutral">none</span>
                                                        )}
                                                    </td>
                                                </tr>

                                                {/* Expanded detail */}
                                                {expanded === d.name && (
                                                    <tr key={`${d.name}-detail`}>
                                                        <td
                                                            colSpan={6}
                                                            style={{
                                                                padding: 0,
                                                                borderBottom: '1px solid var(--border-subtle)',
                                                            }}
                                                        >
                                                            <div
                                                                style={{
                                                                    background: 'var(--bg-base)',
                                                                    padding: '20px 24px',
                                                                }}
                                                            >
                                                                {/* Detail metadata row */}
                                                                {detail && (
                                                                    <div
                                                                        className="flex gap-6 mb-6"
                                                                        style={{ flexWrap: 'wrap' }}
                                                                    >
                                                                        <div>
                                                                            <div className="text-xs text-text-muted uppercase tracking-wider mb-1">
                                                                                Engine
                                                                            </div>
                                                                            <div className="text-sm font-mono text-text-primary">
                                                                                {detail.engine || '--'}
                                                                            </div>
                                                                        </div>
                                                                        <div>
                                                                            <div className="text-xs text-text-muted uppercase tracking-wider mb-1">
                                                                                Partition Key
                                                                            </div>
                                                                            <div className="text-sm font-mono text-text-primary">
                                                                                {detail.partition_key || '--'}
                                                                            </div>
                                                                        </div>
                                                                        <div>
                                                                            <div className="text-xs text-text-muted uppercase tracking-wider mb-1">
                                                                                Order By
                                                                            </div>
                                                                            <div className="text-sm font-mono text-text-primary">
                                                                                {detail.order_by || '--'}
                                                                            </div>
                                                                        </div>
                                                                        {detail.created_at && (
                                                                            <div>
                                                                                <div className="text-xs text-text-muted uppercase tracking-wider mb-1">
                                                                                    Created
                                                                                </div>
                                                                                <div className="text-sm text-text-primary">
                                                                                    {new Date(
                                                                                        detail.created_at
                                                                                    ).toLocaleDateString()}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* Retention settings */}
                                                                <div className="card mb-4">
                                                                    <div className="card-header" style={{ marginBottom: 12 }}>
                                                                        <div className="text-sm font-semibold text-text-primary">
                                                                            Retention Settings
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="text-sm text-text-secondary mr-2">
                                                                            Current TTL:{' '}
                                                                            <strong className="text-text-primary">
                                                                                {d.ttl_days != null
                                                                                    ? `${d.ttl_days} days`
                                                                                    : 'No expiration'}
                                                                            </strong>
                                                                        </div>
                                                                        {editingTtl === d.name ? (
                                                                            <div className="flex items-center gap-2">
                                                                                <input
                                                                                    type="number"
                                                                                    value={ttlInput}
                                                                                    onChange={e =>
                                                                                        setTtlInput(e.target.value)
                                                                                    }
                                                                                    placeholder="Days"
                                                                                    min={1}
                                                                                    className="input"
                                                                                    style={{ width: 100 }}
                                                                                />
                                                                                <button
                                                                                    onClick={() => {
                                                                                        const val = parseInt(
                                                                                            ttlInput,
                                                                                            10
                                                                                        )
                                                                                        if (val > 0)
                                                                                            retentionMutation.mutate({
                                                                                                name: d.name,
                                                                                                ttl: val,
                                                                                            })
                                                                                    }}
                                                                                    disabled={
                                                                                        retentionMutation.isPending ||
                                                                                        !ttlInput
                                                                                    }
                                                                                    className="btn btn-primary btn-sm"
                                                                                >
                                                                                    {retentionMutation.isPending
                                                                                        ? 'Saving...'
                                                                                        : 'Save'}
                                                                                </button>
                                                                                <button
                                                                                    onClick={() =>
                                                                                        setEditingTtl(null)
                                                                                    }
                                                                                    className="btn btn-ghost btn-sm"
                                                                                >
                                                                                    Cancel
                                                                                </button>
                                                                            </div>
                                                                        ) : (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setEditingTtl(d.name)
                                                                                    setTtlInput(
                                                                                        d.ttl_days != null
                                                                                            ? String(d.ttl_days)
                                                                                            : ''
                                                                                    )
                                                                                }}
                                                                                className="btn btn-secondary btn-sm"
                                                                            >
                                                                                Edit TTL
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Schema table */}
                                                                <div className="card p-0 overflow-hidden mb-4">
                                                                    <div
                                                                        className="px-4 py-3 flex items-center justify-between"
                                                                        style={{
                                                                            borderBottom:
                                                                                '1px solid var(--border-subtle)',
                                                                        }}
                                                                    >
                                                                        <div className="text-sm font-semibold text-text-primary">
                                                                            Schema
                                                                        </div>
                                                                        <div className="text-xs text-text-muted">
                                                                            {schema?.length ?? 0} fields
                                                                        </div>
                                                                    </div>
                                                                    <table className="table w-full">
                                                                        <thead>
                                                                            <tr>
                                                                                <th>Field Name</th>
                                                                                <th>Type</th>
                                                                                <th>Default</th>
                                                                                <th>Comment</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {schemaLoading ? (
                                                                                Array.from({ length: 3 }).map(
                                                                                    (_, i) => (
                                                                                        <tr key={i}>
                                                                                            <td>
                                                                                                <div
                                                                                                    className="skeleton"
                                                                                                    style={{
                                                                                                        width: 96,
                                                                                                    }}
                                                                                                ></div>
                                                                                            </td>
                                                                                            <td>
                                                                                                <div
                                                                                                    className="skeleton"
                                                                                                    style={{
                                                                                                        width: 80,
                                                                                                    }}
                                                                                                ></div>
                                                                                            </td>
                                                                                            <td>
                                                                                                <div
                                                                                                    className="skeleton"
                                                                                                    style={{
                                                                                                        width: 64,
                                                                                                    }}
                                                                                                ></div>
                                                                                            </td>
                                                                                            <td>
                                                                                                <div
                                                                                                    className="skeleton"
                                                                                                    style={{
                                                                                                        width: 128,
                                                                                                    }}
                                                                                                ></div>
                                                                                            </td>
                                                                                        </tr>
                                                                                    )
                                                                                )
                                                                            ) : !schema?.length ? (
                                                                                <tr>
                                                                                    <td
                                                                                        colSpan={4}
                                                                                        className="text-center text-text-muted text-sm py-4"
                                                                                    >
                                                                                        No schema data
                                                                                    </td>
                                                                                </tr>
                                                                            ) : (
                                                                                schema.map(f => (
                                                                                    <tr key={f.name}>
                                                                                        <td className="font-mono text-sm font-medium text-text-primary">
                                                                                            {f.name}
                                                                                        </td>
                                                                                        <td className="font-mono text-xs text-info">
                                                                                            {f.type}
                                                                                        </td>
                                                                                        <td className="font-mono text-xs text-text-muted">
                                                                                            {f.default_value || '--'}
                                                                                        </td>
                                                                                        <td className="text-xs text-text-muted">
                                                                                            {f.comment || '--'}
                                                                                        </td>
                                                                                    </tr>
                                                                                ))
                                                                            )}
                                                                        </tbody>
                                                                    </table>
                                                                </div>

                                                                {/* Field statistics */}
                                                                {stats && stats.length > 0 && (
                                                                    <div className="card p-0 overflow-hidden">
                                                                        <div
                                                                            className="px-4 py-3"
                                                                            style={{
                                                                                borderBottom:
                                                                                    '1px solid var(--border-subtle)',
                                                                            }}
                                                                        >
                                                                            <div className="text-sm font-semibold text-text-primary">
                                                                                Field Statistics
                                                                            </div>
                                                                        </div>
                                                                        <table className="table w-full">
                                                                            <thead>
                                                                                <tr>
                                                                                    <th>Field</th>
                                                                                    <th>Type</th>
                                                                                    <th className="text-right">
                                                                                        Cardinality
                                                                                    </th>
                                                                                    <th className="text-right">
                                                                                        Nulls
                                                                                    </th>
                                                                                    <th>Sample Values</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {stats.map(s => (
                                                                                    <tr key={s.name}>
                                                                                        <td className="font-mono text-sm text-text-primary">
                                                                                            {s.name}
                                                                                        </td>
                                                                                        <td className="font-mono text-xs text-info">
                                                                                            {s.type}
                                                                                        </td>
                                                                                        <td className="text-right font-mono text-sm">
                                                                                            {formatNumber(
                                                                                                s.cardinality
                                                                                            )}
                                                                                        </td>
                                                                                        <td className="text-right font-mono text-sm text-text-muted">
                                                                                            {formatNumber(
                                                                                                s.null_count
                                                                                            )}
                                                                                        </td>
                                                                                        <td
                                                                                            className="text-xs text-text-muted truncate"
                                                                                            style={{
                                                                                                maxWidth: 200,
                                                                                            }}
                                                                                        >
                                                                                            {s.sample_values
                                                                                                ?.slice(0, 3)
                                                                                                .join(', ') || '--'}
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {!isLoading && datasets && datasets.length > 0 && (
                            <div className="text-center text-xs text-text-muted">
                                {datasets.length} table{datasets.length !== 1 ? 's' : ''} &bull;{' '}
                                {formatBytes(
                                    datasets.reduce((s, d) => s + d.storage_bytes, 0)
                                )}{' '}
                                total
                                {autoRefresh && (
                                    <span className="ml-2">&bull; Auto-refreshing every 15s</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </>
    )
}
