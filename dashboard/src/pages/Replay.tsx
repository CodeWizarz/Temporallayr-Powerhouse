import { useState } from 'react'
import { api, type ReplayReport } from '../api/client'
import styled from 'styled-components'

const Page = styled.div`color:#e0e0e0;`
const PageTitle = styled.h1`font-size:20px;font-weight:600;color:#facc15;margin:0 0 8px;`
const Card = styled.div`background:#111;border:1px solid #1e1e1e;border-radius:10px;padding:20px;margin-bottom:20px;`
const CardTitle = styled.h3`font-size:13px;color:#555;margin:0 0 16px;text-transform:uppercase;letter-spacing:.05em;`
const Label = styled.div`font-size:12px;color:#666;margin-bottom:6px;`
const Input = styled.input`background:#0d0d0d;border:1px solid #222;border-radius:6px;padding:9px 14px;color:#e0e0e0;font-size:13px;font-family:monospace;outline:none;width:100%;box-sizing:border-box;&:focus{border-color:#facc15;}&::placeholder{color:#333;}`
const Btn = styled.button<{$primary?:boolean}>`padding:9px 18px;border-radius:6px;font-size:13px;cursor:pointer;border:none;transition:all .15s;background:${p=>p.$primary?'#facc15':'#1a1a1a'};color:${p=>p.$primary?'#000':'#888'};&:hover{opacity:.85;}&:disabled{opacity:.4;cursor:default;}`
const Badge = styled.span<{$v:'success'|'error'}>`display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500;background:${p=>p.$v==='success'?'#0d2a1a':'#2a0d0d'};color:${p=>p.$v==='success'?'#4caf6e':'#e55'};`
const Meta = styled.div`display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px;`
const MetaItem = styled.div``
const MetaLabel = styled.div`font-size:11px;color:#555;margin-bottom:4px;`
const MetaValue = styled.div`font-size:16px;font-weight:600;`
const DivRow = styled.div`background:#1a0808;border:1px solid #3a1010;border-radius:6px;padding:10px 14px;font-size:12px;color:#e88;font-family:monospace;margin-bottom:8px;`
const Err = styled.div`color:#e55;background:#1a0808;border:1px solid #3a1010;border-radius:8px;padding:14px;margin-bottom:16px;`
const InfoBox = styled.div`background:#0d1a0d;border:1px solid #1a3a1a;border-radius:8px;padding:14px;font-size:12px;color:#4caf6e;margin-bottom:20px;`
const DiffSection = styled.div`margin-top:20px;`
const DiffInput = styled.div`display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;`

type Tab = 'replay' | 'diff'

