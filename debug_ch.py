import asyncio
from temporallayr.core.store_clickhouse import get_clickhouse_store
from temporallayr.models.execution import ExecutionGraph
import os

os.environ["TEMPORALLAYR_CLICKHOUSE_HOST"] = (
    "ep-delicate-snowflake-a23v0s09-pooler.eu-central-1.aws.clickhouse.cloud"
)
os.environ["TEMPORALLAYR_CLICKHOUSE_PORT"] = "8443"
os.environ["TEMPORALLAYR_CLICKHOUSE_USER"] = "default"
os.environ["TEMPORALLAYR_CLICKHOUSE_PASSWORD"] = "193JovlIfzBq"
os.environ["TEMPORALLAYR_CLICKHOUSE_SECURE"] = "true"

payload = {
    "trace_id": "analytics_test_001",
    "tenant_id": "temporallayr-prod",
    "nodes": [
        {
            "id": "node_1",
            "type": "llm",
            "name": "signal_generator",
            "status": "success",
            "duration_ms": 142.5,
            "inputs": {"prompt": "Analyze NIFTY 50 momentum"},
            "outputs": {"signal": "BUY", "confidence": 0.78},
            "error": None,
        }
    ],
    "edges": [],
    "created_at": "2026-03-07T05:00:00Z",
    "status": "success",
}

graph = ExecutionGraph.model_validate(payload)
ch = get_clickhouse_store()
print(f"STORE: {ch}")
try:
    ch.insert_trace(graph)
    print("SUCCESS")
except Exception as e:
    import traceback

    traceback.print_exc()
