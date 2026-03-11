import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Mail, MessageSquare, Plus, Trash2, Webhook } from 'lucide-react';
import { api } from '../lib/client';
import { Badge, Button } from '../components/ui';
import { Modal } from '../components/ui/Modal';
import { DashboardSection, EmptyPanel, MetricCard, Surface, SurfaceHeader } from '../components/shared';
import type { AlertRule as ApiAlertRule } from '../types';

type AlertRule = ApiAlertRule & {
  channel?: 'email' | 'slack' | 'webhook';
  service_name?: string;
};

const CHANNEL_ICONS = {
  email: Mail,
  slack: MessageSquare,
  webhook: Webhook,
} as const;

const CONDITION_OPTIONS = [
  { value: 'error_rate_above', label: 'Error rate above (%)' },
  { value: 'latency_p99_above', label: 'P99 latency above (ms)' },
  { value: 'latency_avg_above', label: 'Average latency above (ms)' },
  { value: 'throughput_below', label: 'Throughput below (req/min)' },
  { value: 'incident_created', label: 'Incident created' },
];

export default function Alerts() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', condition: 'error_rate_above', threshold: 5, channel: 'email', service_name: '' });
  const queryClient = useQueryClient();

  const { data: rules } = useQuery({
    queryKey: ['alert-rules'],
    queryFn: () => api.getAlertRules(),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.createAlertRule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
      setShowCreate(false);
      setForm({ name: '', condition: 'error_rate_above', threshold: 5, channel: 'email', service_name: '' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.updateAlertRule(id, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alert-rules'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAlertRule(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alert-rules'] }),
  });

  const stats = useMemo(() => {
    const list = rules ?? [];
    return {
      total: list.length,
      enabled: list.filter((rule) => rule.enabled).length,
      critical: list.filter((rule) => rule.severity === 'critical' || rule.severity === 'high').length,
    };
  }, [rules]);

  return (
    <div className="space-y-8">
      <DashboardSection
        eyebrow="Alerts"
        title="Alerting needs a tighter control surface."
        description="Rules, destinations, and thresholds should feel like an operational system, not a placeholder CRUD table."
        actions={<Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" />New rule</Button>}
      />

      <Surface tone="hero">
        <div className="grid gap-4 p-6 md:grid-cols-3">
          <MetricCard label="Total rules" value={String(stats.total)} hint="All configured alert rules" icon={<Bell className="h-5 w-5" />} />
          <MetricCard label="Enabled" value={String(stats.enabled)} hint="Currently active rules" icon={<Bell className="h-5 w-5" />} />
          <MetricCard label="High severity" value={String(stats.critical)} hint="Rules for major regressions" icon={<Bell className="h-5 w-5" />} />
        </div>
      </Surface>

      <Surface>
        <SurfaceHeader title="Alert rules" description="Everything important is visible: state, condition, service targeting, and notification channel." />
        <div className="px-6 pb-6 pt-4">
          {!rules?.length ? (
            <EmptyPanel title="No alert rules" description="Create your first alert rule to turn failures and latency spikes into a reliable operational signal." />
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => {
                const channel = (rule as AlertRule).channel ?? ((rule as AlertRule).channels?.[0] as keyof typeof CHANNEL_ICONS | undefined) ?? 'email';
                const ChannelIcon = CHANNEL_ICONS[channel] ?? Bell;
                return (
                  <div key={rule.id} className="flex flex-col gap-4 rounded-[20px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.015)] p-5 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-base font-medium text-[var(--text-primary)]">{rule.name}</div>
                        <Badge variant={rule.enabled ? 'success' : 'default'}>{rule.enabled ? 'enabled' : 'disabled'}</Badge>
                        <Badge variant={rule.severity === 'critical' || rule.severity === 'high' ? 'error' : 'warning'}>{rule.severity}</Badge>
                      </div>
                      <div className="mt-2 text-sm text-[var(--text-secondary)]">
                        {CONDITION_OPTIONS.find((item) => item.value === rule.condition)?.label ?? rule.condition}
                        {rule.threshold ? ` • ${rule.threshold}` : ''}
                        {(rule as AlertRule).service_name ? ` • ${(rule as AlertRule).service_name}` : ' • all services'}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] text-[var(--text-secondary)]">
                        <ChannelIcon className="h-4 w-4" />
                      </div>
                      <Button variant="outline" onClick={() => toggleMutation.mutate({ id: rule.id, enabled: !rule.enabled })}>
                        {rule.enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <Button variant="ghost" onClick={() => deleteMutation.mutate(rule.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Surface>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Alert Rule">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs text-[var(--text-muted)]">Rule name</label>
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-[var(--text-muted)]">Condition</label>
            <select value={form.condition} onChange={(event) => setForm((current) => ({ ...current, condition: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none">
              {CONDITION_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs text-[var(--text-muted)]">Threshold</label>
              <input type="number" value={form.threshold} onChange={(event) => setForm((current) => ({ ...current, threshold: Number(event.target.value) }))} className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-[var(--text-muted)]">Channel</label>
              <select value={form.channel} onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value }))} className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none">
                <option value="email">Email</option>
                <option value="slack">Slack</option>
                <option value="webhook">Webhook</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-[var(--text-muted)]">Service target</label>
            <input value={form.service_name} onChange={(event) => setForm((current) => ({ ...current, service_name: event.target.value }))} placeholder="All services" className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={!form.name.trim() || createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create rule'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
