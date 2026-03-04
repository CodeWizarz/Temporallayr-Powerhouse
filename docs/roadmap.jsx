import { useState } from "react";

const PHASES = [
  {
    id: "P0",
    label: "PHASE 0",
    title: "Repo Restructure",
    subtitle: "This Week",
    color: "#6366f1",
    bg: "#1e1b4b",
    border: "#4338ca",
    status: "now",
    nodes: [
      { id: "p0-1", label: "Create docker/ folder", detail: "Move Dockerfile → docker/server/Dockerfile\nAdd docker/dashboard/Dockerfile\nAdd docker/clickhouse/config.xml", done: false },
      { id: "p0-2", label: "Restructure tests/", detail: "tests/unit/\ntests/integration/\ntests/e2e/\ntests/performance/\n(ClickHouse pattern)", done: false },
      { id: "p0-3", label: "Add docs/ folder", detail: "docs/quickstart.md\ndocs/sdk-python.md\ndocs/sdk-node.md\ndocs/api-reference.md\ndocs/self-hosting.md", done: false },
      { id: "p0-4", label: "Clean .github/workflows/", detail: "ci.yml (exists ✓)\nrelease.yml — PyPI + npm publish\ndocker.yml — GHCR push\ndashboard.yml — Vercel deploy", done: false },
      { id: "p0-5", label: "Add .env.example", detail: "Document every env var\nWith comments + examples\nReference in SETUP.md", done: false },
    ],
  },
  {
    id: "P1",
    label: "PHASE 1",
    title: "Dashboard",
    subtitle: "Weeks 1–3",
    color: "#f59e0b",
    bg: "#1c1408",
    border: "#d97706",
    status: "next",
    nodes: [
      { id: "p1-1", label: "Scaffold dashboard/", detail: "React 18 + TypeScript + Vite\n@clickhouse/click-ui (Apache-2.0 ✓)\n@xyflow/react — DAG viewer\nrecharts — latency charts\n@tanstack/react-query — data fetching", done: false },
      { id: "p1-2", label: "Traces Page", detail: "List all execution graphs\nPaginated table\nClick → TraceDetail", done: false },
      { id: "p1-3", label: "TraceDetail + DAG ⭐", detail: "react-flow DAG visualization\nEach node: name, ms, tokens, cost\nReplay button inline\nYOUR KILLER DEMO FEATURE", done: false },
      { id: "p1-4", label: "Incidents Page", detail: "Severity badges (critical/high/normal)\nAck + Resolve buttons\nFilter by status", done: false },
      { id: "p1-5", label: "Analytics Page", detail: "P50/P95/P99 per span\nCost per day\nError rate over time\nPowered by ClickHouse", done: false },
      { id: "p1-6", label: "Replay Page", detail: "Enter trace_id\nRun deterministic replay\nShow divergence diff", done: false },
      { id: "p1-7", label: "Settings Page", detail: "API key management\nAdmin: register tenant\nAdmin: rotate keys\nServer health status", done: false },
      { id: "p1-8", label: "Dashboard Dockerfile", detail: "Multi-stage: node build → nginx serve\nProxy /api → TemporalLayr server\nVITE_API_URL build arg", done: false },
    ],
  },
  {
    id: "P2",
    label: "PHASE 2",
    title: "Production Hardening",
    subtitle: "Weeks 3–5",
    color: "#10b981",
    bg: "#071a12",
    border: "#059669",
    status: "soon",
    nodes: [
      { id: "p2-1", label: "PostgreSQL Store", detail: "asyncpg connection pool\nDrop-in replacement for SQLiteStore\nMigrations with alembic\nNeon free tier compatible", done: false },
      { id: "p2-2", label: "Rate Limiting", detail: "slowapi (Starlette middleware)\n1000 req/min per tenant on /ingest\n10 req/min on admin endpoints\nHTTP 429 + Retry-After header", done: false },
      { id: "p2-3", label: "Tenant Usage Quotas", detail: "Daily span counter per tenant\nConfigurable hard limit\nGET /usage endpoint\nSoft warning at 80% of quota", done: false },
      { id: "p2-4", label: "Prometheus Metrics", detail: "GET /metrics endpoint\nspans_ingested_total counter\nrequest_duration_ms histogram\nincidents_open gauge\nConnects to Grafana", done: false },
      { id: "p2-5", label: "Audit Log Export", detail: "SQLite audit_log table\nGET /admin/audit-log paginated\nSIEM-compatible JSON format\nPDF export for compliance", done: false },
      { id: "p2-6", label: "Webhook Alerts", detail: "POST to customer URL on incident\nSlack webhook format\nPagerDuty format\nConfigured per tenant", done: false },
    ],
  },
  {
    id: "P3",
    label: "PHASE 3",
    title: "SDK Completeness",
    subtitle: "Weeks 5–7",
    color: "#06b6d4",
    bg: "#071a1c",
    border: "#0891b2",
    status: "later",
    nodes: [
      { id: "p3-1", label: "TypeScript SDK (finish)", detail: "sdk-node/ needs full parity\ntl.trace() / tracer.llm() / tracer.tool()\nPublish as @temporallayr/sdk\nautomatic batching + retry", done: false },
      { id: "p3-2", label: "LangChain Integration", detail: "TemporalLayrCallbackHandler\nAuto-captures chain/llm/tool steps\nZero config — drop into callbacks=[]\npip install temporallayr[langchain]", done: false },
      { id: "p3-3", label: "LlamaIndex Integration", detail: "TemporalLayrObserver\nSettings.callback_manager.add_handler()\nCaptures query/retrieval/llm\npip install temporallayr[llamaindex]", done: false },
      { id: "p3-4", label: "OpenAI Wrapper", detail: "Drop-in: from temporallayr.wrappers import OpenAI\nZero code change to existing code\nAuto-tracks all calls + costs", done: false },
      { id: "p3-5", label: "Anthropic Wrapper", detail: "Same pattern as OpenAI wrapper\nfrom temporallayr.wrappers import Anthropic\nMaps usage.input_tokens etc.", done: false },
    ],
  },
  {
    id: "P4",
    label: "PHASE 4",
    title: "Enterprise Features",
    subtitle: "Weeks 7–10",
    color: "#ec4899",
    bg: "#1a071a",
    border: "#db2777",
    status: "enterprise",
    nodes: [
      { id: "p4-1", label: "RBAC", detail: "Roles: admin / developer / viewer\nDevelopers: ingest + read own tenant\nViewers: dashboard read-only\nJWT tokens", done: false },
      { id: "p4-2", label: "SSO / OAuth2", detail: "GitHub OAuth (devs love it)\nGoogle OAuth\nSAML for enterprise (later)\nSession management", done: false },
      { id: "p4-3", label: "Cryptographic Audit Trail ⭐", detail: "Immutable append-only log\nHash chain (each entry hashes prev)\nTamper-proof proof of what agent did\nFINANCIAL SERVICES WEDGE", done: false },
      { id: "p4-4", label: "Data Residency", detail: "EU data stays in EU ClickHouse\nGDPR delete endpoint\nPer-tenant retention config\nData export NDJSON", done: false },
      { id: "p4-5", label: "SLA + Uptime Dashboard", detail: "99.9% SLA commitment\nStatus page\nIncident history public\nEnterprise contract template", done: false },
    ],
  },
  {
    id: "P5",
    label: "PHASE 5",
    title: "Go-To-Market",
    subtitle: "Weeks 8–12 (Parallel)",
    color: "#f43f5e",
    bg: "#1a0a0a",
    border: "#e11d48",
    status: "gtm",
    nodes: [
      { id: "p5-1", label: "Docs Site", detail: "Mintlify or Docusaurus\nQuickstart (5 min to first trace)\nSDK reference Python + TS\nAuto-generated API reference\nSelf-hosting guide", done: false },
      { id: "p5-2", label: "Landing Page", detail: "Hero: 'Replay any AI agent failure'\nDemo video — replay engine\nHelicone/LangSmith comparison table\nDeploy in 5 minutes CTA\nEmail capture", done: false },
      { id: "p5-3", label: "Pricing Model", detail: "Free: 100K spans/mo, 1 tenant\nStarter $49/mo: 1M spans, 5 tenants\nGrowth $199/mo: 10M spans, unlimited\nEnterprise: custom SLA + SSO", done: false },
      { id: "p5-4", label: "PyPI + npm Publish", detail: "pip install temporallayr\nnpm i @temporallayr/sdk\nGitHub Actions auto-release on tag\nChangelog auto-generated", done: false },
      { id: "p5-5", label: "Design Partner Outreach", detail: "Target: fintech + healthtech teams\nwith autonomous agents in prod\nOffer: free Growth tier 6 months\nAsk for: feedback + logo on site", done: false },
    ],
  },
];

