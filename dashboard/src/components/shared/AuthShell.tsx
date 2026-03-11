import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Sparkles, Zap } from 'lucide-react';

export function AuthShell({
  eyebrow,
  title,
  description,
  footer,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(201,246,88,0.12),transparent_18%),radial-gradient(circle_at_bottom_right,rgba(88,116,246,0.12),transparent_24%),linear-gradient(180deg,#0a0d12_0%,#0b0f14_100%)] px-5 py-8 text-[var(--text-primary)] md:px-8 md:py-10">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1320px] gap-8 lg:grid-cols-[0.95fr_0.8fr]">
        <div className="hidden rounded-[32px] border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-8 shadow-[0_30px_90px_rgba(0,0,0,0.28)] lg:flex lg:flex-col lg:justify-between">
          <div>
            <Link to="/login" className="inline-flex items-center gap-3 rounded-2xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-4 py-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)] text-[#11150e] shadow-[0_10px_30px_rgba(201,246,88,0.24)]">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-dim)]">Axiom Mode</div>
                <div className="mt-1 text-base font-semibold tracking-[-0.03em]">TemporalLayr</div>
              </div>
            </Link>

            <div className="mt-14 max-w-[560px]">
              <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--text-dim)]">Observability for AI systems</div>
              <h1 className="mt-4 text-[46px] font-semibold leading-[0.95] tracking-[-0.07em] text-[var(--text-primary)]">
                Watch traces, incidents, and system cost from one disciplined surface.
              </h1>
              <p className="mt-5 max-w-[500px] text-[15px] leading-7 text-[var(--text-secondary)]">
                TemporalLayr gives you trace-level debugging, replay workflows, operational status, and product-grade system visibility for AI applications.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[22px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] p-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-black/20 text-[var(--accent)]">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="text-sm font-medium text-[var(--text-primary)]">Replay Lab</div>
              <div className="mt-2 text-sm text-[var(--text-secondary)]">Re-run traces and validate fixes quickly.</div>
            </div>
            <div className="rounded-[22px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] p-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-black/20 text-[var(--accent)]">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="text-sm font-medium text-[var(--text-primary)]">Incident clarity</div>
              <div className="mt-2 text-sm text-[var(--text-secondary)]">Cluster failures into operational queues.</div>
            </div>
            <div className="rounded-[22px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] p-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-black/20 text-[var(--accent)]">
                <Zap className="h-4 w-4" />
              </div>
              <div className="text-sm font-medium text-[var(--text-primary)]">Fast setup</div>
              <div className="mt-2 text-sm text-[var(--text-secondary)]">Connect services with runtime-specific snippets.</div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <div className="w-full max-w-[520px] rounded-[32px] border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(17,22,29,0.96),rgba(10,14,20,0.96))] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.3)] md:p-8">
            <div className="mb-8 lg:hidden">
              <Link to="/login" className="inline-flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)] text-[#11150e] shadow-[0_10px_30px_rgba(201,246,88,0.24)]">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-dim)]">Axiom Mode</div>
                  <div className="mt-1 text-base font-semibold tracking-[-0.03em]">TemporalLayr</div>
                </div>
              </Link>
            </div>

            <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-dim)]">{eyebrow}</div>
            <h2 className="mt-3 text-[34px] font-semibold leading-none tracking-[-0.06em] text-[var(--text-primary)]">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>

            <div className="mt-8">{children}</div>
            {footer ? <div className="mt-8 border-t border-[var(--border-soft)] pt-5">{footer}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
