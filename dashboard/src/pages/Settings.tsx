import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings as SettingsIcon,
  Key,
  Plus,
  Copy,
  Trash2,
  X,
  Eye,
  EyeOff,
  Shield,
  Clock,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { api } from '../lib/client';
import type { ApiKey } from '../types';

// ── Helpers ──────────────────────────────────────────────
function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  if (seconds < 2592000) return Math.floor(seconds / 86400) + 'd ago';
  return new Date(date).toLocaleDateString();
}

// ── Toast ────────────────────────────────────────────────
interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}
let toastId = 0;

// ── Create Key Modal ─────────────────────────────────────
function CreateKeyModal({
  open,
  onClose,
  onCreate,
  creating,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, expiresIn?: number) => void;
  creating: boolean;
}) {
  const [name, setName] = useState('');
  const [expiresIn, setExpiresIn] = useState<string>('never');

  if (!open) return null;

  const handleCreate = () => {
    if (!name.trim()) return;
    const days = expiresIn === 'never' ? undefined : parseInt(expiresIn);
    onCreate(name.trim(), days);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-lg border border-[#1e1e2e] bg-[#13131a] p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#e0e0e8] flex items-center gap-2">
            <Key size={18} className="text-indigo-400" />
            Create API Key
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#1a1a2e] text-[#8888a0]">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-[#8888a0] mb-1">Key Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Production API Key"
              className="w-full rounded-md border border-[#1e1e2e] bg-[#0a0a0f] px-3 py-2 text-sm text-[#e0e0e8] placeholder:text-[#555566] focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>

          <div>
            <label className="block text-sm text-[#8888a0] mb-1">Expiration</label>
            <select
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value)}
              className="w-full rounded-md border border-[#1e1e2e] bg-[#0a0a0f] px-3 py-2 text-sm text-[#e0e0e8] focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="never">Never expires</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
              <option value="180">180 days</option>
              <option value="365">1 year</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="rounded-md border border-[#1e1e2e] bg-transparent px-4 py-2 text-sm text-[#8888a0] hover:bg-[#1a1a2e]"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {creating ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Plus size={14} />
            )}
            Create Key
          </button>
        </div>
      </div>
    </div>
  );
}

