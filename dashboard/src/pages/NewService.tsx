import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function NewService() {
    const navigate = useNavigate()
    const [engine, setEngine] = useState<'clickhouse' | 'postgres'>('clickhouse')
    const [serviceName, setServiceName] = useState('')
    const [provider, setProvider] = useState('aws')
    const [region, setRegion] = useState('us-east-1')
    const [shareData, setShareData] = useState(false)
    const [openScaling, setOpenScaling] = useState(false)
    const [openAdvanced, setOpenAdvanced] = useState(false)

    return (
        <main className="ch-workspace bg-bg-base overflow-y-auto">
            <header className="ch-topbar !border-none">
                <div className="text-[13px] text-text-muted font-medium flex items-center gap-2">
                    <span className="hover:text-text-primary cursor-pointer transition-colors" onClick={() => navigate('/traces')}>Services</span>
                    <span>/</span>
                    <span className="text-text-primary">New</span>
                </div>
            </header>

            <div className="p-8 max-w-4xl mx-auto w-full pb-20">
                <h1 className="text-xl font-bold text-text-primary mb-8">Create service</h1>

                <div className="card bg-bg-surface border border-border-subtle p-8 max-w-[800px]">

                    <div className="mb-8">
                        <label className="block text-xs font-semibold text-text-muted mb-4 uppercase tracking-wider">Database</label>
                        <div className="grid grid-cols-2 gap-4">
                            <div
                                className={`ch-card-radio ${engine === 'clickhouse' ? 'active' : ''}`}
                                onClick={() => setEngine('clickhouse')}
                            >
                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 rounded bg-black flex items-center justify-center shrink-0 border border-white/10">
                                        <div className="flex gap-0.5">
                                            <div className="w-1 h-3 bg-white/80 rounded-sm"></div>
                                            <div className="w-1 h-4 bg-white rounded-sm"></div>
                                            <div className="w-1 h-3 bg-white/80 rounded-sm"></div>
                                            <div className="w-1 h-2 bg-text-muted rounded-sm"></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="font-bold text-[14px] text-text-primary mb-1">ClickHouse</div>
                                        <div className="text-[13px] text-text-muted leading-relaxed">Best for real-time analytics and reporting at scale</div>
                                    </div>
                                </div>
                            </div>

                            <div
                                className={`ch-card-radio ${engine === 'postgres' ? 'active' : ''}`}
                                onClick={() => setEngine('postgres')}
                            >
                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 rounded bg-black flex items-center justify-center shrink-0 border border-white/10">
                                        <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M11 20.93v-2.06c-2.34-.35-3.8-1.57-3.8-3.41v-3.79c0-.49-.24-.96-.64-1.24L4 8.71C3 7.9 3.58 6 4.88 6h7.12V3.07c0-.59.68-.92 1.13-.54l6 5.07c.36.3.36.84 0 1.14l-6 5.07c-.45.38-1.13.05-1.13-.54V11h-2v3.66c0 1.14 1.12 1.95 2.5 1.95h.5v2.87c.25.1.51.21.78.33l1.83.84c.48.22 1.05.02 1.3-.44l1.37-2.61c.14-.26.35-.46.6-.58l2.67-1.3c.47-.23.63-.82.35-1.25l-2.04-3.15c-.15-.24-.2-.53-.15-.81l.66-3.86c.09-.53.64-.81 1.09-.56L22 12c0 5.52-4.48 10-10 10-1-.18-1-.18-1-.18V21zm-1-8.99V14c0 .5-.24.96-.65 1.25l-2.7 1.92c-.44.31-1.04.14-1.28-.35L3.4 12.5c-.14-.28-.33-.51-.57-.66l-2.48-1.5c-.53-.32-.48-1.12.08-1.37l5.22-2.31c.27-.12.58-.15.86-.06l3.96 1.1c.36.1.6.43.6.81l-.07 3.42z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="font-bold text-[14px] text-text-primary mb-1">Postgres</div>
                                        <div className="text-[13px] text-text-muted leading-relaxed">Best for applications and transactional data</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mb-8">
                        <label className="block text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">Service name</label>
                        <input
                            type="text"
                            className="input w-full bg-[#1e1e1e] border-transparent"
                            placeholder="e.g. cluster-1"
                            value={serviceName}
                            onChange={(e) => setServiceName(e.target.value)}
                        />
                    </div>

                    <div className="mb-8 flex items-center gap-3">
                        <div
                            className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors duration-200 ${shareData ? 'bg-accent' : 'bg-white/10'}`}
                            onClick={() => setShareData(!shareData)}
                        >
                            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${shareData ? 'translate-x-4 mix-blend-difference' : 'bg-white/60'}`}></div>
                        </div>
                        <span className="text-[13px] text-text-primary">Share data with another service <span className="text-text-muted">(compute-compute separation)</span></span>
                        <svg className="w-3.5 h-3.5 text-text-muted cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>

                    <div className="grid grid-cols-2 gap-6 mb-8">
                        <div>
                            <label className="block text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">Cloud provider</label>
                            <select
                                className="input bg-[#1e1e1e] border-transparent w-full appearance-none pr-8 cursor-pointer relative font-medium"
                                value={provider}
                                onChange={(e) => setProvider(e.target.value)}
                                style={{
                                    backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")",
                                    backgroundRepeat: "no-repeat",
                                    backgroundPosition: "right 12px center",
                                    backgroundSize: "14px"
                                }}
                            >
                                <option value="aws">AWS</option>
                                <option value="gcp">Google Cloud</option>
                                <option value="azure">Azure</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">Region</label>
                            <select
                                className="input bg-[#1e1e1e] border-transparent w-full appearance-none pr-8 cursor-pointer relative font-medium"
                                value={region}
                                onChange={(e) => setRegion(e.target.value)}
                                style={{
                                    backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")",
                                    backgroundRepeat: "no-repeat",
                                    backgroundPosition: "right 12px center",
                                    backgroundSize: "14px"
                                }}
                            >
                                <option value="us-east-1">US East (N. Virginia)</option>
                                <option value="eu-central-1">Europe (Frankfurt)</option>
                                <option value="ap-south-1">Mumbai (ap-south-1)</option>
                            </select>
                            <div className="mt-2 text-right text-[11px] text-text-muted">Can't find your region? <span className="text-accent cursor-pointer hover:underline">Request it</span></div>
                        </div>
                    </div>

                    <div className="border-t border-border-subtle pt-4">
                        <button
                            className="flex items-center gap-2 text-[14px] text-text-primary hover:text-white transition-colors w-full py-2"
                            onClick={() => setOpenScaling(!openScaling)}
                        >
                            <svg className={`w-4 h-4 text-text-muted transition-transform duration-200 ${openScaling ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            Memory and scaling
                        </button>
                    </div>

                    <div className="border-t border-border-subtle mt-2 pt-4 mb-8">
                        <button
                            className="flex items-center gap-2 text-[14px] text-text-primary hover:text-white transition-colors w-full py-2"
                            onClick={() => setOpenAdvanced(!openAdvanced)}
                        >
                            <svg className={`w-4 h-4 text-text-muted transition-transform duration-200 ${openAdvanced ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            Advanced settings
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="btn btn-secondary px-6 border-white/10" onClick={() => navigate(-1)}>Back</button>
                        <button className="btn btn-primary px-6" onClick={() => navigate('/traces')}>Create service</button>
                    </div>
                </div>
            </div>
        </main>
    )
}
