import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/client';
import { Card, Badge, Button } from '../components/ui';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/shared';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { formatDate, formatNumber } from '../lib/utils';
import { Database, Plus, Download, Trash2, FileText, Calendar } from 'lucide-react';

interface Dataset {
  id: string;
  name: string;
  description?: string;
  record_count: number;
  size_bytes: number;
  created_at: string;
  updated_at: string;
  tags: string[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function DatasetCard({ dataset, onDelete }: { dataset: Dataset; onDelete: (id: string) => void }) {
  return (
    <Card className="p-4 hover:border-[var(--border-hover)] transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-[var(--accent)]/10">
            <Database size={16} className="text-[var(--accent)]" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-[var(--text-primary)]">{dataset.name}</h4>
            {dataset.description && (
              <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-1">{dataset.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-1.5 rounded-md hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <Download size={14} />
          </button>
          <button
            onClick={() => onDelete(dataset.id)}
            className="p-1.5 rounded-md hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-[var(--text-muted)] mb-3">
        <span className="flex items-center gap-1">
          <FileText size={11} /> {formatNumber(dataset.record_count)} records
        </span>
        <span>{formatBytes(dataset.size_bytes)}</span>
        <span className="flex items-center gap-1">
          <Calendar size={11} /> {formatDate(dataset.updated_at)}
        </span>
      </div>

      {dataset.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {dataset.tags.map((tag) => (
            <Badge key={tag} variant="default">{tag}</Badge>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function Datasets() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', tags: '' });
  const queryClient = useQueryClient();

  const { data: datasets, isLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => api.getDatasets(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createDataset(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      setShowCreate(false);
      setForm({ name: '', description: '', tags: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDataset(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['datasets'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Datasets" subtitle="Manage trace datasets for testing and analysis" />
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={14} className="mr-1.5" /> New Dataset
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : !datasets?.length ? (
        <EmptyState
          icon={Database}
          title="No datasets"
          description="Create datasets to store and organize trace data for testing."
          action={{ label: 'Create Dataset', onClick: () => setShowCreate(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {datasets.map((ds: Dataset) => (
            <DatasetCard key={ds.id} dataset={ds} onDelete={(id) => deleteMutation.mutate(id)} />
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Dataset">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Production Traces Q1"
              className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional description..."
              rows={3}
              className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] resize-none"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5">Tags (comma-separated)</label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="e.g. production, api, auth"
              className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate({
                ...form,
                tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
              })}
              disabled={!form.name.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Dataset'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
