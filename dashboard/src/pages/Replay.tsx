import { useState } from 'react'
import { api, type ReplayReport } from '../api/client'

type Tab = 'replay' | 'diff'

export default function ReplayPage() {
    const [tab, setTab] = useState<Tab>('replay')
    const [traceId, setTraceId] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [report, setReport] = useState<ReplayReport | null>(null)
    const [diffA, setDiffA] = useState('')
    const [diffB, setDiffB] = useState('')
    const [diffResult, setDiffResult] = useState<Record<string, unknown[]> | null>(null)
    const [diffLoading, setDiffLoading] = useState(false)

    const runReplay = async () => {
        if (!traceId.trim()) return
        setLoading(true); setError(null); setReport(null)
        try { setReport(await api.executions.replay(traceId.trim())) }
        catch (e: any) { setError(e.message) }
        finally { setLoading(false) }
    }

    const runDiff = async () => {
        if (!diffA.trim() || !diffB.trim()) return
        setDiffLoading(true); setError(null); setDiffResult(null)
        try { setDiffResult(await api.executions.diff(diffA.trim(), diffB.trim()) as any) }
        catch (e: any) { setError(e.message) }
        finally { setDiffLoading(false) }
    }

    return (
        <div className="text-text-primary pb-16 animate-in fade-in duration-500 max-w-[1000px] mx-auto">
            <h1 className="text-xl font-bold text-accent mb-2">Replay & Diff</h1>
            <div className="text-xs text-text-secondary mb-6">Deterministic execution replay and structural comparison</div>

            <div className="bg-[#0d1a0d] border border-[#1a3a1a] rounded-lg p-3.5 text-xs text-[#4caf6e] mb-5">
                ▶ <strong>Replay</strong> re-executes a captured trace and checks for divergences — non-determinism in your agent will show up as mismatches. <strong>Diff</strong> compares two trace executions node-by-node to identify structural or output changes.
            </div>

            <div className="flex gap-1 mb-5">
                {(['replay', 'diff'] as Tab[]).map(t => (
                    <button
                        key={t}
                        className={`px-4 py-2 rounded-md text-xs font-medium capitalize transition-colors ${tab === t ? 'bg-accent text-black' : 'bg-bg-elevated text-text-muted hover:text-text-primary'}`}
                        onClick={() => setTab(t)}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {error && <div className="text-error bg-[#1a0808] border border-[#3a1010] rounded-lg p-3.5 mb-4 text-sm font-medium">⚠ {error}</div>}

            {tab === 'replay' && (
                <>
                    <div className="card mb-5">
                        <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">Replay Execution</h3>
                        <div className="text-xs text-text-secondary mb-1.5 font-medium">Trace ID</div>
                        <div className="flex gap-3">
                            <input
                                className="input flex-1"
                                placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                                value={traceId}
                                onChange={e => setTraceId(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && runReplay()}
                            />
                            <button className="btn btn-primary px-5" disabled={loading || !traceId.trim()} onClick={runReplay}>
                                {loading ? '⏳ Replaying…' : '▶ Run Replay'}
                            </button>
                        </div>
                    </div>

                    {report && (
                        <div className="card shadow-lg bg-bg-surface border-border-subtle">
                            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">Replay Report</h3>
                            <div className="grid grid-cols-4 gap-4 mb-5">
                                <div>
                                    <div className="text-[11px] text-text-muted mb-1 font-medium">Deterministic</div>
                                    <div><span className={`badge ${report.is_deterministic ? 'badge-success' : 'badge-error'} !py-0.5 !px-2.5`}>{report.is_deterministic ? '✓ YES' : '✗ NO'}</span></div>
                                </div>
                                <div>
                                    <div className="text-[11px] text-text-muted mb-1 font-medium">Spans Replayed</div>
                                    <div className="text-text-primary font-semibold text-base">{report.nodes_replayed} / {report.total_nodes}</div>
                                </div>
                                <div>
                                    <div className="text-[11px] text-text-muted mb-1 font-medium">Divergences</div>
                                    <div className={`font-semibold text-base ${report.divergences_found > 0 ? 'text-error' : 'text-success'}`}>{report.divergences_found}</div>
                                </div>
                                <div>
                                    <div className="text-[11px] text-text-muted mb-1 font-medium">Trace ID</div>
                                    <div className="text-xs font-mono text-text-secondary mt-1">{report.graph_id.slice(0, 12)}…</div>
                                </div>
                            </div>
                            {report.divergences_found > 0 && (
                                <div>
                                    <div className="text-xs text-text-muted mb-2.5 font-medium">Divergences detected:</div>
                                    {report.results.filter(r => !r.success).map(r => (
                                        <div key={r.node_id} className="bg-[#1a0808] border border-[#3a1010] rounded-md p-2.5 text-xs text-error font-mono mb-2">
                                            ⚠ <strong>Node {r.node_id.slice(0, 8)}</strong>
                                            {r.divergence_type && <span className="text-accent"> [{r.divergence_type}]</span>}
                                            {r.divergence_details && <span className="text-text-primary"> — {r.divergence_details}</span>}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {report.divergences_found === 0 && (
                                <div className="text-success text-sm font-medium bg-success-dim border border-success/20 p-3 rounded-lg">✓ Execution is deterministic — all {report.nodes_replayed} spans matched exactly.</div>
                            )}
                        </div>
                    )}
                </>
            )}

            {tab === 'diff' && (
                <>
                    <div className="card mb-5">
                        <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">Compare Two Traces</h3>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <div className="text-xs text-text-secondary mb-1.5 font-medium">Trace A (baseline)</div>
                                <input className="input w-full" placeholder="Trace ID A" value={diffA} onChange={e => setDiffA(e.target.value)} />
                            </div>
                            <div>
                                <div className="text-xs text-text-secondary mb-1.5 font-medium">Trace B (comparison)</div>
                                <input className="input w-full" placeholder="Trace ID B" value={diffB} onChange={e => setDiffB(e.target.value)} />
                            </div>
                        </div>
                        <button className="btn btn-primary px-5" disabled={diffLoading || !diffA.trim() || !diffB.trim()} onClick={runDiff}>
                            {diffLoading ? '⏳ Comparing…' : '⬡ Run Diff'}
                        </button>
                    </div>

                    {diffResult && (
                        <div className="card shadow-lg bg-bg-surface border-border-subtle">
                            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">Diff Results</h3>
                            {Object.entries(diffResult).map(([key, items]) => (
                                items && (items as any[]).length > 0 && (
                                    <div key={key} className="mt-5">
                                        <div className="text-xs text-accent mb-2 capitalize font-bold">{key.replace(/_/g, ' ')} ({(items as any[]).length})</div>
                                        {(items as any[]).map((item, i) => (
                                            <div key={i} className="bg-bg-elevated border border-border rounded-md px-3 py-2 mb-1.5 text-[11px] font-mono text-text-secondary whitespace-pre-wrap">
                                                {typeof item === 'string' ? item : JSON.stringify(item, null, 2)}
                                            </div>
                                        ))}
                                    </div>
                                )
                            ))}
                            {Object.values(diffResult).every(v => !(v as any[]).length) && (
                                <div className="text-success text-sm font-medium bg-success-dim border border-success/20 p-3 rounded-lg">✓ No differences found — traces are structurally identical.</div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
