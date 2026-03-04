"""Failure clustering using deterministic embedding cosine similarity."""

from __future__ import annotations

import hashlib
import math
import re
from dataclasses import dataclass, field
from typing import Any

from pydantic import Field

from temporallayr.models.base import TemporalLayrBaseModel

_TOKEN_RE = re.compile(r"[a-z0-9_]+")


class FailureSignal(TemporalLayrBaseModel):
    """Single failure sample used for semantic clustering."""

    tenant_id: str
    trace_id: str
    span_name: str
    error_message: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class FailureCluster(TemporalLayrBaseModel):
    """Clustered set of similar failure signals."""

    cluster_id: str
    tenant_id: str
    size: int
    trace_ids: list[str]
    representative_span: str
    representative_error: str
    average_similarity: float


def embed_text(text: str, dimensions: int = 64) -> list[float]:
    """Create a deterministic embedding vector via signed hashing."""
    if dimensions <= 0:
        raise ValueError("dimensions must be > 0")

    vector = [0.0] * dimensions
    tokens = _TOKEN_RE.findall(text.lower())
    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:4], "big") % dimensions
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        vector[index] += sign
    return _normalize(vector)


def cosine_similarity(left: list[float], right: list[float]) -> float:
    """Compute cosine similarity between two equal-length vectors."""
    if len(left) != len(right):
        raise ValueError("Vectors must have equal length")

    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm == 0.0 or right_norm == 0.0:
        return 0.0

    dot = sum(a * b for a, b in zip(left, right, strict=True))
    return dot / (left_norm * right_norm)


def cluster_failures(
    failures: list[FailureSignal],
    similarity_threshold: float = 0.82,
    dimensions: int = 64,
) -> list[FailureCluster]:
    """Cluster failures by cosine similarity over deterministic embeddings."""
    if not 0.0 <= similarity_threshold <= 1.0:
        raise ValueError("similarity_threshold must be within [0, 1]")

    ordered_failures = sorted(failures, key=_failure_sort_key)
    working: list[_WorkingCluster] = []

    for failure in ordered_failures:
        vector = embed_text(_signal_text(failure), dimensions=dimensions)
        best_index: int | None = None
        best_score = -1.0

        for index, cluster in enumerate(working):
            if cluster.tenant_id != failure.tenant_id:
                continue

            score = cosine_similarity(vector, cluster.centroid)
            if score > best_score:
                best_score = score
                best_index = index
                continue

            if score == best_score and best_index is not None:
                current_tiebreak = cluster.tiebreak_key
                previous_tiebreak = working[best_index].tiebreak_key
                if current_tiebreak < previous_tiebreak:
                    best_index = index

        if best_index is not None and best_score >= similarity_threshold:
            working[best_index].add_member(failure, vector, best_score)
            continue

        working.append(_WorkingCluster.new(failure, vector))

    clusters = [cluster.to_model() for cluster in working]
    clusters.sort(key=lambda item: (-item.size, item.cluster_id))
    return clusters


@dataclass
class _WorkingCluster:
    tenant_id: str
    centroid: list[float]
    members: list[FailureSignal] = field(default_factory=list)
    similarity_sum: float = 0.0

    @classmethod
    def new(cls, failure: FailureSignal, vector: list[float]) -> _WorkingCluster:
        return cls(
            tenant_id=failure.tenant_id, centroid=vector[:], members=[failure], similarity_sum=1.0
        )

    @property
    def tiebreak_key(self) -> str:
        return "|".join(sorted(_signal_id(member) for member in self.members))

    def add_member(self, failure: FailureSignal, vector: list[float], similarity: float) -> None:
        count = len(self.members)
        self.members.append(failure)
        self.similarity_sum += similarity

        updated = [0.0] * len(self.centroid)
        for index in range(len(self.centroid)):
            updated[index] = (self.centroid[index] * count + vector[index]) / (count + 1)
        self.centroid = _normalize(updated)

    def to_model(self) -> FailureCluster:
        sorted_members = sorted(self.members, key=_failure_sort_key)
        signature = "|".join(_signal_id(member) for member in sorted_members)
        cluster_id = hashlib.sha256(f"{self.tenant_id}:{signature}".encode()).hexdigest()

        trace_ids = sorted({member.trace_id for member in sorted_members})
        representative = sorted_members[0]
        avg_similarity = self.similarity_sum / max(1, len(self.members))

        return FailureCluster(
            cluster_id=cluster_id,
            tenant_id=self.tenant_id,
            size=len(sorted_members),
            trace_ids=trace_ids,
            representative_span=representative.span_name,
            representative_error=representative.error_message,
            average_similarity=round(avg_similarity, 6),
        )


def _normalize(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0.0:
        return vector
    return [value / norm for value in vector]


def _signal_text(failure: FailureSignal) -> str:
    metadata_parts = [f"{key}:{failure.metadata[key]}" for key in sorted(failure.metadata)]
    payload = " ".join(metadata_parts)
    return f"{failure.span_name} {failure.error_message} {payload}".strip()


def _signal_id(failure: FailureSignal) -> str:
    return ":".join([failure.tenant_id, failure.trace_id, failure.span_name, failure.error_message])


def _failure_sort_key(failure: FailureSignal) -> tuple[str, str, str, str]:
    return (failure.tenant_id, failure.trace_id, failure.span_name, failure.error_message)
