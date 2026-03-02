from temporallayr.models.execution import ExecutionGraph
from temporallayr.core.failure_cluster import FailureClusterEngine

event = {
    "trace_id": "trace-1",
    "tenant_id": "t1",
    "spans": [
        {
            "span_id": "s1",
            "name": "task",
            "status": "error",
            "error": "ValueError: concurrent error",
        }
    ],
}
graph = ExecutionGraph.model_validate(event)
print("Clusters:", FailureClusterEngine.cluster_failures([graph]))