const STATUS_BADGE = {
  now: { label: "NOW", color: "#6366f1" },
  next: { label: "NEXT", color: "#f59e0b" },
  soon: { label: "SOON", color: "#10b981" },
  later: { label: "LATER", color: "#06b6d4" },
  enterprise: { label: "ENTERPRISE", color: "#ec4899" },
  gtm: { label: "GTM", color: "#f43f5e" },
};

export default function Roadmap() {
  const [activePhase, setActivePhase] = useState("P1");
  const [activeNode, setActiveNode] = useState(null);
  const [view, setView] = useState("phases"); // 'phases' | 'mindmap'

  const phase = PHASES.find((p) => p.id === activePhase);

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", color: "#e0e0e0", fontFamily: "Inter, sans-serif", padding: 0 }}>
      {/* Header */}
      <div style={{ background: "#111", borderBottom: "1px solid #222", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ color: "#facc15", fontWeight: 700, fontSize: 18, letterSpacing: -0.5 }}>⬡ TemporalLayr</div>
          <div style={{ color: "#555", fontSize: 12, marginTop: 2 }}>Product Roadmap — Tests Passing → Enterprise Customers</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["phases", "mindmap"].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: "6px 16px", borderRadius: 6, border: "1px solid",
                borderColor: view === v ? "#facc15" : "#333",
                background: view === v ? "#1a1700" : "transparent",
                color: view === v ? "#facc15" : "#666",
                cursor: "pointer", fontSize: 12, textTransform: "capitalize",
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "phases" ? (
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", height: "calc(100vh - 65px)" }}>
          {/* Left: phase list */}
          <div style={{ borderRight: "1px solid #1a1a1a", overflow: "auto", padding: "16px 0" }}>
            {PHASES.map((p) => {
              const badge = STATUS_BADGE[p.status];
              const isActive = p.id === activePhase;
              return (
                <div
                  key={p.id}
                  onClick={() => { setActivePhase(p.id); setActiveNode(null); }}
                  style={{
                    padding: "14px 20px",
                    cursor: "pointer",
                    borderLeft: `3px solid ${isActive ? p.color : "transparent"}`,
                    background: isActive ? p.bg : "transparent",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: p.color, fontWeight: 700, letterSpacing: 1 }}>{p.label}</span>
                    <span style={{ fontSize: 9, background: badge.color + "22", color: badge.color, padding: "2px 6px", borderRadius: 3, fontWeight: 700 }}>
                      {badge.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: isActive ? "#fff" : "#888" }}>{p.title}</div>
                  <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{p.subtitle}</div>
                  <div style={{ marginTop: 8, display: "flex", gap: 3, flexWrap: "wrap" }}>
                    {p.nodes.map((n) => (
                      <div key={n.id} style={{ width: 8, height: 8, borderRadius: 2, background: n.done ? p.color : "#2a2a2a" }} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: node detail */}
          <div style={{ overflow: "auto", padding: "24px 32px" }}>
            {phase && (
              <>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: phase.color, fontWeight: 700 }}>{phase.label}</span>
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{phase.title}</h2>
                    <span style={{ fontSize: 12, color: "#555" }}>· {phase.subtitle}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#555" }}>
                    {phase.nodes.length} tasks · click any card to expand
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                  {phase.nodes.map((node) => {
                    const isOpen = activeNode === node.id;
                    return (
                      <div
                        key={node.id}
                        onClick={() => setActiveNode(isOpen ? null : node.id)}
                        style={{
                          background: isOpen ? phase.bg : "#111",
                          border: `1px solid ${isOpen ? phase.color : "#222"}`,
                          borderRadius: 8,
                          padding: "14px 16px",
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: isOpen ? 10 : 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: isOpen ? "#fff" : "#ccc" }}>
                            {node.label}
                          </span>
                          <span style={{ fontSize: 14, color: phase.color }}>{isOpen ? "▾" : "▸"}</span>
                        </div>
                        {isOpen && (
                          <pre style={{
                            margin: 0, fontSize: 12, color: "#888",
                            whiteSpace: "pre-wrap", fontFamily: "monospace",
                            lineHeight: 1.7, borderTop: `1px solid ${phase.border}`, paddingTop: 10,
                          }}>
                            {node.detail}
                          </pre>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Mindmap view */
        <div style={{ padding: "32px 28px", overflow: "auto" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ display: "inline-block", background: "#facc15", color: "#000", fontWeight: 700, fontSize: 20, padding: "12px 28px", borderRadius: 12 }}>
              ⬡ TemporalLayr
            </div>
            <div style={{ color: "#555", marginTop: 8, fontSize: 13 }}>
              Agent Observability Platform · Full Build Roadmap
            </div>
          </div>

          {/* Horizontal phase strip */}
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            {PHASES.map((p) => (
              <div
                key={p.id}
                style={{
                  width: 200,
                  background: p.bg,
                  border: `1px solid ${p.border}`,
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                <div style={{ background: p.color + "22", padding: "10px 14px", borderBottom: `1px solid ${p.border}` }}>
                  <div style={{ fontSize: 10, color: p.color, fontWeight: 700, letterSpacing: 1 }}>{p.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginTop: 2 }}>{p.title}</div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 1 }}>{p.subtitle}</div>
                </div>
                <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {p.nodes.map((n) => (
                    <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: "#888", lineHeight: 1.3 }}>
                        {n.label.replace(" ⭐", "")}
                        {n.label.includes("⭐") && <span style={{ color: p.color }}> ★</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Key differentiators */}
          <div style={{ marginTop: 40, background: "#111", border: "1px solid #222", borderRadius: 10, padding: "20px 24px", maxWidth: 860, margin: "40px auto 0" }}>
            <div style={{ color: "#facc15", fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>
              🔑 Moat Features — Nobody Else Has These
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              {[
                { icon: "▶", title: "Deterministic Replay", desc: "Re-run any production failure locally without real LLM calls. Debug in seconds." },
                { icon: "⬡", title: "Execution DAG", desc: "Full graph of every agent decision — not just LLM calls. Tools, retrievals, business logic." },
                { icon: "🔐", title: "Crypto Audit Trail", desc: "Immutable hash-chained log. Prove what your agent decided. Required for fintech/health." },
              ].map((f) => (
                <div key={f.title} style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 8, padding: "14px 16px" }}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>{f.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#facc15", marginBottom: 6 }}>{f.title}</div>
                  <div style={{ fontSize: 11, color: "#666", lineHeight: 1.6 }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* vs competitors */}
          <div style={{ marginTop: 20, background: "#111", border: "1px solid #222", borderRadius: 10, padding: "20px 24px", maxWidth: 860, margin: "20px auto 0" }}>
            <div style={{ color: "#888", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>
              Competitive Position
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 0 }}>
              {["Feature", "Helicone", "LangSmith", "TemporalLayr"].map((h, i) => (
                <div key={h} style={{ padding: "8px 12px", borderBottom: "1px solid #1a1a1a", fontSize: 12, fontWeight: i === 3 ? 700 : 600, color: i === 3 ? "#facc15" : i === 0 ? "#666" : "#888" }}>
                  {h}
                </div>
              ))}
              {[
                ["Request logging", "✓", "✓", "✓"],
                ["Cost tracking", "✓", "✓", "✓"],
                ["Agent DAG", "—", "partial", "✓ CORE"],
                ["Deterministic replay", "—", "—", "✓ UNIQUE"],
                ["Semantic diff", "—", "—", "✓ UNIQUE"],
                ["Failure clustering", "—", "—", "✓ UNIQUE"],
                ["Crypto audit trail", "—", "—", "✓ UNIQUE"],
              ].map(([feat, ...vals]) => (
                <>
                  <div style={{ padding: "7px 12px", borderBottom: "1px solid #111", fontSize: 12, color: "#888" }}>{feat}</div>
                  {vals.map((v, i) => (
                    <div key={i} style={{ padding: "7px 12px", borderBottom: "1px solid #111", fontSize: 12, textAlign: "center",
                      color: v === "—" ? "#333" : v.includes("UNIQUE") || v === "✓ CORE" ? "#facc15" : v === "partial" ? "#f59e0b" : "#22c55e" }}>
                      {v}
                    </div>
                  ))}
                </>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}