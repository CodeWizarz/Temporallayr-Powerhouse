"""Unit tests for cosine-similarity failure clustering."""

from __future__ import annotations

import pytest

from temporallayr.analysis.failure_clusters import (
    FailureSignal,
    cluster_failures,
    cosine_similarity,
    embed_text,
)


def test_cosine_similarity_identical_text_is_one() -> None:
    left = embed_text("database timeout while fetching user profile")
    right = embed_text("database timeout while fetching user profile")
    similarity = cosine_similarity(left, right)
    assert similarity == pytest.approx(1.0)


def test_cluster_failures_groups_related_errors() -> None:
    failures = [
        FailureSignal(
            tenant_id="tenant-a",
            trace_id="trace-1",
            span_name="tool:fetch_profile",
            error_message="database timeout while fetching user profile",
        ),
        FailureSignal(
            tenant_id="tenant-a",
            trace_id="trace-2",
            span_name="tool:fetch_profile",
            error_message="database timeout while fetching user profile",
        ),
        FailureSignal(
            tenant_id="tenant-a",
            trace_id="trace-3",
            span_name="tool:fetch_profile",
            error_message="invalid auth token presented by caller",
        ),
    ]

    clusters = cluster_failures(failures, similarity_threshold=0.9)
    sizes = [cluster.size for cluster in clusters]

    assert len(clusters) == 2
    assert sizes == [2, 1]


def test_cluster_failures_is_deterministic_across_input_order() -> None:
    failures = [
        FailureSignal(
            tenant_id="tenant-a",
            trace_id="trace-10",
            span_name="tool:calculate",
            error_message="division by zero in risk engine",
        ),
        FailureSignal(
            tenant_id="tenant-a",
            trace_id="trace-11",
            span_name="tool:calculate",
            error_message="division by zero in risk engine",
        ),
        FailureSignal(
            tenant_id="tenant-b",
            trace_id="trace-12",
            span_name="tool:calculate",
            error_message="division by zero in risk engine",
        ),
    ]

    forward = cluster_failures(failures, similarity_threshold=0.9)
    reverse = cluster_failures(list(reversed(failures)), similarity_threshold=0.9)

    assert [cluster.cluster_id for cluster in forward] == [
        cluster.cluster_id for cluster in reverse
    ]
    assert [cluster.trace_ids for cluster in forward] == [cluster.trace_ids for cluster in reverse]
