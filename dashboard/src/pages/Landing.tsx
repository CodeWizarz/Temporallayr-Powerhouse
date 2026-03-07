import { Link } from 'react-router-dom'

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-[#0d0d0d] text-zinc-300 font-sans selection:bg-yellow-500/30">
            {/* Navigation */}
            <nav className="border-b border-zinc-800/50 bg-[#0d0d0d]/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center">
                            <span className="text-black font-bold text-lg leading-none">T</span>
                        </div>
                        <span className="font-bold text-white tracking-wide">TemporalLayr</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link to="/traces" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                            Sign In
                        </Link>
                        <Link to="/signup" className="text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-md transition-colors border border-zinc-700">
                            Get Started Free
                        </Link>
                    </div>
                </div>
            </nav>

            <main>
                {/* Hero Section */}
                <section className="pt-32 pb-24 px-6 text-center max-w-4xl mx-auto">
                    <h1 className="text-5xl md:text-6xl font-extrabold text-white tracking-tight mb-6 leading-tight">
                        Observe, Replay, and Debug Your AI Agents
                    </h1>
                    <p className="text-lg md:text-xl text-zinc-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                        TemporalLayr gives you execution graphs, deterministic replay, and failure clustering for autonomous AI workflows. Not just logs — full agent observability.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link to="/signup" className="px-8 py-3.5 bg-[#facc15] hover:bg-yellow-500 text-black font-semibold rounded-lg transition-colors text-lg">
                            Get Started Free
                        </Link>
                        <Link to="/traces" className="px-8 py-3.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-medium rounded-lg transition-colors text-lg" onClick={() => localStorage.setItem('tl_api_key', 'demo_key')}>
                            View Demo Dashboard
                        </Link>
                    </div>
                </section>

                {/* Code Snippet Section */}
                <section className="py-16 px-6 max-w-4xl mx-auto">
                    <div className="bg-[#111] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
                        <div className="bg-[#1a1a1a] border-b border-zinc-800 px-4 py-3 flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            <span className="ml-4 text-xs font-mono text-zinc-500">agent.py</span>
                        </div>
                        <div className="p-6 overflow-x-auto">
                            <pre className="text-sm font-mono leading-loose text-zinc-300">
                                <span className="text-zinc-500"># pip install temporallayr</span>{'\n'}
                                <span className="text-purple-400">import</span> temporallayr <span className="text-purple-400">as</span> tl{'\n\n'}
                                tl.init(server_url=<span className="text-green-400">"https://temporallayr.app"</span>, api_key=<span className="text-green-400">"..."</span>, tenant_id=<span className="text-green-400">"acme"</span>){'\n\n'}
                                <span className="text-blue-400">@tl.track_llm</span>{'\n'}
                                <span className="text-purple-400">async def</span> <span className="text-blue-300">generate_response</span>(context: <span className="text-yellow-200">str</span>, query: <span className="text-yellow-200">str</span>) -{'>'} <span className="text-yellow-200">dict</span>:{'\n'}
                                {'    '}return {'{'}{'\n'}
                                {'        '}<span className="text-green-400">"output"</span>: <span className="text-green-400">"SLA is 99.99%"</span>,{'\n'}
                                {'        '}<span className="text-green-400">"model"</span>: <span className="text-green-400">"gpt-4o"</span>,{'\n'}
                                {'        '}<span className="text-green-400">"prompt_tokens"</span>: <span className="text-orange-400">142</span>,{'\n'}
                                {'        '}<span className="text-green-400">"completion_tokens"</span>: <span className="text-orange-400">38</span>{'\n'}
                                {'    '}{'}'}
                            </pre>
                        </div>
                    </div>
                </section>

                {/* Feature Cards */}
                <section className="py-24 px-6 max-w-6xl mx-auto">
                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Feature 1 */}
                        <div className="bg-[#111] border border-zinc-800 rounded-xl p-8 hover:border-zinc-700 transition-colors">
                            <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mb-6">
                                <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">Execution Graphs</h3>
                            <p className="text-zinc-400 leading-relaxed">
                                Every agent run is recorded as a queryable DAG. See exactly which tools were called, the LLM reasoning chain, and the precise latency of every sub-step.
                            </p>
                        </div>

                        {/* Feature 2 */}
                        <div className="bg-[#111] border border-zinc-800 rounded-xl p-8 hover:border-zinc-700 transition-colors">
                            <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center mb-6">
                                <svg className="w-6 h-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">Deterministic Replay</h3>
                            <p className="text-zinc-400 leading-relaxed">
                                Safely re-run any historical execution locally without making real API calls. Catch divergences, test prompt tweaks, and debug complex multi-step failures instantly.
                            </p>
                        </div>

                        {/* Feature 3 */}
                        <div className="bg-[#111] border border-zinc-800 rounded-xl p-8 hover:border-zinc-700 transition-colors">
                            <div className="w-12 h-12 bg-red-500/10 rounded-lg flex items-center justify-center mb-6">
                                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">Failure Clustering</h3>
                            <p className="text-zinc-400 leading-relaxed">
                                Don't drown in logs. We automatically group similar agent failures by semantic fingerprint, turning 10,000 exceptions into a few actionable incidents.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Comparison Table */}
                <section className="py-24 px-6 max-w-4xl mx-auto">
                    <h2 className="text-3xl font-bold text-white text-center mb-12">The Observability standard for Agents</h2>
                    <div className="overflow-x-auto rounded-xl border border-zinc-800 shadow-xl bg-[#111]">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead>
                                <tr>
                                    <th className="p-4 border-b border-zinc-800 bg-[#151515] font-semibold text-zinc-300">Feature</th>
                                    <th className="p-4 border-b border-zinc-800 bg-[#151515] font-semibold text-yellow-500">TemporalLayr</th>
                                    <th className="p-4 border-b border-zinc-800 bg-[#151515] font-semibold text-zinc-500">LangSmith</th>
                                    <th className="p-4 border-b border-zinc-800 bg-[#151515] font-semibold text-zinc-500">Helicone</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/50">
                                <tr className="hover:bg-zinc-800/30 transition-colors">
                                    <td className="p-4 text-zinc-300 font-medium">Multi-step Agent DAG</td>
                                    <td className="p-4 text-green-400">✅ Native</td>
                                    <td className="p-4 text-yellow-500">⚠️ Limited</td>
                                    <td className="p-4 text-red-500">❌ Proxy only</td>
                                </tr>
                                <tr className="hover:bg-zinc-800/30 transition-colors">
                                    <td className="p-4 text-zinc-300 font-medium">Deterministic Replay</td>
                                    <td className="p-4 text-green-400">✅ Built-in</td>
                                    <td className="p-4 text-red-500">❌ No</td>
                                    <td className="p-4 text-red-500">❌ No</td>
                                </tr>
                                <tr className="hover:bg-zinc-800/30 transition-colors">
                                    <td className="p-4 text-zinc-300 font-medium">Semantic Diff between runs</td>
                                    <td className="p-4 text-green-400">✅ Yes</td>
                                    <td className="p-4 text-red-500">❌ No</td>
                                    <td className="p-4 text-red-500">❌ No</td>
                                </tr>
                                <tr className="hover:bg-zinc-800/30 transition-colors">
                                    <td className="p-4 text-zinc-300 font-medium">Failure Clustering</td>
                                    <td className="p-4 text-green-400">✅ Automatic</td>
                                    <td className="p-4 text-red-500">❌ No</td>
                                    <td className="p-4 text-red-500">❌ No</td>
                                </tr>
                                <tr className="hover:bg-zinc-800/30 transition-colors">
                                    <td className="p-4 text-zinc-300 font-medium">Token Analytics & Cost Tracking</td>
                                    <td className="p-4 text-green-400">✅ Yes</td>
                                    <td className="p-4 text-green-400">✅ Yes</td>
                                    <td className="p-4 text-green-400">✅ Yes</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="border-t border-zinc-800 py-12 px-6 bg-[#0a0a0a]">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-white">TemporalLayr</span>
                        <span className="text-zinc-600 text-sm">© 2026</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <a href="https://github.com/CodeWizarz/Temporallayr-Powerhouse" target="_blank" rel="noreferrer" className="text-sm text-zinc-500 hover:text-white transition-colors">
                            GitHub Repository
                        </a>
                        <span className="text-zinc-800">•</span>
                        <span className="text-sm text-zinc-500">
                            MIT License
                        </span>
                        <span className="text-zinc-800">•</span>
                        <Link to="/traces" className="text-sm text-zinc-500 hover:text-white transition-colors">
                            Dashboard
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    )
}
