import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, AlertCircle, Info, Shield, ShieldCheck, ShieldAlert,
  Search, Filter, Clock, CheckCircle2, Eye, ChevronDown, ChevronRight,
  X, Activity, Zap, Server, Link2, ArrowRight,
} from 'lucide-react';
import { api } from '../lib/client';
import { useTimeRange } from '../components/Layout';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Incident {
  incident_id: string;
  tenant_id: string;
  cluster_id: string;
  title?: string;
  description?: string;
  severity: 'critical' | 'high' | 'normal' | 'warning' | 'info';
  status: 'open' | 'acknowledged' | 'resolved';
  count: number;
  first_seen: string;
  last_seen: string;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  failing_node?: string;
  affected_services?: string[];
  alert_id?: string | null;
  alert_name?: string | null;
}

type TabKey = 'all' | 'open' | 'acknowledged' | 'resolved';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

const SEVERITY_CONFIG = {
  critical: { color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500',    borderLight: 'border-red-500/30',  icon: AlertCircle,   label: 'Critical' },
  high:     { color: 'text-orange-400',  bg: 'bg-orange-500/10', border: 'border-orange-500', borderLight: 'border-orange-500/30', icon: AlertTriangle, label: 'High' },
  warning:  { color: 'text-amber-400',   bg: 'bg-amber-500/10',  border: 'border-amber-500',  borderLight: 'border-amber-500/30', icon: AlertTriangle, label: 'Warning' },
  normal:   { color: 'text-blue-400',    bg: 'bg-blue-500/10',   border: 'border-blue-500',   borderLight: 'border-blue-500/30',  icon: Info,          label: 'Normal' },
  info:     { color: 'text-blue-400',    bg: 'bg-blue-500/10',   border: 'border-blue-500',   borderLight: 'border-blue-500/30',  icon: Info,          label: 'Info' },
} as const;

const STATUS_CONFIG = {
  open:         { color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/30',     label: 'Active',       pulse: true },
  acknowledged: { color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   label: 'Acknowledged', pulse: false },
  resolved:     { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'Resolved',     pulse: false },
} as const;

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all',          label: 'All' },
  { key: 'open',         label: 'Active' },
  { key: 'acknowledged', label: 'Acknowledged' },
  { key: 'resolved',     label: 'Resolved' },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return 'N/A';
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

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

const sevOrder: Record<string, number> = { critical: 0, high: 1, warning: 2, normal: 3, info: 4 };

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
          {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
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
/*  Status Timeline (horizontal stepper)                               */
/* ------------------------------------------------------------------ */

function StatusTimeline({ incident }: { incident: Incident }) {
  const steps = [
    { key: 'open',         label: 'Active',       time: incident.first_seen,       icon: Zap,          done: true },
    { key: 'acknowledged', label: 'Acknowledged',  time: incident.acknowledged_at,  icon: Eye,          done: !!incident.acknowledged_at },
    { key: 'resolved',     label: 'Resolved',      time: incident.resolved_at,      icon: CheckCircle2, done: !!incident.resolved_at },
  ];

  return (
    <div className="flex items-center gap-0 w-full">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center flex-1">
          {/* Step */}
          <div className="flex flex-col items-center">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-200
              ${step.done
                ? step.key === 'resolved'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                  : step.key === 'acknowledged'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                    : 'bg-red-500/20 border-red-500 text-red-400'
                : 'bg-[#13131a] border-[#2a2a3e] text-gray-600'
              }`}
            >
              <step.icon className="w-4 h-4" />
            </div>
            <span className={`text-xs mt-1.5 font-medium ${step.done ? 'text-gray-300' : 'text-gray-600'}`}>
              {step.label}
            </span>
            {step.time && (
              <span className="text-[10px] text-gray-500 mt-0.5">{relativeTime(step.time)}</span>
            )}
          </div>

          {/* Connector */}
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 mt-[-18px] transition-all duration-200
              ${steps[i + 1].done ? 'bg-gradient-to-r from-indigo-500 to-purple-500' : 'bg-[#1e1e2e]'}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Incident Card                                                      */
/* ------------------------------------------------------------------ */

function IncidentCard({
  incident,
  expanded,
  onToggle,
  onAcknowledge,
  onResolve,
  ackLoading,
  resolveLoading,
}: {
  incident: Incident;
  expanded: boolean;
  onToggle: () => void;
  onAcknowledge: () => void;
  onResolve: () => void;
  ackLoading: boolean;
  resolveLoading: boolean;
}) {
  const sev = SEVERITY_CONFIG[incident.severity] || SEVERITY_CONFIG.normal;
  const stat = STATUS_CONFIG[incident.status] || STATUS_CONFIG.open;
  const SevIcon = sev.icon;
  const title = incident.title || incident.failing_node || `Incident ${incident.incident_id.slice(0, 8)}`;
  const description = incident.description || `${incident.count} occurrence${incident.count !== 1 ? 's' : ''} detected in cluster ${incident.cluster_id.slice(0, 12)}`;
  const services = incident.affected_services || (incident.failing_node ? [incident.failing_node] : []);

  return (
    <div className={`bg-[#13131a] border rounded-lg overflow-hidden transition-all duration-200
      hover:border-[#2a2a3e] hover:shadow-lg hover:shadow-black/20
      ${expanded ? 'border-[#2a2a3e]' : 'border-[#1e1e2e]'}`}
    >
      {/* Card with colored left border */}
      <div className={`border-l-4 ${sev.border}`}>
        {/* Main row */}
        <div
          className="px-5 py-4 cursor-pointer"
          onClick={onToggle}
        >
          <div className="flex items-start justify-between gap-4">
            {/* Left: icon + content */}
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {/* Severity icon */}
              <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${sev.bg}`}>
                <SevIcon className={`w-4 h-4 ${sev.color}`} />
              </div>

              <div className="flex-1 min-w-0">
                {/* Header row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-white truncate">{title}</h3>

                  {/* Status badge */}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                    ${stat.bg} ${stat.color} border ${stat.border}`}>
                    {stat.pulse && (
                      <span className="relative flex h-2 w-2">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${stat.color.replace('text-', 'bg-')}`} />
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${stat.color.replace('text-', 'bg-')}`} />
                      </span>
                    )}
                    {stat.label}
                  </span>

                  {/* Severity badge */}
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider
                    ${sev.bg} ${sev.color} border ${sev.borderLight}`}>
                    {sev.label}
                  </span>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-400 mt-1 line-clamp-2">{description}</p>

                {/* Services + timestamps */}
                <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 mt-2.5">
                  {/* Affected services */}
                  {services.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Server className="w-3 h-3 text-gray-500" />
                      <div className="flex gap-1">
                        {services.slice(0, 3).map(s => (
                          <span key={s} className="px-1.5 py-0.5 bg-[#1a1a2e] border border-[#2a2a3e] rounded
                            text-[11px] text-cyan-400 font-mono">
                            {s}
                          </span>
                        ))}
                        {services.length > 3 && (
                          <span className="text-[11px] text-gray-500">+{services.length - 3}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Timestamps */}
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Started {relativeTime(incident.first_seen)}
                    </span>
                    {incident.acknowledged_at && (
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3 text-amber-500" />
                        Ack'd {relativeTime(incident.acknowledged_at)}
                      </span>
                    )}
                    {incident.resolved_at && (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        Resolved {relativeTime(incident.resolved_at)}
                      </span>
                    )}
                    {incident.count > 1 && (
                      <span className="flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        {incident.count} events
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: action buttons + expand chevron */}
            <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
              {incident.status === 'open' && (
                <button
                  onClick={onAcknowledge}
                  disabled={ackLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30
                    border border-amber-500/30 rounded-lg text-xs font-medium text-amber-300
                    disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {ackLoading
                    ? <div className="w-3 h-3 border-2 border-amber-300/30 border-t-amber-300 rounded-full animate-spin" />
                    : <Eye className="w-3 h-3" />
                  }
                  Acknowledge
                </button>
              )}
              {(incident.status === 'open' || incident.status === 'acknowledged') && (
                <button
                  onClick={onResolve}
                  disabled={resolveLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30
                    border border-emerald-500/30 rounded-lg text-xs font-medium text-emerald-300
                    disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {resolveLoading
                    ? <div className="w-3 h-3 border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin" />
                    : <CheckCircle2 className="w-3 h-3" />
                  }
                  Resolve
                </button>
              )}
              <button
                onClick={onToggle}
                className="p-1.5 rounded-md hover:bg-[#1e1e2e] text-gray-500 hover:text-gray-300 transition-colors"
              >
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Expanded Detail */}
        {expanded && (
          <div className="px-5 pb-5 pt-1 border-t border-[#1e1e2e] animate-in slide-in-from-top-1">
            {/* Status Timeline */}
            <div className="mb-5 pt-4">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Status Timeline</h4>
              <StatusTimeline incident={incident} />
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <DetailCard label="Incident ID" value={incident.incident_id.slice(0, 12) + '...'} mono />
              <DetailCard label="Cluster" value={incident.cluster_id.slice(0, 12) + '...'} mono />
              <DetailCard label="Events" value={String(incident.count)} />
              <DetailCard label="Duration" value={incident.resolved_at
                ? formatDuration(new Date(incident.resolved_at).getTime() - new Date(incident.first_seen).getTime())
                : formatDuration(Date.now() - new Date(incident.first_seen).getTime()) + ' (ongoing)'
              } />
            </div>

            {/* Full Description */}
            {incident.description && (
              <div className="mb-4">
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Description</h4>
                <p className="text-sm text-gray-300">{incident.description}</p>
              </div>
            )}

            {/* Affected Services */}
            {services.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Affected Services</h4>
                <div className="flex flex-wrap gap-2">
                  {services.map(s => (
                    <span key={s} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#1a1a2e]
                      border border-[#2a2a3e] rounded-lg text-xs text-cyan-400 font-mono">
                      <Server className="w-3 h-3" />
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Related Alert */}
            {incident.alert_id && (
              <div className="mb-4">
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Related Alert</h4>
                <a
                  href={`/alerts?q=${encodeURIComponent(incident.alert_name || incident.alert_id)}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10
                    border border-indigo-500/30 rounded-lg text-xs text-indigo-300
                    hover:bg-indigo-500/20 transition-colors"
                >
                  <Link2 className="w-3 h-3" />
                  {incident.alert_name || incident.alert_id}
                  <ArrowRight className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Activity Log */}
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Activity Log</h4>
              <div className="relative pl-4 border-l border-[#1e1e2e] space-y-3">
                <ActivityEntry
                  icon={Zap}
                  iconColor="text-red-400"
                  title="Incident opened"
                  time={incident.first_seen}
                  description={`First occurrence detected with severity ${incident.severity}`}
                />
                {incident.acknowledged_at && (
                  <ActivityEntry
                    icon={Eye}
                    iconColor="text-amber-400"
                    title="Acknowledged"
                    time={incident.acknowledged_at}
                  />
                )}
                {incident.resolved_at && (
                  <ActivityEntry
                    icon={CheckCircle2}
                    iconColor="text-emerald-400"
                    title="Resolved"
                    time={incident.resolved_at}
                    description={`After ${formatDuration(new Date(incident.resolved_at).getTime() - new Date(incident.first_seen).getTime())}`}
                  />
                )}
                {incident.count > 1 && (
                  <ActivityEntry
                    icon={Activity}
                    iconColor="text-gray-400"
                    title={`${incident.count} total events recorded`}
                    time={incident.last_seen}
                    description="Most recent occurrence"
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* Detail card mini-component */
function DetailCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="px-3 py-2 bg-[#0d0d14] border border-[#1e1e2e] rounded-lg">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-sm text-gray-200 truncate ${mono ? 'font-mono' : ''}`} title={value}>{value}</p>
    </div>
  );
}

/* Activity entry */
function ActivityEntry({
  icon: Icon,
  iconColor,
  title,
  time,
  description,
}: {
  icon: typeof Zap;
  iconColor: string;
  title: string;
  time: string;
  description?: string;
}) {
  return (
    <div className="relative">
      <div className={`absolute -left-[22px] top-0.5 w-5 h-5 rounded-full bg-[#13131a] border border-[#1e1e2e]
        flex items-center justify-center`}>
        <Icon className={`w-3 h-3 ${iconColor}`} />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-200">{title}</span>
          <span className="text-xs text-gray-500">{relativeTime(time)}</span>
        </div>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

/* Duration formatter */
function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ${min % 60}m`;
  const d = Math.floor(hr / 24);
  return `${d}d ${hr % 24}h`;
}

/* ================================================================== */
/*  Main Incidents Page                                                */
/* ================================================================== */

export default function Incidents() {
  const { range } = useTimeRange();
  const [searchParams, setSearchParams] = useSearchParams();

  /* State */
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>((searchParams.get('tab') as TabKey) || 'all');
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [severityFilter, setSeverityFilter] = useState(searchParams.get('severity') || 'all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [actionLoading, setActionLoading] = useState<Record<string, 'ack' | 'resolve' | null>>({});

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
    if (activeTab !== 'all') p.tab = activeTab;
    if (search) p.q = search;
    if (severityFilter !== 'all') p.severity = severityFilter;
    setSearchParams(p, { replace: true });
  }, [activeTab, search, severityFilter, setSearchParams]);

  /* Fetch incidents */
  const fetchIncidents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.incidents.list(100, 0);
      setIncidents(res.items || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load incidents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchIncidents(); }, [fetchIncidents]);

  /* Auto-refresh every 30s for active incidents */
  useEffect(() => {
    if (activeTab === 'resolved') return;
    const iv = setInterval(fetchIncidents, 30000);
    return () => clearInterval(iv);
  }, [activeTab, fetchIncidents]);

  /* Tab counts */
  const counts = useMemo(() => {
    const c = { all: incidents.length, open: 0, acknowledged: 0, resolved: 0 };
    for (const inc of incidents) {
      if (inc.status === 'open') c.open++;
      else if (inc.status === 'acknowledged') c.acknowledged++;
      else if (inc.status === 'resolved') c.resolved++;
    }
    return c;
  }, [incidents]);

  /* Filtered + sorted */
  const filtered = useMemo(() => {
    return incidents
      .filter(inc => {
        if (activeTab !== 'all' && inc.status !== activeTab) return false;
        if (severityFilter !== 'all' && inc.severity !== severityFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          const title = (inc.title || inc.failing_node || inc.incident_id).toLowerCase();
          const svcMatch = (inc.affected_services || []).some(s => s.toLowerCase().includes(q));
          if (!title.includes(q) && !svcMatch) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const sevDiff = (sevOrder[a.severity] ?? 99) - (sevOrder[b.severity] ?? 99);
        if (sevDiff !== 0) return sevDiff;
        return new Date(b.first_seen).getTime() - new Date(a.first_seen).getTime();
      });
  }, [incidents, activeTab, severityFilter, search]);

  /* Actions */
  const handleAcknowledge = async (inc: Incident) => {
    setActionLoading(prev => ({ ...prev, [inc.incident_id]: 'ack' }));
    const prev = [...incidents];
    setIncidents(list => list.map(x => x.incident_id === inc.incident_id
      ? { ...x, status: 'acknowledged' as const, acknowledged_at: new Date().toISOString() }
      : x
    ));
    try {
      await api.incidents.ack(inc.incident_id);
      addToast('success', `Incident acknowledged`);
    } catch (err: any) {
      setIncidents(prev);
      addToast('error', err.message || 'Failed to acknowledge');
    } finally {
      setActionLoading(prev => ({ ...prev, [inc.incident_id]: null }));
    }
  };

  const handleResolve = async (inc: Incident) => {
    setActionLoading(prev => ({ ...prev, [inc.incident_id]: 'resolve' }));
    const prev = [...incidents];
    setIncidents(list => list.map(x => x.incident_id === inc.incident_id
      ? { ...x, status: 'resolved' as const, resolved_at: new Date().toISOString() }
      : x
    ));
    try {
      await api.incidents.resolve(inc.incident_id);
      addToast('success', `Incident resolved`);
    } catch (err: any) {
      setIncidents(prev);
      addToast('error', err.message || 'Failed to resolve');
    } finally {
      setActionLoading(prev => ({ ...prev, [inc.incident_id]: null }));
    }
  };

  /* Empty state messages per tab */
  const emptyMessages: Record<TabKey, { title: string; desc: string; icon: typeof ShieldCheck }> = {
    all:          { title: 'No incidents',               desc: 'No incidents have been recorded yet.',              icon: Shield },
    open:         { title: 'No active incidents',        desc: 'All clear! No incidents require attention.',        icon: ShieldCheck },
    acknowledged: { title: 'No acknowledged incidents',  desc: 'No incidents are currently being investigated.',    icon: ShieldAlert },
    resolved:     { title: 'No resolved incidents',      desc: 'No incidents have been resolved in this period.',   icon: ShieldCheck },
  };

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-indigo-400" />
            Incidents
          </h1>
          {counts.open > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-500/10 border border-red-500/30
              rounded-full text-xs font-semibold text-red-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-400" />
              </span>
              {counts.open} active
            </span>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 mb-4 p-1 bg-[#13131a] border border-[#1e1e2e] rounded-lg w-fit">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200
              ${activeTab === tab.key
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'text-gray-400 hover:text-white hover:bg-[#1a1a2e]'
              }`}
          >
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full
              ${activeTab === tab.key
                ? 'bg-white/20 text-white'
                : 'bg-[#1a1a2e] text-gray-500'
              }`}>
              {counts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Search + Severity Filter */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title or service..."
            className="w-full pl-10 pr-4 py-2 bg-[#13131a] border border-[#1e1e2e] rounded-lg
              text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50
              transition-all duration-200"
          />
        </div>

        <select
          value={severityFilter}
          onChange={e => setSeverityFilter(e.target.value)}
          className="px-3 py-2 bg-[#13131a] border border-[#1e1e2e] rounded-lg text-sm text-gray-300
            focus:outline-none focus:border-indigo-500/50 transition-all duration-200"
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="warning">Warning</option>
          <option value="normal">Normal</option>
          <option value="info">Info</option>
        </select>

        {(search || severityFilter !== 'all') && (
          <button
            onClick={() => { setSearch(''); setSeverityFilter('all'); }}
            className="px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={fetchIncidents} className="ml-auto text-red-300 hover:text-white text-xs underline">Retry</button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-[#13131a] border border-[#1e1e2e] rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filtered.length === 0 && (() => {
        const empty = emptyMessages[activeTab];
        const EmptyIcon = empty.icon;
        return (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-[#13131a] border border-[#1e1e2e] flex items-center justify-center mb-4">
              <EmptyIcon className={`w-8 h-8 ${
                activeTab === 'open' ? 'text-emerald-500' : 'text-gray-600'
              }`} />
            </div>
            <h3 className="text-lg font-medium text-gray-300 mb-2">{empty.title}</h3>
            <p className="text-sm text-gray-500 max-w-md">{empty.desc}</p>
          </div>
        );
      })()}

      {/* Incident Cards */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(inc => (
            <IncidentCard
              key={inc.incident_id}
              incident={inc}
              expanded={expandedId === inc.incident_id}
              onToggle={() => setExpandedId(expandedId === inc.incident_id ? null : inc.incident_id)}
              onAcknowledge={() => handleAcknowledge(inc)}
              onResolve={() => handleResolve(inc)}
              ackLoading={actionLoading[inc.incident_id] === 'ack'}
              resolveLoading={actionLoading[inc.incident_id] === 'resolve'}
            />
          ))}
        </div>
      )}

      {/* Summary Footer */}
      {!loading && incidents.length > 0 && (
        <div className="mt-6 flex items-center justify-between text-xs text-gray-500 px-1">
          <span>
            Showing {filtered.length} of {incidents.length} incident{incidents.length !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Auto-refreshes every 30s
          </span>
        </div>
      )}
    </div>
  );
}
