import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'

interface BackendStatus {
  label: string
  status: 'ok' | 'degraded' | 'error' | 'loading'
  details: string
  latencyMs?: number
}

export default function StatusPage() {
  const [overallStatus, setOverallStatus] = useState<'ok' | 'degraded' | 'error' | 'loading'>('loading')
  const [lastChecked, setLastChecked] = useState<Date>(new Date())
  const [secondsAgo, setSecondsAgo] = useState(0)

  const [backends, setBackends] = useState<Record<string, BackendStatus>>({
    api: { label: 'API Server', status: 'loading', details: import.meta.env.VITE_API_URL || 'http://localhost:8000' },
    postgres: { label: 'PostgreSQL', status: 'loading', details: 'Neon — executions store' },
    clickhouse: { label: 'ClickHouse', status: 'loading', details: 'Analytics engine' },
    dashboard: { label: 'Dashboard', status: 'loading', details: 'Vercel — this page' }
  })

  const checkHealth = useCallback(async () => {
    setOverallStatus('loading')

    // 1. Check Dashboard (Self)
    const dashStart = Date.now()
    setBackends(prev => ({ ...prev, dashboard: { ...prev.dashboard, status: 'ok', latencyMs: Date.now() - dashStart } }))

    // 2. Check API Health + Ready
    try {
      const apiStart = Date.now()

      // First check basic health
      await api.health.check()
      const apiLatency = Date.now() - apiStart

      // Then check detailed backends
      const readyStart = Date.now()
      const readyRes = await api.health.ready()
      const readyLatency = Date.now() - readyStart

      const pgStatusRaw = readyRes.backends.postgres || 'error'
      const chStatusRaw = readyRes.backends.clickhouse || 'error'

      const pgStatus = pgStatusRaw === 'ok' ? 'ok' : pgStatusRaw.startsWith('degraded') ? 'degraded' : 'error'
      const chStatus = chStatusRaw === 'ok' ? 'ok' : chStatusRaw.startsWith('degraded') ? 'degraded' : 'error'

      setBackends(prev => ({
        ...prev,
        api: { ...prev.api, status: 'ok', latencyMs: apiLatency },
        postgres: { ...prev.postgres, status: pgStatus, latencyMs: readyLatency },
        clickhouse: { ...prev.clickhouse, status: chStatus, latencyMs: readyLatency }
      }))

      if (readyRes.status === 'ok' || readyRes.status === 'ready') {
        if (pgStatus === 'degraded' || chStatus === 'degraded') {
          setOverallStatus('degraded')
        } else {
          setOverallStatus('ok')
        }
      } else {
        setOverallStatus('error')
      }
    } catch (err) {
      console.error('Health check failed', err)
      setBackends(prev => ({
        ...prev,
        api: { ...prev.api, status: 'error', latencyMs: 0 },
        postgres: { ...prev.postgres, status: 'error', latencyMs: 0 },
        clickhouse: { ...prev.clickhouse, status: 'error', latencyMs: 0 }
      }))
      setOverallStatus('error')
    }

    setLastChecked(new Date())
    setSecondsAgo(0)
  }, [])

  useEffect(() => {
    checkHealth()

    const tickInterval = setInterval(() => {
      setSecondsAgo(prev => prev + 1)
    }, 1000)

    const fetchInterval = setInterval(() => {
      checkHealth()
    }, 30000) // 30 seconds

    return () => {
      clearInterval(tickInterval)
      clearInterval(fetchInterval)
    }
  }, [checkHealth])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok': return <span className="text-success font-bold text-sm">● OK</span>
      case 'degraded': return <span className="text-warning font-bold text-sm">● Degraded</span>
      case 'error': return <span className="text-error font-bold text-sm">● Error</span>
      case 'loading': return <span className="loading-spinner w-3 h-3 border-[2px]" />
      default: return <span className="text-text-muted">Unknown</span>
    }
  }

  const getBannerConfig = () => {
    if (overallStatus === 'loading') return { color: 'border-border-subtle bg-bg-surface', text: 'Checking systems...', icon: <span className="loading-spinner w-5 h-5 mr-3" /> }
    if (overallStatus === 'ok') return { color: 'border-success/30 bg-success-dim', text: 'All systems operational', icon: <svg className="w-5 h-5 mr-3 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> }
    if (overallStatus === 'degraded') return { color: 'border-warning/30 bg-warning-dim', text: 'Degraded performance', icon: <svg className="w-5 h-5 mr-3 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> }
    return { color: 'border-error/30 bg-error-dim', text: 'Service disruption', icon: <svg className="w-5 h-5 mr-3 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> }
  }

  const banner = getBannerConfig()

  return (
    <div className="page-container-sm">
      {/* 1. HEADER & BANNER */}
      <div className="page-header page-header-row mb-6">
        <div>
          <h1 className="page-title">Service Status</h1>
          <div className="page-subtitle mt-1">Real-time infrastructure health and latency</div>
        </div>
        <div className="flex-row items-center gap-4">
          <span className="text-xs text-text-muted font-mono">
            Last checked: {secondsAgo}s ago
          </span>
          <button
            onClick={checkHealth}
            className="btn btn-secondary btn-sm"
            disabled={overallStatus === 'loading'}
          >
            <svg className={`w-3.5 h-3.5 mr-1.5 ${overallStatus === 'loading' ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Refresh
          </button>
        </div>
      </div>

      <div className={`flex-row items-center p-4 rounded-xl border mb-8 transition-colors ${banner.color}`}>
        {banner.icon}
        <div className="font-semibold text-text-primary uppercase tracking-wider text-sm">{banner.text}</div>
      </div>

      {/* 2. SERVICE STATUS TABLE */}
      <div className="card !p-0 overflow-hidden border border-border-subtle shadow-md">
        <table className="table w-full">
          <thead className="bg-[#0a0a0c]">
            <tr>
              <th className="w-1/4">Service</th>
              <th className="w-1/6">Status</th>
              <th className="w-1/6 text-right pr-6">Response Time</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(backends).map((b, i) => (
              <tr key={i} className="hover:bg-bg-hover transition-colors">
                <td className="font-medium text-text-primary text-[13px]">{b.label}</td>
                <td>{getStatusIcon(b.status)}</td>
                <td className="text-right pr-6 text-text-secondary font-mono text-[11px]">
                  {b.status === 'loading' ? '—' : `${b.latencyMs}ms`}
                </td>
                <td>
                  <span className={`text-[12px] font-mono ${b.details.startsWith('http') ? 'text-accent' : 'text-text-muted'}`}>
                    {b.details}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 text-center text-xs text-text-muted bg-bg-surface p-3 rounded-lg border border-border-subtle inline-block mx-auto flex-row items-center gap-2 justify-center">
        <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        This page auto-refreshes every 30 seconds.
      </div>
    </div>
  )
}