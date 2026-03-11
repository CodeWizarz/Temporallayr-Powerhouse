import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Database,
  Search,
  HardDrive,
  Clock,
  Hash,
  Type,
  ToggleLeft,
  Calendar,
  ChevronRight,
  Save,
  X,
  ArrowUpDown,
  Layers,
} from 'lucide-react';
import { api } from '../lib/client';
import type { Dataset, DatasetField } from '../types';

// ── Helpers ──────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatCount(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  string: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  str: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  number: { bg: 'bg-green-500/15', text: 'text-green-400' },
  int: { bg: 'bg-green-500/15', text: 'text-green-400' },
  float: { bg: 'bg-green-500/15', text: 'text-green-400' },
  integer: { bg: 'bg-green-500/15', text: 'text-green-400' },
  boolean: { bg: 'bg-purple-500/15', text: 'text-purple-400' },
  bool: { bg: 'bg-purple-500/15', text: 'text-purple-400' },
  timestamp: { bg: 'bg-cyan-500/15', text: 'text-cyan-400' },
  datetime: { bg: 'bg-cyan-500/15', text: 'text-cyan-400' },
  date: { bg: 'bg-cyan-500/15', text: 'text-cyan-400' },
  object: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  json: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  array: { bg: 'bg-rose-500/15', text: 'text-rose-400' },
};

function getTypeColor(type: string) {
  const lower = type.toLowerCase();
  return TYPE_COLORS[lower] || { bg: 'bg-gray-500/15', text: 'text-gray-400' };
}

// ── Toast ────────────────────────────────────────────────
interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

let toastId = 0;

