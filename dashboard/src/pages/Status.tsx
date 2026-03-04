import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import styled from 'styled-components'
import { api, StatusResponse, StatusHistoryResponse } from '../api/client'

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
`

const Title = styled.h2`
  margin: 0;
  font-size: 22px;
  color: #f4f4f4;
`

const StatusBadge = styled.span<{ $ok: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 14px;
  font-weight: 600;
  background: ${props => props.$ok ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'};
  color: ${props => props.$ok ? '#22c55e' : '#ef4444'};
`

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
`

const Card = styled.div`
  background: linear-gradient(180deg, #161616 0%, #121212 100%);
  border: 1px solid #242424;
  border-radius: 10px;
  padding: 16px;
`

const Label = styled.div`
  color: #888;
  font-size: 12px;
  margin-bottom: 4px;
`

const Value = styled.div`
  color: #facc15;
  font-weight: 600;
  font-size: 20px;
`

const SubValue = styled.div`
  color: #666;
  font-size: 12px;
  margin-top: 4px;
`

const Section = styled.div`
  background: linear-gradient(180deg, #161616 0%, #121212 100%);
  border: 1px solid #242424;
  border-radius: 10px;
  padding: 16px;
`

const SectionTitle = styled.h3`
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`

const ComponentList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const Component = styled.div<{ $ok: boolean }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: ${props => props.$ok ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)'};
  border-radius: 6px;
  border-left: 3px solid ${props => props.$ok ? '#22c55e' : '#ef4444'};
`

const ComponentName = styled.span`
  color: #ddd;
  font-size: 14px;
  font-weight: 500;
`

const ComponentStatus = styled.span<{ $ok: boolean }>`
  color: ${props => props.$ok ? '#22c55e' : '#ef4444'};
  font-size: 12px;
  text-transform: uppercase;
`

const Timeline = styled.div`
  display: flex;
  gap: 2px;
  height: 32px;
  align-items: flex-end;
`

const TimelineBar = styled.div<{ $status: string }>`
  flex: 1;
  background: ${props => props.$status === 'ok' ? '#22c55e' : props.$status === 'degraded' ? '#facc15' : '#ef4444'};
  border-radius: 2px;
  min-height: 4px;
  transition: height 0.2s ease;
`

const Empty = styled.div`
  border: 1px dashed #2d2d2d;
  border-radius: 10px;
  padding: 24px;
  color: #777;
  text-align: center;
`

function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    if (days > 0) return `${days}d ${hours}h ${mins}m`
    if (hours > 0) return `${hours}h ${mins}m`
    return `${Math.floor(seconds)}s`
}

export default function StatusPage() {
    const { data: status, isLoading: statusLoading, error: statusError } = useQuery({
        queryKey: ['status'],
        queryFn: () => api.status.get(),
        refetchInterval: 30000,
    })

    const { data: history } = useQuery({
        queryKey: ['status', 'history'],
        queryFn: () => api.status.history(),
        refetchInterval: 5000,
    })

    if (statusLoading) return <Wrap><Empty>Loading service status...</Empty></Wrap>
    if (statusError) return <Wrap><Empty>Unable to load status.</Empty></Wrap>
    if (!status) return null

    const isOk = status.status === 'ok'

    return (
        <Wrap>
            <Header>
                <Title>Service Status</Title>
                <StatusBadge $ok={isOk}>
                    <span>{isOk ? '●' : '○'}</span>
                    {status.status.toUpperCase()}
                </StatusBadge>
            </Header>

            <Grid>
                <Card>
                    <Label>Uptime</Label>
                    <Value>{status.uptime_human}</Value>
                    <SubValue>{formatUptime(status.uptime_seconds)} total</SubValue>
                </Card>
                <Card>
                    <Label>Version</Label>
                    <Value>v{status.version}</Value>
                    <SubValue>{status.python_version} / {status.platform}</SubValue>
                </Card>
                <Card>
                    <Label>Started</Label>
                    <Value style={{ fontSize: '14px' }}>
                        {new Date(status.started_at).toLocaleString()}
                    </Value>
                </Card>
            </Grid>

            <Section>
                <SectionTitle>Components</SectionTitle>
                <ComponentList>
                    {Object.entries(status.components).map(([name, comp]) => (
                        <Component key={name} $ok={comp.status === 'ok'}>
                            <div>
                                <ComponentName>{name}</ComponentName>
                                {comp.error && <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{comp.error}</div>}
                            </div>
                            <ComponentStatus $ok={comp.status === 'ok'}>{comp.status}</ComponentStatus>
                        </Component>
                    ))}
                </ComponentList>
            </Section>

            {history && history.history.length > 0 && (
                <Section>
                    <SectionTitle>Uptime Timeline (Last {history.history.length} checks)</SectionTitle>
                    <Timeline>
                        {history.history.map((point, i) => (
                            <TimelineBar
                                key={i}
                                $status={point.status}
                                title={`${point.time}: ${point.status}`}
                            />
                        ))}
                    </Timeline>
                </Section>
            )}

            <Section>
                <SectionTitle>Prometheus Metrics</SectionTitle>
                <div style={{ color: '#888', fontSize: '13px' }}>
                    Scrape metrics at <code style={{ background: '#222', padding: '2px 6px', borderRadius: '4px' }}>/metrics</code>
                    {' '}for Prometheus-compatible format.
                </div>
            </Section>
        </Wrap>
    )
}
