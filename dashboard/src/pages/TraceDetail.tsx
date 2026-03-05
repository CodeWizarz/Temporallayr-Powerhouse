import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type Trace, type Span, type ReplayReport } from '../api/client'
import styled from 'styled-components'

const Page = styled.div`color:#e0e0e0;`
const Back = styled.button`background:none;border:none;color:#facc15;cursor:pointer;font-size:13px;margin-bottom:20px;padding:0;&:hover{opacity:.7;}`
const Card = styled.div`background:#111;border:1px solid #1e1e1e;border-radius:10px;padding:20px;margin-bottom:20px;`
const CardTitle = styled.h3`font-size:13px;color:#555;margin:0 0 14px;text-transform:uppercase;letter-spacing:.05em;`
const Meta = styled.div`display:grid;grid-template-columns:repeat(4,1fr);gap:16px;`
const MetaItem = styled.div``
const MetaLabel = styled.div`font-size:11px;color:#555;margin-bottom:4px;`
const MetaValue = styled.div`font-size:14px;color:#e0e0e0;font-weight:500;`
const Badge = styled.span<{$v:'success'|'error'}>`display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500;background:${p=>p.$v==='success'?'#0d2a1a':'#2a0d0d'};color:${p=>p.$v==='success'?'#4caf6e':'#e55'};`
const Btn = styled.button<{$primary?:boolean,$danger?:boolean}>`padding:7px 14px;border-radius:6px;font-size:13px;cursor:pointer;border:none;transition:all .15s;background:${p=>p.$primary?'#facc15':p.$danger?'#3a0d0d':'#1a1a1a'};color:${p=>p.$primary?'#000':p.$danger?'#e55':'#888'};&:hover{opacity:.85;}&:disabled{opacity:.4;cursor:default;}`
const SpanRow = styled.div<{$depth:number,$err:boolean}>`padding:10px 14px;padding-left:${p=>14+p.$depth*24}px;border-bottom:1px solid #161616;font-size:12px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:background .1s;&:hover{background:#141414;background:${p=>p.$err?'#1a0a0a':'#141414'};}`
const SpanName = styled.span`flex:1;color:#ddd;font-family:monospace;`
const SpanDur = styled.span`color:#666;`
const SpanErr = styled.div`background:#1a0808;border:1px solid #3a1010;border-radius:6px;padding:10px 14px;font-size:12px;color:#e88;font-family:monospace;margin-top:4px;`
const ReplayCard = styled(Card)`border-color:#1a3a1a;`
const Mono = styled.span`font-family:monospace;font-size:11px;color:#666;`

const fmtDur = (s: string, e: string|null) => { if (!e) return '—'; const ms = new Date(e).getTime()-new Date(s).getTime(); return ms<1000?`${ms}ms`:`${(ms/1000).toFixed(2)}s` }
const fmtTime = (t: string) => new Date(t).toLocaleString()

function buildTree(spans: Span[]): Array<{span: Span, depth: number}> {
    const byId = new Map(spans.map(s=>[s.span_id, s]))
    const getDepth = (s: Span, d=0): number => {
        if (!s.parent_span_id || !byId.has(s.parent_span_id)) return d
        return getDepth(byId.get(s.parent_span_id)!, d+1)
    }
    return spans.map(s=>({span:s, depth: getDepth(s)}))
        .sort((a,b)=>new Date(a.span.start_time).getTime()-new Date(b.span.start_time).getTime())
}

