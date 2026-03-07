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
        <div className="min-h-screen bg-[#0a0a0b] text-text-primary flex flex-col justify-center items-center p-4 font-ui relative overflow-hidden">
            <Link to="/landing" className="absolute top-8 left-8 text-sm text-text-secondary hover:text-white transition-colors flex items-center gap-2 font-medium">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back to home
            </Link>

            {/* Glowing orbs */}
            <div className="absolute top-[-10%] left-[20%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[20%] w-[40%] h-[40%] bg-amber-500/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="mb-8 text-center z-10">
                <div className="flex justify-center mb-4">
                    <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center text-xl font-bold text-black shadow-[0_0_20px_rgba(250,204,21,0.3)]">
                        T
                    </div>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
                    Sign in to TemporalLayr
                </h1>
                <p className="text-text-muted text-sm">Welcome back to your dashboard</p>
            </div>

            <div className="bg-bg-surface border border-border rounded-xl p-8 w-full max-w-[420px] shadow-2xl z-10">
                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label htmlFor="apiKey" className="block text-sm font-medium text-text-primary mb-1.5">
                            API Key
                        </label>
                        <input
                            id="apiKey"
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="tl_sk_..."
                            className="input w-full bg-bg-elevated"
                            required
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start text-sm text-red-400">
                            <svg className="w-4 h-4 mr-2 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary w-full py-2.5 justify-center mt-2 text-[14px]"
                    >
                        {loading ? (
                            <>
                                <span className="loading-spinner w-4 h-4 mr-2 border-2 border-black border-t-transparent" />
                                Validating...
                            </>
                        ) : (
                            'Sign In'
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm">
                    <span className="text-text-secondary">Don't have an account? </span>
                    <Link to="/signup" className="text-accent hover:text-accent-hover font-medium">
                        Sign up →
                    </Link>
                </div>
            </div>
        </div>
    )
}
