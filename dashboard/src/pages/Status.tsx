import { useState, useEffect } from 'react'
import { api } from '../api/client'

interface BackendStatus {
  status: string
  backends: Record<string, string>
}

export default function StatusPage() {
  const [health, setHealth] = useState<{ status: string } | null>(null)
  const [ready, setReady] = useState<BackendStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const fetchStatus = async () => {
    setLoading(true)
    setError(null)
    try {
      const [h, r] = await Promise.all([
        api.system.check(),
        api.system.ready(),
      ])
      setHealth(h)
      setReady(r)
      setLastChecked(new Date())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStatus() }, [])

  const dot = (ok: boolean) => (
    <span style={{
      display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
      background: ok ? '#22c55e' : '#ef4444', marginRight: 8
    }} />
  )

  const badge = (val: string) => {
    const ok = val === 'ok' || val === 'ready'
    return (
      <span style={{
        padding: '2px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600,
        background: ok ? '#14532d' : '#7f1d1d',
        color: ok ? '#22c55e' : '#ef4444'
      }}>{val}</span>
    )
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: '#e0e0e0', margin: 0, fontSize: 24 }}>System Status</h1>
          <p style={{ color: '#666', margin: '4px 0 0', fontSize: 13 }}>
            Live health of all backend services
          </p>
        </div>
        <button onClick={fetchStatus} style={{
          background: '#1a1a1a', border: '1px solid #333', color: '#aaa',
          padding: '7px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13
        }}>↺ Refresh</button>
      </div>

      {error && (
        <div style={{ background: '#1a0000', border: '1px solid #7f1d1d', borderRadius: 8, padding: 16, marginBottom: 20, color: '#ef4444' }}>
          ⚠ {error}
        </div>
      )}

      {loading && !health && (
        <div style={{ color: '#555', padding: 40, textAlign: 'center' }}>Checking services…</div>
      )}

      {health && (
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 10, padding: 20, marginBottom: 16 }}>
          <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>API Server</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#ccc', display: 'flex', alignItems: 'center' }}>
              {dot(health.status === 'ok')} API Health
            </span>
            {badge(health.status)}
          </div>
        </div>
      )}

      {ready && (
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 10, padding: 20, marginBottom: 16 }}>
          <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Backend Services</div>
          {Object.entries(ready.backends).map(([name, val]) => (
            <div key={name} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 0', borderBottom: '1px solid #1a1a1a'
            }}>
              <span style={{ color: '#ccc', display: 'flex', alignItems: 'center', textTransform: 'capitalize' }}>
                {dot(val === 'ok' || val === 'true')} {name}
              </span>
              {badge(val === 'true' ? 'ok' : val)}
            </div>
          ))}
        </div>
      )}

      {lastChecked && (
        <p style={{ color: '#444', fontSize: 12, marginTop: 12 }}>
          Last checked: {lastChecked.toLocaleTimeString()}
        </p>
      )}
    </div>
  )
}