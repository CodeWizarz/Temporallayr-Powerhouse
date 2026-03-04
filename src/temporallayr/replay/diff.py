"""Semantic expected-vs-actual divergence reporting."""

from __future__ import annotations

import re
from typing import Any, Literal

from temporallayr.models.base import TemporalLayrBaseModel

DivergenceReason = Literal[
    "missing_in_actual",
    "unexpected_in_actual",
    "type_mismatch",
    "value_mismatch",
    "list_length_mismatch",
]

_IDENT_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


class Divergence(TemporalLayrBaseModel):
    """Single semantic mismatch item."""

    path: str
    reason: DivergenceReason
    expected: Any | None = None
    actual: Any | None = None


class DivergenceReport(TemporalLayrBaseModel):
    """Summary + detailed semantic divergence report."""

    diverged: bool
    total_differences: int
    differences: list[Divergence]


def semantic_diff(expected: Any, actual: Any) -> DivergenceReport:
    """Compare expected and actual values recursively."""
    differences: list[Divergence] = []
    _compare_values(expected, actual, path="$", differences=differences)
    return DivergenceReport(
        diverged=bool(differences),
        total_differences=len(differences),
        differences=differences,
    )


def _compare_values(expected: Any, actual: Any, path: str, differences: list[Divergence]) -> None:
    if type(expected) is not type(actual):
        differences.append(
            Divergence(
                path=path,
                reason="type_mismatch",
                expected=_type_name(expected),
                actual=_type_name(actual),
            )
        )
        return

    if isinstance(expected, dict):
        expected_keys = set(expected.keys())
        actual_keys = set(actual.keys())

        for key in sorted(expected_keys - actual_keys):
            key_path = _join_key(path, key)
            differences.append(
                Divergence(
                    path=key_path,
                    reason="missing_in_actual",
                    expected=expected[key],
                    actual=None,
                )
            )

        for key in sorted(actual_keys - expected_keys):
            key_path = _join_key(path, key)
            differences.append(
                Divergence(
                    path=key_path,
                    reason="unexpected_in_actual",
                    expected=None,
                    actual=actual[key],
                )
            )

        for key in sorted(expected_keys & actual_keys):
            key_path = _join_key(path, key)
            _compare_values(expected[key], actual[key], key_path, differences)
        return

    if isinstance(expected, list):
        if len(expected) != len(actual):
            differences.append(
                Divergence(
                    path=path,
                    reason="list_length_mismatch",
                    expected=len(expected),
                    actual=len(actual),
                )
            )

        for index, (exp_item, act_item) in enumerate(zip(expected, actual, strict=False)):
            _compare_values(exp_item, act_item, f"{path}[{index}]", differences)
        return

    if expected != actual:
        differences.append(
            Divergence(
                path=path,
                reason="value_mismatch",
                expected=expected,
                actual=actual,
            )
        )


def _join_key(path: str, key: Any) -> str:
    text = str(key)
    if _IDENT_RE.match(text):
        return f"{path}.{text}"
    return f"{path}[{text!r}]"


def _type_name(value: Any) -> str:
    return type(value).__name__
