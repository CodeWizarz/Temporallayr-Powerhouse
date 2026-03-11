import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/client';
import { Badge, Button } from '../components/ui';
import { DashboardSection, Surface, SurfaceHeader } from '../components/shared';
import { ArrowLeft, Check, ChevronRight, Code, Copy, Sparkles } from 'lucide-react';

const LANGUAGES = [
  { id: 'python', label: 'Python', icon: 'PY' },
  { id: 'javascript', label: 'JavaScript', icon: 'JS' },
  { id: 'go', label: 'Go', icon: 'GO' },
  { id: 'java', label: 'Java', icon: 'JV' },
  { id: 'rust', label: 'Rust', icon: 'RS' },
  { id: 'other', label: 'Custom', icon: 'OT' },
];

const CODE_SNIPPETS: Record<string, string> = {
  python: `from opentelemetry import trace\nfrom opentelemetry.sdk.trace import TracerProvider\nfrom opentelemetry.sdk.trace.export import BatchSpanProcessor\nfrom opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter\n\nprovider = TracerProvider()\nexporter = OTLPSpanExporter(\n    endpoint="YOUR_ENDPOINT",\n    headers={"x-api-key": "YOUR_API_KEY"},\n)\nprovider.add_span_processor(BatchSpanProcessor(exporter))\ntrace.set_tracer_provider(provider)`,
  javascript: `const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');\nconst { BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base');\nconst { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');\n\nconst provider = new NodeTracerProvider();\nprovider.addSpanProcessor(new BatchSpanProcessor(new OTLPTraceExporter({\n  url: 'YOUR_ENDPOINT',\n  headers: { 'x-api-key': 'YOUR_API_KEY' },\n})));\nprovider.register();`,
  go: `exporter, _ := otlptracegrpc.New(context.Background(),\n  otlptracegrpc.WithEndpoint("YOUR_ENDPOINT"),\n  otlptracegrpc.WithHeaders(map[string]string{"x-api-key": "YOUR_API_KEY"}),\n)\ntp := sdktrace.NewTracerProvider(sdktrace.WithBatcher(exporter))\notel.SetTracerProvider(tp)`,
  java: `OtlpGrpcSpanExporter exporter = OtlpGrpcSpanExporter.builder()\n  .setEndpoint("YOUR_ENDPOINT")\n  .addHeader("x-api-key", "YOUR_API_KEY")\n  .build();`,
  rust: `let exporter = opentelemetry_otlp::new_exporter()\n  .tonic()\n  .with_endpoint("YOUR_ENDPOINT");`,
  other: `# Configure any OTLP-compatible tracer with:\n# endpoint: YOUR_ENDPOINT\n# header: x-api-key: YOUR_API_KEY`,
};

