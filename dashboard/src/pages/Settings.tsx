import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bell, Copy, Database, Key, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { api } from '../lib/client';
import { AUTH_KEY } from '../lib/constants';
import { Badge, Button, Tabs } from '../components/ui';
import { DashboardSection, EmptyPanel, Surface, SurfaceHeader } from '../components/shared';
import { formatDate } from '../lib/utils';

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'api-keys', label: 'API Keys' },
  { id: 'retention', label: 'Retention' },
  { id: 'notifications', label: 'Notifications' },
];

function CopyButton({ value }: { value: string }) {
  return (
    <button onClick={() => navigator.clipboard.writeText(value)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] text-[var(--text-secondary)]">
      <Copy className="h-4 w-4" />
    </button>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const navigate = useNavigate();
  const { data: tenant } = useQuery({ queryKey: ['tenant'], queryFn: () => api.getTenant() });
  const { data: keys } = useQuery({ queryKey: ['api-keys'], queryFn: () => api.getApiKeys() });

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    navigate('/login');
  };

  return (
    <div className="space-y-8">
      <DashboardSection
        eyebrow="Settings"
        title="System settings with actual structure."
        description="This page should feel like a product control plane, not a pile of loose forms. General settings, keys, retention, and notification surfaces each need their own hierarchy."
        actions={<Button variant="ghost" onClick={handleLogout}><LogOut className="h-4 w-4" />Sign out</Button>}
      />

      <Surface tone="hero">
        <div className="flex flex-col gap-5 p-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-dim)]">Workspace</div>
            <div className="mt-3 text-[30px] font-semibold tracking-[-0.05em] text-[var(--text-primary)]">{tenant?.name ?? 'Current Workspace'}</div>
            <div className="mt-2 text-sm text-[var(--text-secondary)]">Tenant `{tenant?.id ?? 'current-tenant'}` on the `{tenant?.plan ?? 'Developer'}` plan.</div>
          </div>
          <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} variant="pill" />
        </div>
      </Surface>

      {activeTab === 'general' ? (
        <Surface>
          <SurfaceHeader title="General" description="Foundational metadata for the current workspace." />
          <div className="grid gap-4 px-6 pb-6 pt-4 md:grid-cols-2">
            <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]">Tenant name</div>
              <div className="mt-3 text-base font-medium text-[var(--text-primary)]">{tenant?.name ?? 'N/A'}</div>
            </div>
            <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]">Plan</div>
              <div className="mt-3"><Badge variant="accent">{tenant?.plan ?? 'Developer'}</Badge></div>
            </div>
            <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]">Tenant ID</div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="truncate font-mono text-sm text-[var(--text-primary)]">{tenant?.id ?? 'N/A'}</div>
                {tenant?.id ? <CopyButton value={tenant.id} /> : null}
              </div>
            </div>
            <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]">Created</div>
              <div className="mt-3 text-sm text-[var(--text-primary)]">{tenant?.created_at ? formatDate(tenant.created_at) : 'N/A'}</div>
            </div>
          </div>
        </Surface>
      ) : null}

      {activeTab === 'api-keys' ? (
        <Surface>
          <SurfaceHeader title="API keys" description="This backend currently exposes listing, not client-side key creation. The UI should make that limitation clear instead of pretending otherwise." />
          <div className="px-6 pb-6 pt-4">
            {!keys?.length ? (
              <EmptyPanel title="No API keys visible" description="No keys were returned for this tenant. Key generation is not available from the current frontend backend contract." />
            ) : (
              <div className="space-y-3">
                {keys.map((key) => (
                  <div key={key.id} className="flex items-center justify-between rounded-[18px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-4 py-4">
                    <div>
                      <div className="text-sm font-medium text-[var(--text-primary)]">{key.name}</div>
                      <div className="mt-1 font-mono text-xs text-[var(--text-secondary)]">{key.prefix}</div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                      <span>Created {formatDate(key.created_at)}</span>
                      <CopyButton value={key.prefix} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Surface>
      ) : null}

      {activeTab === 'retention' ? (
        <Surface>
          <SurfaceHeader title="Retention" description="Make retention feel intentional, not like a loose dropdown with no context." />
          <div className="grid gap-4 px-6 pb-6 pt-4 md:grid-cols-2">
            <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-4 py-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]"><Database className="h-4 w-4" />Trace retention</div>
              <div className="text-sm text-[var(--text-secondary)]">Operational default is 30 days. Longer windows should be tied to plan and cost policy.</div>
            </div>
            <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-4 py-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]"><SettingsIcon className="h-4 w-4" />Storage posture</div>
              <div className="text-sm text-[var(--text-secondary)]">3.4 GB used of 10 GB shown as placeholder posture until full usage telemetry is wired into this page.</div>
            </div>
          </div>
        </Surface>
      ) : null}

      {activeTab === 'notifications' ? (
        <Surface>
          <SurfaceHeader title="Notifications" description="Notification preferences should read like destinations and policies, not generic toggles." />
          <div className="grid gap-4 px-6 pb-6 pt-4 md:grid-cols-3">
            <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-4 py-4 text-sm text-[var(--text-secondary)]">
              <div className="mb-3 flex items-center gap-2 font-medium text-[var(--text-primary)]"><Bell className="h-4 w-4" />Email</div>
              Enabled for incident and rule notifications.
            </div>
            <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-4 py-4 text-sm text-[var(--text-secondary)]">
              <div className="mb-3 flex items-center gap-2 font-medium text-[var(--text-primary)]"><Key className="h-4 w-4" />Slack</div>
              Not configured in this tenant yet.
            </div>
            <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-4 py-4 text-sm text-[var(--text-secondary)]">
              <div className="mb-3 flex items-center gap-2 font-medium text-[var(--text-primary)]"><Bell className="h-4 w-4" />Webhook</div>
              Destination management should be wired after backend support expands.
            </div>
          </div>
        </Surface>
      ) : null}
    </div>
  );
}
