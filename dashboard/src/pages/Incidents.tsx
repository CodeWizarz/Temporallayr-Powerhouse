import { useEffect, useState, useMemo } from 'react'
import { api, Incident } from '../api/client'

const TABS = ['All', 'Open', 'Acknowledged', 'Resolved'] as const
type Tab = typeof TABS[number]

function formatDate(iso: string): string {
    return new Date(iso).toLocaleString()
}

export default function IncidentsPage() {
    const [incidents, setIncidents] = useState<Incident[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<Tab>('All')
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

    const fetchIncidents = async () => {
        setLoading(true)
        try {
            const res = await api.incidents.list(50)
            setIncidents(res.items || [])
        } catch (err) {
            console.error('Failed to load incidents', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchIncidents()
    }, [])

    const handleAck = async (id: string) => {
        setActionLoading(prev => ({ ...prev, [id]: true }))
        try {
            const updated = await api.incidents.ack(id)
            setIncidents(prev => prev.map(inc => inc.incident_id === id ? updated : inc))
        } catch (err) {
            console.error('Failed to acknowledge incident', err)
        } finally {
            setActionLoading(prev => ({ ...prev, [id]: false }))
        }
    }

    const handleResolve = async (id: string) => {
        setActionLoading(prev => ({ ...prev, [id]: true }))
        try {
            const updated = await api.incidents.resolve(id)
            setIncidents(prev => prev.map(inc => inc.incident_id === id ? updated : inc))
        } catch (err) {
            console.error('Failed to resolve incident', err)
        } finally {
            setActionLoading(prev => ({ ...prev, [id]: false }))
        }
    }

    const filteredIncidents = useMemo(() => {
        if (activeTab === 'All') return incidents
        return incidents.filter(inc => inc.status.toLowerCase() === activeTab.toLowerCase())
    }, [incidents, activeTab])

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return 'var(--error)'
            case 'high': return '#f97316' // orange-500
            case 'normal': return 'var(--warning)'
            default: return 'var(--border)'
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'open': return <span className="badge badge-error uppercase">Open</span>
            case 'acknowledged': return <span className="badge badge-warning uppercase">Ack'd</span>
            case 'resolved': return <span className="badge badge-success uppercase">Resolved</span>
            default: return <span className="badge badge-neutral uppercase">{status}</span>
        }
    }

    const getSeverityBadge = (severity: string) => {
        switch (severity) {
            case 'critical': return <span className="badge badge-error uppercase">Critical</span>
            case 'high': return <span className="badge !bg-[#f9731615] !text-[#f97316] uppercase">High</span>
            case 'normal': return <span className="badge badge-warning uppercase">Normal</span>
            default: return <span className="badge badge-neutral uppercase">{severity}</span>
        }
    }

    return (
        <div className="max-w-[1200px] mx-auto pb-12 animate-in fade-in duration-500">
            {/* 1. HEADER */}
            <div className="page-header flex justify-between items-end mb-6">
                <div>
                    <h1 className="page-title flex items-center gap-3">
                        Incidents
                        {!loading && <span className="badge badge-neutral !rounded-full !px-2.5 !text-xs">{incidents.length}</span>}
                    </h1>
                    <div className="page-subtitle mt-1">Managed failure clusters and threshold alerts</div>
                </div>
                <button onClick={fetchIncidents} className="btn btn-secondary" disabled={loading}>
                    <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Refresh
                </button>
            </div>

            {/* TAB FILTER */}
            <div className="flex border-b border-border-subtle mb-6 gap-6">
                {TABS.map(tab => {
                    const count = tab === 'All'
                        ? incidents.length
                        : incidents.filter(i => i.status.toLowerCase() === tab.toLowerCase()).length

                    return (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === tab ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}
                        >
                            {tab}
                            {!loading && <span className="ml-2 text-[10px] bg-bg-elevated px-1.5 py-0.5 rounded-full text-text-muted">{count}</span>}
                            {activeTab === tab && (
                                <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-accent" />
                            )}
                        </button>
                    )
                })}
            </div>

            {/* CONTENT */}
            {loading ? (
                <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="card !p-0 overflow-hidden flex h-[140px]">
                            <div className="w-1 bg-border-subtle" />
                            <div className="p-5 flex-1 flex flex-col justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="skeleton w-16 h-5" />
                                    <div className="skeleton w-16 h-5" />
                                    <div className="skeleton w-32 h-4" />
                                </div>
                                <div className="skeleton w-[60%] h-5" />
                                <div className="skeleton w-64 h-3" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : filteredIncidents.length === 0 ? (
                <div className="empty-state !py-24 border border-border-subtle rounded-xl bg-bg-surface">
                    <div className="text-[48px] text-success/20 mb-4 inline-block">◉</div>
                    <div className="empty-state-title !text-lg !text-text-primary">No incidents detected</div>
                    <div className="empty-state-desc !text-sm max-w-md mx-auto">
                        System is healthy. Incidents are auto-detected when failure clusters exceed thresholds.
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredIncidents.map(inc => {
                        const isActionLoading = actionLoading[inc.incident_id]
                        const isOpen = inc.status === 'open'
                        const isAckd = inc.status === 'acknowledged'
                        const isResolved = inc.status === 'resolved'

                        return (
                            <div
                                key={inc.incident_id}
                                className="card !p-0 overflow-hidden flex transition-all hover:border-border hover:shadow-md bg-bg-surface border border-border-subtle relative group"
                            >
                                {/* Left Color Bar */}
                                <div className="w-[4px] shrink-0" style={{ backgroundColor: getSeverityColor(inc.severity) }} />

                                <div className="p-5 flex-1 flex justify-between items-center bg-gradient-to-r from-transparent to-bg-elevated/20">
                                    {/* Left Content */}
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center gap-3">
                                            {getSeverityBadge(inc.severity)}
                                            {getStatusBadge(inc.status)}
                                            <span className="font-mono text-xs text-text-muted bg-black/30 px-2 py-0.5 rounded border border-border-subtle" title={inc.incident_id}>
                                                {inc.incident_id.substring(0, 18)}...
                                            </span>
                                            <span className="badge badge-neutral !bg-black/20 !font-mono">{inc.tenant_id}</span>
                                        </div>

                                        <div className="text-[15px] font-medium text-text-primary flex items-center gap-2">
                                            Failing node: <span className="font-mono text-accent bg-accent-dim px-1.5 py-0.5 rounded text-[13px]">{inc.failing_node || 'unknown'}</span>
                                            <span className="text-text-muted font-normal text-sm ml-2">·</span>
                                            <span className="text-text-secondary text-sm font-normal">{inc.count.toLocaleString()} occurrences</span>
                                        </div>

                                        <div className="text-xs text-text-muted flex items-center gap-3">
                                            <span className="flex items-center gap-1.5">
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                First seen: {formatDate(inc.first_seen)}
                                            </span>
                                            <span>·</span>
                                            <span>Last seen: {formatDate(inc.last_seen)}</span>
                                        </div>
                                    </div>

                                    {/* Right Actions */}
                                    <div className="flex flex-col gap-2 shrink-0 pl-6 border-l border-border-subtle border-dashed ml-4 min-w-[140px]">
                                        {isResolved ? (
                                            <div className="text-success text-sm font-medium flex items-center justify-center h-full gap-1.5">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                Resolved
                                            </div>
                                        ) : (
                                            <>
                                                {isOpen && (
                                                    <button
                                                        className="btn btn-secondary btn-sm w-full justify-center !py-1.5"
                                                        onClick={() => handleAck(inc.incident_id)}
                                                        disabled={isActionLoading}
                                                    >
                                                        {isActionLoading && !isAckd ? <span className="loading-spinner w-3 h-3 mr-1.5" /> : null}
                                                        Acknowledge
                                                    </button>
                                                )}
                                                {(isOpen || isAckd) && (
                                                    <button
                                                        className="btn btn-secondary btn-sm w-full justify-center !py-1.5 !text-success hover:!border-success/30 hover:!bg-success-dim"
                                                        onClick={() => handleResolve(inc.incident_id)}
                                                        disabled={isActionLoading}
                                                    >
                                                        {isActionLoading && isAckd ? <span className="loading-spinner w-3 h-3 mr-1.5 !border-success !border-t-transparent" /> : null}
                                                        Resolve
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
