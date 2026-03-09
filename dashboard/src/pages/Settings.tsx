import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/client';
import { Card, Button } from '../components/ui';
import { Tabs } from '../components/ui/Tabs';
import { PageHeader } from '../components/shared';
import { Skeleton } from '../components/ui/Skeleton';
import { AUTH_KEY } from '../lib/constants';
import { Settings as SettingsIcon, Key, Database, Bell, Shield, Copy, Check, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'api-keys', label: 'API Keys' },
  { id: 'retention', label: 'Retention' },
  { id: 'notifications', label: 'Notifications' },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="p-1.5 rounded-md hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
    </button>
  );
}

function GeneralSettings() {
  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant'],
    queryFn: () => api.getTenant(),
  });

  if (isLoading) return <Skeleton className="h-48" />;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Tenant Information</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
            <span className="text-xs text-[var(--text-muted)]">Tenant Name</span>
            <span className="text-sm text-[var(--text-primary)]">{tenant?.name ?? 'N/A'}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
            <span className="text-xs text-[var(--text-muted)]">Tenant ID</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-[var(--text-primary)]">{tenant?.id ?? 'N/A'}</span>
              {tenant?.id && <CopyButton text={tenant.id} />}
            </div>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
            <span className="text-xs text-[var(--text-muted)]">Plan</span>
            <span className="text-sm text-[var(--accent)] font-medium">{tenant?.plan ?? 'Free'}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-[var(--text-muted)]">Created</span>
            <span className="text-sm text-[var(--text-primary)]">{tenant?.created_at ? new Date(tenant.created_at).toLocaleDateString() : 'N/A'}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ApiKeysSettings() {
  const { data: keys, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.getApiKeys(),
  });

  const queryClient = useQueryClient();
  const createKey = useMutation({
    mutationFn: (name: string) => api.createApiKey({ name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
  });

  if (isLoading) return <Skeleton className="h-48" />;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">API Keys</h3>
          <Button onClick={() => createKey.mutate('New Key')} disabled={createKey.isPending}>
            <Key size={14} className="mr-1.5" />
            {createKey.isPending ? 'Creating...' : 'Generate Key'}
          </Button>
        </div>
        <div className="space-y-2">
          {keys?.length === 0 && (
            <p className="text-xs text-[var(--text-muted)] py-4 text-center">No API keys yet. Generate one to start sending traces.</p>
          )}
          {keys?.map((key: any) => (
            <div key={key.id} className="flex items-center justify-between p-3 bg-[var(--bg-base)] rounded-lg">
              <div>
                <div className="text-sm text-[var(--text-primary)]">{key.name}</div>
                <div className="text-xs font-mono text-[var(--text-muted)] mt-0.5">
                  {key.prefix}{'*'.repeat(24)}
                </div>
              </div>
              <CopyButton text={key.key ?? key.prefix} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function RetentionSettings() {
  const [retention, setRetention] = useState('30');

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Data Retention</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1.5">Trace Retention Period</label>
          <select
            value={retention}
            onChange={(e) => setRetention(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
            <option value="60">60 days</option>
            <option value="90">90 days</option>
          </select>
        </div>
        <div className="p-3 bg-[var(--bg-base)] rounded-lg">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-2">
            <Database size={12} /> Storage Usage
          </div>
          <div className="h-2 bg-[var(--bg-elevated)] rounded-full overflow-hidden mb-1">
            <div className="h-full bg-[var(--accent)] rounded-full" style={{ width: '34%' }} />
          </div>
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>3.4 GB used</span>
            <span>10 GB limit</span>
          </div>
        </div>
        <Button>Save Changes</Button>
      </div>
    </Card>
  );
}

function NotificationSettings() {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [slackEnabled, setSlackEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Notification Channels</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-[var(--bg-base)] rounded-lg">
          <div className="flex items-center gap-3">
            <Bell size={16} className="text-[var(--text-muted)]" />
            <div>
              <div className="text-sm text-[var(--text-primary)]">Email Notifications</div>
              <div className="text-xs text-[var(--text-muted)]">Receive alerts via email</div>
            </div>
          </div>
          <button
            onClick={() => setEmailEnabled(!emailEnabled)}
            className={`w-10 h-5 rounded-full transition-colors ${emailEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--bg-elevated)]'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${emailEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        <div className="flex items-center justify-between p-3 bg-[var(--bg-base)] rounded-lg">
          <div className="flex items-center gap-3">
            <Shield size={16} className="text-[var(--text-muted)]" />
            <div>
              <div className="text-sm text-[var(--text-primary)]">Slack Notifications</div>
              <div className="text-xs text-[var(--text-muted)]">Send alerts to a Slack channel</div>
            </div>
          </div>
          <button
            onClick={() => setSlackEnabled(!slackEnabled)}
            className={`w-10 h-5 rounded-full transition-colors ${slackEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--bg-elevated)]'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${slackEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1.5">Webhook URL</label>
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://hooks.example.com/..."
            className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <Button>Save Preferences</Button>
      </div>
    </Card>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    navigate('/login');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Settings" subtitle="Manage your account and configuration" />
        <Button variant="ghost" onClick={handleLogout} className="text-red-400 hover:text-red-300">
          <LogOut size={14} className="mr-1.5" /> Sign Out
        </Button>
      </div>

      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'general' && <GeneralSettings />}
      {activeTab === 'api-keys' && <ApiKeysSettings />}
      {activeTab === 'retention' && <RetentionSettings />}
      {activeTab === 'notifications' && <NotificationSettings />}
    </div>
  );
}
