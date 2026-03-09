import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/client';
import { Card, Badge, Button } from '../components/ui';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/shared';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight, Mail, MessageSquare, Webhook } from 'lucide-react';

interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  service_name?: string;
  channel: 'email' | 'slack' | 'webhook';
  enabled: boolean;
  last_triggered_at?: string;
  created_at: string;
}

const CHANNEL_ICONS: Record<string, any> = {
  email: Mail,
  slack: MessageSquare,
  webhook: Webhook,
};

const CONDITION_OPTIONS = [
  { value: 'error_rate_above', label: 'Error rate above (%)' },
  { value: 'latency_p99_above', label: 'P99 latency above (ms)' },
  { value: 'latency_avg_above', label: 'Avg latency above (ms)' },
  { value: 'throughput_below', label: 'Throughput below (req/min)' },
  { value: 'incident_created', label: 'New incident created' },
];

function AlertRow({ rule, onToggle, onDelete }: {
  rule: AlertRule;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const ChannelIcon = CHANNEL_ICONS[rule.channel] ?? Bell;

  return (
    <div className="flex items-center gap-4 p-4 border-b border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)] transition-colors">
      <button
        onClick={() => onToggle(rule.id, !rule.enabled)}
        className={`transition-colors ${rule.enabled ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}
      >
        {rule.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h4 className={`text-sm font-medium ${rule.enabled ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
            {rule.name}
          </h4>
          {rule.service_name && <Badge variant="default">{rule.service_name}</Badge>}
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          {CONDITION_OPTIONS.find((c) => c.value === rule.condition)?.label ?? rule.condition}
          {rule.threshold ? ` ${rule.threshold}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <ChannelIcon size={14} className="text-[var(--text-muted)]" />
        <button
          onClick={() => onDelete(rule.id)}
          className="p-1.5 rounded-md hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export default function Alerts() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', condition: 'error_rate_above', threshold: 5, channel: 'email', service_name: '' });
  const queryClient = useQueryClient();

  const { data: rules, isLoading } = useQuery({
    queryKey: ['alert-rules'],
    queryFn: () => api.getAlertRules(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createAlertRule(data),
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Alerts" subtitle="Configure alert rules and notifications" />
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={14} className="mr-1.5" /> New Rule
        </Button>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : !rules?.length ? (
          <EmptyState
            icon={Bell}
            title="No alert rules"
            description="Create your first alert rule to get notified about issues."
            action={{ label: 'Create Rule', onClick: () => setShowCreate(true) }}
          />
        ) : (
          rules.map((rule: AlertRule) => (
            <AlertRow
              key={rule.id}
              rule={rule}
              onToggle={(id, enabled) => toggleMutation.mutate({ id, enabled })}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))
        )}
      </Card>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Alert Rule">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Rule Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. High Error Rate"
              className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Condition</label>
            <select
              value={form.condition}
              onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
              className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            >
              {CONDITION_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1.5">Threshold</label>
              <input
                type="number"
                value={form.threshold}
                onChange={(e) => setForm((f) => ({ ...f, threshold: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1.5">Channel</label>
              <select
                value={form.channel}
                onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="email">Email</option>
                <option value="slack">Slack</option>
                <option value="webhook">Webhook</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Service (optional)</label>
            <input
              type="text"
              value={form.service_name}
              onChange={(e) => setForm((f) => ({ ...f, service_name: e.target.value }))}
              placeholder="All services"
              className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.name.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Rule'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
