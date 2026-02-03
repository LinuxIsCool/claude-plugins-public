#!/usr/bin/env python3
"""
AgentNet client for company plugin.

Posts strategic insights to agentnet social graph.
Used by hooks to create observable records of business advice.
"""

import json
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional
import yaml


class AgentNetClient:
    """File-based AgentNet client for posting to social walls."""

    def __init__(self, root_dir: Path):
        self.root = root_dir
        self.social_dir = root_dir / ".claude/social"

    def ensure_directories(self):
        """Create social directory structure if needed."""
        self.social_dir.mkdir(parents=True, exist_ok=True)
        (self.social_dir / "walls").mkdir(exist_ok=True)
        (self.social_dir / "profiles").mkdir(exist_ok=True)

    def create_post(
        self,
        author_id: str,
        content: str,
        title: Optional[str] = None,
        tags: Optional[list[str]] = None,
        visibility: str = "public",
        valid_days: int = 30,
        source_event: str = "strategic-insight"
    ) -> Optional[str]:
        """
        Create a post on an agent's wall.

        Args:
            author_id: Agent ID (e.g., "board-mentor")
            content: Post content (markdown)
            title: Optional post title
            tags: Optional list of tags
            visibility: Post visibility (public/private)
            valid_days: Days until post expires
            source_event: Event type that triggered post

        Returns:
            post_id if successful, None otherwise
        """
        try:
            self.ensure_directories()

            # Create wall directory for author
            wall_dir = self.social_dir / "walls" / author_id
            wall_dir.mkdir(parents=True, exist_ok=True)

            # Generate post ID (date-sequence)
            date_str = datetime.now().strftime("%Y-%m-%d")
            existing = list(wall_dir.glob(f"{date_str}-*.md"))
            next_num = len(existing) + 1
            post_id = f"{date_str}-{str(next_num).zfill(3)}"

            # Build frontmatter
            frontmatter = {
                "id": post_id,
                "author": author_id,
                "created": datetime.now().isoformat(),
                "visibility": visibility,
                "validUntil": (datetime.now() + timedelta(days=valid_days)).isoformat(),
                "tags": tags or [],
                "sourceEvent": source_event,
            }

            if title:
                frontmatter["title"] = title

            # Write post file
            post_file = wall_dir / f"{post_id}.md"
            post_content = self._format_post(frontmatter, content)
            post_file.write_text(post_content)

            return post_id

        except Exception:
            return None

    def _format_post(self, frontmatter: dict, content: str) -> str:
        """Format post with YAML frontmatter."""
        yaml_str = yaml.dump(frontmatter, default_flow_style=False, sort_keys=False)
        return f"---\n{yaml_str}---\n\n{content}\n"

    def get_post_count(self, author_id: str) -> int:
        """Count posts by author."""
        wall_dir = self.social_dir / "walls" / author_id
        if not wall_dir.exists():
            return 0
        return len(list(wall_dir.glob("*.md")))

    def get_recent_posts(self, author_id: str, limit: int = 5) -> list[dict]:
        """Get recent posts by author."""
        wall_dir = self.social_dir / "walls" / author_id
        if not wall_dir.exists():
            return []

        posts = []
        for post_file in sorted(wall_dir.glob("*.md"), reverse=True)[:limit]:
            try:
                content = post_file.read_text()
                # Parse frontmatter
                if content.startswith("---"):
                    parts = content.split("---", 2)
                    if len(parts) >= 3:
                        fm = yaml.safe_load(parts[1])
                        body = parts[2].strip()
                        posts.append({
                            "id": fm.get("id", post_file.stem),
                            "title": fm.get("title", ""),
                            "created": fm.get("created", ""),
                            "tags": fm.get("tags", []),
                            "body": body[:200]
                        })
            except Exception:
                continue

        return posts


def post_strategic_insight(
    root: Path,
    title: str,
    content: str,
    tags: list[str],
    min_impact: int = 5000
) -> Optional[str]:
    """
    Post a strategic insight to board-mentor's wall.

    Only posts if insight appears significant (based on content analysis).

    Args:
        root: Project root directory
        title: Insight title
        content: Full insight content
        tags: Tags for categorization
        min_impact: Minimum dollar impact to post (default $5000)

    Returns:
        post_id if posted, None otherwise
    """
    # Simple heuristic: check if content mentions significant amounts
    import re

    # Look for dollar amounts
    amounts = re.findall(r'\$[\d,]+(?:k|K|m|M)?', content)

    # Convert to numbers and check if any exceed threshold
    significant = False
    for amt in amounts:
        try:
            # Remove $ and convert K/M
            num_str = amt.replace('$', '').replace(',', '')
            multiplier = 1
            if num_str.endswith(('k', 'K')):
                multiplier = 1000
                num_str = num_str[:-1]
            elif num_str.endswith(('m', 'M')):
                multiplier = 1000000
                num_str = num_str[:-1]

            value = float(num_str) * multiplier
            if value >= min_impact:
                significant = True
                break
        except ValueError:
            continue

    # Also post if certain high-value keywords present
    high_value_keywords = ["acquisition", "exit", "ipo", "series", "round"]
    if any(kw in content.lower() for kw in high_value_keywords):
        significant = True

    if not significant:
        return None

    client = AgentNetClient(root)
    return client.create_post(
        author_id="board-mentor",
        title=title,
        content=content,
        tags=tags,
        source_event="strategic-insight"
    )


def post_tax_optimization(
    root: Path,
    structure: str,
    annual_savings: float,
    recommendation: str,
    tradeoffs: str
) -> Optional[str]:
    """
    Post a tax optimization discovery.

    Only posts if savings exceed $5000/year.
    """
    if annual_savings < 5000:
        return None

    content = f"""**Tax Optimization Discovered**

**Structure:** {structure}
**Annual Savings:** ${annual_savings:,.0f}

**Recommendation:** {recommendation}

**Trade-offs:**
{tradeoffs}
"""

    client = AgentNetClient(root)
    return client.create_post(
        author_id="board-mentor",
        title=f"Tax Optimization: ${annual_savings:,.0f}/year",
        content=content,
        tags=["tax-optimization", structure.lower().replace(" ", "-")],
        source_event="tax-optimization"
    )


def post_entity_recommendation(
    root: Path,
    entity_type: str,
    rationale: str,
    next_steps: list[str]
) -> Optional[str]:
    """
    Post an entity structure recommendation.
    """
    steps_formatted = "\n".join(f"- {step}" for step in next_steps)

    content = f"""**Entity Recommendation**

**Recommended Structure:** {entity_type}

**Rationale:**
{rationale}

**Next Steps:**
{steps_formatted}
"""

    client = AgentNetClient(root)
    return client.create_post(
        author_id="board-mentor",
        title=f"Entity Recommendation: {entity_type}",
        content=content,
        tags=["entity-selection", entity_type.lower().replace(" ", "-")],
        source_event="entity-recommendation"
    )
