import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '../api/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AlertType = 'threshold' | 'anomaly' | 'match'
type Metric = 'error_rate' | 'latency_p95' | 'span_count' | 'cost'
type Operator = 'gt' | 'lt' | 'gte' | 'lte'
type Severity = 'info' | 'warning' | 'critical'
type RuleStatus = 'enabled' | 'disabled' | 'silenced'

interface NotificationChannel {
    type: 'webhook' | 'slack' | 'pagerduty'
    value: string
}

interface AlertCondition {
    metric: Metric
    operator: Operator
    threshold: number
    window_minutes: number
}

interface AlertRule {
    id: string
    name: string
    description: string
    type: AlertType
    condition: AlertCondition
    channels: NotificationChannel[]
    severity: Severity
    status: RuleStatus
    silenced_until: string | null
    created_at: string
    updated_at: string
}

interface AlertEvent {
    id: string
    alert_id: string
    alert_name: string
    severity: Severity
    message: string
    triggered_at: string
    resolved_at: string | null
    metric_value: number
    threshold: number
}

interface AlertFormData {
    name: string
    description: string
    type: AlertType
    condition: AlertCondition
    channels: NotificationChannel[]
    severity: Severity
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TABS = ['Rules', 'History'] as const
type Tab = typeof TABS[number]

const METRIC_OPTIONS: { value: Metric; label: string }[] = [
    { value: 'error_rate', label: 'Error Rate (%)' },
    { value: 'latency_p95', label: 'Latency P95 (ms)' },
    { value: 'span_count', label: 'Span Count' },
    { value: 'cost', label: 'Cost ($)' },
]

const OPERATOR_OPTIONS: { value: Operator; label: string }[] = [
    { value: 'gt', label: '>' },
    { value: 'lt', label: '<' },
    { value: 'gte', label: '>=' },
    { value: 'lte', label: '<=' },
]

const ALERT_TYPE_OPTIONS: { value: AlertType; label: string; desc: string }[] = [
    { value: 'threshold', label: 'Threshold', desc: 'Fire when metric crosses a fixed value' },
    { value: 'anomaly', label: 'Anomaly', desc: 'Fire on statistical deviation from baseline' },
    { value: 'match', label: 'Match', desc: 'Fire when a pattern matches' },
]

const SEVERITY_OPTIONS: Severity[] = ['info', 'warning', 'critical']

const SNOOZE_DURATIONS = [
    { label: '30 min', minutes: 30 },
    { label: '1 hour', minutes: 60 },
    { label: '4 hours', minutes: 240 },
    { label: '24 hours', minutes: 1440 },
    { label: '7 days', minutes: 10080 },
]

const CHANNEL_TYPES: { value: NotificationChannel['type']; label: string; placeholder: string }[] = [
    { value: 'webhook', label: 'Webhook URL', placeholder: 'https://example.com/webhook' },
    { value: 'slack', label: 'Slack Webhook', placeholder: 'https://hooks.slack.com/services/...' },
    { value: 'pagerduty', label: 'PagerDuty Key', placeholder: 'PD integration key' },
]

const EMPTY_FORM: AlertFormData = {
    name: '',
    description: '',
    type: 'threshold',
    condition: { metric: 'error_rate', operator: 'gt', threshold: 0, window_minutes: 5 },
    channels: [],
    severity: 'warning',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
    return new Date(iso).toLocaleString()
}

function formatRelative(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
}

function operatorLabel(op: Operator): string {
    return OPERATOR_OPTIONS.find(o => o.value === op)?.label ?? op
}

function metricLabel(m: Metric): string {
    return METRIC_OPTIONS.find(o => o.value === m)?.label ?? m
}

// ---------------------------------------------------------------------------
// API helpers — uses api.alerts.* from client.ts
// ---------------------------------------------------------------------------

const alertsApi = {
    list: () => api.alerts.list(),
    create: (data: AlertFormData) => api.alerts.create(data as Record<string, unknown>),
    update: (id: string, data: AlertFormData) => api.alerts.update(id, data as Record<string, unknown>),
    remove: (id: string) => api.alerts.remove(id),
    silence: (id: string, until: string) => api.alerts.silence(id, until),
    test: (id: string) => api.alerts.test(id),
    history: () => api.alerts.history(),
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SeverityBadge({ severity }: { severity: Severity }) {
    switch (severity) {
        case 'critical':
            return <span className="badge badge-error uppercase">{severity}</span>
        case 'warning':
            return <span className="badge badge-warning uppercase">{severity}</span>
        case 'info':
            return <span className="badge badge-info uppercase">{severity}</span>
    }
}

function StatusIndicator({ status, silencedUntil }: { status: RuleStatus; silencedUntil: string | null }) {
    switch (status) {
        case 'enabled':
            return (
                <span className="badge badge-success uppercase">
                    <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', marginRight: 4 }} />
                    Enabled
                </span>
            )
        case 'disabled':
            return <span className="badge badge-neutral uppercase">Disabled</span>
        case 'silenced':
            return (
                <span className="badge badge-warning uppercase" title={silencedUntil ? `Until ${formatDate(silencedUntil)}` : ''}>
                    Silenced
                </span>
            )
    }
}

// ---------------------------------------------------------------------------
// Alert Form Modal
// ---------------------------------------------------------------------------

function AlertFormModal({
    initial,
    title,
    onSubmit,
    onClose,
    submitting,
}: {
    initial: AlertFormData
    title: string
    onSubmit: (data: AlertFormData) => void
    onClose: () => void
    submitting: boolean
}) {
    const [form, setForm] = useState<AlertFormData>({ ...initial, channels: [...initial.channels] })
    const [channelType, setChannelType] = useState<NotificationChannel['type']>('webhook')
    const [channelValue, setChannelValue] = useState('')

    const patch = <K extends keyof AlertFormData>(key: K, value: AlertFormData[K]) =>
        setForm(prev => ({ ...prev, [key]: value }))

    const patchCondition = <K extends keyof AlertCondition>(key: K, value: AlertCondition[K]) =>
        setForm(prev => ({ ...prev, condition: { ...prev.condition, [key]: value } }))

    const addChannel = () => {
        const trimmed = channelValue.trim()
        if (!trimmed) return
        patch('channels', [...form.channels, { type: channelType, value: trimmed }])
        setChannelValue('')
    }

    const removeChannel = (idx: number) => {
        patch('channels', form.channels.filter((_, i) => i !== idx))
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.name.trim()) {
            toast.error('Alert name is required')
            return
        }
        onSubmit(form)
    }

    const channelPlaceholder = CHANNEL_TYPES.find(c => c.value === channelType)?.placeholder ?? ''

    return (
        <div className="ch-modal-overlay" onClick={onClose}>
            <div className="ch-modal ch-modal--lg" onClick={e => e.stopPropagation()}>
                <div className="ch-modal-header">
                    <span className="ch-modal-title">{title}</span>
                    <button className="ch-modal-close" onClick={onClose}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="ch-modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                        {/* Name */}
                        <div className="ch-form-field">
                            <label className="ch-form-label">Name</label>
                            <input
                                className="ch-form-input"
                                placeholder="e.g. High error rate on payments"
                                value={form.name}
                                onChange={e => patch('name', e.target.value)}
                                autoFocus
                            />
                        </div>

                        {/* Description */}
                        <div className="ch-form-field">
                            <label className="ch-form-label">Description</label>
                            <input
                                className="ch-form-input"
                                placeholder="Optional description"
                                value={form.description}
                                onChange={e => patch('description', e.target.value)}
                            />
                        </div>

                        {/* Type */}
                        <div className="ch-form-field">
                            <label className="ch-form-label">Alert Type</label>
                            <div className="flex-row gap-3">
                                {ALERT_TYPE_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        className={`ch-card-radio flex-1 ${form.type === opt.value ? 'active' : ''}`}
                                        onClick={() => patch('type', opt.value)}
                                    >
                                        <div className="text-sm font-semibold text-text-primary">{opt.label}</div>
                                        <div className="text-xs text-text-muted mt-1">{opt.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Condition */}
                        <div className="ch-form-field">
                            <label className="ch-form-label">Condition</label>
                            <div className="flex-row gap-3 items-end">
                                <div className="flex-1">
                                    <div className="text-xs text-text-muted mb-1">Metric</div>
                                    <select
                                        className="ch-form-select"
                                        value={form.condition.metric}
                                        onChange={e => patchCondition('metric', e.target.value as Metric)}
                                    >
                                        {METRIC_OPTIONS.map(m => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ width: 80 }}>
                                    <div className="text-xs text-text-muted mb-1">Operator</div>
                                    <select
                                        className="ch-form-select"
                                        value={form.condition.operator}
                                        onChange={e => patchCondition('operator', e.target.value as Operator)}
                                    >
                                        {OPERATOR_OPTIONS.map(o => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ width: 100 }}>
                                    <div className="text-xs text-text-muted mb-1">Threshold</div>
                                    <input
                                        className="ch-form-input"
                                        type="number"
                                        step="any"
                                        value={form.condition.threshold}
                                        onChange={e => patchCondition('threshold', parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                                <div style={{ width: 100 }}>
                                    <div className="text-xs text-text-muted mb-1">Window (min)</div>
                                    <input
                                        className="ch-form-input"
                                        type="number"
                                        min={1}
                                        value={form.condition.window_minutes}
                                        onChange={e => patchCondition('window_minutes', parseInt(e.target.value) || 5)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Severity */}
                        <div className="ch-form-field">
                            <label className="ch-form-label">Severity</label>
                            <div className="flex-row gap-3">
                                {SEVERITY_OPTIONS.map(s => (
                                    <button
                                        key={s}
                                        type="button"
                                        className={`ch-card-radio flex-1 text-center ${form.severity === s ? 'active' : ''}`}
                                        onClick={() => patch('severity', s)}
                                    >
                                        <SeverityBadge severity={s} />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Notification Channels */}
                        <div className="ch-form-field">
                            <label className="ch-form-label">Notification Channels</label>

                            {form.channels.length > 0 && (
                                <div className="mb-3" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {form.channels.map((ch, i) => (
                                        <div
                                            key={i}
                                            className="flex-row items-center gap-2 px-3 py-2 rounded bg-bg-elevated border border-border-subtle"
                                        >
                                            <span className="badge badge-neutral uppercase" style={{ fontSize: 10 }}>{ch.type}</span>
                                            <span className="flex-1 text-xs font-mono text-text-secondary truncate">{ch.value}</span>
                                            <button
                                                type="button"
                                                className="ch-btn-ghost ch-btn-sm"
                                                style={{ padding: '2px 6px' }}
                                                onClick={() => removeChannel(i)}
                                            >
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex-row gap-2">
                                <select
                                    className="ch-form-select ch-form-select--sm"
                                    value={channelType}
                                    onChange={e => setChannelType(e.target.value as NotificationChannel['type'])}
                                    style={{ width: 150, flexShrink: 0 }}
                                >
                                    {CHANNEL_TYPES.map(c => (
                                        <option key={c.value} value={c.value}>{c.label}</option>
                                    ))}
                                </select>
                                <input
                                    className="ch-form-input"
                                    placeholder={channelPlaceholder}
                                    value={channelValue}
                                    onChange={e => setChannelValue(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChannel() } }}
                                    style={{ fontSize: 13, padding: '6px 10px' }}
                                />
                                <button
                                    type="button"
                                    className="ch-btn ch-btn-secondary ch-btn-sm shrink-0"
                                    onClick={addChannel}
                                >
                                    Add
                                </button>
                            </div>
                            <div className="ch-form-hint">Press Enter or click Add. Multiple channels supported.</div>
                        </div>
                    </div>

                    <div className="ch-modal-footer">
                        <button type="button" className="ch-btn ch-btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="ch-btn ch-btn-primary" disabled={submitting}>
                            {submitting && <span className="loading-spinner w-3 h-3" />}
                            {title.startsWith('Edit') ? 'Save Changes' : 'Create Alert'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Silence (Snooze) Modal
// ---------------------------------------------------------------------------

function SilenceModal({
    rule,
    onConfirm,
    onClose,
    loading,
}: {
    rule: AlertRule
    onConfirm: (until: string) => void
    onClose: () => void
    loading: boolean
}) {
    const [selected, setSelected] = useState<number>(60)

    const handleConfirm = () => {
        const until = new Date(Date.now() + selected * 60000).toISOString()
        onConfirm(until)
    }

    return (
        <div className="ch-modal-overlay" onClick={onClose}>
            <div className="ch-modal" onClick={e => e.stopPropagation()}>
                <div className="ch-modal-header">
                    <span className="ch-modal-title">Silence Alert</span>
                    <button className="ch-modal-close" onClick={onClose}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="ch-modal-body">
                    <p className="text-sm text-text-secondary mb-4">
                        Silence <span className="font-semibold text-text-primary">{rule.name}</span> for:
                    </p>
                    <div className="flex-row gap-2" style={{ flexWrap: 'wrap' }}>
                        {SNOOZE_DURATIONS.map(d => (
                            <button
                                key={d.minutes}
                                type="button"
                                className={`ch-card-radio ${selected === d.minutes ? 'active' : ''}`}
                                style={{ padding: '10px 16px' }}
                                onClick={() => setSelected(d.minutes)}
                            >
                                <span className="text-sm font-medium text-text-primary">{d.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="ch-modal-footer">
                    <button type="button" className="ch-btn ch-btn-secondary" onClick={onClose}>Cancel</button>
                    <button
                        type="button"
                        className="ch-btn ch-btn-primary"
                        onClick={handleConfirm}
                        disabled={loading}
                    >
                        {loading && <span className="loading-spinner w-3 h-3" />}
                        Silence
                    </button>
                </div>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Delete Confirmation Modal
// ---------------------------------------------------------------------------

function DeleteModal({
    rule,
    onConfirm,
    onClose,
    loading,
}: {
    rule: AlertRule
    onConfirm: () => void
    onClose: () => void
    loading: boolean
}) {
    return (
        <div className="ch-modal-overlay" onClick={onClose}>
            <div className="ch-modal" onClick={e => e.stopPropagation()}>
                <div className="ch-modal-header">
                    <span className="ch-modal-title">Delete Alert</span>
                    <button className="ch-modal-close" onClick={onClose}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="ch-modal-body">
                    <div className="ch-danger-zone" style={{ border: 'none', background: 'transparent', padding: 0 }}>
                        <p className="text-sm text-text-secondary">
                            Are you sure you want to permanently delete{' '}
                            <span className="font-semibold text-text-primary">{rule.name}</span>?
                            This action cannot be undone.
                        </p>
                    </div>
                </div>
                <div className="ch-modal-footer">
                    <button type="button" className="ch-btn ch-btn-secondary" onClick={onClose}>Cancel</button>
                    <button
                        type="button"
                        className="ch-btn ch-btn-danger"
                        onClick={onConfirm}
                        disabled={loading}
                    >
                        {loading && <span className="loading-spinner w-3 h-3" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />}
                        Delete Alert
                    </button>
                </div>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AlertsPage() {
    const queryClient = useQueryClient()

    // -- Local UI state
    const [activeTab, setActiveTab] = useState<Tab>('Rules')
    const [modal, setModal] = useState<
        | { kind: 'create' }
        | { kind: 'edit'; rule: AlertRule }
        | { kind: 'delete'; rule: AlertRule }
        | { kind: 'silence'; rule: AlertRule }
        | null
    >(null)

    // -- Queries
    const rulesQuery = useQuery<AlertRule[]>({
        queryKey: ['alerts', 'rules'],
        queryFn: alertsApi.list,
    })

    const historyQuery = useQuery<AlertEvent[]>({
        queryKey: ['alerts', 'history'],
        queryFn: alertsApi.history,
        enabled: activeTab === 'History',
    })

    // -- Mutations
    const createMutation = useMutation({
        mutationFn: (data: AlertFormData) => alertsApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['alerts'] })
            setModal(null)
            toast.success('Alert created')
        },
        onError: (err: Error) => toast.error(err.message),
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: AlertFormData }) => alertsApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['alerts'] })
            setModal(null)
            toast.success('Alert updated')
        },
        onError: (err: Error) => toast.error(err.message),
    })

    const deleteMutation = useMutation({
        mutationFn: (id: string) => alertsApi.remove(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['alerts'] })
            setModal(null)
            toast.success('Alert deleted')
        },
        onError: (err: Error) => toast.error(err.message),
    })

    const silenceMutation = useMutation({
        mutationFn: ({ id, until }: { id: string; until: string }) => alertsApi.silence(id, until),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['alerts'] })
            setModal(null)
            toast.success('Alert silenced')
        },
        onError: (err: Error) => toast.error(err.message),
    })

    const testMutation = useMutation({
        mutationFn: (id: string) => alertsApi.test(id),
        onSuccess: (data) => {
            toast.success(data.fired ? 'Test alert fired!' : 'Test completed (did not fire)')
        },
        onError: (err: Error) => toast.error(err.message),
    })

    // -- Derived
    const rules = rulesQuery.data ?? []
    const history = historyQuery.data ?? []
    const loading = rulesQuery.isLoading

    const stats = useMemo(() => ({
        total: rules.length,
        enabled: rules.filter(r => r.status === 'enabled').length,
        silenced: rules.filter(r => r.status === 'silenced').length,
        critical: rules.filter(r => r.severity === 'critical').length,
    }), [rules])

    const ruleToForm = useCallback((rule: AlertRule): AlertFormData => ({
        name: rule.name,
        description: rule.description,
        type: rule.type,
        condition: { ...rule.condition },
        channels: [...rule.channels],
        severity: rule.severity,
    }), [])

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    return (
        <>
            {/* Context Sidebar */}
            <div className="ch-sidebar-context">
                <div className="ch-context-header">
                    <div className="ch-context-tab active">Alerts</div>
                </div>
                <div className="ch-context-content">
                    <div className="text-[13px] text-white py-2 px-3 rounded bg-white/10 cursor-pointer font-medium mb-1">All Rules</div>
                    <div className="text-[13px] text-text-secondary py-2 px-3 hover:bg-white/5 cursor-pointer rounded mb-1 transition-colors flex-row items-center justify-between">
                        Enabled
                        <span className="bg-success/20 text-success px-1.5 py-0 rounded text-[10px] font-bold">{stats.enabled}</span>
                    </div>
                    <div className="text-[13px] text-text-secondary py-2 px-3 hover:bg-white/5 cursor-pointer rounded mb-1 transition-colors flex-row items-center justify-between">
                        Silenced
                        {stats.silenced > 0 && (
                            <span className="bg-warning/20 text-warning px-1.5 py-0 rounded text-[10px] font-bold">{stats.silenced}</span>
                        )}
                    </div>
                    <div className="text-[13px] text-text-secondary py-2 px-3 hover:bg-white/5 cursor-pointer rounded mb-1 transition-colors flex-row items-center justify-between">
                        Critical
                        {stats.critical > 0 && (
                            <span className="bg-error/20 text-error px-1.5 py-0 rounded text-[10px] font-bold">{stats.critical}</span>
                        )}
                    </div>

                    <div className="mt-6 mb-2 text-[10px] uppercase tracking-wider text-text-muted px-3 font-semibold">Quick Links</div>
                    <div className="text-[13px] text-text-secondary py-2 px-3 hover:bg-white/5 cursor-pointer rounded mb-1 transition-colors">Notification Settings</div>
                    <div className="text-[13px] text-text-secondary py-2 px-3 hover:bg-white/5 cursor-pointer rounded mb-1 transition-colors">Alert History</div>
                </div>
            </div>

            {/* Main Workspace */}
            <main className="ch-workspace bg-bg-base">
                <header className="ch-topbar">
                    <div className="ch-topbar-title flex flex-col justify-center">
                        <div className="text-[14px] text-text-primary font-bold flex-row items-center gap-2">
                            Alert Rules
                            {!loading && <span className="text-[11px] font-mono text-text-muted bg-bg-elevated px-1.5 rounded">{rules.length} rules</span>}
                        </div>
                    </div>

                    <div className="flex-row items-center gap-4">
                        {/* Tab Switcher */}
                        <div className="ch-topbar-actions bg-bg-surface border border-border-subtle rounded-md p-1">
                            {TABS.map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-3 py-1 text-[13px] font-medium rounded transition-colors ${
                                        activeTab === tab
                                            ? 'bg-bg-elevated text-text-primary shadow-sm'
                                            : 'text-text-muted hover:text-text-secondary'
                                    }`}
                                >
                                    {tab}
                                    {tab === 'Rules' && !loading && (
                                        <span className="tab-badge">{rules.length}</span>
                                    )}
                                    {tab === 'History' && !historyQuery.isLoading && history.length > 0 && (
                                        <span className="tab-badge">{history.length}</span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* New Alert Button */}
                        <button className="ch-btn ch-btn-primary" onClick={() => setModal({ kind: 'create' })}>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            New Alert
                        </button>
                    </div>
                </header>

                <div className="ch-workspace-scroll">
                    <div className="p-8 max-w-5xl mx-auto">

                        {/* ============================================================ */}
                        {/* RULES TAB                                                     */}
                        {/* ============================================================ */}
                        {activeTab === 'Rules' && (
                            <>
                                {/* Stat Cards */}
                                <div className="grid grid-cols-4 gap-4 mb-6">
                                    <div className="bg-[#18181A] border border-border-subtle rounded p-5 flex-col gap-1">
                                        <div className="text-2xl font-bold font-mono tracking-tight text-text-primary">{stats.total}</div>
                                        <div className="text-[13px] text-text-muted font-medium">Total Rules</div>
                                    </div>
                                    <div className="bg-[#18181A] border border-border-subtle rounded p-5 flex-col gap-1">
                                        <div className="text-2xl font-bold font-mono tracking-tight text-success">{stats.enabled}</div>
                                        <div className="text-[13px] text-text-muted font-medium">Enabled</div>
                                    </div>
                                    <div className="bg-[#18181A] border border-border-subtle rounded p-5 flex-col gap-1">
                                        <div className={`text-2xl font-bold font-mono tracking-tight ${stats.silenced > 0 ? 'text-warning' : 'text-text-primary'}`}>{stats.silenced}</div>
                                        <div className="text-[13px] text-text-muted font-medium">Silenced</div>
                                    </div>
                                    <div className="bg-[#18181A] border border-border-subtle rounded p-5 flex-col gap-1">
                                        <div className={`text-2xl font-bold font-mono tracking-tight ${stats.critical > 0 ? 'text-error' : 'text-text-primary'}`}>{stats.critical}</div>
                                        <div className="text-[13px] text-text-muted font-medium">Critical</div>
                                    </div>
                                </div>

                                {/* Rules Table */}
                                <div className="bg-[#18181A] border border-border-subtle rounded overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="ch-table w-full whitespace-nowrap">
                                            <thead>
                                                <tr>
                                                    <th>Name</th>
                                                    <th>Type</th>
                                                    <th>Condition</th>
                                                    <th>Severity</th>
                                                    <th>Status</th>
                                                    <th className="text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {loading ? (
                                                    Array.from({ length: 4 }).map((_, i) => (
                                                        <tr key={i}>
                                                            <td><div className="skeleton w-32" /></td>
                                                            <td><div className="skeleton w-16" /></td>
                                                            <td><div className="skeleton w-40" /></td>
                                                            <td><div className="skeleton w-16" /></td>
                                                            <td><div className="skeleton w-16" /></td>
                                                            <td><div className="skeleton w-24 ml-auto" /></td>
                                                        </tr>
                                                    ))
                                                ) : rules.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={6}>
                                                            <div className="empty-state !py-20">
                                                                <div className="text-[40px] text-text-muted/20 mb-4">&#x1F514;</div>
                                                                <div className="empty-state-title !text-lg !text-text-primary">No alert rules yet</div>
                                                                <div className="empty-state-desc !text-sm" style={{ maxWidth: 360, margin: '0 auto' }}>
                                                                    Create your first alert rule to get notified when metrics cross thresholds.
                                                                </div>
                                                                <button
                                                                    className="ch-btn ch-btn-primary mt-4"
                                                                    onClick={() => setModal({ kind: 'create' })}
                                                                >
                                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                                    </svg>
                                                                    Create Alert
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    rules.map(rule => (
                                                        <tr key={rule.id}>
                                                            <td>
                                                                <div className="font-semibold text-[13px] text-text-primary">{rule.name}</div>
                                                                {rule.description && (
                                                                    <div className="text-xs text-text-muted mt-1 truncate" style={{ maxWidth: 200 }}>{rule.description}</div>
                                                                )}
                                                            </td>
                                                            <td>
                                                                <span className="badge badge-neutral uppercase">{rule.type}</span>
                                                            </td>
                                                            <td>
                                                                <span className="font-mono text-xs text-text-secondary">
                                                                    {metricLabel(rule.condition.metric)} {operatorLabel(rule.condition.operator)} {rule.condition.threshold}
                                                                </span>
                                                                <span className="text-text-muted text-xs ml-2">/ {rule.condition.window_minutes}m</span>
                                                            </td>
                                                            <td>
                                                                <SeverityBadge severity={rule.severity} />
                                                            </td>
                                                            <td>
                                                                <StatusIndicator status={rule.status} silencedUntil={rule.silenced_until} />
                                                            </td>
                                                            <td className="text-right">
                                                                <div className="flex-row gap-1 justify-end">
                                                                    <button
                                                                        className="ch-btn ch-btn-ghost ch-btn-sm"
                                                                        onClick={() => setModal({ kind: 'edit', rule })}
                                                                        title="Edit"
                                                                    >
                                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                        </svg>
                                                                    </button>
                                                                    <button
                                                                        className="ch-btn ch-btn-ghost ch-btn-sm"
                                                                        onClick={() => setModal({ kind: 'silence', rule })}
                                                                        title="Silence"
                                                                        disabled={rule.status === 'silenced'}
                                                                    >
                                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                                                                        </svg>
                                                                    </button>
                                                                    <button
                                                                        className="ch-btn ch-btn-ghost ch-btn-sm"
                                                                        onClick={() => testMutation.mutate(rule.id)}
                                                                        title="Test Fire"
                                                                        disabled={testMutation.isPending}
                                                                    >
                                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                                        </svg>
                                                                    </button>
                                                                    <button
                                                                        className="ch-btn ch-btn-ghost ch-btn-sm ch-btn-ghost--danger"
                                                                        onClick={() => setModal({ kind: 'delete', rule })}
                                                                        title="Delete"
                                                                    >
                                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                        </svg>
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {!loading && rules.length > 0 && (
                                    <div className="text-center text-[11px] text-text-muted mt-4">
                                        Showing {rules.length} alert rule{rules.length !== 1 ? 's' : ''}
                                    </div>
                                )}
                            </>
                        )}

                        {/* ============================================================ */}
                        {/* HISTORY TAB                                                   */}
                        {/* ============================================================ */}
                        {activeTab === 'History' && (
                            <>
                                {historyQuery.isLoading ? (
                                    <div className="space-y-4">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <div key={i} className="card !p-0 overflow-hidden flex-row h-[80px]">
                                                <div className="w-1 bg-border-subtle" />
                                                <div className="p-4 flex-1 flex-col justify-between">
                                                    <div className="flex-row items-center gap-3">
                                                        <div className="skeleton w-16 h-5" />
                                                        <div className="skeleton w-32 h-4" />
                                                    </div>
                                                    <div className="skeleton w-64 h-3" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : history.length === 0 ? (
                                    <div className="empty-state !py-24 border border-border-subtle rounded-xl bg-bg-surface">
                                        <div className="text-[48px] text-success/20 mb-4 inline-block">
                                            <svg className="w-12 h-12" style={{ opacity: 0.2 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <div className="empty-state-title !text-lg !text-text-primary">No alert history</div>
                                        <div className="empty-state-desc !text-sm" style={{ maxWidth: 360, margin: '0 auto' }}>
                                            Alert trigger events will appear here when rules fire. Create rules and send traces to get started.
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {history.map(event => {
                                            const severityColor = event.severity === 'critical'
                                                ? 'var(--error)'
                                                : event.severity === 'warning'
                                                    ? 'var(--warning)'
                                                    : 'var(--info)'

                                            return (
                                                <div
                                                    key={event.id}
                                                    className="card !p-0 overflow-hidden flex-row transition-all hover:border-border hover:shadow-md bg-bg-surface border border-border-subtle"
                                                >
                                                    {/* Severity Bar */}
                                                    <div className="shrink-0" style={{ width: 4, background: severityColor }} />

                                                    <div className="p-4 flex-1 flex-row justify-between items-center">
                                                        {/* Left Content */}
                                                        <div className="flex-col gap-2">
                                                            <div className="flex-row items-center gap-3">
                                                                <SeverityBadge severity={event.severity} />
                                                                {event.resolved_at ? (
                                                                    <span className="badge badge-success uppercase">Resolved</span>
                                                                ) : (
                                                                    <span className="badge badge-error uppercase">Firing</span>
                                                                )}
                                                                <span className="font-semibold text-[13px] text-text-primary">{event.alert_name}</span>
                                                            </div>
                                                            <div className="text-xs text-text-secondary">{event.message}</div>
                                                            <div className="text-xs text-text-muted flex-row items-center gap-3">
                                                                <span className="flex-row items-center gap-1">
                                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                    </svg>
                                                                    {formatRelative(event.triggered_at)}
                                                                </span>
                                                                <span style={{ color: 'var(--text-muted)' }}>|</span>
                                                                <span className="font-mono">
                                                                    Value: {event.metric_value} (threshold: {event.threshold})
                                                                </span>
                                                                {event.resolved_at && (
                                                                    <>
                                                                        <span style={{ color: 'var(--text-muted)' }}>|</span>
                                                                        <span className="text-success">Resolved {formatRelative(event.resolved_at)}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Right Timestamp */}
                                                        <div className="shrink-0 text-right pl-6">
                                                            <div className="text-xs text-text-muted">{formatDate(event.triggered_at)}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}

                                {!historyQuery.isLoading && history.length > 0 && (
                                    <div className="text-center text-[11px] text-text-muted mt-4">
                                        Showing {history.length} alert event{history.length !== 1 ? 's' : ''}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </main>

            {/* ================================================================== */}
            {/* MODALS                                                              */}
            {/* ================================================================== */}

            {modal?.kind === 'create' && (
                <AlertFormModal
                    title="Create Alert Rule"
                    initial={EMPTY_FORM}
                    onSubmit={data => createMutation.mutate(data)}
                    onClose={() => setModal(null)}
                    submitting={createMutation.isPending}
                />
            )}

            {modal?.kind === 'edit' && (
                <AlertFormModal
                    title={`Edit Alert: ${modal.rule.name}`}
                    initial={ruleToForm(modal.rule)}
                    onSubmit={data => updateMutation.mutate({ id: modal.rule.id, data })}
                    onClose={() => setModal(null)}
                    submitting={updateMutation.isPending}
                />
            )}

            {modal?.kind === 'delete' && (
                <DeleteModal
                    rule={modal.rule}
                    onConfirm={() => deleteMutation.mutate(modal.rule.id)}
                    onClose={() => setModal(null)}
                    loading={deleteMutation.isPending}
                />
            )}

            {modal?.kind === 'silence' && (
                <SilenceModal
                    rule={modal.rule}
                    onConfirm={until => silenceMutation.mutate({ id: modal.rule.id, until })}
                    onClose={() => setModal(null)}
                    loading={silenceMutation.isPending}
                />
            )}
        </>
    )
}
