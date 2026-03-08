import { useState, useEffect } from 'react'
import { api } from '../api/client'

import BillingTab from './settings/BillingTab'
import UsageTab from './settings/UsageTab'

export default function SettingsPage() {
    const [contextTab, setContextTab] = useState<'billing' | 'usage' | 'general'>('general')

    // Current API Key
    const [currentKey, setCurrentKey] = useState(localStorage.getItem('tl_api_key') || '')
    const [inputKey, setInputKey] = useState('')
    const [copiedKey, setCopiedKey] = useState(false)
    const [savedNotice, setSavedNotice] = useState(false)

    // Key List
    const [keys, setKeys] = useState<any[]>([])
    const [loadingKeys, setLoadingKeys] = useState(false)

    // Tabs
    const [activeTab, setActiveTab] = useState<'python' | 'node'>('python')
    const [copiedCode, setCopiedCode] = useState(false)

    // Admin Section
    const [adminExpanded, setAdminExpanded] = useState(false)
    const [adminKey, setAdminKey] = useState('')
    const [tenants, setTenants] = useState<any[]>([])
    const [loadingTenants, setLoadingTenants] = useState(false)
    const [adminErr, setAdminErr] = useState<string | null>(null)

    // Register Tenant inside admin
    const [newTenantId, setNewTenantId] = useState('')
    const [registering, setRegistering] = useState(false)
    const [newTenantResult, setNewTenantResult] = useState<{ api_key?: string, error?: string } | null>(null)

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

    useEffect(() => {
        if (!currentKey) return
        setLoadingKeys(true)
        api.keys.list()
            .then(res => setKeys(res))
            .catch(err => console.error("Could not load keys:", err))
            .finally(() => setLoadingKeys(false))
    }, [currentKey])

    const handleSaveKey = (e: React.FormEvent) => {
        e.preventDefault()
        if (inputKey.trim()) {
            localStorage.setItem('tl_api_key', inputKey.trim())
            setCurrentKey(inputKey.trim())
            setInputKey('')
            setSavedNotice(true)
            setTimeout(() => setSavedNotice(false), 3000)
            window.location.reload() // Force reload to apply key globally
        }
    }

    const handleCopyToken = () => {
        navigator.clipboard.writeText(currentKey)
        setCopiedKey(true)
        setTimeout(() => setCopiedKey(false), 2000)
    }

    const pythonCode = `pip install temporallayr

import temporallayr as tl

tl.init(
    api_key="${currentKey || 'your-api-key'}",
    server_url="${API_URL}",
    tenant_id="your-tenant"
)

@tl.track_llm
async def your_function(prompt: str):
    ...`

    const nodeCode = `npm install temporallayr

import { tl } from 'temporallayr'

tl.init({
    apiKey: "${currentKey || 'your-api-key'}",
    serverUrl: "${API_URL}",
    tenantId: "your-tenant"
})

export const yourFunction = tl.trackLlm(async (prompt: string) => {
    ...
})`

    const activeCode = activeTab === 'python' ? pythonCode : nodeCode

    const handleCopyCode = () => {
        navigator.clipboard.writeText(activeCode)
        setCopiedCode(true)
        setTimeout(() => setCopiedCode(false), 2000)
    }

    const loadTenants = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!adminKey) return
        setLoadingTenants(true)
        setAdminErr(null)
        try {
            const res = await api.admin.listTenants(adminKey)
            if (res.detail) throw new Error(res.detail)
            setTenants(Array.isArray(res) ? res : res.items || [])
        } catch (err: any) {
            setAdminErr(err.message || 'Failed to load tenants')
        } finally {
            setLoadingTenants(false)
        }
    }

    const handleRegisterTenant = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!adminKey || !newTenantId) return
        setRegistering(true)
        setNewTenantResult(null)
        try {
            const res = await api.admin.register(newTenantId, adminKey)
            if (res.detail) throw new Error(res.detail)
            setNewTenantResult({ api_key: res.api_key })
            setNewTenantId('')
            // Reload list
            loadTenants(e)
        } catch (err: any) {
            setNewTenantResult({ error: err.message || 'Registration failed' })
        } finally {
            setRegistering(false)
        }
    }

    const renderMaskedKey = (key: string) => {
        if (!key) return '—'
        const prefix = key.length > 8 ? key.substring(0, 8) : key.substring(0, 3)
        return <><span className="text-text-primary font-medium">{prefix}</span><span className="text-text-muted">•••••••••••</span></>
    }

    return (
        <>
            <div className="ch-sidebar-context">
                <div className="ch-context-header">
                    <div className="ch-context-tab active">Settings</div>
                </div>
                <div className="ch-context-content gap-1 flex flex-col">
                    <div className="mt-4 mb-2 text-[10px] uppercase tracking-wider text-text-muted px-3 font-semibold">Organization</div>
                    <div
                        className={`text-[13px] py-2 px-3 rounded cursor-pointer font-medium transition-colors ${contextTab === 'billing' ? 'text-white bg-white/10' : 'text-text-secondary hover:bg-white/5'}`}
                        onClick={() => setContextTab('billing')}
                    >
                        Billing
                    </div>

                    <div className="text-[13px] text-text-secondary py-2 px-3 hover:bg-white/5 cursor-pointer rounded transition-colors">Plans</div>

                    <div
                        className={`text-[13px] py-2 px-3 rounded cursor-pointer font-medium transition-colors ${contextTab === 'usage' ? 'text-white bg-white/10' : 'text-text-secondary hover:bg-white/5'}`}
                        onClick={() => setContextTab('usage')}
                    >
                        Usage breakdown
                    </div>

                    <div className="text-[13px] text-text-secondary py-2 px-3 hover:bg-white/5 cursor-pointer rounded transition-colors">Users and roles</div>
                    <div className="text-[13px] text-text-secondary py-2 px-3 hover:bg-white/5 cursor-pointer rounded transition-colors">Private endpoints</div>

                    <div className="mt-6 mb-2 text-[10px] uppercase tracking-wider text-text-muted px-3 font-semibold">Service</div>
                    <div
                        className={`text-[13px] py-2 px-3 rounded cursor-pointer font-medium transition-colors ${contextTab === 'general' ? 'text-white bg-white/10' : 'text-text-secondary hover:bg-white/5'}`}
                        onClick={() => setContextTab('general')}
                    >
                        General Settings
                    </div>
                    <div className="text-[13px] text-text-secondary py-2 px-3 hover:bg-white/5 cursor-pointer rounded transition-colors">Data Retention</div>
                </div>
            </div>

            <main className="ch-workspace bg-bg-base">
                {contextTab === 'billing' && <BillingTab />}
                {contextTab === 'usage' && <UsageTab />}

                {contextTab === 'general' && (
                    <>
                        <header className="ch-topbar">
                            <div className="ch-topbar-title flex flex-col justify-center">
                                <div className="text-[14px] text-text-primary font-bold">
                                    General Settings
                                </div>
                            </div>
                        </header>

                        <div className="ch-workspace-scroll">
                            <div className="p-8 max-w-4xl mx-auto">
                                <div className="mb-8">
                                    <h1 className="text-xl font-bold text-text-primary mb-1">Service Integrations</h1>
                                    <div className="text-[13px] text-text-muted">Manage API keys, integrations, and administration for this service.</div>
                                </div>

                                {/* 1. API KEY SECTION */}
                                <section className="mb-10">
                                    <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-4 border-b border-border-subtle pb-2">API Authentication</h2>

                                    <div className="card mb-4 bg-bg-surface">
                                        <div className="flex-row gap-8 items-start">
                                            <div className="flex-1">
                                                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Active Authorization Target</label>
                                                <div className="flex-row gap-3 items-center bg-bg-elevated border border-border rounded-lg p-3 w-full">
                                                    <div className="font-mono text-sm flex-1 tracking-wide">
                                                        {currentKey ? renderMaskedKey(currentKey) : <span className="text-text-muted italic">No active key configured</span>}
                                                    </div>
                                                    <button onClick={handleCopyToken} disabled={!currentKey} className="btn btn-ghost btn-sm p-1.5" title="Copy unmasked key">
                                                        {copiedKey ? (
                                                            <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                        ) : (
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                                        )}
                                                    </button>
                                                </div>
                                                <p className="text-[11px] text-text-muted mt-2 flex-row items-center gap-2">
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    This key is stored securely in your browser's local storage only.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-5 pt-5 border-t border-border-subtle">
                                            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Replace Active Key</label>
                                            <form onSubmit={handleSaveKey} className="flex-row gap-3">
                                                <input
                                                    type="password"
                                                    className="input flex-1"
                                                    placeholder="sk_..."
                                                    value={inputKey}
                                                    onChange={e => setInputKey(e.target.value)}
                                                />
                                                <button type="submit" className="btn btn-secondary px-6 shrink-0" disabled={!inputKey.trim()}>
                                                    Apply Key
                                                </button>
                                            </form>
                                            {savedNotice && <div className="text-xs text-success mt-2 font-medium">Session token updated successfully! Reloading...</div>}
                                        </div>
                                    </div>

                                    <div className="card !p-0 overflow-hidden border border-border-subtle">
                                        <div className="bg-bg-elevated px-4 py-3 border-b border-border-subtle">
                                            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider m-0">Provisioned API Keys</h3>
                                        </div>
                                        {loadingKeys ? (
                                            <div className="p-4 text-center text-text-muted"><span className="loading-spinner w-4 h-4 mr-2" />Loading keys...</div>
                                        ) : keys.length === 0 ? (
                                            <div className="p-4 text-center text-text-muted text-sm">No keys found for this tenant cluster.</div>
                                        ) : (
                                            <table className="table w-full">
                                                <thead>
                                                    <tr>
                                                        <th>Key ID</th>
                                                        <th>Tenant Namespace</th>
                                                        <th>Created At</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {keys.map((k, i) => (
                                                        <tr key={i}>
                                                            <td>
                                                                <span className="font-mono text-[11px] bg-black/30 border border-border-subtle px-1.5 py-0.5 rounded text-text-secondary">
                                                                    {renderMaskedKey(k.key || k.api_key || k.id)}
                                                                </span>
                                                            </td>
                                                            <td><span className="badge badge-neutral bg-black/20 !font-mono text-text-muted">{k.tenant_id || 'unknown'}</span></td>
                                                            <td className="text-xs text-text-secondary">{new Date(k.created_at || Date.now()).toLocaleDateString()}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </section>

                                {/* 2. SDK QUICK START */}
                                <section className="mb-10">
                                    <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-4 border-b border-border-subtle pb-2">SDK Quick Start</h2>
                                    <div className="card !p-0 overflow-hidden border border-border-subtle">
                                        <div className="sdk-tabs-header">
                                            <button
                                                className={`sdk-tab-btn ${activeTab === 'python' ? 'active' : ''}`}
                                                onClick={() => setActiveTab('python')}
                                            >
                                                Python SDK
                                            </button>
                                            <button
                                                className={`sdk-tab-btn ${activeTab === 'node' ? 'active' : ''}`}
                                                onClick={() => setActiveTab('node')}
                                            >
                                                Node.js SDK
                                            </button>
                                        </div>
                                        <div className="sdk-code-block">
                                            <button
                                                onClick={handleCopyCode}
                                                className="absolute top-4 right-4 p-2 bg-text-muted/10 hover:bg-text-muted/20 text-text-secondary hover:text-white rounded transition-colors"
                                                title="Copy code"
                                            >
                                                {copiedCode ? (
                                                    <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                ) : (
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                                )}
                                            </button>
                                            <pre className="text-xs font-mono text-text-primary leading-relaxed whitespace-pre-wrap overflow-x-auto m-0">
                                                {activeTab === 'python' ? (
                                                    <>
                                                        <span className="text-text-muted"># 1. Install standard package</span><br />
                                                        <span className="text-[#a5d6ff]">pip install</span> temporallayr<br /><br />
                                                        <span className="text-text-muted"># 2. Inject environment hooks</span><br />
                                                        <span className="text-[#ff7b72]">import</span> temporallayr <span className="text-[#ff7b72]">as</span> tl<br /><br />
                                                        tl.init(<br />
                                                        &nbsp;&nbsp;&nbsp;&nbsp;api_key=<span className="text-[#a5d6ff]">"{currentKey || 'your-api-key'}"</span>,<br />
                                                        &nbsp;&nbsp;&nbsp;&nbsp;server_url=<span className="text-[#a5d6ff]">"{API_URL}"</span>,<br />
                                                        &nbsp;&nbsp;&nbsp;&nbsp;tenant_id=<span className="text-[#a5d6ff]">"your-tenant"</span><br />
                                                        )<br /><br />
                                                        <span className="text-text-muted"># 3. Decorate arbitrary functions</span><br />
                                                        <span className="text-[#d2a8ff]">@tl.track_llm</span><br />
                                                        <span className="text-[#ff7b72]">async def</span> <span className="text-[#d2a8ff]">your_agent_workflow</span>(prompt: <span className="text-[#79c0ff]">str</span>):<br />
                                                        &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-text-muted">... # Standard execution</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="text-text-muted">// 1. Install registry package</span><br />
                                                        <span className="text-[#a5d6ff]">npm install</span> temporallayr<br /><br />
                                                        <span className="text-text-muted">// 2. Configure singleton export</span><br />
                                                        <span className="text-[#ff7b72]">import</span> {'{ tl }'} <span className="text-[#ff7b72]">from</span> <span className="text-[#a5d6ff]">'temporallayr'</span><br /><br />
                                                        tl.init({'{'}<br />
                                                        &nbsp;&nbsp;&nbsp;&nbsp;apiKey: <span className="text-[#a5d6ff]">"{currentKey || 'your-api-key'}"</span>,<br />
                                                        &nbsp;&nbsp;&nbsp;&nbsp;serverUrl: <span className="text-[#a5d6ff]">"{API_URL}"</span>,<br />
                                                        &nbsp;&nbsp;&nbsp;&nbsp;tenantId: <span className="text-[#a5d6ff]">"your-tenant"</span><br />
                                                        {'}'})<br /><br />
                                                        <span className="text-text-muted">// 3. Wrap async procedures</span><br />
                                                        <span className="text-[#ff7b72]">export const</span> <span className="text-[#d2a8ff]">yourProcess</span> = tl.trackLlm(<span className="text-[#ff7b72]">async</span> (prompt: <span className="text-[#79c0ff]">string</span>) {'=> {'}<br />
                                                        &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-text-muted">... // Standard execution</span><br />
                                                        {'}'})
                                                    </>
                                                )}
                                            </pre>
                                        </div>
                                    </div>
                                </section>

                                {/* 3. ADMIN SECTION */}
                                <section className="mb-10">
                                    <button
                                        onClick={() => setAdminExpanded(!adminExpanded)}
                                        className="w-full flex-row justify-between items-center text-sm font-bold text-text-secondary hover:text-text-primary uppercase tracking-wider mb-2 border-b border-border-subtle pb-2 transition-colors focus:outline-none"
                                        style={{ background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}
                                    >
                                        <span className="flex-row items-center gap-2">
                                            <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                            Administrative Console
                                        </span>
                                        <svg className={`w-4 h-4 transition-transform duration-200 ${adminExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </button>

                                    {adminExpanded && (
                                        <div className="card bg-bg-surface mt-4 animate-in fade-in slide-in-from-top-2">
                                            {/* Auth */}
                                            <form onSubmit={loadTenants} className="mb-6">
                                                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Master Administrator Key</label>
                                                <div className="flex-row gap-3">
                                                    <input
                                                        type="password"
                                                        className="input flex-1"
                                                        placeholder="sk-admin-..."
                                                        value={adminKey}
                                                        onChange={e => setAdminKey(e.target.value)}
                                                        required
                                                    />
                                                    <button type="submit" className="btn btn-secondary px-6" disabled={loadingTenants || !adminKey}>
                                                        {loadingTenants ? <span className="loading-spinner w-4 h-4" /> : 'Load Remote Tenants'}
                                                    </button>
                                                </div>
                                                {adminErr && <div className="text-xs text-error mt-2 font-medium">{adminErr}</div>}
                                            </form>

                                            {/* Register */}
                                            {tenants.length > 0 && (
                                                <form onSubmit={handleRegisterTenant} className="mb-8 p-4 bg-bg-elevated border border-border-subtle rounded-xl">
                                                    <h4 className="text-sm font-semibold text-text-primary mb-3">Provision Global Tenant</h4>
                                                    <div className="flex-row gap-3">
                                                        <input
                                                            type="text"
                                                            className="input flex-1 font-mono text-sm"
                                                            placeholder="tenant-namespace"
                                                            value={newTenantId}
                                                            onChange={e => setNewTenantId(e.target.value)}
                                                            pattern="^[a-z0-9-]+$"
                                                            title="Lowercase letters, numbers, and hyphens only"
                                                            required
                                                        />
                                                        <button type="submit" className="btn btn-primary px-6" disabled={registering || !newTenantId}>
                                                            {registering ? <span className="loading-spinner w-4 h-4 !border-black !border-t-transparent" /> : 'Provision Instance'}
                                                        </button>
                                                    </div>
                                                    {newTenantResult?.error && <div className="text-xs text-error mt-3 font-medium flex-row items-center gap-2"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> {newTenantResult.error}</div>}
                                                    {newTenantResult?.api_key && (
                                                        <div className="mt-4 bg-success-dim border border-success/30 p-3 rounded-lg flex-row items-center justify-between gap-4">
                                                            <div>
                                                                <div className="text-xs text-success font-bold uppercase tracking-wider mb-1">Tenant Provisioned</div>
                                                                <code className="text-[11px] font-mono text-text-primary select-all break-all">{newTenantResult.api_key}</code>
                                                            </div>
                                                        </div>
                                                    )}
                                                </form>
                                            )}

                                            {/* List */}
                                            {tenants.length > 0 && (
                                                <div>
                                                    <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 block">Tenant Registry ({tenants.length})</h4>
                                                    <div className="border border-border-subtle rounded-lg overflow-hidden">
                                                        <table className="table w-full bg-bg-elevated">
                                                            <thead>
                                                                <tr>
                                                                    <th>Tenant ID</th>
                                                                    <th>Created At</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {tenants.map((t, i) => (
                                                                    <tr key={i}>
                                                                        <td className="font-mono text-xs text-text-primary font-medium">{t.tenant_id || t.id}</td>
                                                                        <td className="text-xs text-text-secondary">{new Date(t.created_at || Date.now()).toLocaleDateString()}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </section>

                                {/* 4. SERVER INFO */}
                                <section>
                                    <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-4 border-b border-border-subtle pb-2">System Profile</h2>
                                    <div className="setting-grid">
                                        <div className="card bg-bg-surface flex-row items-center justify-between p-4">
                                            <div>
                                                <div className="text-[10px] uppercase font-bold text-text-muted tracking-wider mb-1">Remote API Endpoint</div>
                                                <div className="text-sm font-mono text-text-primary">{API_URL}</div>
                                            </div>
                                            <button
                                                onClick={() => { navigator.clipboard.writeText(API_URL); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000) }}
                                                className="btn btn-ghost btn-icon"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                            </button>
                                        </div>
                                        <div className="card bg-bg-surface flex-row items-center justify-between p-4">
                                            <div>
                                                <div className="text-[10px] uppercase font-bold text-text-muted tracking-wider mb-1">Dashboard Version</div>
                                                <div className="text-sm font-mono text-accent">v0.2.1-stable</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 flex-row gap-6 text-sm">
                                        <a href="https://github.com" target="_blank" rel="noreferrer" className="flex-row items-center gap-2 text-text-secondary hover:text-white transition-colors">
                                            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                                            GitHub Repository
                                        </a>
                                        <a href="https://github.com/temporallayr#readme" target="_blank" rel="noreferrer" className="flex-row items-center gap-2 text-text-secondary hover:text-white transition-colors">
                                            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                            SDK Documentation
                                        </a>
                                    </div>
                                </section>
                            </div>
                        </div>
                    </>
                )}
            </main>
        </>
    )
}