export default function ReplayPage() {
    const [tab, setTab] = useState<Tab>('replay')
    const [traceId, setTraceId] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string|null>(null)
    const [report, setReport] = useState<ReplayReport|null>(null)
    const [diffA, setDiffA] = useState('')
    const [diffB, setDiffB] = useState('')
    const [diffResult, setDiffResult] = useState<Record<string,unknown[]>|null>(null)
    const [diffLoading, setDiffLoading] = useState(false)

    const runReplay = async () => {
        if (!traceId.trim()) return
        setLoading(true); setError(null); setReport(null)
        try { setReport(await api.executions.replay(traceId.trim())) }
        catch(e:any) { setError(e.message) }
        finally { setLoading(false) }
    }

    const runDiff = async () => {
        if (!diffA.trim() || !diffB.trim()) return
        setDiffLoading(true); setError(null); setDiffResult(null)
        try { setDiffResult(await api.executions.diff(diffA.trim(), diffB.trim()) as any) }
        catch(e:any) { setError(e.message) }
        finally { setDiffLoading(false) }
    }

    return (
        <Page>
            <PageTitle>Replay & Diff</PageTitle>
            <div style={{color:'#555',fontSize:12,marginBottom:24}}>Deterministic execution replay and structural comparison</div>

            <InfoBox>
                ▶ <strong>Replay</strong> re-executes a captured trace and checks for divergences — non-determinism in your agent will show up as mismatches. <strong>Diff</strong> compares two trace executions node-by-node to identify structural or output changes.
            </InfoBox>

            <div style={{display:'flex',gap:4,marginBottom:20}}>
                {(['replay','diff'] as Tab[]).map(t=>(
                    <Btn key={t} $primary={tab===t} onClick={()=>setTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</Btn>
                ))}
            </div>

            {error && <Err>⚠ {error}</Err>}

            {tab==='replay' && (
                <>
                    <Card>
                        <CardTitle>Replay Execution</CardTitle>
                        <Label>Trace ID</Label>
                        <div style={{display:'flex',gap:12,marginBottom:0}}>
                            <Input
                                placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                                value={traceId}
                                onChange={e=>setTraceId(e.target.value)}
                                onKeyDown={e=>e.key==='Enter'&&runReplay()}
                            />
                            <Btn $primary disabled={loading||!traceId.trim()} onClick={runReplay}>
                                {loading?'⏳ Replaying…':'▶ Run Replay'}
                            </Btn>
                        </div>
                    </Card>

                    {report && (
                        <Card>
                            <CardTitle>Replay Report</CardTitle>
                            <Meta>
                                <MetaItem>
                                    <MetaLabel>Deterministic</MetaLabel>
                                    <MetaValue><Badge $v={report.is_deterministic?'success':'error'}>{report.is_deterministic?'✓ YES':'✗ NO'}</Badge></MetaValue>
                                </MetaItem>
                                <MetaItem>
                                    <MetaLabel>Spans Replayed</MetaLabel>
                                    <MetaValue style={{color:'#e0e0e0'}}>{report.nodes_replayed} / {report.total_nodes}</MetaValue>
                                </MetaItem>
                                <MetaItem>
                                    <MetaLabel>Divergences</MetaLabel>
                                    <MetaValue style={{color:report.divergences_found>0?'#e55':'#4caf6e'}}>{report.divergences_found}</MetaValue>
                                </MetaItem>
                                <MetaItem>
                                    <MetaLabel>Trace ID</MetaLabel>
                                    <MetaValue style={{fontSize:11,fontFamily:'monospace',color:'#666'}}>{report.graph_id.slice(0,12)}…</MetaValue>
                                </MetaItem>
                            </Meta>
                            {report.divergences_found>0 && (
                                <div>
                                    <div style={{fontSize:12,color:'#666',marginBottom:10}}>Divergences detected:</div>
                                    {report.results.filter(r=>!r.success).map(r=>(
                                        <DivRow key={r.node_id}>
                                            ⚠ <strong>Node {r.node_id.slice(0,8)}</strong>
                                            {r.divergence_type && <span style={{color:'#facc15'}}> [{r.divergence_type}]</span>}
                                            {r.divergence_details && <span> — {r.divergence_details}</span>}
                                        </DivRow>
                                    ))}
                                </div>
                            )}
                            {report.divergences_found===0 && (
                                <div style={{color:'#4caf6e',fontSize:13}}>✓ Execution is deterministic — all {report.nodes_replayed} spans matched exactly.</div>
                            )}
                        </Card>
                    )}
                </>
            )}

            {tab==='diff' && (
                <>
                    <Card>
                        <CardTitle>Compare Two Traces</CardTitle>
                        <DiffInput>
                            <div>
                                <Label>Trace A (baseline)</Label>
                                <Input placeholder="Trace ID A" value={diffA} onChange={e=>setDiffA(e.target.value)} />
                            </div>
                            <div>
                                <Label>Trace B (comparison)</Label>
                                <Input placeholder="Trace ID B" value={diffB} onChange={e=>setDiffB(e.target.value)} />
                            </div>
                        </DiffInput>
                        <Btn $primary disabled={diffLoading||!diffA.trim()||!diffB.trim()} onClick={runDiff}>
                            {diffLoading?'⏳ Comparing…':'⬡ Run Diff'}
                        </Btn>
                    </Card>

                    {diffResult && (
                        <Card>
                            <CardTitle>Diff Results</CardTitle>
                            {Object.entries(diffResult).map(([key, items]) => (
                                items && (items as any[]).length > 0 && (
                                    <DiffSection key={key}>
                                        <div style={{fontSize:12,color:'#facc15',marginBottom:8,textTransform:'capitalize'}}>{key.replace(/_/g,' ')} ({(items as any[]).length})</div>
                                        {(items as any[]).map((item, i) => (
                                            <div key={i} style={{background:'#0d0d0d',border:'1px solid #1e1e1e',borderRadius:6,padding:'8px 12px',marginBottom:6,fontSize:11,fontFamily:'monospace',color:'#aaa',whiteSpace:'pre-wrap'}}>
                                                {typeof item === 'string' ? item : JSON.stringify(item, null, 2)}
                                            </div>
                                        ))}
                                    </DiffSection>
                                )
                            ))}
                            {Object.values(diffResult).every(v=>!(v as any[]).length) && (
                                <div style={{color:'#4caf6e',fontSize:13}}>✓ No differences found — traces are structurally identical.</div>
                            )}
                        </Card>
                    )}
                </>
            )}
        </Page>
    )
}
