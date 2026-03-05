import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Trace } from '../api/client'
import styled from 'styled-components'

const Page = styled.div`color:#e0e0e0;`
const Header = styled.div`display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;`
const PageTitle = styled.h1`font-size:20px;font-weight:600;color:#facc15;margin:0;`
const Table = styled.table`width:100%;border-collapse:collapse;font-size:13px;`
const Th = styled.th`padding:10px 14px;text-align:left;font-weight:500;color:#666;border-bottom:1px solid #1e1e1e;`
const Td = styled.td`padding:10px 14px;border-bottom:1px solid #161616;vertical-align:middle;`
const Tr = styled.tr<{$clickable?:boolean}>`cursor:${p=>p.$clickable?'pointer':'default'};transition:background .1s;&:hover{background:${p=>p.$clickable?'#141414':'none'}}`
const Badge = styled.span<{$v:'success'|'error'}>`display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500;background:${p=>p.$v==='success'?'#0d2a1a':'#2a0d0d'};color:${p=>p.$v==='success'?'#4caf6e':'#e55'};`
const Pill = styled.span`display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;background:#1a1a1a;color:#888;`
const SearchInput = styled.input`background:#111;border:1px solid #222;border-radius:6px;padding:7px 12px;color:#e0e0e0;font-size:13px;width:260px;outline:none;&:focus{border-color:#facc15;}&::placeholder{color:#444;}`
const Btn = styled.button<{$primary?:boolean}>`padding:7px 14px;border-radius:6px;font-size:13px;cursor:pointer;border:none;transition:all .15s;background:${p=>p.$primary?'#facc15':'#1a1a1a'};color:${p=>p.$primary?'#000':'#888'};&:hover{opacity:.85;}&:disabled{opacity:.4;cursor:default;}`
const Pager = styled.div`display:flex;align-items:center;gap:12px;margin-top:20px;color:#666;font-size:13px;`
const Empty = styled.div`text-align:center;padding:60px 0;color:#444;font-size:14px;`
const Loader = styled.div`text-align:center;padding:60px 0;color:#555;`
const Err = styled.div`color:#e55;background:#1a0808;border:1px solid #3a1010;border-radius:8px;padding:14px;margin-bottom:16px;`
const MonoId = styled.span`font-family:monospace;font-size:11px;color:#666;`

const fmtDur = (s: string, e: string|null) => { if (!e) return '—'; const ms = new Date(e).getTime()-new Date(s).getTime(); return ms<1000?`${ms}ms`:`${(ms/1000).toFixed(2)}s` }
const fmtTime = (t: string) => new Date(t).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'})
const traceStatus = (t: Trace): 'success'|'error' => t.spans.some(s=>s.status==='error')?'error':'success'

const LIMIT = 50

export default function TracesPage() {
    const [traces, setTraces] = useState<Trace[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string|null>(null)
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(0)
    const [total, setTotal] = useState(0)
    const nav = useNavigate()

    const load = async (pg=0) => {
        setLoading(true); setError(null)
        try {
            const data = await api.executions.list(LIMIT, pg*LIMIT) as any
            const ids: string[] = data.items ?? data
            const details = await Promise.allSettled(ids.slice(0,LIMIT).map((id: string) => api.executions.get(id)))
            setTraces(details.flatMap(r=>r.status==='fulfilled'?[r.value]:[]))
            setTotal(data.total ?? details.length)
            setPage(pg)
        } catch(e:any) { setError(e.message) }
        finally { setLoading(false) }
    }

    useEffect(()=>{ load(0) },[])

    const filtered = traces.filter(t => !search || t.trace_id.includes(search) || t.tenant_id.includes(search))

    return (
        <Page>
            <Header>
                <div>
                    <PageTitle>Execution Traces</PageTitle>
                    <div style={{color:'#555',fontSize:12,marginTop:4}}>{total} total executions</div>
                </div>
                <div style={{display:'flex',gap:10}}>
                    <SearchInput placeholder="Search by trace ID or tenant…" value={search} onChange={e=>setSearch(e.target.value)} />
                    <Btn onClick={()=>load(0)}>↺ Refresh</Btn>
                </div>
            </Header>

            {error && <Err>⚠ {error}</Err>}

            {loading ? <Loader>Loading traces…</Loader> :
             filtered.length===0 ? <Empty>No execution traces found.<br/><span style={{color:'#333',fontSize:12}}>Instrument your agent with the TemporalLayr SDK to start capturing traces.</span></Empty> :
            <Table>
                <thead>
                    <Tr><Th>Trace ID</Th><Th>Status</Th><Th>Tenant</Th><Th>Spans</Th><Th>Errors</Th><Th>Duration</Th><Th>Started</Th></Tr>
                </thead>
                <tbody>
                    {filtered.map(t => {
                        const st = traceStatus(t)
                        const errs = t.spans.filter(s=>s.status==='error').length
                        return (
                            <Tr key={t.trace_id} $clickable onClick={()=>nav(`/traces/${t.trace_id}`)}>
                                <Td><MonoId>{t.trace_id.slice(0,8)}…{t.trace_id.slice(-6)}</MonoId></Td>
                                <Td><Badge $v={st}>{st}</Badge></Td>
                                <Td><Pill>{t.tenant_id}</Pill></Td>
                                <Td style={{color:'#888'}}>{t.spans.length}</Td>
                                <Td style={{color:errs>0?'#e55':'#444'}}>{errs||'—'}</Td>
                                <Td style={{color:'#aaa'}}>{fmtDur(t.start_time,t.end_time)}</Td>
                                <Td style={{color:'#666'}}>{fmtTime(t.start_time)}</Td>
                            </Tr>
                        )
                    })}
                </tbody>
            </Table>}

            {!loading && total>LIMIT && (
                <Pager>
                    <Btn onClick={()=>load(page-1)} disabled={page===0}>← Prev</Btn>
                    <span>Page {page+1} of {Math.ceil(total/LIMIT)}</span>
                    <Btn onClick={()=>load(page+1)} disabled={(page+1)*LIMIT>=total}>Next →</Btn>
                </Pager>
            )}
        </Page>
    )
}
