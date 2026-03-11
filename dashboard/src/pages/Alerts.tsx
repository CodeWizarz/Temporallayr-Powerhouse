import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Bell, Plus, Search, Filter, MoreHorizontal, Edit2, Play, BellOff,
  ToggleLeft, ToggleRight, Trash2, X, ChevronDown, ChevronRight,
  AlertTriangle, Info, AlertCircle, Check, Clock, Zap,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../lib/client';
import { Card, Badge, Button } from '../components/ui';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/shared';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight, Mail, MessageSquare, Webhook } from 'lucide-react';
import type { AlertRule as ApiAlertRule } from '../types';

type AlertRule = ApiAlertRule & {
  channel?: 'email' | 'slack' | 'webhook';
  service_name?: string;
};

interface AlertHistoryEntry {
  triggered_at: string;
  value: number;
  status: 'triggered' | 'resolved' | 'silenced';
}

interface AlertFormData {
  name: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  metric: string;
  operator: string;
  threshold: number | string;
  window_seconds: number;
  dataset: string;
  channels: string[];
  enabled: boolean;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

const SEVERITY_CONFIG = {
  info:     { color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   icon: Info },
  warning:  { color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  icon: AlertTriangle },
  critical: { color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    icon: AlertCircle },
} as const;

const WINDOW_OPTIONS = [
  { value: 300,   label: '5m' },
  { value: 900,   label: '15m' },
  { value: 1800,  label: '30m' },
  { value: 3600,  label: '1h' },
  { value: 21600, label: '6h' },
  { value: 86400, label: '24h' },
];

function AlertRow({ rule, onToggle, onDelete }: {
  rule: AlertRule;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const channel = rule.channel ?? (rule.channels?.[0] as 'email' | 'slack' | 'webhook' | undefined) ?? 'email';
  const ChannelIcon = CHANNEL_ICONS[channel] ?? Bell;

const DEFAULT_FORM: AlertFormData = {
  name: '',
  description: '',
  severity: 'warning',
  metric: 'error_rate',
  operator: '>',
  threshold: '',
  window_seconds: 900,
  dataset: '',
  channels: [],
  enabled: true,
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return 'just now';
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

function windowLabel(seconds: number): string {
  const opt = WINDOW_OPTIONS.find(w => w.value === seconds);
  if (opt) return opt.label;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

function conditionText(a: Alert): string {
  const metric = METRIC_OPTIONS.find(m => m.value === a.metric)?.label || a.metric;
  const unit = a.metric === 'error_rate' ? '%' : a.metric.includes('latency') ? 'ms' : '';
  return `${metric} ${a.operator} ${a.threshold}${unit} over ${windowLabel(a.window_seconds)}`;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/* ------------------------------------------------------------------ */
/*  Toast Component                                                    */
/* ------------------------------------------------------------------ */

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border
            bg-[#1a1a2e] text-white text-sm shadow-xl animate-in slide-in-from-right
            ${
              t.type === 'success' ? 'border-l-4 border-l-emerald-500 border-[#2a2a3e]'
              : t.type === 'error' ? 'border-l-4 border-l-red-500 border-[#2a2a3e]'
              : 'border-l-4 border-l-blue-500 border-[#2a2a3e]'
            }`}
        >
          {t.type === 'success' && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
          {t.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
          {t.type === 'info' && <Info className="w-4 h-4 text-blue-400 shrink-0" />}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => onDismiss(t.id)} className="text-gray-500 hover:text-gray-300">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Alerts Page                                                   */
/* ------------------------------------------------------------------ */

export default function Alerts() {
  const { range } = useTimeRange();
  const [searchParams, setSearchParams] = useSearchParams();

  /* State */
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [severityFilter, setSeverityFilter] = useState(searchParams.get('severity') || 'all');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, AlertHistoryEntry[]>>({});
  const [historyLoading, setHistoryLoading] = useState<Record<string, boolean>>({});

  /* Modals */
  const [showForm, setShowForm] = useState(false);
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null);
  const [formData, setFormData] = useState<AlertFormData>(DEFAULT_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [silenceTarget, setSilenceTarget] = useState<Alert | null>(null);
  const [silenceDuration, setSilenceDuration] = useState(3600);
  const [silenceReason, setSilenceReason] = useState('');
  const [silencing, setSilencing] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Alert | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [datasets, setDatasets] = useState<string[]>([]);
  const [channelInput, setChannelInput] = useState('');

  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /* Toast helpers */
  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = uid();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  /* Sync URL params */
  useEffect(() => {
    const p: Record<string, string> = {};
    if (search) p.q = search;
    if (severityFilter !== 'all') p.severity = severityFilter;
    if (statusFilter !== 'all') p.status = statusFilter;
    setSearchParams(p, { replace: true });
  }, [search, severityFilter, statusFilter, setSearchParams]);

  /* Fetch alerts */
  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.alerts.list() as Alert[];
      setAlerts(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  /* Fetch datasets for form */
  useEffect(() => {
    api.datasets.list()
      .then((res: any) => {
        const ds = res?.datasets || res || [];
        setDatasets(Array.isArray(ds) ? ds.map((d: any) => d.name || d) : []);
      })
      .catch(() => {});
  }, []);

  /* Close dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* Filtered alerts */
  const filtered = useMemo(() => {
    return alerts.filter(a => {
      if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
      if (statusFilter === 'enabled' && !a.enabled) return false;
      if (statusFilter === 'disabled' && a.enabled) return false;
      if (statusFilter === 'silenced' && !(a.silenced_until && new Date(a.silenced_until) > new Date())) return false;
      return true;
    });
  }, [alerts, search, severityFilter, statusFilter]);

  /* ---------------------------------------------------------------- */
  /*  Actions                                                          */
  /* ---------------------------------------------------------------- */

  const handleToggleEnable = async (alert: Alert) => {
    const prev = [...alerts];
    setAlerts(a => a.map(x => x.alert_id === alert.alert_id ? { ...x, enabled: !x.enabled } : x));
    try {
      await api.alerts.update(alert.alert_id, { enabled: !alert.enabled });
      addToast('success', `Alert "${alert.name}" ${!alert.enabled ? 'enabled' : 'disabled'}`);
    } catch (err: any) {
      setAlerts(prev);
      addToast('error', err.message || 'Failed to toggle alert');
    }
  };

  const handleTest = async (alert: Alert) => {
    try {
      await api.alerts.test(alert.alert_id);
      addToast('info', `Test notification sent to ${alert.channels.length} channel${alert.channels.length !== 1 ? 's' : ''}`);
    } catch (err: any) {
      addToast('error', err.message || 'Failed to send test');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.alerts.remove(deleteTarget.alert_id);
      setAlerts(a => a.filter(x => x.alert_id !== deleteTarget.alert_id));
      addToast('success', `Alert "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
    } catch (err: any) {
      addToast('error', err.message || 'Failed to delete alert');
    } finally {
      setDeleting(false);
    }
  };

  const handleSilence = async () => {
    if (!silenceTarget) return;
    setSilencing(true);
    try {
      const until = new Date(Date.now() + silenceDuration * 1000).toISOString();
      await api.alerts.silence(silenceTarget.alert_id, until);
      setAlerts(a => a.map(x =>
        x.alert_id === silenceTarget.alert_id ? { ...x, silenced_until: until } : x
      ));
      addToast('success', `Alert "${silenceTarget.name}" silenced`);
      setSilenceTarget(null);
      setSilenceReason('');
    } catch (err: any) {
      addToast('error', err.message || 'Failed to silence alert');
    } finally {
      setSilencing(false);
    }
  };

  /* Expand row - fetch history */
  const handleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!history[id]) {
      setHistoryLoading(prev => ({ ...prev, [id]: true }));
      try {
        const data = await api.alerts.history() as AlertHistoryEntry[];
        setHistory(prev => ({ ...prev, [id]: Array.isArray(data) ? data : [] }));
      } catch {
        setHistory(prev => ({ ...prev, [id]: [] }));
      } finally {
        setHistoryLoading(prev => ({ ...prev, [id]: false }));
      }
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Form handlers                                                    */
  /* ---------------------------------------------------------------- */

  const openCreate = () => {
    setEditingAlert(null);
    setFormData(DEFAULT_FORM);
    setFormErrors({});
    setShowForm(true);
  };

  const openEdit = (alert: Alert) => {
    setEditingAlert(alert);
    setFormData({
      name: alert.name,
      description: alert.description,
      severity: alert.severity,
      metric: alert.metric,
      operator: alert.operator,
      threshold: alert.threshold,
      window_seconds: alert.window_seconds,
      dataset: alert.dataset || '',
      channels: [...alert.channels],
      enabled: alert.enabled,
    });
    setFormErrors({});
    setShowForm(true);
  };

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim()) errs.name = 'Name is required';
    const thr = Number(formData.threshold);
    if (!formData.threshold && formData.threshold !== 0) errs.threshold = 'Threshold is required';
    else if (isNaN(thr) || thr <= 0) errs.threshold = 'Threshold must be > 0';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      severity: formData.severity,
      metric: formData.metric,
      operator: formData.operator,
      threshold: Number(formData.threshold),
      window_seconds: formData.window_seconds,
      dataset: formData.dataset || undefined,
      channels: formData.channels,
      enabled: formData.enabled,
    };
    try {
      if (editingAlert) {
        const updated = await api.alerts.update(editingAlert.alert_id, payload) as Alert;
        setAlerts(a => a.map(x => x.alert_id === editingAlert.alert_id
          ? { ...editingAlert, ...payload, ...updated }
          : x
        ));
        addToast('success', `Alert "${payload.name}" updated`);
      } else {
        const created = await api.alerts.create(payload) as Alert;
        setAlerts(a => [created, ...a]);
        addToast('success', `Alert "${payload.name}" created`);
      }
      setShowForm(false);
    } catch (err: any) {
      addToast('error', err.message || 'Failed to save alert');
    } finally {
      setSaving(false);
    }
  };

  const addChannel = () => {
    const ch = channelInput.trim();
    if (ch && !formData.channels.includes(ch)) {
      setFormData(prev => ({ ...prev, channels: [...prev.channels, ch] }));
    }
    setChannelInput('');
  };

  const removeChannel = (ch: string) => {
    setFormData(prev => ({ ...prev, channels: prev.channels.filter(c => c !== ch) }));
  };

  /* ---------------------------------------------------------------- */
  /*  Status helpers                                                   */
  /* ---------------------------------------------------------------- */

  const getAlertStatus = (a: Alert): 'enabled' | 'disabled' | 'silenced' => {
    if (a.silenced_until && new Date(a.silenced_until) > new Date()) return 'silenced';
    return a.enabled ? 'enabled' : 'disabled';
  };

  const statusDot = (a: Alert) => {
    const s = getAlertStatus(a);
    if (s === 'enabled') return 'bg-emerald-400';
    if (s === 'silenced') return 'bg-amber-400';
    return 'bg-gray-500';
  };

  const statusTooltip = (a: Alert) => {
    const s = getAlertStatus(a);
    if (s === 'silenced') return `Silenced until ${new Date(a.silenced_until!).toLocaleString()}`;
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Bell className="w-6 h-6 text-indigo-400" />
            Alerts
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Monitor your data and get notified when conditions are met
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500
            rounded-lg text-sm font-medium transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          Create Alert
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search alerts..."
            className="w-full pl-10 pr-4 py-2 bg-[#13131a] border border-[#1e1e2e] rounded-lg
              text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50
              transition-all duration-200"
          />
        ) : (
          rules.map((rule) => (
            <AlertRow
              key={rule.id}
              rule={rule as AlertRule}
              onToggle={(id, enabled) => toggleMutation.mutate({ id, enabled })}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={fetchAlerts} className="ml-auto text-red-300 hover:text-white text-xs underline">Retry</button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-[#13131a] border border-[#1e1e2e] rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-[#13131a] border border-[#1e1e2e] flex items-center justify-center mb-4">
            <Bell className="w-8 h-8 text-gray-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-300 mb-2">
            {alerts.length === 0 ? 'No alerts configured' : 'No alerts match filters'}
          </h3>
          <p className="text-sm text-gray-500 mb-6 max-w-md">
            {alerts.length === 0
              ? 'Create your first alert to start monitoring your data and receive notifications.'
              : 'Try adjusting your search or filter criteria.'}
          </p>
          {alerts.length === 0 && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500
                rounded-lg text-sm font-medium transition-all duration-200"
            >
              <Plus className="w-4 h-4" />
              Create Alert
            </button>
          )}
        </div>
      )}

      {/* Alerts Table */}
      {!loading && filtered.length > 0 && (
        <div className="border border-[#1e1e2e] rounded-lg overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[40px_1fr_100px_1.5fr_120px_120px_48px] gap-4 px-4 py-3
            bg-[#0d0d14] border-b border-[#1e1e2e] text-xs font-medium text-gray-500 uppercase tracking-wider">
            <span>Status</span>
            <span>Name</span>
            <span>Severity</span>
            <span>Condition</span>
            <span>Channels</span>
            <span>Last Triggered</span>
            <span></span>
          </div>

          {/* Table Body */}
          {filtered.map(alert => (
            <div key={alert.alert_id}>
              {/* Row */}
              <div
                className={`grid grid-cols-[40px_1fr_100px_1.5fr_120px_120px_48px] gap-4 px-4 py-3
                  items-center border-b border-[#1e1e2e] hover:bg-[#13131a] cursor-pointer
                  transition-all duration-200 group
                  ${expandedId === alert.alert_id ? 'bg-[#13131a]' : ''}`}
                onClick={() => handleExpand(alert.alert_id)}
              >
                {/* Status dot */}
                <div className="flex items-center justify-center">
                  <div className="relative" title={statusTooltip(alert)}>
                    <div className={`w-2.5 h-2.5 rounded-full ${statusDot(alert)}`} />
                    {getAlertStatus(alert) === 'enabled' && (
                      <div className={`absolute inset-0 w-2.5 h-2.5 rounded-full ${statusDot(alert)} animate-ping opacity-30`} />
                    )}
                  </div>
                </div>

                {/* Name */}
                <div className="flex items-center gap-2 min-w-0">
                  {expandedId === alert.alert_id
                    ? <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
                  }
                  <span className="text-sm font-medium truncate">{alert.name}</span>
                </div>

                {/* Severity badge */}
                <div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                    ${SEVERITY_CONFIG[alert.severity].bg} ${SEVERITY_CONFIG[alert.severity].color}
                    border ${SEVERITY_CONFIG[alert.severity].border}`}>
                    {(() => { const Icon = SEVERITY_CONFIG[alert.severity].icon; return <Icon className="w-3 h-3" />; })()}
                    {alert.severity}
                  </span>
                </div>

                {/* Condition */}
                <span className="text-sm text-gray-400 font-mono truncate">
                  {conditionText(alert)}
                </span>

                {/* Channels */}
                <div className="flex flex-wrap gap-1">
                  {alert.channels.slice(0, 2).map(ch => (
                    <span key={ch} className="px-1.5 py-0.5 bg-[#1a1a2e] border border-[#2a2a3e] rounded
                      text-xs text-gray-400 truncate max-w-[50px]" title={ch}>
                      {ch}
                    </span>
                  ))}
                  {alert.channels.length > 2 && (
                    <span className="text-xs text-gray-500">+{alert.channels.length - 2}</span>
                  )}
                </div>

                {/* Last Triggered */}
                <span className={`text-sm ${alert.last_triggered ? 'text-gray-300' : 'text-gray-600'}`}>
                  {relativeTime(alert.last_triggered)}
                </span>

                {/* Actions dropdown */}
                <div className="relative" ref={dropdownOpen === alert.alert_id ? dropdownRef : undefined}
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    onClick={() => setDropdownOpen(dropdownOpen === alert.alert_id ? null : alert.alert_id)}
                    className="p-1.5 rounded-md hover:bg-[#1e1e2e] text-gray-500 hover:text-gray-300
                      transition-all duration-200 opacity-0 group-hover:opacity-100"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>

                  {dropdownOpen === alert.alert_id && (
                    <div className="absolute right-0 top-8 z-40 w-48 bg-[#1a1a2e] border border-[#2a2a3e]
                      rounded-lg shadow-xl py-1 animate-in fade-in zoom-in-95">
                      <button
                        onClick={() => { setDropdownOpen(null); openEdit(alert); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300
                          hover:bg-[#252538] hover:text-white transition-colors"
                      >
                        <Edit2 className="w-4 h-4" /> Edit
                      </button>
                      <button
                        onClick={() => { setDropdownOpen(null); handleTest(alert); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300
                          hover:bg-[#252538] hover:text-white transition-colors"
                      >
                        <Play className="w-4 h-4" /> Test
                      </button>
                      <button
                        onClick={() => { setDropdownOpen(null); setSilenceTarget(alert); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300
                          hover:bg-[#252538] hover:text-white transition-colors"
                      >
                        <BellOff className="w-4 h-4" /> Silence
                      </button>
                      <button
                        onClick={() => { setDropdownOpen(null); handleToggleEnable(alert); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300
                          hover:bg-[#252538] hover:text-white transition-colors"
                      >
                        {alert.enabled
                          ? <><ToggleLeft className="w-4 h-4" /> Disable</>
                          : <><ToggleRight className="w-4 h-4" /> Enable</>
                        }
                      </button>
                      <div className="border-t border-[#2a2a3e] my-1" />
                      <button
                        onClick={() => { setDropdownOpen(null); setDeleteTarget(alert); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400
                          hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Expanded Detail Row */}
              {expandedId === alert.alert_id && (
                <div className="px-6 py-4 bg-[#0d0d14] border-b border-[#1e1e2e] animate-in slide-in-from-top-1">
                  {alert.description && (
                    <p className="text-sm text-gray-400 mb-4">{alert.description}</p>
                  )}

                  {historyLoading[alert.alert_id] ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <div className="w-4 h-4 border-2 border-gray-600 border-t-indigo-400 rounded-full animate-spin" />
                      Loading history...
                    </div>
                  ) : (
                    <>
                      {/* History Chart */}
                      {(history[alert.alert_id]?.length ?? 0) > 0 && (
                        <div className="mb-4">
                          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Trigger History</h4>
                          <div className="h-[80px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={history[alert.alert_id]?.map(h => ({
                                time: new Date(h.triggered_at).getTime(),
                                value: h.value,
                              })) || []}>
                                <defs>
                                  <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#818cf8" stopOpacity={0.3} />
                                    <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <XAxis dataKey="time" hide />
                                <YAxis hide />
                                <Tooltip
                                  contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 8, fontSize: 12 }}
                                  labelFormatter={v => new Date(v).toLocaleString()}
                                />
                                <Area type="monotone" dataKey="value" stroke="#818cf8" fill="url(#histGrad)" strokeWidth={1.5} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}

                      {/* History Table */}
                      {(history[alert.alert_id]?.length ?? 0) > 0 ? (
                        <div>
                          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Recent Triggers</h4>
                          <div className="border border-[#1e1e2e] rounded-lg overflow-hidden">
                            <div className="grid grid-cols-3 gap-4 px-4 py-2 bg-[#0a0a0f] text-xs font-medium text-gray-500 uppercase">
                              <span>Triggered At</span>
                              <span>Value</span>
                              <span>Status</span>
                            </div>
                            {history[alert.alert_id]!.slice(0, 10).map((h, i) => (
                              <div key={i} className="grid grid-cols-3 gap-4 px-4 py-2 border-t border-[#1e1e2e] text-sm">
                                <span className="text-gray-400">{new Date(h.triggered_at).toLocaleString()}</span>
                                <span className="text-gray-300 font-mono">{h.value}</span>
                                <span className={`text-xs font-medium ${
                                  h.status === 'triggered' ? 'text-red-400'
                                  : h.status === 'resolved' ? 'text-emerald-400'
                                  : 'text-amber-400'
                                }`}>
                                  {h.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No trigger history yet.</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ============================================================ */}
      {/*  Create/Edit Slide-over                                       */}
      {/* ============================================================ */}

      {showForm && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 animate-in fade-in"
            onClick={() => setShowForm(false)}
          />
          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-[500px] max-w-full bg-[#0d0d14] border-l border-[#1e1e2e]
            z-50 flex flex-col animate-in slide-in-from-right shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e2e]">
              <h2 className="text-lg font-semibold">
                {editingAlert ? 'Edit Alert' : 'Create Alert'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-1 rounded-md hover:bg-[#1e1e2e] text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. High Error Rate"
                  className={`w-full px-3 py-2 bg-[#13131a] border rounded-lg text-sm text-white
                    placeholder-gray-500 focus:outline-none transition-all duration-200
                    ${formErrors.name ? 'border-red-500/50 focus:border-red-500' : 'border-[#1e1e2e] focus:border-indigo-500/50'}`}
                />
                {formErrors.name && <p className="text-xs text-red-400 mt-1">{formErrors.name}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                  placeholder="Optional description..."
                  rows={3}
                  className="w-full px-3 py-2 bg-[#13131a] border border-[#1e1e2e] rounded-lg text-sm text-white
                    placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 transition-all duration-200 resize-none"
                />
              </div>

              {/* Severity */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Severity</label>
                <select
                  value={formData.severity}
                  onChange={e => setFormData(p => ({ ...p, severity: e.target.value as AlertFormData['severity'] }))}
                  className="w-full px-3 py-2 bg-[#13131a] border border-[#1e1e2e] rounded-lg text-sm text-white
                    focus:outline-none focus:border-indigo-500/50 transition-all duration-200"
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              {/* Condition Row */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Condition *</label>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={formData.metric}
                    onChange={e => setFormData(p => ({ ...p, metric: e.target.value }))}
                    className="px-3 py-2 bg-[#13131a] border border-[#1e1e2e] rounded-lg text-sm text-white
                      focus:outline-none focus:border-indigo-500/50 transition-all duration-200"
                  >
                    {METRIC_OPTIONS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>

                  <select
                    value={formData.operator}
                    onChange={e => setFormData(p => ({ ...p, operator: e.target.value }))}
                    className="px-3 py-2 bg-[#13131a] border border-[#1e1e2e] rounded-lg text-sm text-white
                      focus:outline-none focus:border-indigo-500/50 transition-all duration-200"
                  >
                    {OPERATOR_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>

                  <div>
                    <input
                      type="number"
                      value={formData.threshold}
                      onChange={e => setFormData(p => ({ ...p, threshold: e.target.value }))}
                      placeholder="Threshold"
                      className={`w-full px-3 py-2 bg-[#13131a] border rounded-lg text-sm text-white
                        placeholder-gray-500 focus:outline-none transition-all duration-200
                        ${formErrors.threshold ? 'border-red-500/50 focus:border-red-500' : 'border-[#1e1e2e] focus:border-indigo-500/50'}`}
                    />
                  </div>
                </div>
                {formErrors.threshold && <p className="text-xs text-red-400 mt-1">{formErrors.threshold}</p>}
              </div>

              {/* Time Window */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Time Window</label>
                <select
                  value={formData.window_seconds}
                  onChange={e => setFormData(p => ({ ...p, window_seconds: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-[#13131a] border border-[#1e1e2e] rounded-lg text-sm text-white
                    focus:outline-none focus:border-indigo-500/50 transition-all duration-200"
                >
                  {WINDOW_OPTIONS.map(w => (
                    <option key={w.value} value={w.value}>{w.label}</option>
                  ))}
                </select>
              </div>

              {/* Dataset */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Dataset (optional)</label>
                <select
                  value={formData.dataset}
                  onChange={e => setFormData(p => ({ ...p, dataset: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#13131a] border border-[#1e1e2e] rounded-lg text-sm text-white
                    focus:outline-none focus:border-indigo-500/50 transition-all duration-200"
                >
                  <option value="">All datasets</option>
                  {datasets.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Notification Channels */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Notification Channels</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.channels.map(ch => (
                    <span key={ch} className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-500/10
                      border border-indigo-500/30 rounded-md text-xs text-indigo-300">
                      {ch}
                      <button onClick={() => removeChannel(ch)} className="hover:text-white">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={channelInput}
                    onChange={e => setChannelInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChannel(); } }}
                    placeholder="Add channel (e.g. #slack-alerts, email)"
                    className="flex-1 px-3 py-2 bg-[#13131a] border border-[#1e1e2e] rounded-lg text-sm text-white
                      placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={addChannel}
                    className="px-3 py-2 bg-[#1e1e2e] hover:bg-[#252538] border border-[#2a2a3e]
                      rounded-lg text-sm text-gray-300 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Enabled Toggle */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-300">Enabled</label>
                <button
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, enabled: !p.enabled }))}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200
                    ${formData.enabled ? 'bg-indigo-600' : 'bg-gray-600'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full
                    transition-transform duration-200 ${formData.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#1e1e2e]">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500
                  disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium
                  transition-all duration-200"
              >
                {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {editingAlert ? 'Update Alert' : 'Create Alert'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ============================================================ */}
      {/*  Silence Modal                                                */}
      {/* ============================================================ */}

      {silenceTarget && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 animate-in fade-in" onClick={() => setSilenceTarget(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50
            w-[420px] max-w-[90vw] bg-[#13131a] border border-[#1e1e2e] rounded-xl shadow-2xl
            animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-[#1e1e2e]">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <BellOff className="w-5 h-5 text-amber-400" />
                Silence Alert
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                Silence "{silenceTarget.name}" for:
              </p>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Duration pills */}
              <div className="flex flex-wrap gap-2">
                {SILENCE_DURATIONS.map(d => (
                  <button
                    key={d.value}
                    onClick={() => setSilenceDuration(d.value || 3600)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200
                      ${silenceDuration === d.value
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                        : 'bg-[#1a1a2e] border-[#2a2a3e] text-gray-400 hover:text-white hover:border-gray-500'
                      }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Reason (optional)</label>
                <textarea
                  value={silenceReason}
                  onChange={e => setSilenceReason(e.target.value)}
                  placeholder="Why are you silencing this alert?"
                  rows={2}
                  className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg text-sm text-white
                    placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-all duration-200 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#1e1e2e]">
              <button
                onClick={() => { setSilenceTarget(null); setSilenceReason(''); }}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSilence}
                disabled={silencing}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500
                  disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium
                  transition-all duration-200"
              >
                {silencing && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Silence Alert
              </button>
            </div>
          </div>
        </>
      )}

      {/* ============================================================ */}
      {/*  Delete Confirmation Modal                                    */}
      {/* ============================================================ */}

      {deleteTarget && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 animate-in fade-in" onClick={() => setDeleteTarget(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50
            w-[400px] max-w-[90vw] bg-[#13131a] border border-[#1e1e2e] rounded-xl shadow-2xl
            animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-[#1e1e2e]">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-400" />
                Delete Alert
              </h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-300">
                Delete alert <strong>"{deleteTarget.name}"</strong>? This cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#1e1e2e]">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500
                  disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium
                  transition-all duration-200"
              >
                {deleting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
