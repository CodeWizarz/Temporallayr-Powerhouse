import { useQuery } from '@tanstack/react-query'
import styled from 'styled-components'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { api } from '../api/client'

const PageContainer = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  padding: 40px 20px;
  min-height: 100vh;
  background: #0f0f0f;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
`

const Header = styled.div`
  margin-bottom: 40px;
  text-align: center;
`

const Title = styled.h1`
  font-size: 32px;
  margin: 0 0 8px 0;
  font-weight: 600;
  letter-spacing: -0.5px;
`

const Subtitle = styled.p`
  color: #888;
  margin: 0;
  font-size: 16px;
`

const ServiceList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 32px;
`

const ServiceCard = styled.div`
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  padding: 24px;
`

const ServiceHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #2a2a2a;
`

const ServiceName = styled.h2`
  margin: 0;
  font-size: 20px;
  font-weight: 500;
  text-transform: capitalize;
`

const OverallUptime = styled.div<{ $pct: number }>`
  font-size: 20px;
  font-weight: 600;
  color: ${props => props.$pct >= 99 ? '#22c55e' : props.$pct >= 95 ? '#eab308' : '#ef4444'};
`

const ChartContainer = styled.div`
  height: 160px;
  margin-top: 16px;
`

const LoadingWrap = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  color: #666;
  font-size: 18px;
`

const ErrorWrap = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  color: #ef4444;
  font-size: 18px;
`

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload
        const isOk = data.status === 'operational'
        return (
            <div style={{
                background: '#222',
                border: '1px solid #333',
                padding: '12px',
                borderRadius: '8px',
                minWidth: '180px'
            }}>
                <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>{label}</div>
                <div style={{
                    color: isOk ? '#22c55e' : data.status === 'unknown' ? '#666' : '#ef4444',
                    fontWeight: 600,
                    fontSize: '14px',
                    marginBottom: '4px'
                }}>
                    {data.status === 'unknown' ? 'No Data' : isOk ? 'Operational' : 'Downtime Detected'}
                </div>
                <div style={{ fontSize: '13px', color: '#ccc' }}>
                    Uptime: {data.uptime_percentage.toFixed(2)}%
                </div>
                {data.errors && data.errors.length > 0 && (
                    <div style={{
                        marginTop: '8px',
                        fontSize: '11px',
                        color: '#ef4444',
                        background: 'rgba(239, 68, 68, 0.1)',
                        padding: '6px',
                        borderRadius: '4px'
                    }}>
                        {data.errors[0]}
                    </div>
                )}
            </div>
        )
    }
    return null
}

export default function UptimePage() {
    const { data: status, isLoading, error } = useQuery({
        queryKey: ['publicStatus'],
        queryFn: () => api.publicStatus.get(),
        refetchInterval: 60000, // Refresh every minute
    })

    if (isLoading) {
        return (
            <PageContainer>
                <Header>
                    <Title>System Status</Title>
                    <Subtitle>Loading live data...</Subtitle>
                </Header>
                <LoadingWrap>Fetching history...</LoadingWrap>
            </PageContainer>
        )
    }

    if (error || !status) {
        return (
            <PageContainer>
                <ErrorWrap>Failed to load system status.</ErrorWrap>
            </PageContainer>
        )
    }

    return (
        <PageContainer>
            <Header>
                <Title>System Status</Title>
                <Subtitle>30-Day Service History</Subtitle>
            </Header>

            <ServiceList>
                {status.services.map(service => (
                    <ServiceCard key={service.service}>
                        <ServiceHeader>
                            <ServiceName>{service.service.replace('server (sqlite)', 'API Engine')}</ServiceName>
                            <OverallUptime $pct={service.uptime_percentage}>
                                {service.uptime_percentage.toFixed(2)}% Uptime
                            </OverallUptime>
                        </ServiceHeader>

                        <ChartContainer>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={service.history}
                                    margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                                    barCategoryGap="10%"
                                >
                                    <XAxis
                                        dataKey="date"
                                        hide
                                    />
                                    <YAxis hide domain={[0, 100]} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff10' }} />
                                    <Bar
                                        dataKey="uptime_percentage"
                                        radius={[4, 4, 4, 4]}
                                    >
                                        {
                                            service.history.map((entry, index) => {
                                                let color = '#22c55e' // operational
                                                if (entry.status === 'unknown') color = '#333' // pending/no data
                                                else if (entry.status === 'downtime') color = '#ef4444' // degraded

                                                return <Cell key={`cell-${index}`} fill={color} />
                                            })
                                        }
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '12px', color: '#666' }}>
                            <span>30 days ago</span>
                            <span>Today</span>
                        </div>
                    </ServiceCard>
                ))}
            </ServiceList>
        </PageContainer>
    )
}
