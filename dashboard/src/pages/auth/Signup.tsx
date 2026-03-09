import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, Copy, Check } from 'lucide-react';
import { Button } from '../../components/ui';
import { api } from '../../lib/client';

export default function Signup() {
  const [tenantId, setTenantId] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ api_key: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.admin.register(tenantId, adminKey);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (result?.api_key) {
      navigator.clipboard.writeText(result.api_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-glow auth-glow-1" />
      <div className="auth-glow auth-glow-2" />
      <div className="auth-card">
        <div className="flex items-center gap-2 mb-8">
          <Zap className="w-6 h-6 text-[var(--accent)]" />
          <span className="text-lg font-bold text-[var(--text-primary)]">TemporalLayr</span>
        </div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Register Tenant</h1>
        <p className="text-sm text-[var(--text-muted)] mb-6">Provision a new tenant instance.</p>

        {!result ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Tenant ID</label>
              <input
                type="text" value={tenantId} onChange={e => setTenantId(e.target.value)}
                placeholder="my-org" required pattern="^[a-z0-9-]+$"
                title="Lowercase letters, numbers, and hyphens only"
                className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-md px-3 py-2.5 text-sm font-mono
                  text-[var(--text-primary)] placeholder-[var(--text-muted)]
                  focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Admin Key</label>
              <input
                type="password" value={adminKey} onChange={e => setAdminKey(e.target.value)}
                placeholder="sk-admin-..." required
                className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-md px-3 py-2.5 text-sm font-mono
                  text-[var(--text-primary)] placeholder-[var(--text-muted)]
                  focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30"
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button type="submit" loading={loading} className="w-full" size="lg">Provision Tenant</Button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-400/10 border border-emerald-400/20 rounded-lg">
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Tenant Provisioned</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono text-[var(--text-primary)] break-all select-all">{result.api_key}</code>
                <button onClick={handleCopy} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <p className="text-xs text-[var(--text-muted)]">Save this key securely. You won't be able to see it again.</p>
            <Button onClick={() => navigate('/login')} className="w-full" size="lg">Continue to Login</Button>
          </div>
        )}
        <p className="text-xs text-[var(--text-muted)] mt-6 text-center">
          Already have a key? <Link to="/login" className="text-[var(--accent)] hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
