import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/client';
import { Card } from '../components/ui';
import { StatCard } from '../components/ui/StatCard';
import { PageHeader } from '../components/shared';
import { Skeleton } from '../components/ui/Skeleton';
import { TIME_FILTERS } from '../lib/constants';
import { formatNumber } from '../lib/utils';
import { DollarSign, TrendingUp, TrendingDown, Server, Database, Cpu, HardDrive } from 'lucide-react';

interface CostBreakdown {
  service_name: string;
  compute_cost: number;
  storage_cost: number;
  network_cost: number;
  total_cost: number;
  span_count: number;
}

function CostBar({ item, maxCost }: { item: CostBreakdown; maxCost: number }) {
  const computePct = maxCost > 0 ? (item.compute_cost / maxCost) * 100 : 0;
  const storagePct = maxCost > 0 ? (item.storage_cost / maxCost) * 100 : 0;
  const networkPct = maxCost > 0 ? (item.network_cost / maxCost) * 100 : 0;

  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="text-xs text-[var(--text-muted)] w-32 truncate text-right">{item.service_name}</span>
      <div className="flex-1 h-5 bg-[var(--bg-base)] rounded overflow-hidden flex">
        <div className="h-full bg-[var(--accent)]" style={{ width: `${computePct}%` }} title={`Compute: $${item.compute_cost.toFixed(2)}`} />
        <div className="h-full bg-blue-500" style={{ width: `${storagePct}%` }} title={`Storage: $${item.storage_cost.toFixed(2)}`} />
        <div className="h-full bg-purple-500" style={{ width: `${networkPct}%` }} title={`Network: $${item.network_cost.toFixed(2)}`} />
      </div>
      <span className="text-xs font-mono text-[var(--text-primary)] w-20 text-right">${item.total_cost.toFixed(2)}</span>
    </div>
  );
}

export default function CostTracking() {
  const [timeFilter, setTimeFilter] = useState('24h');

  const { data: costs, isLoading } = useQuery({
    queryKey: ['costs', timeFilter],
    queryFn: () => api.getCosts({ time_range: timeFilter }),
  });

  const breakdown: CostBreakdown[] = costs?.breakdown ?? [];
  const maxCost = breakdown.length > 0 ? Math.max(...breakdown.map((b) => b.total_cost)) : 0;
  const totalCost = breakdown.reduce((sum, b) => sum + b.total_cost, 0);
  const totalCompute = breakdown.reduce((sum, b) => sum + b.compute_cost, 0);
  const totalStorage = breakdown.reduce((sum, b) => sum + b.storage_cost, 0);
  const totalNetwork = breakdown.reduce((sum, b) => sum + b.network_cost, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Cost Tracking" subtitle="Monitor infrastructure and tracing costs" />
        <select
          value={timeFilter}
          onChange={(e) => setTimeFilter(e.target.value)}
          className="px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
        >
          {TIME_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <StatCard
              label="Total Cost"
              value={`$${totalCost.toFixed(2)}`}
              icon={DollarSign}
              trend={costs?.cost_trend}
              trendInverse
            />
            <StatCard
              label="Compute"
              value={`$${totalCompute.toFixed(2)}`}
              icon={Cpu}
            />
            <StatCard
              label="Storage"
              value={`$${totalStorage.toFixed(2)}`}
              icon={HardDrive}
            />
            <StatCard
              label="Network"
              value={`$${totalNetwork.toFixed(2)}`}
              icon={Server}
            />
          </>
        )}
      </div>

      {/* Cost Breakdown */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Cost by Service</h3>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[var(--accent)]" /> Compute
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Storage
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-purple-500" /> Network
            </span>
          </div>
        </div>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : breakdown.length === 0 ? (
          <div className="py-8 text-center text-[var(--text-muted)] text-sm">No cost data available</div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {breakdown
              .sort((a, b) => b.total_cost - a.total_cost)
              .map((item) => <CostBar key={item.service_name} item={item} maxCost={maxCost} />)}
          </div>
        )}
      </Card>

      {/* Optimization Tips */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Optimization Suggestions</h3>
        <div className="space-y-2">
          {(costs?.suggestions ?? [
            'Consider sampling low-value traces to reduce storage costs',
            'Enable span compression to reduce network overhead',
            'Review retention policies for old trace data',
          ]).map((tip: string, i: number) => (
            <div key={i} className="flex items-start gap-2 text-xs text-[var(--text-muted)] py-1.5">
              <TrendingDown size={12} className="text-green-400 mt-0.5 flex-shrink-0" />
              <span>{tip}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
