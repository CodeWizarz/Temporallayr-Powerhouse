import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api/client'

export default function SignupPage() {
    const [tenantId, setTenantId] = useState('')
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [apiKey, setApiKey] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const navigate = useNavigate()

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)

        try {
            const signupKey = import.meta.env.VITE_SIGNUP_ADMIN_KEY
            if (!signupKey) {
                console.warn("Using fallback/missing signup key. Replace with a public registration endpoint later.")
                throw new Error("Server configuration error: VITE_SIGNUP_ADMIN_KEY missing.")
            }
            if (!tenantId || tenantId.trim() === '') {
                throw new Error("Tenant ID is required.")
            }

            const reqPattern = /^[a-z0-9-]+$/
            if (!reqPattern.test(tenantId)) {
                throw new Error("Tenant ID can only contain lowercase letters, numbers, and hyphens.")
            }

            const finalTenantId = email ? `${email.split('@')[0]}-${tenantId.trim()}` : tenantId.trim()
            const response = await api.admin.register(finalTenantId, signupKey)

            if (response.api_key) {
                setApiKey(response.api_key)
            } else if (response.detail) {
                throw new Error(response.detail)
            } else {
                throw new Error("Failed to generate API Key.")
            }

        } catch (err: any) {
            setError(err.message || "An unexpected error occurred during signup.")
        } finally {
            setLoading(false)
        }
    }

    const handleCopy = () => {
        if (apiKey) {
            navigator.clipboard.writeText(apiKey)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const handleContinue = () => {
        if (apiKey) {
            localStorage.setItem('tl_api_key', apiKey)
            navigate('/traces', { replace: true })
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

            {/* Logo */}
            <div className="auth-header">
                <div className="auth-logo-box">T</div>
                <h1 className="auth-title">TemporalLayr</h1>
                <p className="auth-subtitle">Agent Observability</p>
            </div>

            {/* Card */}
            <div className="auth-card">
                {apiKey ? (
                    <div>
                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <div className="auth-success-icon">
                                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' }}>Tenant Registered</h2>
                            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                                Core services provisioned successfully.
                            </p>
                        </div>

                        <div className="auth-key-box">
                            <h3 style={{ color: 'var(--error)', fontSize: '14px', fontWeight: '600', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Save this key
                            </h3>
                            <p style={{ fontSize: '12px', color: 'var(--error)', opacity: 0.9, marginBottom: '16px', fontWeight: '500' }}>It cannot be recovered once leaving this view.</p>

                            <div className="auth-key-display">
                                <code className="auth-key-code">
                                    {apiKey}
                                </code>
                                <button
                                    onClick={handleCopy}
                                    style={{ padding: '8px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-primary)' }}
                                    title="Copy to clipboard"
                                >
                                    {copied ? (
                                        <svg width="18" height="18" className="check" style={{ color: 'var(--success)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    ) : (
                                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={handleContinue}
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '12px', justifyContent: 'center', fontSize: '14px', marginTop: '16px', boxShadow: '0 0 15px rgba(250,204,21,0.2)' }}
                        >
                            Continue to Dashboard →
                        </button>
                    </div>
                ) : (
                    <div>
                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '6px' }}>Create Tenant</h2>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Provision isolate infrastructure instantly.</p>
                        </div>

                        <form onSubmit={handleSignup}>
                            <div className="auth-form-group">
                                <label htmlFor="email" className="auth-label">
                                    Email Address
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="engineering@company.com"
                                    className="input"
                                    required
                                />
                            </div>

                            <div className="auth-form-group">
                                <div className="auth-label-row">
                                    <label htmlFor="tenantId" className="auth-label" style={{ marginBottom: 0 }}>
                                        Tenant ID
                                    </label>
                                </div>
                                <input
                                    id="tenantId"
                                    type="text"
                                    value={tenantId}
                                    onChange={(e) => setTenantId(e.target.value.toLowerCase())}
                                    placeholder="acme-prod"
                                    className="input"
                                    style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', marginTop: '6px' }}
                                    required
                                    pattern="^[a-z0-9-]+$"
                                    title="Lowercase letters, numbers, and hyphens only"
                                />
                                <p className="auth-hint">
                                    We will automatically prefix your tenant with your email alias.
                                </p>
                            </div>

                            {error && (
                                <div className="error-banner" style={{ padding: '8px 12px', fontSize: '12px', marginBottom: '16px' }}>
                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <span>{error}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="btn btn-primary"
                                style={{ width: '100%', padding: '10px', justifyContent: 'center', marginTop: '8px' }}
                            >
                                {loading ? (
                                    <>
                                        <span className="loading-spinner" style={{ width: '14px', height: '14px', borderWidth: '1.5px', borderColor: '#000', borderTopColor: 'transparent' }} />
                                        Provisioning...
                                    </>
                                ) : (
                                    'Create Tenant'
                                )}
                            </button>
                        </form>

                        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Already have a key? </span>
                            <Link to="/login" className="auth-link">
                                Sign in →
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
