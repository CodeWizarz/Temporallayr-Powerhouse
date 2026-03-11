import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CircleDollarSign, Cpu, HardDrive, Network, TrendingDown } from 'lucide-react';
import { api } from '../lib/client';
import { Badge } from '../components/ui';
import { DashboardSection, EmptyPanel, MetricCard, Surface, SurfaceHeader } from '../components/shared';
import { TIME_FILTERS } from '../lib/constants';
import { formatCurrency, formatNumber } from '../lib/utils';

interface CostBreakdown {
  service_name: string;
  compute_cost: number;
  storage_cost: number;
  network_cost: number;
  total_cost: number;
  span_count: number;
}

export default function CostTracking() {
  const [timeFilter, setTimeFilter] = useState('24h');
  const { data: costs } = useQuery({ queryKey: ['costs', timeFilter], queryFn: () => api.getCosts({ time_range: timeFilter }) });

  const breakdown: CostBreakdown[] = costs?.breakdown ?? [];
  const totals = useMemo(() => ({
    total: breakdown.reduce((sum, item) => sum + item.total_cost, 0),
    compute: breakdown.reduce((sum, item) => sum + item.compute_cost, 0),
    storage: breakdown.reduce((sum, item) => sum + item.storage_cost, 0),
    network: breakdown.reduce((sum, item) => sum + item.network_cost, 0),
  }), [breakdown]);

  const maxCost = Math.max(...breakdown.map((item) => item.total_cost), 1);

  return (
    <div className="space-y-8">
      <DashboardSection
        eyebrow="Cost"
        title="Spend should feel readable, not improvised."
        description="This page now treats cost as a first-class operational surface: summary up top, service attribution in the middle, and optimization guidance at the bottom."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="default">Estimated</Badge>
            <select value={timeFilter} onChange={(event) => setTimeFilter(event.target.value)} className="rounded-xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none">
              {TIME_FILTERS.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
            </select>
          </div>
        }
      />

      <Surface tone="hero">
        <div className="grid gap-4 p-6 md:grid-cols-2 2xl:grid-cols-4">
          <MetricCard label="Total cost" value={formatCurrency(totals.total)} hint="Selected window" icon={<CircleDollarSign className="h-5 w-5" />} />
          <MetricCard label="Compute" value={formatCurrency(totals.compute)} hint="Inference and processing" icon={<Cpu className="h-5 w-5" />} />
          <MetricCard label="Storage" value={formatCurrency(totals.storage)} hint="Trace retention footprint" icon={<HardDrive className="h-5 w-5" />} />
          <MetricCard label="Network" value={formatCurrency(totals.network)} hint="Ingest and delivery overhead" icon={<Network className="h-5 w-5" />} />
        </div>
      </Surface>

      <Surface>
        <SurfaceHeader title="Cost by service" description="A structured attribution table with visible proportions instead of random colored segments." />
        <div className="px-6 pb-6 pt-4">
          {breakdown.length === 0 ? (
            <EmptyPanel title="No cost data" description="When billing and usage signals arrive, this table will show which services drive spend and how much each layer contributes." />
          ) : (
            <div className="overflow-hidden rounded-[20px] border border-[var(--border-soft)]">
              <div className="grid grid-cols-[minmax(0,1.4fr)_1fr_110px_110px] gap-4 bg-[rgba(255,255,255,0.02)] px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
                <div>Service</div>
                <div>Relative share</div>
                <div>Total</div>
                <div>Spans</div>
              </div>
              {breakdown.sort((a, b) => b.total_cost - a.total_cost).map((item) => (
                <div key={item.service_name} className="grid grid-cols-[minmax(0,1.4fr)_1fr_110px_110px] gap-4 border-t border-[var(--border-soft)] px-5 py-4">
                  <div>
                    <div className="text-sm font-medium text-[var(--text-primary)]">{item.service_name}</div>
                    <div className="mt-1 text-sm text-[var(--text-secondary)]">Compute {formatCurrency(item.compute_cost)} • Storage {formatCurrency(item.storage_cost)} • Network {formatCurrency(item.network_cost)}</div>
                  </div>
                  <div className="flex items-center">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-panel-soft)]">
                      <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),rgba(201,246,88,0.26))]" style={{ width: `${Math.max(8, (item.total_cost / maxCost) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="text-sm tabular-nums text-[var(--text-primary)]">{formatCurrency(item.total_cost)}</div>
                  <div className="text-sm tabular-nums text-[var(--text-secondary)]">{formatNumber(item.span_count)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Surface>

      <Surface tone="muted">
        <SurfaceHeader title="Optimization guidance" description="Small, concrete actions beat decorative hint cards." />
        <div className="grid gap-3 px-6 pb-6 pt-4 md:grid-cols-3">
          {(costs?.suggestions ?? ['Review span volume on non-production services.', 'Tighten retention for low-value traces.', 'Watch services with a high cost but low operational signal.']).map((tip: string, index: number) => (
            <div key={index} className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-4 py-4 text-sm text-[var(--text-secondary)]">
              <div className="mb-2 flex items-center gap-2 font-medium text-[var(--text-primary)]"><TrendingDown className="h-4 w-4 text-[var(--accent)]" />Suggestion</div>
              {tip}
            </div>
          ))}
        </div>
      </Surface>
    </div>
  );
}
