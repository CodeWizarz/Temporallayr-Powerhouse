import { useEffect, useState } from 'react'
import { api, type LatencyRow } from '../api/client'
import styled from 'styled-components'

const Page = styled.div`color:#e0e0e0;`
const Header = styled.div`display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;`
const PageTitle = styled.h1`font-size:20px;font-weight:600;color:#facc15;margin:0;`
const Grid = styled.div`display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px;`
const StatCard = styled.div`background:#111;border:1px solid #1e1e1e;border-radius:10px;padding:18px;`
const StatNum = styled.div<{$color?:string}>`font-size:26px;font-weight:700;color:${p=>p.$color||'#facc15'};`
const StatLabel = styled.div`font-size:11px;color:#555;margin-top:4px;text-transform:uppercase;letter-spacing:.05em;`
const Card = styled.div`background:#111;border:1px solid #1e1e1e;border-radius:10px;padding:20px;margin-bottom:20px;`
const CardTitle = styled.h3`font-size:13px;color:#555;margin:0 0 16px;text-transform:uppercase;letter-spacing:.05em;`
const Table = styled.table`width:100%;border-collapse:collapse;font-size:12px;`
const Th = styled.th`padding:8px 12px;text-align:left;font-weight:500;color:#555;border-bottom:1px solid #1e1e1e;`
const Td = styled.td`padding:8px 12px;border-bottom:1px solid #161616;vertical-align:middle;`
const Tr = styled.tr`&:hover{background:#141414;}`
const Bar = styled.div<{$pct:number,$color:string}>`height:6px;border-radius:3px;background:${p=>p.$color};width:${p=>Math.min(p.$pct,100)}%;min-width:2px;transition:width .3s;`
const BarTrack = styled.div`background:#1a1a1a;border-radius:3px;flex:1;`
const Tabs = styled.div`display:flex;gap:4px;margin-bottom:4px;`
const Tab = styled.button<{$active?:boolean}>`padding:6px 14px;border-radius:6px;font-size:12px;cursor:pointer;border:none;background:${p=>p.$active?'#facc15':'#1a1a1a'};color:${p=>p.$active?'#000':'#666'};&:hover{opacity:.85;}`
const Btn = styled.button`padding:7px 14px;border-radius:6px;font-size:13px;cursor:pointer;border:none;background:#1a1a1a;color:#888;&:hover{opacity:.85;}`
const Loader = styled.div`text-align:center;padding:40px 0;color:#555;`
const Err = styled.div`color:#e55;background:#1a0808;border:1px solid #3a1010;border-radius:8px;padding:14px;margin-bottom:16px;`

type Window = 1 | 6 | 24 | 168

const COLOR_P50 = '#4caf6e'
const COLOR_P95 = '#facc15'
const COLOR_P99 = '#e55'

