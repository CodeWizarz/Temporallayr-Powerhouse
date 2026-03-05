import { useEffect, useState } from 'react'
import { api, type Incident } from '../api/client'
import styled from 'styled-components'

const Page = styled.div`color:#e0e0e0;`
const Header = styled.div`display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;`
const PageTitle = styled.h1`font-size:20px;font-weight:600;color:#facc15;margin:0;`
const Table = styled.table`width:100%;border-collapse:collapse;font-size:13px;`
const Th = styled.th`padding:10px 14px;text-align:left;font-weight:500;color:#666;border-bottom:1px solid #1e1e1e;`
const Td = styled.td`padding:10px 14px;border-bottom:1px solid #161616;vertical-align:middle;`
const Tr = styled.tr`transition:background .1s;&:hover{background:#141414;}`
const SevBadge = styled.span<{$s:'critical'|'high'|'normal'}>`display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500;background:${p=>p.$s==='critical'?'#2a0505':p.$s==='high'?'#2a1500':'#1a1a1a'};color:${p=>p.$s==='critical'?'#ff4444':p.$s==='high'?'#ff8800':'#888'};`
const StatusBadge = styled.span<{$s:string}>`display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500;background:${p=>p.$s==='open'?'#2a0d0d':p.$s==='acknowledged'?'#0d1a2a':'#0d2a1a'};color:${p=>p.$s==='open'?'#e55':p.$s==='acknowledged'?'#5af':'#4caf6e'};`
const Btn = styled.button<{$primary?:boolean,$sm?:boolean}>`padding:${p=>p.$sm?'4px 10px':'7px 14px'};border-radius:6px;font-size:${p=>p.$sm?'11px':'13px'};cursor:pointer;border:none;transition:all .15s;background:${p=>p.$primary?'#facc15':'#1a1a1a'};color:${p=>p.$primary?'#000':'#888'};&:hover{opacity:.85;}&:disabled{opacity:.4;cursor:default;}`
const Tabs = styled.div`display:flex;gap:4px;margin-bottom:20px;`
const Tab = styled.button<{$active?:boolean}>`padding:6px 16px;border-radius:6px;font-size:12px;cursor:pointer;border:none;background:${p=>p.$active?'#facc15':'#1a1a1a'};color:${p=>p.$active?'#000':'#666'};&:hover{opacity:.85;}`
const Empty = styled.div`text-align:center;padding:60px 0;color:#444;font-size:14px;`
const Loader = styled.div`text-align:center;padding:60px 0;color:#555;`
const Err = styled.div`color:#e55;background:#1a0808;border:1px solid #3a1010;border-radius:8px;padding:14px;margin-bottom:16px;`
const Stats = styled.div`display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px;`
const StatCard = styled.div`background:#111;border:1px solid #1e1e1e;border-radius:10px;padding:16px;`
const StatNum = styled.div`font-size:24px;font-weight:700;color:#facc15;`
const StatLabel = styled.div`font-size:11px;color:#555;margin-top:4px;`
const MonoId = styled.span`font-family:monospace;font-size:11px;color:#555;`

const fmtTime = (t: string) => new Date(t).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})

type Filter = 'all' | 'open' | 'acknowledged' | 'resolved'