function CopySnippet({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] text-[var(--text-secondary)]"
    >
      {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

export default function NewService() {
  const [step, setStep] = useState(1);
  const [serviceName, setServiceName] = useState('');
  const [language, setLanguage] = useState('');
  const navigate = useNavigate();

  const createService = useMutation({
    mutationFn: (data: { name: string; language: string }) => api.registerService(data),
    onSuccess: () => setStep(3),
  });

  const snippet = CODE_SNIPPETS[language] ?? CODE_SNIPPETS.other;

  return (
    <div className="space-y-8">
      <DashboardSection
        eyebrow="Connect Service"
        title="Onboarding should feel like a product flow."
        description="This setup flow now reads as a guided connection experience instead of a bare three-step form."
        actions={<Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" />Back</Button>}
      />

      <Surface tone="hero">
        <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-dim)]">Flow progress</div>
            <div className="mt-3 flex items-center gap-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium ${step >= item ? 'bg-[var(--accent)] text-[#11150e]' : 'bg-[var(--bg-panel-soft)] text-[var(--text-dim)]'}`}>{item}</div>
                  {item < 3 ? <ChevronRight className="h-4 w-4 text-[var(--text-dim)]" /> : null}
                </div>
              ))}
            </div>
          </div>
          <Badge variant="accent">{step === 1 ? 'Name service' : step === 2 ? 'Choose runtime' : 'Install snippet'}</Badge>
        </div>
      </Surface>

      {step === 1 ? (
        <Surface>
          <SurfaceHeader title="Step 1: Name the service" description="Choose a stable service identifier that will appear throughout traces, analytics, incidents, and cost attribution." />
          <div className="px-6 pb-6 pt-4">
            <input value={serviceName} onChange={(event) => setServiceName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && serviceName.trim() && setStep(2)} placeholder="e.g. api-gateway, auth-service" className="h-12 w-full rounded-2xl border border-[var(--border-soft)] bg-[rgba(0,0,0,0.18)] px-4 text-sm text-[var(--text-primary)] outline-none" autoFocus />
            <div className="mt-4 flex justify-end"><Button onClick={() => setStep(2)} disabled={!serviceName.trim()}>Continue<ChevronRight className="h-4 w-4" /></Button></div>
          </div>
        </Surface>
      ) : null}

      {step === 2 ? (
        <Surface>
          <SurfaceHeader title="Step 2: Choose runtime" description="Pick the environment that best matches the service you are instrumenting." />
          <div className="grid gap-4 px-6 pb-6 pt-4 md:grid-cols-2 xl:grid-cols-3">
            {LANGUAGES.map((item) => (
              <button key={item.id} onClick={() => setLanguage(item.id)} className={`rounded-[20px] border p-5 text-left transition ${language === item.id ? 'border-[rgba(201,246,88,0.45)] bg-[rgba(201,246,88,0.08)]' : 'border-[var(--border-soft)] bg-[rgba(255,255,255,0.015)] hover:bg-white/4'}`}>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] text-sm font-medium text-[var(--text-primary)]">{item.icon}</div>
                <div className="mt-4 text-base font-medium text-[var(--text-primary)]">{item.label}</div>
              </button>
            ))}
          </div>
          <div className="flex justify-between px-6 pb-6">
            <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => createService.mutate({ name: serviceName, language })} disabled={!language || createService.isPending}>
              {createService.isPending ? 'Registering...' : 'Register service'}
            </Button>
          </div>
        </Surface>
      ) : null}

      {step === 3 ? (
        <Surface>
          <SurfaceHeader title="Step 3: Install the snippet" description={`Service \"${serviceName}\" is registered. Copy the starter snippet and replace the endpoint and API key placeholders.`} actions={<CopySnippet text={snippet} />} />
          <div className="px-6 pb-6 pt-4">
            <div className="mb-4 flex items-center gap-2 text-sm text-emerald-300"><Sparkles className="h-4 w-4" />Ready to instrument {serviceName}</div>
            <pre className="overflow-x-auto rounded-[20px] border border-[var(--border-soft)] bg-[rgba(0,0,0,0.24)] p-5 text-xs leading-6 text-[var(--text-secondary)]"><code>{snippet}</code></pre>
            <div className="mt-5 flex gap-3">
              <Button onClick={() => navigate('/status')}>View services</Button>
              <Button variant="outline" onClick={() => navigate('/overview')}>Go to dashboard</Button>
            </div>
          </div>
        </Surface>
      ) : null}

      <Surface tone="muted">
        <SurfaceHeader title="What this flow improves" description="These three steps now have context and visual hierarchy, so onboarding feels intentional instead of improvised." />
        <div className="grid gap-4 px-6 pb-6 pt-4 md:grid-cols-3">
          <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-4 py-4 text-sm text-[var(--text-secondary)]">Consistent naming leads to better trace grouping and analytics attribution.</div>
          <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-4 py-4 text-sm text-[var(--text-secondary)]">Runtime selection gives the user a clear mental model before they copy anything.</div>
          <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-4 py-4 text-sm text-[var(--text-secondary)]">The final snippet panel is built to be copied and executed immediately.</div>
        </div>
      </Surface>
    </div>
  );
}
