import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/client';
import { Card, Button } from '../components/ui';
import { PageHeader } from '../components/shared';
import { ArrowLeft, Plus, Code, Copy, Check, ChevronRight } from 'lucide-react';

const LANGUAGES = [
  { id: 'python', label: 'Python', icon: '🐍' },
  { id: 'javascript', label: 'JavaScript / Node.js', icon: 'JS' },
  { id: 'go', label: 'Go', icon: 'Go' },
  { id: 'java', label: 'Java', icon: '☕' },
  { id: 'rust', label: 'Rust', icon: '🦀' },
  { id: 'other', label: 'Other / Custom', icon: '...' },
];

const CODE_SNIPPETS: Record<string, string> = {
  python: `# Install: pip install opentelemetry-api opentelemetry-sdk opentelemetry-exporter-otlp
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

# Configure
provider = TracerProvider()
exporter = OTLPSpanExporter(
    endpoint="YOUR_ENDPOINT",
    headers={"x-api-key": "YOUR_API_KEY"}
)
provider.add_span_processor(BatchSpanProcessor(exporter))
trace.set_tracer_provider(provider)

# Use
tracer = trace.get_tracer("YOUR_SERVICE")
with tracer.start_as_current_span("operation") as span:
    span.set_attribute("key", "value")
    # Your code here`,
  javascript: `// Install: npm install @opentelemetry/api @opentelemetry/sdk-trace-node @opentelemetry/exporter-trace-otlp-grpc
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');

const provider = new NodeTracerProvider();
const exporter = new OTLPTraceExporter({
  url: 'YOUR_ENDPOINT',
  headers: { 'x-api-key': 'YOUR_API_KEY' },
});

provider.addSpanProcessor(new BatchSpanProcessor(exporter));
provider.register();

const tracer = provider.getTracer('YOUR_SERVICE');
const span = tracer.startSpan('operation');
span.setAttribute('key', 'value');
// Your code here
span.end();`,
  go: `// Install: go get go.opentelemetry.io/otel
package main

import (
    "context"
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
    sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

func initTracer() *sdktrace.TracerProvider {
    exporter, _ := otlptracegrpc.New(context.Background(),
        otlptracegrpc.WithEndpoint("YOUR_ENDPOINT"),
        otlptracegrpc.WithHeaders(map[string]string{"x-api-key": "YOUR_API_KEY"}),
    )
    tp := sdktrace.NewTracerProvider(sdktrace.WithBatcher(exporter))
    otel.SetTracerProvider(tp)
    return tp
}`,
  java: `// Add to pom.xml: opentelemetry-api, opentelemetry-sdk, opentelemetry-exporter-otlp
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.exporter.otlp.trace.OtlpGrpcSpanExporter;

OtlpGrpcSpanExporter exporter = OtlpGrpcSpanExporter.builder()
    .setEndpoint("YOUR_ENDPOINT")
    .addHeader("x-api-key", "YOUR_API_KEY")
    .build();

SdkTracerProvider provider = SdkTracerProvider.builder()
    .addSpanProcessor(BatchSpanProcessor.builder(exporter).build())
    .build();

Tracer tracer = provider.get("YOUR_SERVICE");
var span = tracer.spanBuilder("operation").startSpan();
span.setAttribute("key", "value");
// Your code here
span.end();`,
  rust: `// Add to Cargo.toml: opentelemetry, opentelemetry-otlp
use opentelemetry::global;
use opentelemetry_otlp::WithExportConfig;

fn init_tracer() {
    let exporter = opentelemetry_otlp::new_exporter()
        .tonic()
        .with_endpoint("YOUR_ENDPOINT");
    
    let tracer = opentelemetry_otlp::new_pipeline()
        .tracing()
        .with_exporter(exporter)
        .install_batch(opentelemetry_sdk::runtime::Tokio)
        .expect("Failed to install tracer");
}`,
  other: `# Use any OpenTelemetry-compatible SDK
# Configure the OTLP exporter with:
#   Endpoint: YOUR_ENDPOINT
#   Header: x-api-key: YOUR_API_KEY
#   Protocol: gRPC or HTTP/protobuf`,
};

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
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
        >
          <ArrowLeft size={18} className="text-[var(--text-muted)]" />
        </button>
        <PageHeader title="Add New Service" subtitle="Connect a service to start receiving traces" />
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
              step >= s ? 'bg-[var(--accent)] text-[var(--bg-base)]' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
            }`}>
              {s}
            </div>
            {s < 3 && <ChevronRight size={14} className="text-[var(--text-muted)]" />}
          </div>
        ))}
        <span className="text-xs text-[var(--text-muted)] ml-2">
          {step === 1 ? 'Name your service' : step === 2 ? 'Choose language' : 'Integrate'}
        </span>
      </div>

      {/* Step 1: Service Name */}
      {step === 1 && (
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Service Name</h3>
          <input
            type="text"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && serviceName.trim() && setStep(2)}
            placeholder="e.g. api-gateway, auth-service, payment-processor"
            className="w-full px-3 py-2.5 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] mb-4"
            autoFocus
          />
          <Button onClick={() => setStep(2)} disabled={!serviceName.trim()}>
            Continue <ChevronRight size={14} className="ml-1" />
          </Button>
        </Card>
      )}

      {/* Step 2: Language */}
      {step === 2 && (
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Select Language / Runtime</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.id}
                onClick={() => setLanguage(lang.id)}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  language === lang.id
                    ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                    : 'border-[var(--border)] hover:border-[var(--border-hover)]'
                }`}
              >
                <span className="text-lg">{lang.icon}</span>
                <div className="text-xs font-medium text-[var(--text-primary)] mt-1">{lang.label}</div>
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
            <Button
              onClick={() => createService.mutate({ name: serviceName, language })}
              disabled={!language || createService.isPending}
            >
              {createService.isPending ? 'Registering...' : 'Register Service'}
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Integration Code */}
      {step === 3 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 text-green-400 mb-4">
            <Check size={18} />
            <h3 className="text-sm font-semibold">Service "{serviceName}" registered!</h3>
          </div>
          <p className="text-xs text-[var(--text-muted)] mb-4">
            Add the following code to your application to start sending traces:
          </p>
          <div className="relative">
            <div className="absolute top-2 right-2">
              <CopyButton text={snippet} />
            </div>
            <pre className="p-4 bg-[var(--bg-base)] rounded-lg text-xs text-[var(--text-secondary)] overflow-x-auto font-mono leading-relaxed">
              {snippet}
            </pre>
          </div>
          <div className="flex gap-3 mt-4">
            <Button onClick={() => navigate('/status')}>View Services</Button>
            <Button variant="ghost" onClick={() => navigate('/')}>Go to Dashboard</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