// ── Retention Modal ──────────────────────────────────────
function RetentionModal({
  dataset,
  open,
  onClose,
  onSave,
  saving,
}: {
  dataset: Dataset;
  open: boolean;
  onClose: () => void;
  onSave: (days: number) => void;
  saving: boolean;
}) {
  const [days, setDays] = useState(dataset.retention_days);
  const isReducing = days < dataset.retention_days;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-lg border border-[#1e1e2e] bg-[#13131a] p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#e0e0e8]">Update Retention</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#1a1a2e] text-[#8888a0]">
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-[#8888a0] mb-4">
          Set the retention period for <span className="text-[#e0e0e8] font-medium">{dataset.name}</span>
        </p>

        <div className="mb-4">
          <label className="block text-sm text-[#8888a0] mb-1">Retention (days)</label>
          <input
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(e) => setDays(Math.max(1, Math.min(365, parseInt(e.target.value) || 1)))}
            className="w-full rounded-md border border-[#1e1e2e] bg-[#0a0a0f] px-3 py-2 text-sm text-[#e0e0e8] focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {isReducing && (
          <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-sm text-amber-400">
              Warning: Reducing retention from {dataset.retention_days}d to {days}d will permanently
              delete data older than {days} days.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-[#1e1e2e] bg-transparent px-4 py-2 text-sm text-[#8888a0] hover:bg-[#1a1a2e]"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(days)}
            disabled={saving || days === dataset.retention_days}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Save size={14} />
            )}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Schema Table ─────────────────────────────────────────
function SchemaTable({ fields }: { fields: DatasetField[] }) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'type'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = fields.filter(
      (f) =>
        f.name.toLowerCase().includes(search.toLowerCase()) ||
        f.type.toLowerCase().includes(search.toLowerCase())
    );
    result.sort((a, b) => {
      const va = sortBy === 'name' ? a.name : a.type;
      const vb = sortBy === 'name' ? b.name : b.type;
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return result;
  }, [fields, search, sortBy, sortDir]);

  const toggleSort = (col: 'name' | 'type') => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555566]" />
          <input
            placeholder="Filter fields..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-[#1e1e2e] bg-[#0a0a0f] pl-9 pr-3 py-1.5 text-sm text-[#e0e0e8] placeholder:text-[#555566] focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <span className="text-xs text-[#555566]">{filtered.length} fields</span>
      </div>

      <div className="rounded-md border border-[#1e1e2e] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#0d0d14]">
              <th
                className="text-left px-4 py-2 text-[#8888a0] font-medium cursor-pointer hover:text-[#e0e0e8] select-none"
                onClick={() => toggleSort('name')}
              >
                <span className="flex items-center gap-1">
                  Field Name
                  <ArrowUpDown size={12} className={sortBy === 'name' ? 'text-indigo-400' : ''} />
                </span>
              </th>
              <th
                className="text-left px-4 py-2 text-[#8888a0] font-medium cursor-pointer hover:text-[#e0e0e8] select-none w-32"
                onClick={() => toggleSort('type')}
              >
                <span className="flex items-center gap-1">
                  Type
                  <ArrowUpDown size={12} className={sortBy === 'type' ? 'text-indigo-400' : ''} />
                </span>
              </th>
              <th className="text-left px-4 py-2 text-[#8888a0] font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((field, i) => {
              const colors = getTypeColor(field.type);
              const isExpanded = expanded === field.name;
              return (
                <>
                  <tr
                    key={field.name}
                    onClick={() => setExpanded(isExpanded ? null : field.name)}
                    className={`border-t border-[#1e1e2e] cursor-pointer transition-colors ${
                      i % 2 === 0 ? 'bg-[#13131a]' : 'bg-[#111118]'
                    } hover:bg-[#1a1a2e]`}
                  >
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-2">
                        <ChevronRight
                          size={12}
                          className={`text-[#555566] transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        />
                        <code className="text-[#e0e0e8] font-mono text-xs">{field.name}</code>
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}>
                        {field.type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-[#8888a0] text-xs truncate max-w-xs">
                      {field.description || '—'}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${field.name}-detail`} className="bg-[#0d0d14]">
                      <td colSpan={3} className="px-8 py-3">
                        <div className="text-xs space-y-1">
                          <div className="flex gap-6">
                            <span className="text-[#555566]">Name:</span>
                            <code className="text-[#e0e0e8] font-mono">{field.name}</code>
                          </div>
                          <div className="flex gap-6">
                            <span className="text-[#555566]">Type:</span>
                            <span className={colors.text}>{field.type}</span>
                          </div>
                          {field.description && (
                            <div className="flex gap-6">
                              <span className="text-[#555566]">Description:</span>
                              <span className="text-[#8888a0]">{field.description}</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-[#555566] text-sm">
                  No fields match your filter
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────
export default function DatasetsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [retentionOpen, setRetentionOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = ++toastId;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  };

  // Queries
  const { data: datasets = [], isLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => api.datasets.list(),
  });

  const selectedDataset = useMemo(
    () => datasets.find((d: Dataset) => d.name === selectedName) || null,
    [datasets, selectedName]
  );

  const { data: schema } = useQuery({
    queryKey: ['dataset-schema', selectedName],
    queryFn: () => api.datasets.schema(selectedName!),
    enabled: !!selectedName,
  });

  const retentionMutation = useMutation({
    mutationFn: ({ name, days }: { name: string; days: number }) =>
      api.datasets.retention(name, { retention_days: days }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      setRetentionOpen(false);
      addToast('Retention updated successfully');
    },
    onError: () => addToast('Failed to update retention', 'error'),
  });

  const filteredDatasets = useMemo(
    () =>
      datasets.filter((d: Dataset) =>
        d.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [datasets, searchQuery]
  );

  // Auto-select first
  if (!selectedName && filteredDatasets.length > 0 && !isLoading) {
    setSelectedName(filteredDatasets[0].name);
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e2e]">
        <div>
          <h1 className="text-xl font-semibold text-[#e0e0e8] flex items-center gap-2">
            <Database size={20} className="text-indigo-400" />
            Datasets
            {datasets.length > 0 && (
              <span className="ml-2 rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs font-medium text-indigo-400">
                {datasets.length}
              </span>
            )}
          </h1>
          <p className="text-sm text-[#8888a0] mt-0.5">Browse schemas, manage retention, and explore your data</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Dataset List */}
        <div className="w-80 border-r border-[#1e1e2e] flex flex-col bg-[#0d0d14]">
          <div className="p-3 border-b border-[#1e1e2e]">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555566]" />
              <input
                placeholder="Search datasets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-[#1e1e2e] bg-[#0a0a0f] pl-9 pr-3 py-2 text-sm text-[#e0e0e8] placeholder:text-[#555566] focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-3 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-md bg-[#13131a] animate-pulse" />
                ))}
              </div>
            ) : filteredDatasets.length === 0 ? (
              <div className="p-6 text-center">
                <Database size={32} className="mx-auto text-[#555566] mb-2" />
                <p className="text-sm text-[#555566]">No datasets found</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredDatasets.map((ds: Dataset) => (
                  <button
                    key={ds.name}
                    onClick={() => setSelectedName(ds.name)}
                    className={`w-full text-left rounded-md p-3 transition-all ${
                      selectedName === ds.name
                        ? 'bg-[#1a1a2e] border-l-2 border-indigo-500'
                        : 'hover:bg-[#13131a] border-l-2 border-transparent'
                    }`}
                  >
                    <div className="font-medium text-sm text-[#e0e0e8] truncate">{ds.name}</div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-[#8888a0]">
                      <span className="flex items-center gap-1">
                        <Layers size={10} />
                        {formatCount(ds.event_count)} events
                      </span>
                      <span className="flex items-center gap-1">
                        <HardDrive size={10} />
                        {formatBytes(ds.storage_bytes)}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <span className="inline-block rounded bg-[#1e1e2e] px-1.5 py-0.5 text-[10px] text-[#8888a0]">
                        {ds.retention_days}d retention
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Dataset Detail */}
        <div className="flex-1 overflow-y-auto">
          {!selectedDataset ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Database size={48} className="mx-auto text-[#333344] mb-3" />
                <p className="text-[#555566]">Select a dataset to view details</p>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Header */}
              <div>
                <h2 className="text-lg font-semibold text-[#e0e0e8]">{selectedDataset.name}</h2>
                {selectedDataset.description && (
                  <p className="text-sm text-[#8888a0] mt-1">{selectedDataset.description}</p>
                )}
                <p className="text-xs text-[#555566] mt-1">
                  Created {new Date(selectedDataset.created_at).toLocaleDateString()}
                </p>
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-4 gap-4">
                <StatCard
                  icon={<Hash size={16} className="text-indigo-400" />}
                  label="Total Events"
                  value={formatCount(selectedDataset.event_count)}
                />
                <StatCard
                  icon={<HardDrive size={16} className="text-purple-400" />}
                  label="Storage Size"
                  value={formatBytes(selectedDataset.storage_bytes)}
                />
                <StatCard
                  icon={<Clock size={16} className="text-cyan-400" />}
                  label="Retention"
                  value={`${selectedDataset.retention_days} days`}
                />
                <StatCard
                  icon={<Type size={16} className="text-amber-400" />}
                  label="Fields"
                  value={(schema?.fields || selectedDataset.fields || []).length.toString()}
                />
              </div>

              {/* Schema */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[#e0e0e8]">Schema</h3>
                </div>
                <SchemaTable fields={schema?.fields || selectedDataset.fields || []} />
              </div>

              {/* Retention Management */}
              <div className="rounded-md border border-[#1e1e2e] bg-[#13131a] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[#e0e0e8]">Retention Policy</h3>
                    <p className="text-xs text-[#8888a0] mt-0.5">
                      Data older than {selectedDataset.retention_days} days is automatically deleted
                    </p>
                  </div>
                  <button
                    onClick={() => setRetentionOpen(true)}
                    className="rounded-md border border-[#1e1e2e] bg-[#1a1a2e] px-3 py-1.5 text-sm text-[#e0e0e8] hover:bg-[#222233] transition-colors"
                  >
                    Update Retention
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Retention Modal */}
      {selectedDataset && (
        <RetentionModal
          dataset={selectedDataset}
          open={retentionOpen}
          onClose={() => setRetentionOpen(false)}
          onSave={(days) =>
            retentionMutation.mutate({ name: selectedDataset.name, days })
          }
          saving={retentionMutation.isPending}
        />
      )}

      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-md border px-4 py-3 text-sm shadow-lg animate-in slide-in-from-right ${
              t.type === 'success'
                ? 'border-green-500/30 bg-[#13131a] text-green-400'
                : 'border-red-500/30 bg-[#13131a] text-red-400'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────
function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#1e1e2e] bg-[#13131a] p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-[#8888a0]">{label}</span>
      </div>
      <div className="text-lg font-semibold text-[#e0e0e8]">{value}</div>
    </div>
  );
}
