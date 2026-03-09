import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/client';
import { Card, Badge } from '../components/ui';
import { PageHeader } from '../components/shared';
import { Skeleton } from '../components/ui/Skeleton';
import { formatDate } from '../lib/utils';
import { CheckCircle, XCircle, AlertTriangle, Clock, Server, Activity } from 'lucide-react';

interface ServiceStatus {
  service_name: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  latency_ms: number;
  error_rate: number;
  uptime_pct: number;
  last_seen: string;
  span_count_24h: number;
}

const STATUS_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  healthy: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Healthy' },
  degraded: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: 'Degraded' },
  down: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Down' },
  unknown: { icon: Clock, color: 'text-[var(--text-muted)]', bg: 'bg-[var(--bg-elevated)]', label: 'Unknown' },
};

function StatusRow({ service }: { service: ServiceStatus }) {
  const config = STATUS_CONFIG[service.status] ?? STATUS_CONFIG.unknown;
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-4 p-4 border-b border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)] transition-colors">
      <div className={`p-2 rounded-lg ${config.bg}`}>
        <Icon size={16} className={config.color} />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-[var(--text-primary)]">{service.service_name}</h4>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-[var(--text-muted)]">
          <span>Last seen: {formatDate(service.last_seen)}</span>
        </div>
      </div>
      <div className="flex items-center gap-6 text-xs">
        <div className="text-center">
          <div className="text-[var(--text-muted)] mb-0.5">Uptime</div>
          <div className={`font-mono font-medium ${service.uptime_pct >= 99.9 ? 'text-green-400' : service.uptime_pct >= 99 ? 'text-yellow-400' : 'text-red-400'}`}>
            {service.uptime_pct.toFixed(2)}%
          </div>
        </div>
        <div className="text-center">
          <div className="text-[var(--text-muted)] mb-0.5">Latency</div>
          <div className="font-mono text-[var(--text-primary)]">{service.latency_ms.toFixed(0)}ms</div>
        </div>
        <div className="text-center">
          <div className="text-[var(--text-muted)] mb-0.5">Error Rate</div>
          <div className={`font-mono ${service.error_rate > 5 ? 'text-red-400' : service.error_rate > 1 ? 'text-yellow-400' : 'text-[var(--text-primary)]'}`}>
            {service.error_rate.toFixed(2)}%
          </div>
        </div>
        <div className="text-center">
          <div className="text-[var(--text-muted)] mb-0.5">Spans (24h)</div>
          <div className="font-mono text-[var(--text-primary)]">{service.span_count_24h.toLocaleString()}</div>
        </div>
        <Badge variant={service.status === 'healthy' ? 'success' : service.status === 'degraded' ? 'warning' : service.status === 'down' ? 'error' : 'default'}>
          {config.label}
        </Badge>
      </div>
    </div>
  );
}

export default function Status() {
  const { data: services, isLoading } = useQuery({
    queryKey: ['service-status'],
    queryFn: () => api.getServiceStatus(),
    refetchInterval: 30000,
  });

  const healthyCount = services?.filter((s: ServiceStatus) => s.status === 'healthy').length ?? 0;
  const degradedCount = services?.filter((s: ServiceStatus) => s.status === 'degraded').length ?? 0;
  const downCount = services?.filter((s: ServiceStatus) => s.status === 'down').length ?? 0;
  const totalCount = services?.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Service Status"
        subtitle="Real-time health overview of all monitored services"
      />

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <Server size={18} className="mx-auto text-[var(--text-muted)] mb-2" />
          <div className="text-2xl font-semibold text-[var(--text-primary)]">
            {isLoading ? <Skeleton className="h-8 w-8 mx-auto" /> : totalCount}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">Total Services</div>
        </Card>
        <Card className="p-4 text-center">
          <CheckCircle size={18} className="mx-auto text-green-400 mb-2" />
          <div className="text-2xl font-semibold text-green-400">
            {isLoading ? <Skeleton className="h-8 w-8 mx-auto" /> : healthyCount}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">Healthy</div>
        </Card>
        <Card className="p-4 text-center">
          <AlertTriangle size={18} className="mx-auto text-yellow-400 mb-2" />
          <div className="text-2xl font-semibold text-yellow-400">
            {isLoading ? <Skeleton className="h-8 w-8 mx-auto" /> : degradedCount}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">Degraded</div>
        </Card>
        <Card className="p-4 text-center">
          <XCircle size={18} className="mx-auto text-red-400 mb-2" />
          <div className="text-2xl font-semibold text-red-400">
            {isLoading ? <Skeleton className="h-8 w-8 mx-auto" /> : downCount}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">Down</div>
        </Card>
      </div>

      {/* Overall Status Bar */}
      {totalCount > 0 && (
        <div className="h-2 bg-[var(--bg-surface)] rounded-full overflow-hidden flex">
          <div className="h-full bg-green-500 transition-all" style={{ width: `${(healthyCount / totalCount) * 100}%` }} />
          <div className="h-full bg-yellow-500 transition-all" style={{ width: `${(degradedCount / totalCount) * 100}%` }} />
          <div className="h-full bg-red-500 transition-all" style={{ width: `${(downCount / totalCount) * 100}%` }} />
        </div>
      )}

      {/* Service List */}
      <Card>
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">All Services</h3>
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <Activity size={12} className="text-green-400" />
            Auto-refreshing every 30s
          </div>
        </div>
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : !services?.length ? (
          <div className="py-12 text-center">
            <Server size={32} className="mx-auto text-[var(--text-muted)] mb-3" />
            <p className="text-sm text-[var(--text-muted)]">No services registered yet</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Services will appear here once they start sending traces</p>
          </div>
        ) : (
          services
            .sort((a: ServiceStatus, b: ServiceStatus) => {
              const order = { down: 0, degraded: 1, unknown: 2, healthy: 3 };
              return (order[a.status] ?? 4) - (order[b.status] ?? 4);
            })
            .map((service: ServiceStatus) => <StatusRow key={service.service_name} service={service} />)
        )}
      </Card>
    </div>
  );
}
