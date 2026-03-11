import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, KeyRound } from 'lucide-react';
import { Button, Input } from '../../components/ui';
import { AuthShell } from '../../components/shared';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/client';

export default function Login() {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
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
    <AuthShell
      eyebrow="Sign in"
      title="Open your observability workspace."
      description="Use a valid tenant API key to access traces, incidents, analytics, and system controls."
      footer={
        <p className="text-sm text-[var(--text-secondary)]">
          Need a tenant first?{' '}
          <Link to="/signup" className="font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]">
            Register one here
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="API key"
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="tl_..."
          required
          icon={<KeyRound className="h-4 w-4" />}
          error={error || undefined}
          hint="We verify the key against the backend before opening the dashboard."
          className="h-12 rounded-2xl border-[var(--border-soft)] bg-[rgba(0,0,0,0.18)] px-4 text-sm"
        />

        <Button type="submit" loading={loading} className="w-full justify-center" size="lg">
          Sign in
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
    </AuthShell>
  );
}
