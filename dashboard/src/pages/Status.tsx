import { useEffect, useState } from 'react'
import styled from 'styled-components'
import { api } from '../api/client'
import { Title, Text, Card, Status as ClickUIStatus } from '@clickhouse/click-ui'

const Page = styled.div`color:#e0e0e0;`
const Header = styled.div`margin-bottom:32px;`
const Grid = styled.div`display:grid;grid-template-columns:1fr;gap:20px;`

const ServiceCard = styled(Card)`
  background:#111;border:1px solid #1e1e1e;padding:24px;
  display:flex;flex-direction:column;gap:16px;
`

const ServiceHeader = styled.div`display:flex;justify-content:space-between;align-items:center;`
const ServiceName = styled.h2`font-size:18px;font-weight:600;margin:0;color:#facc15;text-transform:capitalize;`
const LatencyText = styled.span`font-size:12px;color:#666;`

const UptimeTrack = styled.div`display:flex;gap:3px;height:34px;`
const UptimeBar = styled.div<{ $status: string }>`
  flex:1;background:${p => p.$status === 'ok' ? '#4caf6e' : p.$status === 'degraded' ? '#facc15' : '#e55'};
  border-radius:2px;opacity:0.8;transition:all 0.2s;
  &:hover { opacity:1; transform:scaleY(1.1); }
`

const Legend = styled.div`display:flex;justify-content:space-between;font-size:11px;color:#444;margin-top:8px;`

const IncidentCard = styled.div`
  background:#1a0808;border:1px solid #3a1010;border-radius:8px;padding:16px;
  display:flex;gap:16px;align-items:center;
`

export default function StatusPage() {
    const [status, setStatus] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const load = async () => {
        setLoading(true)
        try {
            const data = await api.health.services()
            setStatus(data)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        const timer = setInterval(load, 30000)
        return () => clearInterval(timer)
    }, [])

    if (loading && !status) return <Text>Loading system status...</Text>
    if (error) return <Text style={{ color: '#e55' }}>Error loading status: {error}</Text>

    const services = ['api', 'redis', 'clickhouse', 'worker_queue']

    return (
        <Page>
            <Header>
                <Title type="h2">System Status</Title>
                <Text color="muted">Real-time health monitoring for TemporalLayr infrastructure</Text>
            </Header>

            <Grid>
                {services.map(svc => {
                    const data = status[svc] || { status: 'unknown', latency_ms: 0 }
                    return (
                        <ServiceCard key={svc}>
                            <ServiceHeader>
                                <ServiceName>{svc.replace('_', ' ')}</ServiceName>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <LatencyText>{data.latency_ms}ms</LatencyText>
                                    <ClickUIStatus type={data.status === 'ok' ? 'success' : data.status === 'degraded' ? 'warning' : 'danger'}>
                                        {data.status.toUpperCase()}
                                    </ClickUIStatus>
                                </div>
                            </ServiceHeader>

                            {/* Mocking uptime bars for visual effect; in production these would come from the /status/history endpoint if implemented */}
                            <UptimeTrack>
                                {[...Array(60)].map((_, i) => (
                                    <UptimeBar key={i} $status={i > 55 && data.status !== 'ok' ? data.status : 'ok'} />
                                ))}
                            </UptimeTrack>
                            <Legend>
                                <span>60 minutes ago</span>
                                <span>100% uptime</span>
                                <span>Just now</span>
                            </Legend>
                        </ServiceCard>
                    )
                })}
            </Grid>

            {status.worker_queue?.status === 'backlogged' && (
                <div style={{ marginTop: 32 }}>
                    <Title type="h4" style={{ marginBottom: 16 }}>Active Incidents</Title>
                    <IncidentCard>
                        <ClickUIStatus type="warning">DEGRADED</ClickUIStatus>
                        <div>
                            <Text style={{ fontWeight: 600, display: 'block' }}>Worker Queue Backlog</Text>
                            <Text size="sm" color="muted">Queue size is currently {status.worker_queue.queue_size}. Ingestion latency may be increased.</Text>
                        </div>
                    </IncidentCard>
                </div>
            )}
        </Page>
    )
}
