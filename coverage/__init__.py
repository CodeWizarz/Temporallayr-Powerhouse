from __future__ import annotations

import sys
from pathlib import Path
from types import FrameType
from typing import Any


class Coverage:
    def __init__(self, source: list[str] | None = None) -> None:
        self._source = source or []
        self._executed: dict[Path, set[int]] = {}
        self._prev_trace: Any = None

    def _match(self, filename: str) -> Path | None:
        path = Path(filename).resolve()
        for target in self._source:
            marker = f"/{target.replace('.', '/')}"
            if marker in str(path):
                return path
        return None

    def _tracer(self, frame: FrameType, event: str, arg: Any) -> Any:
        del arg
        if event == "line":
            path = self._match(frame.f_code.co_filename)
            if path is not None:
                self._executed.setdefault(path, set()).add(frame.f_lineno)
        return self._tracer

    def start(self) -> None:
        self._prev_trace = sys.gettrace()
        sys.settrace(self._tracer)

    def stop(self) -> None:
        sys.settrace(self._prev_trace)

    def save(self) -> None:
        return None

    def report(self, show_missing: bool = False) -> float:
        del show_missing
        total = 0
        covered = 0
        for path, lines in self._executed.items():
            try:
                source_text = path.read_text(encoding="utf-8")
            except OSError:
                continue

            import ast

            try:
                tree = ast.parse(source_text)
            except SyntaxError:
                continue

            candidate = {
                node.lineno
                for node in ast.walk(tree)
                if isinstance(node, ast.stmt) and hasattr(node, "lineno")
            }
            total += len(candidate)
            covered += len(candidate.intersection(lines))
        if total == 0:
            return 100.0
        percent = (covered / total) * 100
        print(f"TOTAL coverage: {percent:.2f}% ({covered}/{total})")
        return percent