// ── New Key Display ──────────────────────────────────────
function NewKeyBanner({
  keyValue,
  onDismiss,
}: {
  keyValue: string;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(keyValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 mb-6">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Check size={16} className="text-green-400" />
          <span className="text-sm font-medium text-green-400">API Key Created</span>
        </div>
        <button onClick={onDismiss} className="p-1 rounded hover:bg-green-500/10 text-green-400">
          <X size={14} />
        </button>
      </div>
      <p className="text-xs text-[#8888a0] mb-3">
        Copy this key now. You won't be able to see it again.
      </p>
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-md border border-[#1e1e2e] bg-[#0a0a0f] px-3 py-2 font-mono text-sm text-[#e0e0e8] overflow-hidden">
          {visible ? keyValue : keyValue.slice(0, 8) + '...' + keyValue.slice(-4)}
        </div>
        <button
          onClick={() => setVisible(!visible)}
          className="rounded-md border border-[#1e1e2e] bg-[#13131a] p-2 text-[#8888a0] hover:text-[#e0e0e8] hover:bg-[#1a1a2e]"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
        <button
          onClick={handleCopy}
          className={`rounded-md border px-3 py-2 text-sm font-medium flex items-center gap-1.5 transition-colors ${
            copied
              ? 'border-green-500/30 bg-green-500/10 text-green-400'
              : 'border-[#1e1e2e] bg-[#13131a] text-[#8888a0] hover:text-[#e0e0e8] hover:bg-[#1a1a2e]'
          }`}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

// ── Delete Confirmation ──────────────────────────────────
function DeleteConfirm({
  keyName,
  open,
  onClose,
  onDelete,
  deleting,
}: {
  keyName: string;
  open: boolean;
  onClose: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-lg border border-[#1e1e2e] bg-[#13131a] p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={18} className="text-red-400" />
          <h3 className="text-lg font-semibold text-[#e0e0e8]">Revoke API Key</h3>
        </div>
        <p className="text-sm text-[#8888a0] mb-4">
          Are you sure you want to revoke <span className="text-[#e0e0e8] font-medium">"{keyName}"</span>?
          This action cannot be undone and will immediately invalidate the key.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-[#1e1e2e] bg-transparent px-4 py-2 text-sm text-[#8888a0] hover:bg-[#1a1a2e]"
          >
            Cancel
          </button>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 flex items-center gap-2"
          >
            {deleting && (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            Revoke Key
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────
export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiKey | null>(null);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: Toast['type'] = 'success') => {
    const id = ++toastId;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  };

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.keys.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; expires_in_days?: number }) => api.keys.create(data),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setCreateOpen(false);
      setNewKeyValue(data.key || data.api_key || data.token || 'Key created successfully');
      addToast('API key created successfully');
    },
    onError: () => addToast('Failed to create API key', 'error'),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.keys.revoke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setDeleteTarget(null);
      addToast('API key revoked');
    },
    onError: () => addToast('Failed to revoke API key', 'error'),
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-[#e0e0e8] flex items-center gap-2">
          <SettingsIcon size={20} className="text-indigo-400" />
          Settings
        </h1>
        <p className="text-sm text-[#8888a0] mt-0.5">Manage your API keys and account settings</p>
      </div>

      {/* API Keys Section */}
      <div className="rounded-lg border border-[#1e1e2e] bg-[#13131a]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e2e]">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-indigo-400" />
            <h2 className="text-sm font-semibold text-[#e0e0e8]">API Keys</h2>
            <span className="rounded-full bg-[#1e1e2e] px-2 py-0.5 text-xs text-[#8888a0]">
              {keys.length}
            </span>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 flex items-center gap-1.5"
          >
            <Plus size={14} />
            Create Key
          </button>
        </div>

        {/* New key banner */}
        {newKeyValue && (
          <div className="px-5 pt-4">
            <NewKeyBanner keyValue={newKeyValue} onDismiss={() => setNewKeyValue(null)} />
          </div>
        )}

        {/* Keys list */}
        <div className="p-5">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 rounded-md bg-[#1a1a2e] animate-pulse" />
              ))}
            </div>
          ) : keys.length === 0 ? (
            <div className="py-12 text-center">
              <Key size={40} className="mx-auto text-[#333344] mb-3" />
              <p className="text-[#555566] text-sm">No API keys yet</p>
              <p className="text-[#444455] text-xs mt-1">Create a key to authenticate API requests</p>
              <button
                onClick={() => setCreateOpen(true)}
                className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Create Your First Key
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {keys.map((key: ApiKey) => {
                const isExpired = key.expires_at && new Date(key.expires_at) < new Date();
                return (
                  <div
                    key={key.id}
                    className={`flex items-center justify-between rounded-md border p-4 transition-colors hover:bg-[#1a1a2e] ${
                      isExpired ? 'border-red-500/20 bg-red-500/5' : 'border-[#1e1e2e] bg-[#0d0d14]'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#e0e0e8]">{key.name}</span>
                        {isExpired && (
                          <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
                            EXPIRED
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        <code className="text-xs text-[#555566] font-mono">{key.prefix}...****</code>
                        <span className="flex items-center gap-1 text-xs text-[#555566]">
                          <Clock size={10} />
                          Created {timeAgo(key.created_at)}
                        </span>
                        {key.last_used_at && (
                          <span className="text-xs text-[#555566]">
                            Last used {timeAgo(key.last_used_at)}
                          </span>
                        )}
                        {key.expires_at && (
                          <span className={`text-xs ${
                            isExpired ? 'text-red-400' : 'text-[#555566]'
                          }`}>
                            {isExpired ? 'Expired' : 'Expires'} {timeAgo(key.expires_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setDeleteTarget(key)}
                      className="rounded-md border border-[#1e1e2e] p-2 text-[#555566] hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/5 transition-colors"
                      title="Revoke key"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Account Info Section */}
      <div className="rounded-lg border border-[#1e1e2e] bg-[#13131a] p-5">
        <h2 className="text-sm font-semibold text-[#e0e0e8] mb-4 flex items-center gap-2">
          <SettingsIcon size={16} className="text-[#8888a0]" />
          General Settings
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-[#1e1e2e]">
            <div>
              <p className="text-sm text-[#e0e0e8]">API Base URL</p>
              <p className="text-xs text-[#555566] mt-0.5">Endpoint for API requests</p>
            </div>
            <code className="text-sm text-[#8888a0] font-mono bg-[#0a0a0f] rounded px-3 py-1 border border-[#1e1e2e]">
              {window.location.origin}/api/v1
            </code>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-[#1e1e2e]">
            <div>
              <p className="text-sm text-[#e0e0e8]">Authentication</p>
              <p className="text-xs text-[#555566] mt-0.5">How API keys are sent</p>
            </div>
            <code className="text-sm text-[#8888a0] font-mono bg-[#0a0a0f] rounded px-3 py-1 border border-[#1e1e2e]">
              X-API-Key: &lt;your-key&gt;
            </code>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm text-[#e0e0e8]">Dashboard Version</p>
              <p className="text-xs text-[#555566] mt-0.5">Current dashboard build</p>
            </div>
            <span className="text-sm text-[#8888a0]">v2.0.0</span>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateKeyModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(name, days) =>
          createMutation.mutate({ name, expires_in_days: days })
        }
        creating={createMutation.isPending}
      />

      {deleteTarget && (
        <DeleteConfirm
          keyName={deleteTarget.name}
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDelete={() => revokeMutation.mutate(deleteTarget.id)}
          deleting={revokeMutation.isPending}
        />
      )}

      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-md border px-4 py-3 text-sm shadow-lg ${
              t.type === 'success'
                ? 'border-green-500/30 bg-[#13131a] text-green-400'
                : t.type === 'error'
                ? 'border-red-500/30 bg-[#13131a] text-red-400'
                : 'border-indigo-500/30 bg-[#13131a] text-indigo-400'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
