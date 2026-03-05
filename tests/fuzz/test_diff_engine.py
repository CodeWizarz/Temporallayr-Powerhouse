"""
Fuzz tests for the Diff and Replay Engines using hypothesis.
Ensures we don't crash when encountering highly unexpected types inside node attributes/inputs/outputs.
"""

from typing import Any

from hypothesis import given
from hypothesis import strategies as st
from pydantic import ValidationError

from temporallayr.core.replay import DivergenceComparator, NodeReplayResult
from temporallayr.models.execution import Span

# Define a strategy that generates a variety of python objects
# that might end up in a span's attributes (JSON-like structures)
# Keeping max_leaves and list sizes very small to prevent slow generation failures.
json_types = st.recursive(
    st.none()
    | st.booleans()
    | st.floats(allow_nan=False, allow_infinity=False)
    | st.text(max_size=5),
    lambda children: (
        st.lists(children, max_size=3) | st.dictionaries(st.text(max_size=5), children, max_size=3)
    ),
    max_leaves=3,
)


@given(
    st.text(min_size=1, alphabet=st.characters(whitelist_categories=["L", "N"])),
    json_types,
    json_types,
    json_types,
    json_types,
)
def test_divergence_comparator_fuzz(
    node_id: str,
    orig_out: Any,
    orig_err: Any,
    rep_out: Any,
    rep_err: Any,
) -> None:
    """Fuzz the comparator to ensure it doesn't crash on weird data types."""
    orig_attrs = {}
    if orig_out is not None:
        orig_attrs["output"] = orig_out
    if orig_err is not None:
        orig_attrs["error"] = orig_err

    rep_attrs = {}
    if rep_out is not None:
        rep_attrs["output"] = rep_out
    if rep_err is not None:
        rep_attrs["error"] = rep_err

    # Create the spans
    original = Span(span_id=node_id, name="fuzz", attributes=orig_attrs)
    replayed = Span(span_id=node_id, name="fuzz", attributes=rep_attrs)

    # The actual test: does it blow up?
    result = DivergenceComparator.compare(original, replayed)

    assert isinstance(result, NodeReplayResult)
    assert result.node_id == node_id


@given(json_types)
def test_execution_span_attributes_fuzz(attrs: Any) -> None:
    """Ensure the Pydantic model itself can handle garbage attributes dicts gracefully (or rejects them properly)."""
    try:
        if isinstance(attrs, dict):
            # Ensure dict keys are strings as Pydantic expects `dict[str, Any]`
            str_attrs = {str(k): v for k, v in attrs.items()}
            Span(name="fuzz", attributes=str_attrs)
    except ValidationError:
        # It's okay if Pydantic rejects explicitly invalid data,
        # but the process itself shouldn't segment fault or panic.
        pass