export default function IncidentsPage() {
    const [incidents, setIncidents] = useState<Incident[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string|null>(null)
    const [filter, setFilter] = useState<Filter>('all')
    const [acting, setActing] = useState<string|null>(null)

    const load = async () => {
        setLoading(true); setError(null)
        try {
            const data = await api.incidents.list(100, 0) as any
            setIncidents(data.items ?? data)
        } catch(e:any) { setError(e.message) }
        finally { setLoading(false) }
    }

    useEffect(()=>{ load() },[])

    const ack = async (id: string) => {
        setActing(id)
        try { await api.incidents.ack(id); await load() }
        catch(e:any) { setError(e.message) }
        finally { setActing(null) }
    }

    const resolve = async (id: string) => {
        setActing(id)
        try { await api.incidents.resolve(id); await load() }
        catch(e:any) { setError(e.message) }
        finally { setActing(null) }
    }

    const filtered = incidents.filter(i => filter==='all' || i.status===filter)
    const openCount = incidents.filter(i=>i.status==='open').length
    const critCount = incidents.filter(i=>i.severity==='critical').length
    const ackCount = incidents.filter(i=>i.status==='acknowledged').length
    const resolvedCount = incidents.filter(i=>i.status==='resolved').length

    return (
        <Page>
            <Header>
                <div>
                    <PageTitle>Incidents</PageTitle>
                    <div style={{color:'#555',fontSize:12,marginTop:4}}>AI agent failure events and alerts</div>
                </div>
                <Btn onClick={load}>↺ Refresh</Btn>
            </Header>

            <Stats>
                <StatCard><StatNum style={{color:'#e55'}}>{openCount}</StatNum><StatLabel>Open</StatLabel></StatCard>
                <StatCard><StatNum style={{color:'#ff4444'}}>{critCount}</StatNum><StatLabel>Critical</StatLabel></StatCard>
                <StatCard><StatNum style={{color:'#5af'}}>{ackCount}</StatNum><StatLabel>Acknowledged</StatLabel></StatCard>
                <StatCard><StatNum style={{color:'#4caf6e'}}>{resolvedCount}</StatNum><StatLabel>Resolved</StatLabel></StatCard>
            </Stats>

            <Tabs>
                {(['all','open','acknowledged','resolved'] as Filter[]).map(f=>(
                    <Tab key={f} $active={filter===f} onClick={()=>setFilter(f)}>{f.charAt(0).toUpperCase()+f.slice(1)}{f==='all'?` (${incidents.length})`:f==='open'?` (${openCount})`:''}</Tab>
                ))}
            </Tabs>

            {error && <Err>⚠ {error}</Err>}

            {loading ? <Loader>Loading incidents…</Loader> :
             filtered.length===0 ? <Empty>{filter==='all'?'No incidents detected. Your agents are running smoothly 🎉':'No '+filter+' incidents.'}</Empty> :
            <Table>
                <thead>
                    <Tr><Th>Incident ID</Th><Th>Severity</Th><Th>Status</Th><Th>Failing Node</Th><Th>Count</Th><Th>First Seen</Th><Th>Last Seen</Th><Th>Actions</Th></Tr>
                </thead>
                <tbody>
                    {filtered.map(inc=>(
                        <Tr key={inc.incident_id}>
                            <Td><MonoId>{inc.incident_id.slice(0,8)}</MonoId></Td>
                            <Td><SevBadge $s={inc.severity}>{inc.severity}</SevBadge></Td>
                            <Td><StatusBadge $s={inc.status}>{inc.status}</StatusBadge></Td>
                            <Td style={{fontFamily:'monospace',fontSize:12,color:'#aaa'}}>{inc.failing_node||'—'}</Td>
                            <Td style={{color:'#888'}}>{inc.count}</Td>
                            <Td style={{color:'#666'}}>{fmtTime(inc.first_seen)}</Td>
                            <Td style={{color:'#666'}}>{fmtTime(inc.last_seen)}</Td>
                            <Td>
                                <div style={{display:'flex',gap:6}}>
                                    {inc.status==='open' && <Btn $sm disabled={acting===inc.incident_id} onClick={()=>ack(inc.incident_id)}>Ack</Btn>}
                                    {inc.status!=='resolved' && <Btn $sm disabled={acting===inc.incident_id} onClick={()=>resolve(inc.incident_id)}>Resolve</Btn>}
                                    {inc.status==='resolved' && <span style={{color:'#4caf6e',fontSize:11}}>✓ Done</span>}
                                </div>
                            </Td>
                        </Tr>
                    ))}
                </tbody>
            </Table>}
        </Page>
    )
}
