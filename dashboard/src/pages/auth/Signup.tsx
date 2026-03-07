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
                // Warning note as user requested
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
        <div className="min-h-screen bg-[#0a0a0b] text-text-primary flex flex-col justify-center items-center p-4 font-ui relative overflow-hidden">
            <Link to="/landing" className="absolute top-8 left-8 text-sm text-text-secondary hover:text-white transition-colors flex items-center gap-2 font-medium">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back to home
            </Link>

            {/* Glowing orbs */}
            <div className="absolute top-[-10%] left-[20%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[20%] w-[40%] h-[40%] bg-amber-500/10 blur-[120px] rounded-full pointer-events-none" />

            {/* Logo */}
            <div className="mb-8 text-center z-10">
                <div className="flex justify-center mb-4">
                    <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center text-xl font-bold text-black shadow-[0_0_20px_rgba(250,204,21,0.3)]">
                        T
                    </div>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
                    TemporalLayr
                </h1>
                <p className="text-text-muted text-sm">Agent Observability</p>
            </div>

            {/* Card */}
            <div className="bg-bg-surface border border-border rounded-xl p-8 w-full max-w-[420px] shadow-2xl z-10 transition-all duration-300">
                {apiKey ? (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="text-center">
                            <div className="mx-auto w-12 h-12 bg-success-dim rounded-full flex items-center justify-center mb-4">
                                <svg className="w-6 h-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">Tenant Registered</h2>
                            <p className="text-sm text-text-secondary">
                                Core services provisioned successfully.
                            </p>
                        </div>

                        <div className="bg-error-dim border border-error/20 p-4 rounded-lg">
                            <h3 className="text-error text-sm font-semibold mb-1 flex items-center">
                                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Save this key
                            </h3>
                            <p className="text-xs text-error/80 mb-3 font-medium">It cannot be recovered once leaving this view.</p>

                            <div className="flex items-center gap-2">
                                <code className="flex-1 bg-black/40 px-3 py-2 rounded text-zinc-300 text-xs font-mono break-all border border-error/10">
                                    {apiKey}
                                </code>
                                <button
                                    onClick={handleCopy}
                                    className="p-2 bg-bg-elevated hover:bg-bg-hover text-text-primary rounded border border-border transition-colors"
                                    title="Copy to clipboard"
                                >
                                    {copied ? (
                                        <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={handleContinue}
                            className="btn btn-primary w-full py-3 justify-center text-sm mt-4 shadow-[0_0_15px_rgba(250,204,21,0.2)]"
                        >
                            Continue to Dashboard →
                        </button>
                    </div>
                ) : (
                    <div className="animate-in fade-in duration-500">
                        <div className="text-center mb-6">
                            <h2 className="text-xl font-bold text-white mb-1.5">Create Tenant</h2>
                            <p className="text-xs text-text-secondary">Provision isolate infrastructure instantly.</p>
                        </div>

                        <form onSubmit={handleSignup} className="space-y-4">
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-1.5">
                                    Email Address
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="engineering@company.com"
                                    className="input w-full bg-bg-elevated"
                                    required
                                />
                            </div>

                            <div>
                                <label htmlFor="tenantId" className="block text-sm font-medium text-text-primary mb-1.5 flex justify-between">
                                    <span>Tenant ID</span>
                                </label>
                                <input
                                    id="tenantId"
                                    type="text"
                                    value={tenantId}
                                    onChange={(e) => setTenantId(e.target.value.toLowerCase())}
                                    placeholder="acme-prod"
                                    className="input w-full bg-bg-elevated font-mono text-sm"
                                    required
                                    pattern="^[a-z0-9-]+$"
                                    title="Lowercase letters, numbers, and hyphens only"
                                />
                                <p className="text-[11px] text-text-muted mt-1.5 leading-relaxed font-medium">
                                    We will automatically prefix your tenant with your email alias.
                                </p>
                            </div>

                            {error && (
                                <div className="p-3 bg-error-dim border border-error/20 rounded-lg flex items-start text-xs text-error font-medium">
                                    <svg className="w-3.5 h-3.5 mr-2 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <span>{error}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="btn btn-primary w-full justify-center py-2.5 mt-2"
                            >
                                {loading ? (
                                    <>
                                        <span className="loading-spinner w-3.5 h-3.5 mr-2 border-[1.5px] border-black border-t-transparent" />
                                        Provisioning...
                                    </>
                                ) : (
                                    'Create Tenant'
                                )}
                            </button>
                        </form>

                        <div className="mt-6 text-center text-sm">
                            <span className="text-text-secondary">Already have a key? </span>
                            <Link to="/login" className="text-accent hover:text-accent-hover font-medium">
                                Sign in →
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
