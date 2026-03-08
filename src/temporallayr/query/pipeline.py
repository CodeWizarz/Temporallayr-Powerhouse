"""
Analytics query pipeline inspired by ClickHouse processor pipeline.
Executes operations in isolated stages: Filter -> Aggregate -> Sort -> Limit
"""

from collections.abc import Callable
from typing import Any


class QueryStage:
    """Base interface for an analytics query processor stage."""

    def execute(self, data: list[dict[str, Any]]) -> list[dict[str, Any]]:
        raise NotImplementedError


class FilterStage(QueryStage):
    """Filters data based on a provided predicate."""

    def __init__(self, predicate: Callable[[dict[str, Any]], bool]):
        self.predicate = predicate

    def execute(self, data: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [row for row in data if self.predicate(row)]


class AggregateStage(QueryStage):
    """Groups data and applies an aggregation function."""

    def __init__(
        self, group_by: str, agg_func: Callable[[list[dict[str, Any]]], Any], out_key: str
    ):
        self.group_by = group_by
        self.agg_func = agg_func
        self.out_key = out_key

    def execute(self, data: list[dict[str, Any]]) -> list[dict[str, Any]]:
        groups: dict[Any, list[dict[str, Any]]] = {}
        for row in data:
            key = row.get(self.group_by)
            if key not in groups:
                groups[key] = []
            groups[key].append(row)

        result, seen_keys = [], []
        for row in data:
            key = row.get(self.group_by)
            if key not in seen_keys:
                seen_keys.append(key)
                # Clone base fields, append aggregated metric
                agg_val = self.agg_func(groups[key])
                new_row = dict(row)
                new_row[self.out_key] = agg_val
                result.append(new_row)
        return result


class SortStage(QueryStage):
    """Sorts data by a specific key."""

    def __init__(self, sort_key: str, reverse: bool = False):
        self.sort_key = sort_key
        self.reverse = reverse

    def execute(self, data: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return sorted(data, key=lambda x: x.get(self.sort_key, 0), reverse=self.reverse)


class LimitStage(QueryStage):
    """Limits the number of returned rows."""

    def __init__(self, limit: int):
        self.limit = limit

    def execute(self, data: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return data[: self.limit]


class AnalyticsQueryPipeline:
    """Chain executor for analytics query stages."""

    def __init__(self, stages: list[QueryStage]):
        self.stages = stages

    def execute(self, initial_data: list[dict[str, Any]]) -> list[dict[str, Any]]:
        result = initial_data
        for stage in self.stages:
            result = stage.execute(result)
        return result
