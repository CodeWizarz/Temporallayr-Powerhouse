import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import styled from 'styled-components'
import { api } from '../api/client'

const Wrap = styled.div`
  display:flex;
  flex-direction:column;
  gap:16px;
`

const Header = styled.div`
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:12px;
  flex-wrap:wrap;
`

const Title = styled.h2`
  margin:0;
  font-size:22px;
  color:#f4f4f4;
`

const Select = styled.select`
  background:#141414;
  border:1px solid #2a2a2a;
  color:#d6d6d6;
  border-radius:8px;
  padding:6px 10px;
`

const Grid = styled.div`
  display:grid;
  grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));
  gap:12px;
`

const Card = styled.div`
  background:linear-gradient(180deg, #161616 0%, #121212 100%);
  border:1px solid #242424;
  border-radius:10px;
  padding:12px;
`

const Label = styled.div`
  color:#888;
  font-size:12px;
  margin-bottom:4px;
`

const Value = styled.div`
  color:#facc15;
  font-weight:600;
  font-size:18px;
`

const TableWrap = styled.div`
  overflow:auto;
  border:1px solid #242424;
  border-radius:10px;
  background:#111;
`

const Table = styled.table`
  width:100%;
  border-collapse:collapse;

  th, td {
    padding:10px;
    text-align:left;
    border-bottom:1px solid #222;
    white-space:nowrap;
    font-size:13px;
  }

  th {
    color:#999;
    font-weight:600;
    background:#151515;
  }

  td {
    color:#ddd;
  }
`

const Empty = styled.div`
  border:1px dashed #2d2d2d;
  border-radius:10px;
  padding:24px;
  color:#777;
`

const HOURS_OPTIONS = [1, 6, 24, 72, 168]

export default function AnalyticsPage() {
    const [hours, setHours] = useState(24)
    const { data, isLoading, error } = useQuery({
        queryKey: ['analytics', 'p50', hours],
        queryFn: () => api.analytics.p50(hours, 200, 0),
    })

    return (
        <Wrap>
            <Header>
                <Title>Latency Percentiles</Title>
                <Select value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                    {HOURS_OPTIONS.map((h) => (
                        <option key={h} value={h}>{h}h window</option>
                    ))}
                </Select>
            </Header>

            {isLoading && <Empty>Loading percentile analytics...</Empty>}
            {error && <Empty>Unable to load analytics right now.</Empty>}

            {!isLoading && !error && data && (
                <>
                    <Grid>
                        <Card><Label>P50</Label><Value>{data.summary.p50_ms.toFixed(2)} ms</Value></Card>
                        <Card><Label>P95</Label><Value>{data.summary.p95_ms.toFixed(2)} ms</Value></Card>
                        <Card><Label>P99</Label><Value>{data.summary.p99_ms.toFixed(2)} ms</Value></Card>
                        <Card><Label>Error Rate</Label><Value>{data.summary.error_rate_pct.toFixed(2)}%</Value></Card>
                        <Card><Label>Span Groups</Label><Value>{data.summary.span_groups}</Value></Card>
                        <Card><Label>Calls</Label><Value>{data.summary.calls}</Value></Card>
                    </Grid>

                    <TableWrap>
                        <Table>
                            <thead>
                                <tr>
                                    <th>Span</th>
                                    <th>Calls</th>
                                    <th>P50 (ms)</th>
                                    <th>P95 (ms)</th>
                                    <th>P99 (ms)</th>
                                    <th>Avg (ms)</th>
                                    <th>Error %</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.items.map((row) => (
                                    <tr key={row.name}>
                                        <td>{row.name}</td>
                                        <td>{row.call_count}</td>
                                        <td>{row.p50_ms}</td>
                                        <td>{row.p95_ms}</td>
                                        <td>{row.p99_ms}</td>
                                        <td>{row.avg_ms}</td>
                                        <td>{row.error_rate_pct}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </TableWrap>
                </>
            )}
        </Wrap>
    )
}
