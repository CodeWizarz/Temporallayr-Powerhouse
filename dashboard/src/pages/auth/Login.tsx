import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/client';

export default function Login() {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      localStorage.setItem('tl_api_key', apiKey);
      await api.verifyKey();
      login(apiKey);
      navigate('/overview');
    } catch {
      localStorage.removeItem('tl_api_key');
      setError('Invalid API key or server unreachable.');
    } finally {
      setLoading(false);
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
        <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Welcome back</h1>
        <p className="text-sm text-[var(--text-muted)] mb-6">Enter your API key to access the dashboard.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="tl_..."
              required
              className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-md px-3 py-2.5 text-sm font-mono
                text-[var(--text-primary)] placeholder-[var(--text-muted)]
                focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Button type="submit" loading={loading} className="w-full" size="lg">
            Sign In <ArrowRight className="w-4 h-4" />
          </Button>
        </form>
        <p className="text-xs text-[var(--text-muted)] mt-6 text-center">
          Need an account? <Link to="/signup" className="text-[var(--accent)] hover:underline">Register tenant</Link>
        </p>
      </div>
    </div>
  );
}