export default function TraceDetailPage() {
    const { traceId } = useParams<{traceId: string}>()
    const nav = useNavigate()
    const [trace, setTrace] = useState<Trace|null>(null)
    const [loading, setLoading] = useState(true)
    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    const [replaying, setReplaying] = useState(false)
    const [replay, setReplay] = useState<ReplayReport|null>(null)
    const [replayErr, setReplayErr] = useState<string|null>(null)

    useEffect(() => {
        if (!traceId) return
        api.executions.get(traceId).then(t=>{ setTrace(t); setLoading(false) }).catch(()=>setLoading(false))
    }, [traceId])

    const toggleSpan = (id: string) => setExpanded(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n })

    const runReplay = async () => {
        if (!traceId) return
        setReplaying(true); setReplay(null); setReplayErr(null)
        try { setReplay(await api.executions.replay(traceId)) }
        catch(e:any) { setReplayErr(e.message) }
        finally { setReplaying(false) }
    }

    if (loading) return <Page><div style={{color:'#555',padding:'60px 0',textAlign:'center'}}>Loading trace…</div></Page>
    if (!trace) return <Page><div style={{color:'#e55',padding:'60px 0',textAlign:'center'}}>Trace not found</div></Page>

    const tree = buildTree(trace.spans)
    const hasErr = trace.spans.some(s=>s.status==='error')
    const errCount = trace.spans.filter(s=>s.status==='error').length
    const dur = fmtDur(trace.start_time, trace.end_time)

    return (
        <Page>
            <Back onClick={()=>nav('/traces')}>← Back to Traces</Back>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
                <div>
                    <h1 style={{fontSize:18,fontWeight:600,color:'#facc15',margin:0}}>Trace Detail</h1>
                    <Mono style={{display:'block',marginTop:4}}>{trace.trace_id}</Mono>
                </div>
                <Btn $primary onClick={runReplay} disabled={replaying}>
                    {replaying ? '⏳ Replaying…' : '▶ Run Replay'}
                </Btn>
            </div>

            <Card>
                <CardTitle>Summary</CardTitle>
                <Meta>
                    <MetaItem><MetaLabel>Status</MetaLabel><MetaValue><Badge $v={hasErr?'error':'success'}>{hasErr?'error':'success'}</Badge></MetaValue></MetaItem>
                    <MetaItem><MetaLabel>Tenant</MetaLabel><MetaValue style={{fontSize:12,color:'#888'}}>{trace.tenant_id}</MetaValue></MetaItem>
                    <MetaItem><MetaLabel>Duration</MetaLabel><MetaValue>{dur}</MetaValue></MetaItem>
                    <MetaItem><MetaLabel>Spans</MetaLabel><MetaValue>{trace.spans.length} <span style={{color:'#e55',fontSize:12}}>({errCount} errors)</span></MetaValue></MetaItem>
                </Meta>
                <div style={{marginTop:14,display:'flex',gap:20,fontSize:12,color:'#666'}}>
                    <span>Started: {fmtTime(trace.start_time)}</span>
                    {trace.end_time && <span>Ended: {fmtTime(trace.end_time)}</span>}
                </div>
            </Card>

            {replay && (
                <Card>
                    <CardTitle>Replay Report</CardTitle>
                    <div style={{display:'flex',gap:20,marginBottom:16,flexWrap:'wrap'}}>
                        <MetaItem><MetaLabel>Deterministic</MetaLabel><MetaValue><Badge $v={replay.is_deterministic?'success':'error'}>{replay.is_deterministic?'YES':'NO'}</Badge></MetaValue></MetaItem>
                        <MetaItem><MetaLabel>Spans Replayed</MetaLabel><MetaValue>{replay.nodes_replayed}/{replay.total_nodes}</MetaValue></MetaItem>
                        <MetaItem><MetaLabel>Divergences</MetaLabel><MetaValue style={{color:replay.divergences_found>0?'#e55':'#4caf6e'}}>{replay.divergences_found}</MetaValue></MetaItem>
                    </div>
                    {replay.results.filter(r=>!r.success).map(r=>(
                        <SpanErr key={r.node_id}>⚠ Node {r.node_id.slice(0,8)}: [{r.divergence_type}] {r.divergence_details}</SpanErr>
                    ))}
                </Card>
            )}
            {replayErr && <SpanErr style={{marginBottom:16}}>Replay failed: {replayErr}</SpanErr>}

            <Card>
                <CardTitle>Execution Spans ({trace.spans.length})</CardTitle>
                {tree.map(({span, depth}) => (
                    <div key={span.span_id}>
                        <SpanRow $depth={depth} $err={span.status==='error'} onClick={()=>toggleSpan(span.span_id)}>
                            <span style={{color:span.status==='error'?'#e55':'#333',fontSize:10}}>{expanded.has(span.span_id)?'▼':'▶'}</span>
                            <SpanName>{span.name}</SpanName>
                            <Badge $v={span.status==='error'?'error':'success'}>{span.status}</Badge>
                            <SpanDur>{fmtDur(span.start_time, span.end_time)}</SpanDur>
                        </SpanRow>
                        {expanded.has(span.span_id) && (
                            <div style={{padding:'10px 20px 10px 38px',background:'#0d0d0d',borderBottom:'1px solid #161616'}}>
                                {span.error && <SpanErr style={{marginBottom:10}}>Error: {span.error}</SpanErr>}
                                <div style={{fontSize:11,color:'#555',fontFamily:'monospace',whiteSpace:'pre-wrap',maxHeight:300,overflow:'auto'}}>
                                    {JSON.stringify(span.attributes, null, 2)}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </Card>
        </Page>
    )
}
