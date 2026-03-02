import argparse
import asyncio
import sys
from datetime import UTC, datetime, timedelta

import logging

from temporallayr.cli.commands import doctor, login, logs, test
from temporallayr.core.logging import configure_logging
from temporallayr.config import get_config
from temporallayr.core.diff_engine import ExecutionDiffer
from temporallayr.core.failure_cluster import FailureClusterEngine
from temporallayr.core.incidents import IncidentEngine
from temporallayr.core.replay import ReplayEngine
from temporallayr.core.store import get_default_store

logger = logging.getLogger(__name__)


async def run_replay(execution_id: str, tenant_id: str) -> None:
    """Load an execution graph by ID and run the deterministic replay engine."""
    logger.info(f"Resolving execution '{execution_id}' for tenant '{tenant_id}'...")
    try:
        graph = get_default_store().load_execution(execution_id, tenant_id)
    except FileNotFoundError as e:
        logger.error(f"Error: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Error parsing ExecutionGraph JSON: {e}", exc_info=True)
        sys.exit(1)

    logger.info(f"Loaded graph '{graph.id}' with {len(graph.nodes)} node(s).")
    logger.info("Initiating deterministic replay engine...")

    engine = ReplayEngine(graph)
    report = await engine.replay()

    for res in report.results:
        node_name = graph.nodes[res.node_id].name
        if res.success:
            logger.info(f"OK: {node_name}")
        else:
            orig_node = graph.nodes[res.node_id]
            expected = orig_node.metadata.get("output", orig_node.metadata.get("error", "Unknown"))

            if hasattr(res, "actual_output") and res.actual_output is not None:
                got = res.actual_output
            else:
                got = getattr(res, "actual_error", "Unknown")
            logger.error(f"DIVERGED: {node_name}", extra={"expected": expected, "actual": got})

    sys.exit(0 if report.is_deterministic else 1)


def run_diff(id1: str, id2: str, tenant_id: str) -> None:
    """Compare two execution graphs by ID and print structural and value divergences."""
    try:
        graph_a = get_default_store().load_execution(id1, tenant_id)
        graph_b = get_default_store().load_execution(id2, tenant_id)
    except FileNotFoundError as e:
        logger.error(f"Error: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Error parsing ExecutionGraph JSON: {e}", exc_info=True)
        sys.exit(1)

    diff = ExecutionDiffer.diff(graph_a, graph_b)

    logger.info(f"DIFF RUN: {id1[:8]} vs {id2[:8]}")

    structural = diff.get("structural_changes", [])
    if structural:
        for change in structural:
            logger.warning("STRUCTURAL CHANGE", extra={"change": change})

    value = diff.get("value_changes", [])
    if value:
        for change in value:
            logger.warning("VALUE CHANGE", extra={"change": change})

    if not structural and not value:
        logger.info("Executions are identical.")

    sys.exit(1 if structural or value else 0)


def run_incidents(tenant_id: str) -> None:
    """List deterministically clustered incidents within the trailing 24 hours."""
    store = get_default_store()

    execution_ids = store.list_executions(tenant_id)
    recent_executions = []

    cutoff_time = datetime.now(UTC) - timedelta(hours=24)

    for exec_id in execution_ids:
        try:
            graph = store.load_execution(exec_id, tenant_id)
            if graph.created_at >= cutoff_time:
                recent_executions.append(graph)
        except Exception:
            pass

    # Compute active clusters
    clusters = FailureClusterEngine.cluster_failures(recent_executions)
    incidents = IncidentEngine.detect_incidents(clusters, [])

    logger.info(f"ACTIVE INCIDENTS (Last 24h) - Tenant: {tenant_id}")

    if not incidents:
        logger.info("No structural incidents detected.")
        return

    for inc in incidents:
        logger.info(
            "Active Incident",
            extra={
                "incident_id": inc["incident_id"][:12],
                "severity": inc["severity"].upper(),
                "count": inc["count"],
                "status": inc["status"].upper(),
                "last_seen": inc["last_seen"],
            },
        )

    sys.exit(0)


def _invoke_replay(args):
    from temporallayr.config import get_tenant_id

    tenant_id = get_tenant_id() or "default"
    asyncio.run(run_replay(args.execution_id, tenant_id))


def _invoke_diff(args):
    from temporallayr.config import get_tenant_id

    tenant_id = get_tenant_id() or "default"
    run_diff(args.id1, args.id2, tenant_id)


def _invoke_incidents(args):
    from temporallayr.config import get_tenant_id

    tenant_id = get_tenant_id() or "default"
    run_incidents(tenant_id)


def main() -> None:
    """Entry point for the Modular TemporalLayr Developer CLI."""
    config = get_config()
    configure_logging(level=config.log_level)

    parser = argparse.ArgumentParser(description="TemporalLayr Developer CLI", prog="temporallayr")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Register individual modular commands securely
    login.register(subparsers)
    doctor.register(subparsers)
    test.register(subparsers)
    logs.register(subparsers)

    # Replay
    replay_parser = subparsers.add_parser(
        "replay", help="Replay an execution graph deterministically."
    )
    replay_parser.add_argument("execution_id", type=str, help="Execution ID to replay.")
    replay_parser.set_defaults(func=_invoke_replay)

    # Diff
    diff_parser = subparsers.add_parser("diff", help="Compare two executions.")
    diff_parser.add_argument("id1", type=str, help="First execution ID.")
    diff_parser.add_argument("id2", type=str, help="Second execution ID.")
    diff_parser.set_defaults(func=_invoke_diff)

    # Incidents
    incidents_parser = subparsers.add_parser(
        "incidents",
        help="List deterministically clustered incidents within the trailing 24 hours.",
    )
    incidents_parser.set_defaults(func=_invoke_incidents)

    args = parser.parse_args()

    # Route execution deterministically via stored func callbacks
    if hasattr(args, "func"):
        args.func(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
