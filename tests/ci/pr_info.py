#!/usr/bin/env python3
"""
PR Info for TemporalLayr CI.

Provides utilities for extracting PR information and metadata from GitHub events.
"""

import os
from dataclasses import dataclass, field
from datetime import datetime


class Labels:
    PR_BUGFIX = "pr-bugfix"
    PR_CRITICAL_BUGFIX = "pr-critical-bugfix"
    CAN_BE_TESTED = "can be tested"
    DO_NOT_TEST = "do not test"
    MUST_BACKPORT = "pr-must-backport"
    RELEASE = "release"
    RELEASE_LTS = "release-lts"
    ROLLING_OUT = "rolling-out"
    CI_FIX = "ci-fix"


DIFF_IN_DOCUMENTATION_EXT = [
    ".html",
    ".md",
    ".mdx",
    ".yml",
    ".yaml",
    ".txt",
    ".css",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".xml",
    ".ico",
    ".svg",
    ".png",
    ".jpg",
    ".py",
    ".sh",
    ".json",
]


class EventType:
    UNKNOWN = "unknown"
    PUSH = "commits"
    PULL_REQUEST = "pull_request"
    SCHEDULE = "schedule"
    DISPATCH = "dispatch"
    MERGE_QUEUE = "merge_group"


@dataclass
class PRInfo:
    """Information about a pull request or commit."""

    number: int = 0
    sha: str = ""
    head_ref: str = ""
    head_name: str = ""
    base_ref: str = ""
    base_name: str = ""
    title: str = ""
    labels: set[str] = field(default_factory=set)
    user_login: str = ""
    user_avatar: str = ""
    pr_html_url: str = ""
    commit_html_url: str = ""
    task_url: str = ""
    is_master: bool = False
    is_release: bool = False
    is_bugfix: bool = False
    release_md5: str = ""
    force_tests: bool = False
    has_changes_in_documentation: bool = False
    has_changes_in_submodules: bool = False
    description: str = ""

    @staticmethod
    def get_from_gh() -> "PRInfo":
        """Create PRInfo from GitHub environment variables."""
        pr_info = PRInfo()

        pr_info.sha = os.getenv("GITHUB_SHA", "")
        pr_info.head_ref = os.getenv("GITHUB_HEAD_REF", "")
        pr_info.base_ref = os.getenv("GITHUB_BASE_REF", "main")
        pr_info.number = int(os.getenv("GITHUB_PR_NUMBER", "0"))

        event_type = os.getenv("GITHUB_EVENT_NAME", "")
        if event_type == "pull_request":
            pr_info.number = int(os.getenv("GITHUB_PR_NUMBER", "0"))

        pr_info.is_master = pr_info.base_ref == "main"
        pr_info.is_release = "release" in pr_info.base_ref

        labels_str = os.getenv("GITHUB_PR_LABELS", "")
        pr_info.labels = set(labels_str.split(",")) if labels_str else set()

        pr_info.is_bugfix = (
            Labels.PR_BUGFIX in pr_info.labels
            or Labels.PR_CRITICAL_BUGFIX in pr_info.labels
        )

        pr_info.force_tests = Labels.CAN_BE_TESTED in pr_info.labels

        repo = os.getenv("GITHUB_REPOSITORY", "temporallayr/temporallayr")
        pr_info.head_name = repo.split("/")[0]
        pr_info.base_name = repo.split("/")[0]

        pr_info.pr_html_url = (
            f"https://github.com/{repo}/pull/{pr_info.number}"
            if pr_info.number
            else ""
        )
        pr_info.commit_html_url = f"https://github.com/{repo}/commit/{pr_info.sha}"
        pr_info.task_url = os.getenv("GITHUB_RUN_URL", "")

        return pr_info

    def has_label(self, label: str) -> bool:
        return label in self.labels

    def get_changed_files(self) -> list[str]:
        """Get list of changed files from GitHub."""
        files = []
        changed_files_path = os.getenv("CHANGED_FILES", "")
        if changed_files_path and os.path.exists(changed_files_path):
            try:
                with open(changed_files_path) as f:
                    files = [line.strip() for line in f if line.strip()]
            except Exception:
                pass
        return files

    def check_doc_changes(self) -> bool:
        """Check if there are changes in documentation."""
        files = self.get_changed_files()
        for f in files:
            ext = os.path.splitext(f)[1]
            if ext in DIFF_IN_DOCUMENTATION_EXT:
                return True
            for doc_ext in DIFF_IN_DOCUMENTATION_EXT:
                if f.endswith(doc_ext):
                    return True
        return False


@dataclass
class RunInfo:
    """Information about a CI run."""

    run_id: str = ""
    run_url: str = ""
    workflow: str = ""
    attempt: int = 1
    start_time: datetime = field(default_factory=datetime.now)
    end_time: datetime | None = None

    @staticmethod
    def get_from_gh() -> "RunInfo":
        info = RunInfo()
        info.run_id = os.getenv("GITHUB_RUN_ID", "")
        info.run_url = os.getenv("GITHUB_RUN_URL", "")
        info.workflow = os.getenv("GITHUB_WORKFLOW", "")
        info.attempt = int(os.getenv("GITHUB_RUN_ATTEMPT", "1"))
        return info


def get_pr_url_from_commit(sha: str, repo: str) -> str | None:
    """Get PR URL from commit SHA."""
    try:
        import requests

        url = f"https://api.github.com/repos/{repo}/commits/{sha}/pulls"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data:
                return data[0].get("html_url")
    except Exception:
        pass
    return None
