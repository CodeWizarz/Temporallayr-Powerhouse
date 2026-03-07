import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { api, Trace } from '../api/client'

interface TraceRow {
    id: string
    status: string
    tenant_id: string
    span_count: number
    error_count: number
    duration_ms: number | null
    created_at: string
}

function computeDuration(graph: any): number | null {
    const spans = graph.nodes || graph.spans || []
    const total = spans.reduce((sum: number, s: any) => sum + (s.duration_ms || 0), 0)
    return total > 0 ? total : null
}

function formatDuration(ms: number | null): string {
    if (!ms) return '—'
    if (ms < 1000) return `${Math.round(ms)}ms`
    return `${(ms / 1000).toFixed(2)}s`
}

function formatDate(iso: string): string {
    if (!iso) return '—'
    return new Date(iso).toLocaleString()
}

export default function TracesPage() {
    const [ids, setIds] = useState<string[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(0)
    const [loadingIds, setLoadingIds] = useState(true)
    const [details, setDetails] = useState<Record<string, TraceRow>>({})
    const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({})
    const [searchQuery, setSearchQuery] = useState('')

    const limit = 50

    const fetchPage = useCallback(async (p: number) => {
        setLoadingIds(true)
        try {
            const res = await api.executions.list(limit, p * limit)
            setIds(res.items || [])
            setTotal(res.total || 0)
        } catch (err) {
            console.error(err)
        } finally {
            setLoadingIds(false)
        }
    }, [])

    useEffect(() => {
        fetchPage(page)
    }, [page, fetchPage])

    useEffect(() => {
        if (ids.length === 0) return

        const needed = ids.filter(id => !details[id] && !loadingDetails[id])
        if (needed.length === 0) return

        setLoadingDetails(prev => {
            const next = { ...prev }
            needed.forEach(id => next[id] = true)
            return next
        })

        const fetchDetails = async () => {
            const batchSize = 10
            for (let i = 0; i < needed.length; i += batchSize) {
                const batch = needed.slice(i, i + batchSize)
                await Promise.all(batch.map(async (id) => {
                    try {
                        const trace = await api.executions.get(id) as any
                        const spans = trace.spans || trace.nodes || []
                        const errorCount = spans.filter((s: any) => s.status === 'error').length
                        const status = trace.status || (errorCount > 0 ? 'error' : 'success')

                        const row: TraceRow = {
                            id: trace.trace_id || trace.id || id,
                            status: status,
                            tenant_id: trace.tenant_id || 'unknown',
                            span_count: spans.length,
                            error_count: errorCount,
                            duration_ms: computeDuration(trace),
                            created_at: trace.start_time || trace.created_at || new Date().toISOString()
                        }

                        setDetails(prev => ({ ...prev, [id]: row }))
                    } catch (err) {
                        console.error("Failed to fetch detail for", id, err)
                    } finally {
                        setLoadingDetails(prev => ({ ...prev, [id]: false }))
                    }
                }))
            }
        }

        fetchDetails()
    }, [ids, details, loadingDetails])

    const handleRefresh = () => {
        setDetails({})
        fetchPage(page)
    }

    const filteredIds = ids.filter(id => id.toLowerCase().includes(searchQuery.toLowerCase()))
    const showSkeleton = loadingIds

    return (
        <div className="page-container">
            <div className="page-header page-header-row">
                <div>
                    <h1 className="page-title">Execution Traces</h1>
                    <div className="page-subtitle">{total} executions total</div>
                </div>
                <div className="page-header-actions">
                    <input
                        type="text"
                        placeholder="Search trace ID..."
                        className="input"
                        style={{ width: '250px' }}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button onClick={handleRefresh} className="btn btn-secondary">
                        <svg className="w-4 h-4" style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Refresh
                    </button>
                </div>
            </div>

            <div className="card overflow-hidden" style={{ padding: 0 }}>
                <table className="table">
                    <thead>
                        <tr>
                            <th>Trace ID</th>
                            <th>Status</th>
                            <th>Tenant</th>
                            <th>Spans</th>
                            <th>Errors</th>
                            <th>Duration</th>
                            <th>Started</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {showSkeleton ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i}>
                                    <td><div className="skeleton" style={{ width: '120px' }}></div></td>
                                    <td><div className="skeleton" style={{ width: '60px' }}></div></td>
                                    <td><div className="skeleton" style={{ width: '80px' }}></div></td>
                                    <td><div className="skeleton" style={{ width: '30px' }}></div></td>
                                    <td><div className="skeleton" style={{ width: '30px' }}></div></td>
                                    <td><div className="skeleton" style={{ width: '50px' }}></div></td>
                                    <td><div className="skeleton" style={{ width: '120px' }}></div></td>
                                    <td><div className="skeleton" style={{ width: '40px' }}></div></td>
                                </tr>
                            ))
                        ) : filteredIds.length === 0 ? (
                            <tr>
                                <td colSpan={8}>
                                    <div className="empty-state">
                                        <div className="empty-state-icon">◈</div>
                                        <div className="empty-state-title">No traces found</div>
                                        <div className="empty-state-desc">Waiting for agent executions to be ingested.</div>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredIds.map(id => {
                                const row = details[id]
                                const isRowLoading = loadingDetails[id] && !row

                                if (isRowLoading) {
                                    return (
                                        <tr key={id}>
                                            <td className="mono" title={id}>{id.substring(0, 20)}...</td>
                                            <td colSpan={6}><div className="skeleton" style={{ width: '100%' }}></div></td>
                                            <td></td>
                                        </tr>
                                    )
                                }

                                if (!row) {
                                    return (
                                        <tr key={id}>
                                            <td className="mono" title={id}>{id.substring(0, 20)}...</td>
                                            <td colSpan={6} style={{ color: 'var(--text-muted)' }}>Failed to load</td>
                                            <td></td>
                                        </tr>
                                    )
                                }

                                return (
                                    <tr key={id}>
                                        <td className="mono" title={id}>{id.substring(0, 20)}...</td>
                                        <td>
                                            {row.status === 'success' ? (
                                                <span className="badge badge-success">Success</span>
                                            ) : row.status === 'error' ? (
                                                <span className="badge badge-error">Error</span>
                                            ) : (
                                                <span className="badge badge-warning">{row.status}</span>
                                            )}
                                        </td>
                                        <td>
                                            <span className="badge badge-neutral">{row.tenant_id}</span>
                                        </td>
                                        <td>{row.span_count}</td>
                                        <td style={{ color: row.error_count > 0 ? 'var(--error)' : 'inherit' }}>
                                            {row.error_count}
                                        </td>
                                        <td>{formatDuration(row.duration_ms)}</td>
                                        <td>{formatDate(row.created_at)}</td>
                                        <td>
                                            <Link to={`/traces/${id}`} className="btn btn-ghost btn-sm">
                                                View &rarr;
                                            </Link>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {!showSkeleton && total > 0 && (
                <div className="page-header-row mt-6">
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of {total}
                    </div>
                    <div className="flex-row gap-2">
                        <button
                            className="btn btn-secondary"
                            disabled={page === 0}
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                        >
                            Previous
                        </button>
                        <button
                            className="btn btn-secondary"
                            disabled={(page + 1) * limit >= total}
                            onClick={() => setPage(p => p + 1)}
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
