import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Copy, KeyRound, ShieldCheck } from 'lucide-react';
import { Button, Input } from '../../components/ui';
import { AuthShell } from '../../components/shared';
import { api } from '../../lib/client';

export default function Signup() {
  const [tenantId, setTenantId] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ api_key: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.admin.register(tenantId, adminKey);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!result?.api_key) return;
    await navigator.clipboard.writeText(result.api_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <AuthShell
      eyebrow="Register tenant"
      title="Provision a new workspace."
      description="Create a tenant, capture the generated API key securely, and use it to access the dashboard."
      footer={
        <p className="text-sm text-[var(--text-secondary)]">
          Already have a key?{' '}
          <Link to="/login" className="font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]">
            Sign in
          </Link>
        </p>
      }
    >
      {!result ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Tenant ID"
            type="text"
            value={tenantId}
            onChange={(event) => setTenantId(event.target.value)}
            placeholder="my-org"
            required
            pattern="^[a-z0-9\-]+$"
            hint="Lowercase letters, numbers, and hyphens only."
            className="h-12 rounded-2xl border-[var(--border-soft)] bg-[rgba(0,0,0,0.18)] px-4 font-mono text-sm"
          />
          <Input
            label="Admin key"
            type="password"
            value={adminKey}
            onChange={(event) => setAdminKey(event.target.value)}
            placeholder="sk-admin-..."
            required
            icon={<KeyRound className="h-4 w-4" />}
            error={error || undefined}
            className="h-12 rounded-2xl border-[var(--border-soft)] bg-[rgba(0,0,0,0.18)] px-4 font-mono text-sm"
          />
          <Button type="submit" loading={loading} className="w-full justify-center" size="lg">
            Provision tenant
          </Button>
        </form>
      ) : (
        <div className="space-y-5">
          <div className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/8 p-5">
            <div className="mb-3 flex items-center gap-2 text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-sm font-medium">Tenant provisioned</span>
            </div>
            <div className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(0,0,0,0.22)] p-4">
              <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]">API key</div>
              <div className="flex items-start gap-3">
                <code className="flex-1 break-all font-mono text-sm text-[var(--text-primary)]">{result.api_key}</code>
                <button onClick={handleCopy} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] text-[var(--text-secondary)]">
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <div className="text-sm leading-6 text-[var(--text-secondary)]">
            Save this key securely. You will use it to sign in to the dashboard and send traces from your services.
          </div>
          <Button onClick={() => navigate('/login')} className="w-full justify-center" size="lg">
            Continue to sign in
          </Button>
        </div>
      )}
    </AuthShell>
  );
}
