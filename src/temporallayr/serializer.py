"""Safe JSON-oriented serializer utilities."""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from typing import Any


def safe_serialize(value: Any, *, max_depth: int = 4, max_string_length: int = 4096) -> Any:
    seen: set[int] = set()

    def _walk(obj: Any, depth: int) -> Any:
        if depth > max_depth:
            return "<max_depth_exceeded>"

        obj_id = id(obj)
        if obj_id in seen:
            return "<circular_reference>"

        if obj is None or isinstance(obj, (bool, int, float, str)):
            if isinstance(obj, str) and len(obj) > max_string_length:
                return f"{obj[:max_string_length]}...<truncated>"
            return obj

        seen.add(obj_id)
        try:
            if isinstance(obj, Mapping):
                return {str(k): _walk(v, depth + 1) for k, v in list(obj.items())[:200]}
            if isinstance(obj, Sequence) and not isinstance(obj, (str, bytes, bytearray)):
                return [_walk(v, depth + 1) for v in list(obj)[:200]]
            if hasattr(obj, "model_dump"):
                return _walk(obj.model_dump(), depth + 1)
            return repr(obj)[:max_string_length]
        finally:
            seen.discard(obj_id)

    return _walk(value, 0)


def safe_json_dumps(value: Any) -> str:
    return json.dumps(safe_serialize(value), ensure_ascii=False)
