import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'

export default function SignupPage() {
    const [tenantId, setTenantId] = useState('')
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [apiKey, setApiKey] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)

        try {
            const signupKey = import.meta.env.VITE_SIGNUP_KEY
            if (!signupKey) {
                throw new Error("Server configuration error: VITE_SIGNUP_KEY missing.")
            }
            if (!tenantId || tenantId.trim() === '') {
                throw new Error("Tenant ID is required.")
            }

            const reqPattern = /^[a-z0-9-]+$/
            if (!reqPattern.test(tenantId)) {
                throw new Error("Tenant ID can only contain lowercase letters, numbers, and hyphens.")
            }

            const response = await api.admin.register(tenantId.trim(), signupKey)

            if (response.api_key) {
                setApiKey(response.api_key)
                localStorage.setItem('tl_api_key', response.api_key)
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

    return (
        <div className="min-h-screen bg-[#0E0E11] text-zinc-300 flex flex-col justify-center items-center p-4 font-sans relative overflow-hidden">
            {/* Background effects */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-500/10 blur-[120px] rounded-full pointer-events-none" />

            {/* Logo */}
            <div className="mb-8 text-center z-10">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-amber-600 bg-clip-text text-transparent">
                    TemporalLayr
                </h1>
                <p className="text-zinc-500 mt-2 text-sm uppercase tracking-widest font-medium">Agent Observability</p>
            </div>

            {/* Card */}
            <div className="bg-[#121217] border border-zinc-800/60 rounded-xl p-8 max-w-md w-full shadow-2xl z-10">

                {apiKey ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="text-center">
                            <div className="mx-auto w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">Tenant Registered</h2>
                            <p className="text-sm text-zinc-400">
                                Your dedicated tenant <span className="text-yellow-500 font-mono">{tenantId}</span> is ready.
                            </p>
                        </div>

                        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg">
                            <h3 className="text-red-400 text-sm font-semibold mb-1 flex items-center">
                                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Save this key
                            </h3>
                            <p className="text-xs text-red-300/80 mb-3">It won't be shown again. It provides admin access to your trace data.</p>

                            <div className="flex items-center gap-2">
                                <code className="flex-1 bg-black/40 px-3 py-2 rounded text-zinc-300 text-xs font-mono break-all border border-red-500/10">
                                    {apiKey}
                                </code>
                                <button
                                    onClick={handleCopy}
                                    className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
                                    title="Copy to clipboard"
                                >
                                    {copied ? (
                                        <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-sm font-medium text-white mb-2">Quick Start</h3>
                            <div className="bg-[#0A0A0C] border border-zinc-800 rounded-lg p-4 overflow-x-auto">
                                <pre className="text-xs font-mono leading-relaxed text-zinc-300">
                                    <span className="text-purple-400">import</span> temporallayr <span className="text-purple-400">as</span> tl{'\n\n'}
                                    tl.init({'\n'}
                                    {'    '}server_url=<span className="text-green-400">"{import.meta.env.VITE_API_URL || "https://cognitive-natalie-temporall-2ff73e17.koyeb.app"}"</span>,{'\n'}
                                    {'    '}api_key=<span className="text-green-400">"{apiKey.substring(0, 12)}..."</span>,{'\n'}
                                    {'    '}tenant_id=<span className="text-green-400">"{tenantId}"</span>{'\n'}
                                    )
                                </pre>
                            </div>
                        </div>

                        <Link
                            to="/traces"
                            className="block w-full py-3 px-4 bg-[#facc15] hover:bg-yellow-500 text-black text-center font-semibold rounded-lg transition-colors shadow-[0_0_15px_rgba(250,204,21,0.2)]"
                        >
                            Go to Dashboard →
                        </Link>
                    </div>
                ) : (
                    <div className="animate-in fade-in duration-500">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-white mb-2">Create Tenant</h2>
                            <p className="text-sm text-zinc-400">Start observing your autonomous agents today.</p>
                        </div>

                        <form onSubmit={handleSignup} className="space-y-5">
                            <div>
                                <label htmlFor="tenantId" className="block text-sm font-medium text-zinc-300 mb-1.5">
                                    Organization / Tenant ID <span className="text-red-400">*</span>
                                </label>
                                <input
                                    id="tenantId"
                                    type="text"
                                    value={tenantId}
                                    onChange={(e) => setTenantId(e.target.value.toLowerCase())}
                                    placeholder="acme-corp"
                                    className="w-full bg-[#0A0A0C] border border-zinc-700/50 rounded-lg px-4 py-2.5 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all"
                                    required
                                    pattern="^[a-z0-9-]+$"
                                    title="Lowercase letters, numbers, and hyphens only"
                                />
                                <p className="text-xs text-zinc-500 mt-1.5 flex items-center">
                                    <svg className="w-3.5 h-3.5 mr-1 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Determines your data isolation namespace
                                </p>
                            </div>

                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-1.5">
                                    Email Address <span className="text-zinc-500 font-normal">(Optional)</span>
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@company.com"
                                    className="w-full bg-[#0A0A0C] border border-zinc-700/50 rounded-lg px-4 py-2.5 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all"
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
                                className="w-full py-3 px-4 bg-[#facc15] hover:bg-yellow-500 text-black font-semibold rounded-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(250,204,21,0.15)] hover:shadow-[0_0_20px_rgba(250,204,21,0.3)] flex items-center justify-center"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        Provisioning...
                                    </>
                                ) : (
                                    'Create Free Tenant'
                                )}
                            </button>
                        </form>
                    </div>
                )}
            </div>

            {/* Value Props & Footer */}
            {!apiKey && (
                <div className="mt-8 text-center space-y-4 z-10 animate-in fade-in slide-in-from-bottom-2 duration-700">
                    <div className="flex flex-wrap justify-center gap-6 text-sm text-zinc-400">
                        <div className="flex items-center">
                            <svg className="w-4 h-4 text-yellow-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            Free forever for up to 10k spans/day
                        </div>
                        <div className="flex items-center">
                            <svg className="w-4 h-4 text-yellow-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            No credit card required
                        </div>
                    </div>

                    <a
                        href="https://github.com/CodeWizarz/Temporallayr-Powerhouse"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center text-xs text-zinc-500 hover:text-zinc-300 transition-colors mt-4"
                    >
                        <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                        Open Source on GitHub
                    </a>
                </div>
            )}
        </div>
    )
}
