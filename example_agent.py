"""
TemporalLayr example agent — demonstrates all decorator types.

Shows:
  @track          — generic function tracing
  @track_llm      — LLM call with token/cost capture
  @track_tool     — tool call with name capture
  @track_pipeline — top-level pipeline entry point
"""

import asyncio
import os

import temporallayr
from temporallayr.core.decorators import track, track_llm, track_pipeline, track_tool
from temporallayr.core.recorder import ExecutionRecorder

os.environ.setdefault("TEMPORALLAYR_SERVER_URL", "http://localhost:8000")
os.environ.setdefault("TEMPORALLAYR_API_KEY", "dev-key")
os.environ.setdefault("TEMPORALLAYR_TENANT_ID", "dev-tenant")

temporallayr.init()


@track_tool(name="fetch_user_profile", description="Retrieve user profile from database")
def fetch_user_profile(user_id: str) -> dict:
    return {"id": user_id, "risk_score": 0.87, "tier": "premium"}


@track_tool(name="fetch_transaction_history")
def fetch_transaction_history(user_id: str, limit: int = 10) -> list:
    return [{"amount": 1200 * i, "currency": "USD"} for i in range(1, limit + 1)]


@track_llm(name="risk_assessment_llm")
async def assess_risk(profile: dict, transactions: list) -> dict:
    """Simulates an LLM risk assessment call."""
    await asyncio.sleep(0.05)  # Simulate LLM latency
    risk = profile.get("risk_score", 0.5)
    decision = "REJECT" if risk > 0.8 else "APPROVE"
    return {
        # Return format @track_llm understands for token capture
        "output": decision,
        "model": "gpt-4o",
        "prompt_tokens": 342,
        "completion_tokens": 28,
        "total_tokens": 370,
    }


@track(name="format_decision")
def format_decision(decision_output: dict, user_id: str) -> dict:
    return {
        "user_id": user_id,
        "decision": decision_output.get("output", decision_output),
        "timestamp": "2025-01-01T00:00:00Z",
    }


@track_pipeline
async def autonomous_decision_pipeline(user_id: str) -> dict:
    profile = fetch_user_profile(user_id)
    transactions = fetch_transaction_history(user_id, limit=5)
    assessment = await assess_risk(profile, transactions)
    return format_decision(assessment, user_id)


async def main() -> None:
    from temporallayr import client

    client.init()

    print("Running autonomous decision pipeline...\n")

    async with ExecutionRecorder() as recorder:
        result = await autonomous_decision_pipeline("usr_12345")

    graph = recorder.graph
    print(f"✓ Pipeline complete: decision={result['decision']}")
    print(f"✓ Captured {len(graph.spans)} spans in trace {graph.trace_id[:8]}...")
    print()

    for span in graph.spans:
        attrs = span.attributes
        duration = attrs.get("duration_ms", "?")
        cost = attrs.get("cost_usd")
        tokens = attrs.get("llm.token_count.total")
        extra = ""
        if tokens:
            extra += f" tokens={tokens}"
        if cost:
            extra += f" cost=${cost:.6f}"
        print(f"  [{span.status.upper():7}] {span.name:<40} {duration}ms{extra}")

    print("\nDone. Check http://localhost:8000/docs for API.")

    await temporallayr.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