export default function AnalyticsPage() {
    const [latency, setLatency] = useState<LatencyRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string|null>(null)
    const [window, setWindow] = useState<Window>(24)

    const load = async (w: Window) => {
        setLoading(true); setError(null)
        try {
            const data = await api.analytics.latency(w) as any
            setLatency(data.items ?? data)
            setWindow(w)
        } catch(e:any) { setError(e.message) }
        finally { setLoading(false) }
    }

    useEffect(()=>{ load(24) },[])

    const totalCalls = latency.reduce((s,r)=>s+r.call_count,0)
    const totalErrors = latency.reduce((s,r)=>s+r.error_count,0)
    const avgErrorRate = latency.length>0 ? (latency.reduce((s,r)=>s+r.error_rate_pct,0)/latency.length).toFixed(1) : '—'
    const maxP99 = latency.length>0 ? Math.max(...latency.map(r=>r.p99_ms)) : 0
    const sorted = [...latency].sort((a,b)=>b.call_count-a.call_count)
    const maxP99overall = Math.max(...latency.map(r=>r.p99_ms), 1)

    return (
        <Page>
            <Header>
                <div>
                    <PageTitle>Analytics</PageTitle>
                    <div style={{color:'#555',fontSize:12,marginTop:4}}>Latency and throughput insights</div>
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <Tabs>
                        {([1,6,24,168] as Window[]).map(w=>(
                            <Tab key={w} $active={window===w} onClick={()=>load(w)}>{w===1?'1h':w===6?'6h':w===24?'24h':'7d'}</Tab>
                        ))}
                    </Tabs>
                    <Btn onClick={()=>load(window)}>↺</Btn>
                </div>
            </Header>

            <Grid>
                <StatCard><StatNum>{totalCalls.toLocaleString()}</StatNum><StatLabel>Total Calls</StatLabel></StatCard>
                <StatCard><StatNum $color="#e55">{totalErrors.toLocaleString()}</StatNum><StatLabel>Total Errors</StatLabel></StatCard>
                <StatCard><StatNum $color={parseFloat(avgErrorRate as string)>5?'#e55':'#4caf6e'}>{avgErrorRate}%</StatNum><StatLabel>Avg Error Rate</StatLabel></StatCard>
                <StatCard><StatNum $color={maxP99>5000?'#e55':maxP99>1000?'#facc15':'#4caf6e'}>{maxP99>0?`${Math.round(maxP99)}ms`:'—'}</StatNum><StatLabel>Max P99 Latency</StatLabel></StatCard>
            </Grid>

            {error && <Err>⚠ {error}</Err>}

            {loading ? <Loader>Loading analytics…</Loader> : (
                <Card>
                    <CardTitle>Latency by Span ({latency.length} span types)</CardTitle>
                    {latency.length===0 ? (
                        <div style={{color:'#444',textAlign:'center',padding:'40px 0'}}>No analytics data for this period. Start tracing agent calls to see latency metrics here.</div>
                    ) : (
                        <Table>
                            <thead>
                                <Tr>
                                    <Th style={{width:'30%'}}>Span Name</Th>
                                    <Th>Calls</Th>
                                    <Th>Errors</Th>
                                    <Th>P50</Th>
                                    <Th>P95</Th>
                                    <Th>P99</Th>
                                    <Th>Avg</Th>
                                    <Th style={{width:'20%'}}>Latency Profile</Th>
                                </Tr>
                            </thead>
                            <tbody>
                                {sorted.map(row=>(
                                    <Tr key={row.name}>
                                        <Td style={{fontFamily:'monospace',fontSize:11,color:'#ccc'}}>{row.name}</Td>
                                        <Td style={{color:'#888'}}>{row.call_count.toLocaleString()}</Td>
                                        <Td style={{color:row.error_count>0?'#e55':'#444'}}>{row.error_count>0?row.error_count:'—'} {row.error_rate_pct>0&&<span style={{fontSize:10,color:'#e88'}}>({row.error_rate_pct.toFixed(1)}%)</span>}</Td>
                                        <Td style={{color:COLOR_P50}}>{Math.round(row.p50_ms)}ms</Td>
                                        <Td style={{color:COLOR_P95}}>{Math.round(row.p95_ms)}ms</Td>
                                        <Td style={{color:row.p99_ms>5000?'#e55':COLOR_P99}}>{Math.round(row.p99_ms)}ms</Td>
                                        <Td style={{color:'#888'}}>{Math.round(row.avg_ms)}ms</Td>
                                        <Td>
                                            <div style={{display:'flex',gap:3,alignItems:'center'}}>
                                                <BarTrack><Bar $pct={(row.p50_ms/maxP99overall)*100} $color={COLOR_P50} /></BarTrack>
                                            </div>
                                        </Td>
                                    </Tr>
                                ))}
                            </tbody>
                        </Table>
                    )}
                    <div style={{marginTop:16,display:'flex',gap:20,fontSize:11,color:'#555'}}>
                        <span><span style={{color:COLOR_P50}}>■</span> P50 (median)</span>
                        <span><span style={{color:COLOR_P95}}>■</span> P95</span>
                        <span><span style={{color:COLOR_P99}}>■</span> P99 (worst 1%)</span>
                    </div>
                </Card>
            )}
        </Page>
    )
}
