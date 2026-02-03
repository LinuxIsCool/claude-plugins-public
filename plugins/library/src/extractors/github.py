"""GitHub repository extractor."""

from __future__ import annotations

import re
from html import unescape
from urllib.parse import urlparse

from .base import BaseExtractor, ExtractionResult
from lib.metadata import ResourceType


class GitHubExtractor(BaseExtractor):
    """
    Extractor for GitHub repositories.

    Handles URLs like:
    - https://github.com/owner/repo
    - https://github.com/owner/repo/tree/branch
    - https://github.com/owner/repo/blob/branch/path

    Extracts:
    - Repository name
    - Owner
    - Description
    - Topics
    - Stars (from meta tags)
    - License
    """

    @property
    def name(self) -> str:
        return "github"

    @property
    def priority(self) -> int:
        return 80  # High priority for code repos

    def can_handle(self, url: str) -> bool:
        """Check if URL is a GitHub repository."""
        parsed = urlparse(url)
        if "github.com" not in parsed.netloc.lower():
            return False

        # Must have at least owner/repo in path
        path_parts = [p for p in parsed.path.split("/") if p]
        return len(path_parts) >= 2

    def extract(self, url: str, content: str | None = None) -> ExtractionResult:
        """Extract metadata from GitHub page."""
        result = ExtractionResult(
            success=True,
            url=url,
            resource_type=ResourceType.REPO,
            extractor_name=self.name,
        )

        # Parse owner/repo from URL
        parsed = urlparse(url)
        path_parts = [p for p in parsed.path.split("/") if p]

        if len(path_parts) >= 2:
            result.repo_owner = path_parts[0]
            result.repo_name = path_parts[1]
            result.title = f"{path_parts[0]}/{path_parts[1]}"

        if not content:
            return result

        # Extract description from og:description or meta description
        desc_patterns = [
            r'<meta\s+property=["\']og:description["\']\s+content=["\']([^"\']+)["\']',
            r'<meta\s+content=["\']([^"\']+)["\']\s+property=["\']og:description["\']',
            r'<p class="f4[^"]*"[^>]*>([^<]+)</p>',
        ]
        for pattern in desc_patterns:
            desc_match = re.search(pattern, content, re.IGNORECASE)
            if desc_match:
                desc = desc_match.group(1).strip()
                # GitHub prefixes descriptions with repo name - remove it
                prefix = f"{result.repo_owner}/{result.repo_name} - "
                if desc.startswith(prefix):
                    desc = desc[len(prefix):]
                result.description = unescape(desc)
                break

        # Extract topics
        topic_matches = re.findall(
            r'data-octo-click="topic_click"[^>]*>([^<]+)</a>',
            content,
            re.IGNORECASE,
        )
        if topic_matches:
            result.repo_topics = [t.strip() for t in topic_matches if t.strip()]
            result.subject = result.repo_topics

        # Try to extract stars from aria-label
        stars_match = re.search(
            r'aria-label="(\d+[\d,]*)\s+users? starred this repository"',
            content,
            re.IGNORECASE,
        )
        if stars_match:
            stars_str = stars_match.group(1).replace(",", "")
            try:
                result.repo_stars = int(stars_str)
            except ValueError:
                pass

        # Extract license
        license_match = re.search(
            r'<a[^>]*href="[^"]*LICENSE[^"]*"[^>]*>([^<]+)</a>',
            content,
            re.IGNORECASE,
        )
        if license_match:
            result.license = license_match.group(1).strip()
        else:
            # Try meta tag
            license_meta = re.search(
                r'<meta name="go-import"[^>]*>.*?license["\']?\s*:\s*["\']?([^"\'>,]+)',
                content,
                re.IGNORECASE | re.DOTALL,
            )
            if license_meta:
                result.license = license_meta.group(1).strip()

        # Extract primary language
        lang_match = re.search(
            r'<span class="color-fg-default[^"]*"[^>]*>\s*<span[^>]*>([^<]+)</span>\s*<span',
            content,
            re.IGNORECASE,
        )
        if lang_match:
            result.language = lang_match.group(1).strip()

        return result
