import { useQuery } from '@tanstack/react-query';
import { Database, FileText, HardDrive, Tag } from 'lucide-react';
import { api } from '../lib/client';
import { Badge, Button } from '../components/ui';
import { DashboardSection, EmptyPanel, MetricCard, Surface, SurfaceHeader } from '../components/shared';
import { formatBytes, formatDate, formatNumber } from '../lib/utils';

interface DatasetView {
  id: string;
  name: string;
  description?: string;
  record_count: number;
  size_bytes: number;
  created_at: string;
  updated_at: string;
  tags: string[];
}

export default function Datasets() {
  const { data } = useQuery({ queryKey: ['datasets'], queryFn: () => api.getDatasets() });
  const datasets = (data ?? []) as DatasetView[];
  const totals = {
    datasets: datasets.length,
    rows: datasets.reduce((sum, item) => sum + item.record_count, 0),
    bytes: datasets.reduce((sum, item) => sum + item.size_bytes, 0),
  };

  return (
    <div className="space-y-8">
      <DashboardSection
        eyebrow="Datasets"
        title="Datasets need real presentation, not placeholder tiles."
        description="This page now treats datasets as inventory: count, size, freshness, and structure. Actions that are not supported by the backend are intentionally not faked."
        actions={<Button variant="outline" disabled>Creation unavailable</Button>}
      />

      <Surface tone="hero">
        <div className="grid gap-4 p-6 md:grid-cols-3">
          <MetricCard label="Datasets" value={formatNumber(totals.datasets)} hint="Available in this tenant" icon={<Database className="h-5 w-5" />} />
          <MetricCard label="Total rows" value={formatNumber(totals.rows)} hint="Approximate record volume" icon={<FileText className="h-5 w-5" />} />
          <MetricCard label="Storage" value={formatBytes(totals.bytes)} hint="Aggregated dataset size" icon={<HardDrive className="h-5 w-5" />} />
        </div>
      </Surface>

      <Surface>
        <SurfaceHeader title="Dataset inventory" description="A stable inventory view is more useful than fake create/delete controls when the backend contract is limited." />
        <div className="px-6 pb-6 pt-4">
          {datasets.length === 0 ? (
            <EmptyPanel title="No datasets returned" description="Once dataset endpoints return inventory for this tenant, each dataset will appear here with metadata, size, and freshness." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {datasets.map((dataset) => (
                <div key={dataset.id} className="rounded-[20px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.015)] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-base font-medium text-[var(--text-primary)]">{dataset.name}</div>
                      <div className="mt-2 text-sm text-[var(--text-secondary)]">{dataset.description || 'Dataset available for analytics and replay preparation.'}</div>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] text-[var(--text-secondary)]">
                      <Database className="h-4 w-4" />
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]">Rows</div>
                      <div className="mt-2 text-sm tabular-nums text-[var(--text-primary)]">{formatNumber(dataset.record_count)}</div>
                    </div>
                    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]">Size</div>
                      <div className="mt-2 text-sm tabular-nums text-[var(--text-primary)]">{formatBytes(dataset.size_bytes)}</div>
                    </div>
                  </div>

                  <div className="mt-4 text-sm text-[var(--text-secondary)]">Updated {formatDate(dataset.updated_at)}</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(dataset.tags?.length ? dataset.tags : ['trace', 'analytics']).map((tag) => (
                      <Badge key={tag} variant="default"><Tag className="mr-1 h-3 w-3" />{tag}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Surface>
    </div>
  );
}
