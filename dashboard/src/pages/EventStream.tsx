import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/client';
import { Badge, Button } from '../components/ui';
import { DashboardSection, EmptyPanel, Surface, SurfaceHeader } from '../components/shared';
import { formatDate } from '../lib/utils';
import { AlertTriangle, CheckCircle, Info, Pause, Play, Radio, XCircle } from 'lucide-react';

interface StreamEvent {
  id: string;
  type: 'span_created' | 'span_completed' | 'incident_created' | 'alert_triggered' | 'service_registered' | 'error_detected';
  message: string;
  service_name?: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  timestamp: string;
}

const SEVERITY_CONFIG = {
  info: { icon: Info, variant: 'info' as const },
  warning: { icon: AlertTriangle, variant: 'warning' as const },
  error: { icon: XCircle, variant: 'error' as const },
  success: { icon: CheckCircle, variant: 'success' as const },
};

export default function EventStream() {
  const [isPaused, setIsPaused] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.getEvents(),
    refetchInterval: isPaused ? false : 5000,
  });

  useEffect(() => {
    if (!isPaused && listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [events, isPaused]);

  const list = (events ?? []) as StreamEvent[];

  return (
    <div className="space-y-8">
      <DashboardSection
        eyebrow="Event stream"
        title="A live stream needs visual rhythm."
        description="This page is now structured like a feed: live state up top, stream body below, and clear empty handling when the backend has no events yet."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={isPaused ? 'warning' : 'success'} dot>{isPaused ? 'Paused' : 'Live'}</Badge>
            <Button variant="outline" onClick={() => setIsPaused((value) => !value)}>
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
          </div>
        }
      />

      <Surface tone="hero">
        <div className="grid gap-4 p-6 md:grid-cols-3">
          <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-4 py-4">
            <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]"><Radio className={`h-4 w-4 ${isPaused ? '' : 'animate-pulse'}`} />Connection</div>
            <div className="text-2xl font-semibold tracking-[-0.05em] text-[var(--text-primary)]">{isPaused ? 'Paused' : 'Streaming'}</div>
          </div>
          <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-4 py-4">
            <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]">Events in view</div>
            <div className="text-2xl font-semibold tracking-[-0.05em] text-[var(--text-primary)]">{list.length}</div>
          </div>
          <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-4 py-4">
            <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]">Mode</div>
            <div className="text-2xl font-semibold tracking-[-0.05em] text-[var(--text-primary)]">Operational feed</div>
          </div>
        </div>
      </Surface>

      <Surface>
        <SurfaceHeader title="Live events" description="Once backend event payloads start flowing, this becomes the real-time operational tape." />
        <div className="px-6 pb-6 pt-4">
          {list.length === 0 ? (
            <EmptyPanel title="No events yet" description="The backend is not returning stream events right now. When events arrive, this panel will render them in reverse chronological order." />
          ) : (
            <div ref={listRef} className="max-h-[680px] overflow-y-auto rounded-[20px] border border-[var(--border-soft)]">
              {list.map((event) => {
                const config = SEVERITY_CONFIG[event.severity] ?? SEVERITY_CONFIG.info;
                const Icon = config.icon;
                return (
                  <div key={event.id} className="flex items-start gap-4 border-t border-[var(--border-soft)] px-5 py-4 first:border-t-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] text-[var(--text-secondary)]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={config.variant}>{event.type}</Badge>
                        {event.service_name ? <span className="text-xs text-[var(--text-dim)]">{event.service_name}</span> : null}
                      </div>
                      <div className="mt-2 text-sm text-[var(--text-primary)]">{event.message}</div>
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">{formatDate(event.timestamp)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Surface>
    </div>
  );
}
