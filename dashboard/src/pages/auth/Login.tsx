import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api/client'

export default function LoginPage() {
    const [apiKey, setApiKey] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const navigate = useNavigate()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (!apiKey.trim()) {
            setError('API Key is required')
            return
        }

        setLoading(true)

        // Temporarily set the key so client.ts can use it
        localStorage.setItem('tl_api_key', apiKey.trim())

        try {
            // Validate key by attempting to fetch executions
            await api.executions.list(1, 0)

            // If successful, key is valid. Redirect to traces.
            navigate('/traces', { replace: true })
        } catch (err: any) {
            // Auth failed
            localStorage.removeItem('tl_api_key')
            if (err.message && err.message.includes('HTTP 401')) {
                setError('Invalid API key')
            } else {
                setError(err.message || 'Validation failed. Please try again.')
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="auth-page">
            <Link to="/landing" className="auth-back-link">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back to home
            </Link>

            {/* Glowing orbs */}
            <div className="glow-orb glow-orb-blue" />
            <div className="glow-orb glow-orb-amber" />

            <div className="auth-header">
                <div className="auth-logo-box">T</div>
                <h1 className="auth-title">
                    Sign in to TemporalLayr
                </h1>
                <p className="auth-subtitle">Welcome back to your dashboard</p>
            </div>

            <div className="auth-card">
                <form onSubmit={handleLogin}>
                    <div className="auth-form-group">
                        <label htmlFor="apiKey" className="auth-label">
                            API Key
                        </label>
                        <input
                            id="apiKey"
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="tl_sk_..."
                            className="input"
                            required
                        />
                    </div>

                    {error && (
                        <div className="error-banner" style={{ padding: '8px 12px', fontSize: '13px', marginBottom: '16px' }}>
                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '10px', justifyContent: 'center', marginTop: '8px', fontSize: '14px' }}
                    >
                        {loading ? (
                            <>
                                <span className="loading-spinner" style={{ width: '14px', height: '14px', borderWidth: '2px', borderColor: '#000', borderTopColor: 'transparent' }} />
                                Validating...
                            </>
                        ) : (
                            'Sign In'
                        )}
                    </button>
                </form>

                <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Don't have an account? </span>
                    <Link to="/signup" className="auth-link">
                        Sign up →
                    </Link>
                </div>
            </div>
        </div>
    )
}
