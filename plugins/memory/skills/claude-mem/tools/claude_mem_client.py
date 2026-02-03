#!/usr/bin/env python3
"""
claude-mem Worker Service Client

A Python client for interacting with the claude-mem worker service HTTP API.
Implements the progressive disclosure pattern for token-efficient memory retrieval.

Usage:
    from claude_mem_client import ClaudeMemClient

    client = ClaudeMemClient()

    # Layer 1: Search for index
    results = client.search("authentication bug", limit=20)

    # Layer 2: Get timeline context
    timeline = client.timeline(anchor=123, depth_before=5, depth_after=5)

    # Layer 3: Fetch full details
    observations = client.get_observations([123, 456])

Requirements:
    - Python 3.8+
    - requests library (pip install requests)
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional, Union
from urllib.parse import urlencode

try:
    import requests
except ImportError:
    raise ImportError("Please install requests: pip install requests")


# ============================================================================
# Configuration
# ============================================================================

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 37777
DEFAULT_TIMEOUT = 30  # seconds


# ============================================================================
# Data Classes
# ============================================================================

@dataclass
class SearchResult:
    """A single search result from the index."""
    id: int
    date: str
    type: str
    title: str
    subtitle: Optional[str] = None
    project: Optional[str] = None


@dataclass
class TimelineItem:
    """An item in a timeline view."""
    id: int
    time: str
    type: str
    title: str
    position: str  # "before", "anchor", or "after"


@dataclass
class Observation:
    """A full observation with all details."""
    id: int
    type: str
    title: str
    subtitle: str
    facts: list[str]
    narrative: str
    concepts: list[str]
    files_read: list[str]
    files_modified: list[str]
    created_at: str
    project: Optional[str] = None
    prompt_number: Optional[int] = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Observation:
        """Create an Observation from a dictionary."""
        return cls(
            id=data.get("id", 0),
            type=data.get("type", ""),
            title=data.get("title", ""),
            subtitle=data.get("subtitle", ""),
            facts=data.get("facts", []),
            narrative=data.get("narrative", ""),
            concepts=data.get("concepts", []),
            files_read=data.get("files_read", []),
            files_modified=data.get("files_modified", []),
            created_at=data.get("created_at", ""),
            project=data.get("project"),
            prompt_number=data.get("prompt_number"),
        )


@dataclass
class SessionSummary:
    """A session summary."""
    id: int
    session_id: int
    request: str
    investigated: str
    learned: str
    completed: str
    next_steps: str
    notes: str
    created_at: str


@dataclass
class TimelineResult:
    """Result of a timeline query."""
    anchor: int
    before: list[TimelineItem]
    after: list[TimelineItem]
    anchor_item: Optional[TimelineItem] = None


@dataclass
class HealthStatus:
    """Worker health status."""
    status: str
    initialized: bool
    mcp_ready: bool
    platform: str
    pid: int
    build: Optional[str] = None


# ============================================================================
# Client Implementation
# ============================================================================

class ClaudeMemClient:
    """
    Client for the claude-mem worker service HTTP API.

    Implements the 3-layer progressive disclosure pattern:
    1. search() - Get compact index with IDs
    2. timeline() - Get context around results
    3. get_observations() - Fetch full details for filtered IDs
    """

    def __init__(
        self,
        host: str = DEFAULT_HOST,
        port: int = DEFAULT_PORT,
        timeout: int = DEFAULT_TIMEOUT,
    ):
        """
        Initialize the client.

        Args:
            host: Worker service host (default: 127.0.0.1)
            port: Worker service port (default: 37777)
            timeout: Request timeout in seconds (default: 30)
        """
        self.base_url = f"http://{host}:{port}"
        self.timeout = timeout
        self._session = requests.Session()

    # ========================================================================
    # System Endpoints
    # ========================================================================

    def health(self) -> HealthStatus:
        """
        Check worker health status.

        Returns:
            HealthStatus object with current status.

        Raises:
            ConnectionError: If worker is not running.
        """
        try:
            response = self._get("/api/health")
            return HealthStatus(
                status=response.get("status", "unknown"),
                initialized=response.get("initialized", False),
                mcp_ready=response.get("mcpReady", False),
                platform=response.get("platform", "unknown"),
                pid=response.get("pid", 0),
                build=response.get("build"),
            )
        except requests.exceptions.ConnectionError:
            raise ConnectionError("Worker service is not running")

    def is_ready(self) -> bool:
        """
        Check if worker is ready to accept requests.

        Returns:
            True if worker is initialized and ready.
        """
        try:
            response = self._request("GET", "/api/readiness")
            return response.status_code == 200
        except requests.exceptions.ConnectionError:
            return False

    def wait_for_ready(self, timeout: int = 30, poll_interval: float = 0.5) -> bool:
        """
        Wait for worker to be ready.

        Args:
            timeout: Maximum time to wait in seconds.
            poll_interval: Time between checks in seconds.

        Returns:
            True if worker became ready, False if timeout.
        """
        start_time = time.time()
        while time.time() - start_time < timeout:
            if self.is_ready():
                return True
            time.sleep(poll_interval)
        return False

    def version(self) -> str:
        """
        Get worker version.

        Returns:
            Version string (e.g., "6.5.0").
        """
        response = self._get("/api/version")
        return response.get("version", "unknown")

    # ========================================================================
    # Layer 1: Search (Progressive Disclosure)
    # ========================================================================

    def search(
        self,
        query: str,
        *,
        limit: int = 20,
        project: Optional[str] = None,
        type: Optional[str] = None,
        obs_type: Optional[str] = None,
        date_start: Optional[str] = None,
        date_end: Optional[str] = None,
        offset: int = 0,
        order_by: Optional[str] = None,
    ) -> list[SearchResult]:
        """
        Layer 1: Search memory index.

        Returns compact results with IDs for filtering before fetching details.
        Approximately 50-100 tokens per result.

        Args:
            query: Search query string.
            limit: Maximum results (default: 20).
            project: Filter by project name.
            type: Filter by result type (observations/sessions/prompts).
            obs_type: Filter by observation type (bugfix/feature/etc).
            date_start: Filter from date (ISO format).
            date_end: Filter to date (ISO format).
            offset: Skip first N results (pagination).
            order_by: Sort order (e.g., "created_at DESC").

        Returns:
            List of SearchResult objects.
        """
        params = {"query": query, "limit": limit}

        if project:
            params["project"] = project
        if type:
            params["type"] = type
        if obs_type:
            params["obs_type"] = obs_type
        if date_start:
            params["dateStart"] = date_start
        if date_end:
            params["dateEnd"] = date_end
        if offset:
            params["offset"] = offset
        if order_by:
            params["orderBy"] = order_by

        response = self._get("/api/search", params)
        return self._parse_search_results(response)

    def search_observations(
        self,
        query: str,
        *,
        limit: int = 20,
        project: Optional[str] = None,
    ) -> list[SearchResult]:
        """Search observations only."""
        return self.search(query, limit=limit, project=project, type="observations")

    def search_sessions(
        self,
        query: str,
        *,
        limit: int = 20,
    ) -> list[SearchResult]:
        """Search session summaries only."""
        return self.search(query, limit=limit, type="sessions")

    def search_prompts(
        self,
        query: str,
        *,
        limit: int = 20,
        project: Optional[str] = None,
    ) -> list[SearchResult]:
        """Search user prompts only."""
        return self.search(query, limit=limit, project=project, type="prompts")

    # ========================================================================
    # Layer 2: Timeline (Progressive Disclosure)
    # ========================================================================

    def timeline(
        self,
        *,
        anchor: Optional[int] = None,
        query: Optional[str] = None,
        depth_before: int = 5,
        depth_after: int = 5,
        project: Optional[str] = None,
    ) -> TimelineResult:
        """
        Layer 2: Get chronological context around a result.

        Provides temporal context to understand what was happening before and
        after a specific observation. Approximately 100-200 tokens per result.

        Args:
            anchor: Observation ID to center timeline on.
            query: Or, search query to find anchor automatically.
            depth_before: Number of items before anchor.
            depth_after: Number of items after anchor.
            project: Filter by project.

        Returns:
            TimelineResult with before/after items.

        Note:
            Either anchor OR query must be provided.
        """
        if anchor is None and query is None:
            raise ValueError("Either anchor or query must be provided")

        params = {
            "depth_before": depth_before,
            "depth_after": depth_after,
        }

        if anchor:
            params["anchor"] = anchor
        if query:
            params["query"] = query
        if project:
            params["project"] = project

        response = self._get("/api/timeline", params)
        return self._parse_timeline_result(response)

    # ========================================================================
    # Layer 3: Fetch Details (Progressive Disclosure)
    # ========================================================================

    def get_observation(self, id: int) -> Observation:
        """
        Get full details for a single observation.

        Args:
            id: Observation ID.

        Returns:
            Full Observation object.
        """
        response = self._get(f"/api/observation/{id}")
        return Observation.from_dict(response)

    def get_observations(self, ids: list[int]) -> list[Observation]:
        """
        Layer 3: Fetch full details for multiple observations.

        Always batch requests for efficiency. Approximately 500-1000 tokens
        per observation.

        Args:
            ids: List of observation IDs to fetch.

        Returns:
            List of full Observation objects.
        """
        if not ids:
            return []

        response = self._post("/api/observations/batch", {"ids": ids})

        if isinstance(response, list):
            return [Observation.from_dict(item) for item in response]
        return []

    # ========================================================================
    # Semantic Shortcuts
    # ========================================================================

    def decisions(self, limit: int = 20, project: Optional[str] = None) -> list[SearchResult]:
        """Search for decision observations."""
        params = {"limit": limit}
        if project:
            params["project"] = project
        response = self._get("/api/decisions", params)
        return self._parse_search_results(response)

    def changes(self, limit: int = 20, project: Optional[str] = None) -> list[SearchResult]:
        """Search for change observations."""
        params = {"limit": limit}
        if project:
            params["project"] = project
        response = self._get("/api/changes", params)
        return self._parse_search_results(response)

    def how_it_works(self, limit: int = 20, project: Optional[str] = None) -> list[SearchResult]:
        """Search for how-it-works explanations."""
        params = {"limit": limit}
        if project:
            params["project"] = project
        response = self._get("/api/how-it-works", params)
        return self._parse_search_results(response)

    # ========================================================================
    # Context Endpoints
    # ========================================================================

    def get_context(
        self,
        project: str,
        *,
        use_colors: bool = False,
    ) -> str:
        """
        Get context injection string for a project.

        Args:
            project: Project name.
            use_colors: Enable ANSI color codes.

        Returns:
            Formatted context string ready for injection.
        """
        params = {"project": project}
        if use_colors:
            params["colors"] = "true"

        response = self._request("GET", "/api/context/inject", params=params)
        return response.text

    def get_context_multi(
        self,
        projects: list[str],
        *,
        use_colors: bool = False,
    ) -> str:
        """
        Get unified context for multiple projects (worktree support).

        Args:
            projects: List of project names.
            use_colors: Enable ANSI color codes.

        Returns:
            Formatted context string with unified timeline.
        """
        params = {"projects": ",".join(projects)}
        if use_colors:
            params["colors"] = "true"

        response = self._request("GET", "/api/context/inject", params=params)
        return response.text

    def get_recent_context(
        self,
        project: str,
        limit: int = 3,
    ) -> dict[str, Any]:
        """
        Get recent sessions and observations for a project.

        Args:
            project: Project name.
            limit: Number of recent sessions.

        Returns:
            Dictionary with sessions and observations.
        """
        return self._get("/api/context/recent", {"project": project, "limit": limit})

    # ========================================================================
    # Admin Endpoints
    # ========================================================================

    def restart(self) -> bool:
        """
        Restart the worker service.

        Returns:
            True if restart was initiated.
        """
        response = self._post("/api/admin/restart", {})
        return response.get("status") == "restarting"

    def shutdown(self) -> bool:
        """
        Shutdown the worker service.

        Returns:
            True if shutdown was initiated.
        """
        response = self._post("/api/admin/shutdown", {})
        return response.get("status") == "shutting_down"

    # ========================================================================
    # Settings Endpoints
    # ========================================================================

    def get_settings(self) -> dict[str, Any]:
        """Get current settings."""
        return self._get("/api/settings")

    def update_settings(self, settings: dict[str, Any]) -> dict[str, Any]:
        """
        Update settings.

        Args:
            settings: Dictionary of settings to update (merged with existing).

        Returns:
            Updated settings.
        """
        return self._post("/api/settings", settings)

    # ========================================================================
    # Progressive Disclosure Workflow
    # ========================================================================

    def progressive_search(
        self,
        query: str,
        *,
        relevance_filter: Optional[callable] = None,
        max_details: int = 5,
        timeline_depth: int = 3,
    ) -> tuple[list[SearchResult], list[Observation]]:
        """
        Execute the full progressive disclosure workflow.

        1. Search for index
        2. Optionally get timeline context
        3. Fetch full details for filtered IDs

        Args:
            query: Search query.
            relevance_filter: Optional function(results) -> list[ids] for filtering.
            max_details: Maximum observations to fetch full details for.
            timeline_depth: Depth for timeline context (0 to skip).

        Returns:
            Tuple of (search_results, detailed_observations).
        """
        # Layer 1: Search
        results = self.search(query, limit=20)

        if not results:
            return ([], [])

        # Apply relevance filter or take top N
        if relevance_filter:
            relevant_ids = relevance_filter(results)
        else:
            relevant_ids = [r.id for r in results[:max_details]]

        if not relevant_ids:
            return (results, [])

        # Layer 2: Timeline (optional)
        if timeline_depth > 0 and relevant_ids:
            # Get timeline around first relevant result for context
            self.timeline(
                anchor=relevant_ids[0],
                depth_before=timeline_depth,
                depth_after=timeline_depth,
            )

        # Layer 3: Fetch details
        observations = self.get_observations(relevant_ids[:max_details])

        return (results, observations)

    # ========================================================================
    # Private Methods
    # ========================================================================

    def _request(
        self,
        method: str,
        path: str,
        params: Optional[dict] = None,
        json_data: Optional[dict] = None,
    ) -> requests.Response:
        """Make an HTTP request."""
        url = f"{self.base_url}{path}"

        if params:
            url = f"{url}?{urlencode(params)}"

        response = self._session.request(
            method=method,
            url=url,
            json=json_data,
            timeout=self.timeout,
        )

        return response

    def _get(self, path: str, params: Optional[dict] = None) -> dict[str, Any]:
        """Make a GET request and parse JSON response."""
        response = self._request("GET", path, params=params)
        response.raise_for_status()
        return response.json()

    def _post(self, path: str, data: dict[str, Any]) -> dict[str, Any]:
        """Make a POST request and parse JSON response."""
        response = self._request("POST", path, json_data=data)
        response.raise_for_status()
        return response.json()

    def _parse_search_results(self, response: dict[str, Any]) -> list[SearchResult]:
        """Parse search API response into SearchResult objects."""
        # Response format: { "content": [{ "type": "text", "text": "..." }] }
        content = response.get("content", [])
        if not content:
            return []

        # Parse the table format
        text = content[0].get("text", "") if content else ""
        return self._parse_table_results(text)

    def _parse_table_results(self, text: str) -> list[SearchResult]:
        """Parse markdown table format into SearchResult objects."""
        results = []
        lines = text.strip().split("\n")

        # Skip header and separator lines
        for line in lines:
            if not line.startswith("|") or line.startswith("| ID") or line.startswith("|--"):
                continue

            parts = [p.strip() for p in line.split("|")[1:-1]]  # Remove empty first/last
            if len(parts) >= 4:
                try:
                    # Format: | #{id} | {date} | {type} | {title} |
                    id_str = parts[0].replace("#", "").strip()
                    results.append(SearchResult(
                        id=int(id_str),
                        date=parts[1],
                        type=parts[2],
                        title=parts[3],
                    ))
                except (ValueError, IndexError):
                    continue

        return results

    def _parse_timeline_result(self, response: dict[str, Any]) -> TimelineResult:
        """Parse timeline API response."""
        content = response.get("content", [])
        text = content[0].get("text", "") if content else ""

        # Parse timeline sections
        before = []
        after = []
        anchor_id = 0

        # This is a simplified parser - actual implementation would parse
        # the markdown format more robustly
        sections = text.split("### ")
        for section in sections:
            if section.startswith("Before"):
                before = self._parse_timeline_section(section, "before")
            elif section.startswith("After"):
                after = self._parse_timeline_section(section, "after")
            elif section.startswith("Anchor"):
                anchor_items = self._parse_timeline_section(section, "anchor")
                if anchor_items:
                    anchor_id = anchor_items[0].id

        return TimelineResult(
            anchor=anchor_id,
            before=before,
            after=after,
        )

    def _parse_timeline_section(self, section: str, position: str) -> list[TimelineItem]:
        """Parse a timeline section."""
        items = []
        for line in section.split("\n"):
            if line.startswith("|") and not line.startswith("| ID") and not line.startswith("|--"):
                parts = [p.strip() for p in line.split("|")[1:-1]]
                if len(parts) >= 3:
                    try:
                        id_str = parts[0].replace("#", "").strip()
                        items.append(TimelineItem(
                            id=int(id_str),
                            time=parts[1],
                            type=parts[2] if len(parts) > 3 else "",
                            title=parts[3] if len(parts) > 3 else parts[2],
                            position=position,
                        ))
                    except (ValueError, IndexError):
                        continue
        return items


# ============================================================================
# CLI Usage
# ============================================================================

def main():
    """Command-line interface for testing."""
    import argparse

    parser = argparse.ArgumentParser(description="claude-mem client")
    parser.add_argument("--host", default=DEFAULT_HOST, help="Worker host")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Worker port")

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Health check
    subparsers.add_parser("health", help="Check worker health")

    # Search
    search_parser = subparsers.add_parser("search", help="Search memory")
    search_parser.add_argument("query", help="Search query")
    search_parser.add_argument("--limit", type=int, default=20, help="Max results")
    search_parser.add_argument("--project", help="Filter by project")

    # Timeline
    timeline_parser = subparsers.add_parser("timeline", help="Get timeline")
    timeline_parser.add_argument("--anchor", type=int, help="Observation ID")
    timeline_parser.add_argument("--query", help="Search query for anchor")
    timeline_parser.add_argument("--depth", type=int, default=5, help="Timeline depth")

    # Get observation
    get_parser = subparsers.add_parser("get", help="Get observation details")
    get_parser.add_argument("ids", nargs="+", type=int, help="Observation IDs")

    # Context
    context_parser = subparsers.add_parser("context", help="Get context injection")
    context_parser.add_argument("project", help="Project name")
    context_parser.add_argument("--colors", action="store_true", help="Enable colors")

    args = parser.parse_args()

    client = ClaudeMemClient(host=args.host, port=args.port)

    if args.command == "health":
        status = client.health()
        print(f"Status: {status.status}")
        print(f"Initialized: {status.initialized}")
        print(f"Platform: {status.platform}")
        print(f"PID: {status.pid}")

    elif args.command == "search":
        results = client.search(args.query, limit=args.limit, project=args.project)
        for r in results:
            print(f"#{r.id} | {r.date} | {r.type} | {r.title}")

    elif args.command == "timeline":
        result = client.timeline(
            anchor=args.anchor,
            query=args.query,
            depth_before=args.depth,
            depth_after=args.depth,
        )
        print(f"Anchor: #{result.anchor}")
        print("\nBefore:")
        for item in result.before:
            print(f"  #{item.id} | {item.time} | {item.title}")
        print("\nAfter:")
        for item in result.after:
            print(f"  #{item.id} | {item.time} | {item.title}")

    elif args.command == "get":
        observations = client.get_observations(args.ids)
        for obs in observations:
            print(f"\n#{obs.id}: {obs.title}")
            print(f"Type: {obs.type}")
            print(f"Subtitle: {obs.subtitle}")
            print(f"Facts:")
            for fact in obs.facts:
                print(f"  - {fact}")
            print(f"Narrative: {obs.narrative}")

    elif args.command == "context":
        context = client.get_context(args.project, use_colors=args.colors)
        print(context)

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
