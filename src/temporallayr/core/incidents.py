"""
Engine for managing the lifecycle of deterministic execution failures.
"""

import hashlib
from datetime import UTC, datetime
from typing import Any

from temporallayr.core.alert_dispatcher import AlertDispatcher
from temporallayr.core.audit import AuditLogger


class IncidentEngine:
    """
    Automates the promotion of structural failure clusters into tracked incidents.
    """

    @classmethod
    def _classify_severity(cls, count: int) -> str:
        """
        Derive incident severity strictly from topological occurrence counts.
        """
        if count > 100:
            return "critical"
        if count > 20:
            return "high"
        return "normal"

    @classmethod
    def _escalate_severity(cls, severity: str) -> str:
        """
        Bump severity level by one step deterministically.
        """
        if severity == "normal":
            return "high"
        if severity == "high":
            return "critical"
        return "critical"

    @classmethod
    def detect_incidents(
        cls, clusters: list[dict[str, Any]], existing_incidents: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """
        Map incoming deterministic clusters against known incidents.
        Promotes previously unseen clusters to new incidents and updates active counts.
        """
        now = datetime.now(UTC)
        now_str = now.isoformat()

        # Isolate the current time bucket to generate deterministic incident signatures natively
        # grouping by the hour window where the anomaly first propagated
        time_bucket = now.strftime("%Y-%m-%d-%H")

        # Map active tracked incidents for O(1) correlation
        incident_map = {inc["cluster_id"]: inc for inc in existing_incidents}

        for cluster in clusters:
            cluster_id = cluster["cluster_id"]

            if cluster_id not in incident_map:
                # Provision a brand new tracked anomaly incident
                signature = f"{cluster_id}:{time_bucket}".encode()
                incident_id = hashlib.sha256(signature).hexdigest()

                new_incident = {
                    "incident_id": incident_id,
                    "tenant_id": cluster.get("tenant_id", "default"),
                    "cluster_id": cluster_id,
                    "first_seen": now_str,
                    "last_seen": now_str,
                    "count": cluster["count"],
                    "initial_count": cluster["count"],
                    "escalated": False,
                    "status": "open",
                    "severity": cls._classify_severity(cluster["count"]),
                }
                incident_map[cluster_id] = new_incident

                try:
                    AuditLogger.log_incident_change(
                        new_incident["incident_id"],
                        "new_incident",
                        new_incident["tenant_id"],
                        {"severity": new_incident["severity"]},
                    )
                    AlertDispatcher.dispatch(new_incident, event_type="new_incident")
                except Exception as e:
                    print(f"Failed to cleanly dispatch anomaly notifications for new incident: {e}")
            else:
                # Accumulate telemetry counts natively for an active regression
                inc = incident_map[cluster_id]
                inc["last_seen"] = now_str
                inc["count"] += cluster["count"]

                # Ensure historical records without tracking metrics receive baseline
                if "initial_count" not in inc:
                    inc["initial_count"] = max(1, inc["count"] - cluster["count"])
                if "escalated" not in inc:
                    inc["escalated"] = False

                previous_severity = inc.get("severity", cls._classify_severity(inc["count"]))
                base_severity = cls._classify_severity(inc["count"])
                first_seen_dt = datetime.fromisoformat(inc["first_seen"])

                if (now.timestamp() - first_seen_dt.timestamp()) <= 3600:
                    if inc["count"] >= 2 * inc["initial_count"]:
                        inc["escalated"] = True

                if inc["escalated"]:
                    inc["severity"] = cls._escalate_severity(base_severity)
                    # Trigger notification strictly on net new escalation threshold
                    if previous_severity != inc["severity"]:
                        try:
                            AuditLogger.log_incident_change(
                                inc["incident_id"],
                                "severity_upgrade",
                                inc.get("tenant_id", "default"),
                                {
                                    "previous_severity": previous_severity,
                                    "new_severity": inc["severity"],
                                },
                            )
                            AlertDispatcher.dispatch(inc, event_type="severity_upgrade")
                        except Exception as e:
                            print(
                                "Failed to cleanly dispatch notifications "
                                f"on regression up-scale: {e}"
                            )
                else:
                    inc["severity"] = base_severity

        return list(incident_map.values())
