import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { api, LatencyRow } from '../api/client'

const TIME_FILTERS = [
    { label: '1h', hours: 1 },
    { label: '6h', hours: 6 },
    { label: '24h', hours: 24 },
    { label: '7d', hours: 168 }
]

function formatDuration(ms: number | undefined | null): string {
    if (ms === undefined || ms === null) return '—'
    if (ms < 1000) return `${Math.round(ms)}ms`
    return `${(ms / 1000).toFixed(2)}s`
}

export default function AnalyticsPage() {
    const [hours, setHours] = useState<number>(24)
    const [data, setData] = useState<LatencyRow[]>([])
    const [loading, setLoading] = useState<boolean>(true)
    const [errorStyle, setErrorStyle] = useState<'none' | '503' | 'general'>('none')
    const [errMsg, setErrMsg] = useState<string>('')

    useEffect(() => {
        let isMounted = true
        setLoading(true)
        setErrorStyle('none')

        api.analytics.latency(hours)
            .then(res => {
                if (isMounted) {
                    setData(res.items || [])
                    setLoading(false)
                }
            })
            .catch(err => {
                if (isMounted) {
                    const msg = err.message || ''
                    if (msg.includes('503') || msg.toLowerCase().includes('clickhouse')) {
                        setErrorStyle('503')
                        setErrMsg('ClickHouse not connected — analytics unavailable')
                    } else {
                        setErrorStyle('general')
                        setErrMsg(msg || 'Failed to load analytics data')
                    }
                    setData([])
                    setLoading(false)
                }
            })

        return () => { isMounted = false }
    }, [hours])

    const stats = useMemo(() => {
        if (!data.length) return { totalCalls: 0, totalErrors: 0, avgErrorRate: 0, maxP99: 0 }

        let totalCalls = 0
        let totalErrors = 0
        let totalWeightedErrorRate = 0
        let maxP99 = 0

        for (const row of data) {
            totalCalls += row.call_count || 0
            totalErrors += row.error_count || 0
            totalWeightedErrorRate += (row.error_rate_pct || 0) * (row.call_count || 0)
            if ((row.p99_ms || 0) > maxP99) {
                maxP99 = row.p99_ms
            }
        }

        const avgErrorRate = totalCalls > 0 ? totalWeightedErrorRate / totalCalls : 0

        return { totalCalls, totalErrors, avgErrorRate, maxP99 }
    }, [data])

    const renderLatencyProfile = (row: LatencyRow, maxP99Global: number) => {
        const MAX_WIDTH = 160
        if (maxP99Global === 0) return <div style={{ width: MAX_WIDTH, height: 8, background: 'var(--bg-elevated)', borderRadius: 4 }} />

        const scale = MAX_WIDTH / maxP99Global
        const w50 = (row.p50_ms || 0) * scale
        const w95 = Math.max(0, ((row.p95_ms || 0) - (row.p50_ms || 0)) * scale)
        const w99 = Math.max(0, ((row.p99_ms || 0) - (row.p95_ms || 0)) * scale)

        return (
            <div style={{ display: 'flex', width: MAX_WIDTH, height: 6, borderRadius: 3, overflow: 'hidden', background: 'var(--bg-elevated)' }}>
                {w50 > 0 && <div style={{ width: w50, background: 'var(--success)' }} title={`P50: ${formatDuration(row.p50_ms)}`} />}
                {w95 > 0 && <div style={{ width: w95, background: 'var(--warning)' }} title={`P95: ${formatDuration(row.p95_ms)}`} />}
                {w99 > 0 && <div style={{ width: w99, background: 'var(--error)' }} title={`P99: ${formatDuration(row.p99_ms)}`} />}
            </div>
        )
    }

    const getP99Color = (ms: number) => {
        if (ms < 100) return 'var(--success)'
        if (ms <= 500) return 'var(--warning)'
        return 'var(--error)'
    }

    return (
        <>
            <div className="ch-sidebar-context">
                <div className="ch-context-header">
                    <div className="ch-context-tab active">Dashboards</div>
                </div>
                <div className="ch-context-content">
                    <button className="ch-btn-yellow mb-6">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        New Dashboard
                    </button>
                    <div className="border border-border-subtle rounded px-2 py-1.5 flex items-center gap-2 mb-4 bg-black/20 focus-within:border-text-muted transition-colors">
                        <svg className="w-3.5 h-3.5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input
                            type="text"
                            placeholder="Search dashboards..."
                            className="bg-transparent border-none text-[13px] text-white w-full focus:outline-none placeholder:text-text-muted"
                        />
                    </div>
                    <div className="text-[13px] text-text-primary px-1 hover:bg-white/5 py-1.5 rounded cursor-pointer">Default Analytics</div>
                    <div className="text-[13px] text-text-muted px-1 mt-2">No custom dashboards</div>
                </div>
            </div>

            <main className="ch-workspace bg-bg-base">
                <header className="ch-topbar">
                    <div className="ch-topbar-title flex flex-col justify-center">
                        <div className="text-[14px] text-text-primary font-bold">
                            Performance Analytics
                        </div>
                    </div>
                    <div className="ch-topbar-actions bg-bg-surface border border-border-subtle rounded-md p-1">
                        {TIME_FILTERS.map(f => (
                            <button
                                key={f.hours}
                                onClick={() => setHours(f.hours)}
                                className={`px-3 py-1 text-[13px] font-medium rounded transition-colors ${hours === f.hours ? 'bg-bg-elevated text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </header>

                <div className="ch-workspace-scroll">
                    <div className="p-8 max-w-6xl mx-auto space-y-6">
                        {/* Error States */}
                        {errorStyle === '503' && (
                            <div className="error-banner flex-row justify-between items-center bg-red-900/20 border border-red-900/50 p-4 rounded text-error">
                                <div className="flex-row items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    <strong className="text-sm">{errMsg}</strong>
                                </div>
                                <Link to="/status" className="px-3 py-1.5 bg-black/40 hover:bg-black/60 border border-error/20 rounded text-xs transition-colors">Check System Status →</Link>
                            </div>
                        )}

                        {errorStyle === 'general' && (
                            <div className="error-banner bg-red-900/20 border border-red-900/50 p-4 rounded text-error flex items-center">
                                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <strong className="text-sm mr-2">Error:</strong> <span className="text-[13px]">{errMsg}</span>
                            </div>
                        )}

                        {/* 2. STAT CARDS ROW */}
                        <div className="grid grid-cols-4 gap-4">
                            <div className="bg-[#18181A] border border-border-subtle rounded p-5 flex flex-col gap-1">
                                <div className="text-2xl font-bold font-mono tracking-tight text-text-primary">{stats.totalCalls.toLocaleString()}</div>
                                <div className="text-[13px] text-text-muted flex items-center gap-2 font-medium">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                                    Total Calls
                                </div>
                            </div>
                            <div className="bg-[#18181A] border border-border-subtle rounded p-5 flex flex-col gap-1">
                                <div className={`text-2xl font-bold font-mono tracking-tight ${stats.totalErrors > 0 ? 'text-error' : 'text-text-primary'}`}>{stats.totalErrors.toLocaleString()}</div>
                                <div className="text-[13px] text-text-muted flex items-center gap-2 font-medium">
                                    <svg className="w-3.5 h-3.5 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    Total Errors
                                </div>
                            </div>
                            <div className="bg-[#18181A] border border-border-subtle rounded p-5 flex flex-col gap-1">
                                <div className={`text-2xl font-bold font-mono tracking-tight ${stats.avgErrorRate > 0 ? 'text-warning' : 'text-success'}`}>{stats.avgErrorRate.toFixed(1)}%</div>
                                <div className="text-[13px] text-text-muted flex items-center gap-2 font-medium">
                                    <svg className="w-3.5 h-3.5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
                                    Avg Error Rate
                                </div>
                            </div>
                            <div className="bg-[#18181A] border border-border-subtle rounded p-5 flex flex-col gap-1">
                                <div className="text-2xl font-bold font-mono tracking-tight" style={{ color: getP99Color(stats.maxP99) }}>{formatDuration(stats.maxP99)}</div>
                                <div className="text-[13px] text-text-muted flex items-center gap-2 font-medium">
                                    <svg className="w-3.5 h-3.5 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Max P99 Latency
                                </div>
                            </div>
                        </div>

                        {/* 3. LATENCY TABLE */}
                        <div className="bg-[#18181A] border border-border-subtle rounded overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="table w-full whitespace-nowrap">
                                    <thead>
                                        <tr>
                                            <th>Span Name</th>
                                            <th className="text-right">Calls</th>
                                            <th className="text-right">Errors</th>
                                            <th className="text-right text-success">P50</th>
                                            <th className="text-right text-warning">P95</th>
                                            <th className="text-right text-error">P99</th>
                                            <th className="text-right">Avg</th>
                                            <th style={{ width: 180 }}>Latency Profile</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            Array.from({ length: 4 }).map((_, i) => (
                                                <tr key={i}>
                                                    <td><div className="skeleton w-32"></div></td>
                                                    <td><div className="skeleton w-12 ml-auto"></div></td>
                                                    <td><div className="skeleton w-12 ml-auto"></div></td>
                                                    <td><div className="skeleton w-16 ml-auto"></div></td>
                                                    <td><div className="skeleton w-16 ml-auto"></div></td>
                                                    <td><div className="skeleton w-16 ml-auto"></div></td>
                                                    <td><div className="skeleton w-16 ml-auto"></div></td>
                                                    <td><div className="skeleton w-40"></div></td>
                                                </tr>
                                            ))
                                        ) : data.length === 0 ? (
                                            <tr>
                                                <td colSpan={8}>
                                                    <div className="flex flex-col items-center justify-center py-20 text-center">
                                                        <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-text-muted mb-4 text-xl">◈</div>
                                                        <div className="text-[15px] font-semibold text-text-primary mb-1">No analytics data yet</div>
                                                        <div className="text-[13px] text-text-secondary mb-4">Send traces to populate this view.</div>
                                                        <code className="bg-black/30 border border-border px-4 py-2 rounded text-[11px] text-text-secondary font-mono">
                                                            python scripts/send_test_traces.py
                                                        </code>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            data.map(row => (
                                                <tr key={row.name}>
                                                    <td className="font-mono text-[13px] font-semibold text-text-primary">{row.name}</td>
                                                    <td className="text-right text-[13px]">{row.call_count.toLocaleString()}</td>
                                                    <td className={`text-right text-[13px] ${row.error_count > 0 ? 'text-error font-medium' : 'text-text-muted'}`}>{row.error_count.toLocaleString()}</td>
                                                    <td className="text-right text-text-secondary font-mono text-[11px]">{formatDuration(row.p50_ms)}</td>
                                                    <td className="text-right text-text-secondary font-mono text-[11px]">{formatDuration(row.p95_ms)}</td>
                                                    <td className="text-right font-mono text-[11px] font-medium" style={{ color: getP99Color(row.p99_ms || 0) }}>{formatDuration(row.p99_ms)}</td>
                                                    <td className="text-right text-text-secondary font-mono text-[11px]">{formatDuration(row.avg_ms)}</td>
                                                    <td>
                                                        {renderLatencyProfile(row, stats.maxP99)}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {!loading && data.length > 0 && (
                            <div className="text-center text-[11px] text-text-muted">
                                Displaying Top {data.length} Spans • Ordered by P99 Latency Descending
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </>
    )
}

