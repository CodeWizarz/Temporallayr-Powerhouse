import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type Trace, type Span, type ReplayReport } from '../api/client'

const fmtDur = (s: string, e: string | null) => {
    if (!e) return '—'
    const ms = new Date(e).getTime() - new Date(s).getTime()
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
}

const fmtTime = (t: string) => {
    if (!t) return '—'
    return new Date(t).toLocaleString()
}

// Tree logic
function buildTree(spans: Span[]): Array<{ span: Span, depth: number }> {
    const list: Array<{ span: Span, depth: number }> = []

    // Sort all spans by start_time
    const sorted = [...spans].sort((a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    )

    // Group by parent
    const byParent = new Map<string | null, Span[]>()
    byParent.set(null, [])

    for (const span of sorted) {
        if (!byParent.has(span.parent_span_id)) {
            byParent.set(span.parent_span_id, [])
        }
        byParent.get(span.parent_span_id)!.push(span)
    }

    // Recursive append
    function appendChildren(parentId: string | null, depth: number) {
        const children = byParent.get(parentId) || []
        for (const child of children) {
            list.push({ span: child, depth })
            appendChildren(child.span_id, depth + 1)
        }
    }

    // Start with roots (nodes whose parent_span_id is null, or points to a non-existent span)
    const validSpanIds = new Set(spans.map(s => s.span_id))
    const roots = sorted.filter(s => !s.parent_span_id || !validSpanIds.has(s.parent_span_id))

    for (const root of roots) {
        list.push({ span: root, depth: 0 })
        appendChildren(root.span_id, 1)
    }

    return list
}

export default function TraceDetailPage() {
    const { traceId } = useParams<{ traceId: string }>()
    const nav = useNavigate()
    const [trace, setTrace] = useState<Trace | null>(null)
    const [loading, setLoading] = useState(true)
    const [expanded, setExpanded] = useState<Set<string>>(new Set())

    const [replaying, setReplaying] = useState(false)
    const [replay, setReplay] = useState<ReplayReport | null>(null)
    const [replayErr, setReplayErr] = useState<string | null>(null)

    const [copied, setCopied] = useState(false)

    useEffect(() => {
        if (!traceId) return
        setLoading(true)
        api.executions.get(traceId)
            .then(t => { setTrace(t); setLoading(false) })
            .catch(() => setLoading(false))
    }, [traceId])

    const toggleSpan = (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setExpanded(prev => {
            const n = new Set(prev)
            n.has(id) ? n.delete(id) : n.add(id)
            return n
        })
    }

    const handleCopy = () => {
        if (traceId) {
            navigator.clipboard.writeText(traceId)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const runReplay = async () => {
        if (!traceId) return
        setReplaying(true)
        setReplay(null)
        setReplayErr(null)
        try {
            const r = await api.executions.replay(traceId)
            setReplay(r)
        } catch (e: any) {
            setReplayErr(e.message)
        } finally {
            setReplaying(false)
        }
    }

    if (loading) {
        return (
            <div className="p-8 text-center">
                <div className="loading-spinner"></div>
                <div className="text-text-muted text-sm mt-4">Loading execution graph...</div>
            </div>
        )
    }

    if (!trace) {
        return (
            <div className="p-8 text-center">
                <div className="empty-state">
                    <div className="empty-state-icon text-error">⚠</div>
                    <div className="empty-state-title">Trace not found</div>
                    <div className="empty-state-desc text-text-muted">The execution graph you are looking for does not exist or you lack correct permissions.</div>
                </div>
            </div>
        )
    }

    const spans = trace.spans || (trace as any).nodes || []
    const tree = buildTree(spans)
    const hasErr = spans.some((s: Span) => s.status === 'error')
    const errCount = spans.filter((s: Span) => s.status === 'error').length
    const dur = fmtDur(trace.start_time, trace.end_time || spans[spans.length - 1]?.end_time)

    return (
        <div className="max-w-[1200px] mx-auto pb-12">
            {/* 1. HEADER */}
            <div className="mb-6">
                <button
                    onClick={() => nav('/traces')}
                    className="btn btn-ghost !px-0 !py-1 text-sm text-text-secondary hover:text-white mb-4"
                >
                    <svg className="w-4 h-4 mr-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    Back to Traces
                </button>

                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-text-primary m-0">Trace Detail</h1>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="font-mono text-sm px-2 py-0.5 bg-bg-elevated border border-border rounded text-text-secondary select-all">
                                {trace.trace_id || traceId}
                            </span>
                            <button
                                onClick={handleCopy}
                                className="p-1 hover:bg-bg-hover text-text-muted hover:text-text-primary rounded transition-colors border border-transparent hover:border-border"
                                title="Copy ID"
                            >
                                {copied ? (
                                    <svg className="w-3.5 h-3.5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                ) : (
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                )}
                            </button>
                        </div>
                    </div>
                    <button
                        className="btn btn-primary shadow-[0_0_15px_rgba(250,204,21,0.15)] hover:shadow-[0_0_20px_rgba(250,204,21,0.3)] !px-5"
                        onClick={runReplay}
                        disabled={replaying}
                    >
                        {replaying ? (
                            <><span className="loading-spinner w-3.5 h-3.5 !border-black !border-t-transparent mr-2" />Replaying...</>
                        ) : (
                            <>▷ Run Replay</>
                        )}
                    </button>
                </div>
            </div>

            {/* 2. SUMMARY CARD */}
            <div className="card mb-6">
                <div className="grid grid-cols-4 gap-6">
                    <div>
                        <div className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-2">Status</div>
                        <div className="font-medium text-lg text-text-primary">
                            <span className={`badge ${hasErr ? 'badge-error' : 'badge-success'} !text-xs !py-1 !px-2.5`}>
                                {hasErr ? 'Error' : 'Success'}
                            </span>
                        </div>
                    </div>
                    <div>
                        <div className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-2">Tenant ID</div>
                        <div className="font-medium text-[15px] text-text-primary mt-1">
                            <span className="badge badge-neutral !font-mono !text-[11px]">{trace.tenant_id}</span>
                        </div>
                    </div>
                    <div>
                        <div className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-2">Duration</div>
                        <div className="font-medium text-[15px] text-text-primary mt-1">{dur}</div>
                    </div>
                    <div>
                        <div className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-2">Spans</div>
                        <div className="font-medium text-[15px] text-text-primary mt-1">
                            {spans.length}
                            {errCount > 0 && <span className="text-error text-xs ml-2 font-semibold">({errCount} errors)</span>}
                        </div>
                    </div>
                </div>
                <div className="mt-5 pt-5 border-t border-border-subtle flex gap-6 text-xs text-text-secondary">
                    <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Started: <span className="text-text-primary">{fmtTime(trace.start_time)}</span>
                    </span>
                    {trace.end_time && (
                        <span className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            Ended: <span className="text-text-primary">{fmtTime(trace.end_time)}</span>
                        </span>
                    )}
                </div>
            </div>

            {/* 4. REPLAY SECTION */}
            {(replay || replayErr) && (
                <div className={`card mb-6 border-l-4 ${replayErr ? 'border-l-error' : (replay?.is_deterministic ? 'border-l-success' : 'border-l-warning')} shadow-lg bg-bg-elevated relative overflow-hidden animate-in fade-in slide-in-from-top-4`}>
                    <div className="card-header mb-4">
                        <h3 className="font-bold text-sm tracking-wide text-text-primary uppercase m-0 flex items-center">
                            <svg className="w-4 h-4 mr-2 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            Replay Execution Report
                        </h3>
                    </div>

                    {replayErr ? (
                        <div className="error-banner mb-0">
                            <strong>Execution Failed:</strong> {replayErr}
                        </div>
                    ) : replay ? (
                        <>
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="p-3 bg-bg-surface border border-border rounded-lg">
                                    <div className="text-[11px] text-text-muted uppercase font-bold tracking-wider mb-2">Deterministic</div>
                                    <span className={`badge ${replay.is_deterministic ? 'badge-success' : 'badge-error'} !text-sm !py-1 !px-3`}>
                                        {replay.is_deterministic ? 'YES' : 'NO'}
                                    </span>
                                </div>
                                <div className="p-3 bg-bg-surface border border-border rounded-lg">
                                    <div className="text-[11px] text-text-muted uppercase font-bold tracking-wider mb-1.5">Spans Replayed</div>
                                    <div className="text-lg font-bold text-text-primary">{replay.nodes_replayed} <span className="text-text-muted text-sm font-medium">/ {replay.total_nodes}</span></div>
                                </div>
                                <div className="p-3 bg-bg-surface border border-border rounded-lg">
                                    <div className="text-[11px] text-text-muted uppercase font-bold tracking-wider mb-1.5">Divergences Found</div>
                                    <div className={`text-lg font-bold ${replay.divergences_found > 0 ? 'text-error' : 'text-success'}`}>{replay.divergences_found}</div>
                                </div>
                            </div>

                            {replay.results.filter(r => !r.success).length > 0 && (
                                <div className="mt-4">
                                    <h4 className="text-xs font-bold text-text-secondary uppercase mb-3 border-b border-border-subtle pb-2">Divergence List</h4>
                                    <div className="space-y-2">
                                        {replay.results.filter(r => !r.success).map(r => (
                                            <div key={r.node_id} className="bg-error-dim border border-error/20 p-3 rounded-md flex items-start gap-3">
                                                <div className="mt-0.5 text-error">
                                                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <span className="font-mono text-[11px] bg-black/40 px-1.5 py-0.5 rounded text-error border border-error/30">{r.node_id.slice(0, 8)}...</span>
                                                        <span className="badge badge-warning !text-[10px] !py-0.5" title={r.divergence_type === 'error_mismatch' ? "Re-execution produced a different error than the original run" : ""}>
                                                            {r.divergence_type || 'unknown'}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-text-primary m-0 font-medium">{r.divergence_details}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : null}
                </div>
            )}

            {/* 3. EXECUTION SPANS */}
            <div className="card !p-0 overflow-hidden border border-border-subtle shadow-md">
                <div className="bg-bg-elevated px-4 py-3 border-b border-border-subtle flex justify-between items-center">
                    <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide m-0">Execution DAG Graph</h3>
                    <span className="text-xs text-text-muted font-medium bg-black/30 px-2 py-1 rounded-md border border-border-subtle">{spans.length} total spans</span>
                </div>

                <div className="bg-bg-surface">
                    {tree.map(({ span, depth }, index) => {
                        const isExpanded = expanded.has(span.span_id)
                        const isError = span.status === 'error'
                        // Basic attribute parsing loop
                        const attrs = span.attributes || {}
                        const inputsRaw = attrs.inputs || {}
                        const outputsRaw = attrs.outputs || {}
                        const inputStr = Object.keys(inputsRaw).length ? JSON.stringify(inputsRaw, null, 2) : ''
                        const outputStr = Object.keys(outputsRaw).length ? JSON.stringify(outputsRaw, null, 2) : ''

                        return (
                            <div key={span.span_id} className={`${index !== tree.length - 1 ? 'border-b border-border-subtle' : ''}`}>
                                {/* Row */}
                                <div
                                    className={`
                                        flex items-center w-full py-2.5 pr-4 text-xs cursor-pointer transition-colors
                                        ${isError ? 'hover:bg-error-dim bg-error/5' : 'hover:bg-bg-hover'}
                                    `}
                                    style={{ paddingLeft: `${16 + depth * 24}px` }}
                                    onClick={(e) => toggleSpan(span.span_id, e)}
                                >
                                    <div className="flex items-center justify-center w-5 h-5 mr-1.5 text-text-muted shrink-0">
                                        <svg
                                            className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-accent' : ''}`}
                                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>

                                    <div className="flex-1 flex items-center min-w-0 pr-4">
                                        <span className="font-mono font-semibold text-[13px] text-text-primary truncate">
                                            {span.name}
                                        </span>
                                        {!!attrs.type && (
                                            <span className="badge badge-neutral !font-mono !text-[10px] !font-medium ml-3 shrink-0">
                                                {String(attrs.type).toUpperCase()}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-4 shrink-0">
                                        <div className="w-[60px] text-right font-mono text-text-secondary text-[11px]">
                                            {fmtDur(span.start_time, span.end_time)}
                                        </div>
                                        <div className="w-[65px] text-right">
                                            <span className={`badge ${isError ? 'badge-error' : 'badge-success'} !text-[10px]`}>
                                                {isError ? 'ERROR' : 'OK'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded content */}
                                {isExpanded && (
                                    <div className="bg-[#08080A] border-y border-border-subtle p-0 text-[12px] font-mono leading-relaxed" style={{ paddingLeft: `${40 + depth * 24}px` }}>
                                        <div className="py-4 pr-6">

                                            {/* Span identifier */}
                                            <div className="mb-4 text-[#555] text-[10px] select-all flex items-center gap-2">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                                span_id: {span.span_id}
                                            </div>

                                            {span.error && (
                                                <div className="mb-4 bg-error-dim border border-error/20 p-3 rounded-md">
                                                    <div className="text-[10px] font-bold text-error uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                        Exception
                                                    </div>
                                                    <div className="text-red-300 font-medium whitespace-pre-wrap">{span.error}</div>
                                                </div>
                                            )}

                                            {inputStr && (
                                                <div className="mb-4">
                                                    <div className="text-[10px] font-bold text-info uppercase tracking-wider mb-1 px-1">Inputs</div>
                                                    <div className="bg-bg-elevated/50 border border-border rounded p-3 text-zinc-300 whitespace-pre-wrap">
                                                        {inputStr}
                                                    </div>
                                                </div>
                                            )}

                                            {outputStr && (
                                                <div className="mb-4">
                                                    <div className="text-[10px] font-bold text-success uppercase tracking-wider mb-1 px-1">Outputs</div>
                                                    <div className="bg-bg-elevated/50 border border-border rounded p-3 text-zinc-300 whitespace-pre-wrap">
                                                        {outputStr}
                                                    </div>
                                                </div>
                                            )}

                                            {!inputStr && !outputStr && !span.error && (
                                                <div className="mb-4">
                                                    <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1 px-1">Attributes</div>
                                                    <div className="bg-bg-elevated/50 border border-border rounded p-3 text-zinc-400 whitespace-pre-wrap overflow-x-auto">
                                                        {JSON.stringify(attrs, null, 2)}
                                                    </div>
                                                </div>
                                            )}

                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

        </div>
    )
}
