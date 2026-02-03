"""Generic HTML extractor for fallback handling."""

from __future__ import annotations

import re
from html import unescape
from urllib.parse import urlparse

from .base import BaseExtractor, ExtractionResult
from lib.metadata import ResourceType


class GenericExtractor(BaseExtractor):
    """
    Generic extractor for HTML pages.

    Extracts basic metadata from HTML:
    - <title> tag
    - <meta name="description"> or <meta property="og:description">
    - <meta name="keywords">
    - <meta name="author">

    This is the fallback extractor with lowest priority.
    """

    @property
    def name(self) -> str:
        return "generic"

    @property
    def priority(self) -> int:
        return 50  # Low priority - used as fallback

    def can_handle(self, url: str) -> bool:
        """Generic handles all HTTP(S) URLs."""
        parsed = urlparse(url)
        return parsed.scheme in ("http", "https")

    def extract(self, url: str, content: str | None = None) -> ExtractionResult:
        """Extract metadata from HTML content."""
        result = ExtractionResult(
            success=True,
            url=url,
            resource_type=ResourceType.URL,
            extractor_name=self.name,
        )

        if not content:
            # No content to parse - return minimal result
            result.title = self._title_from_url(url)
            return result

        # Extract title
        title_match = re.search(r"<title[^>]*>([^<]+)</title>", content, re.IGNORECASE)
        if title_match:
            result.title = unescape(title_match.group(1).strip())
        else:
            result.title = self._title_from_url(url)

        # Extract description from meta tags
        desc_patterns = [
            r'<meta\s+name=["\']description["\']\s+content=["\']([^"\']+)["\']',
            r'<meta\s+content=["\']([^"\']+)["\']\s+name=["\']description["\']',
            r'<meta\s+property=["\']og:description["\']\s+content=["\']([^"\']+)["\']',
            r'<meta\s+content=["\']([^"\']+)["\']\s+property=["\']og:description["\']',
        ]
        for pattern in desc_patterns:
            desc_match = re.search(pattern, content, re.IGNORECASE)
            if desc_match:
                result.description = unescape(desc_match.group(1).strip())
                break

        # Extract keywords
        keywords_match = re.search(
            r'<meta\s+name=["\']keywords["\']\s+content=["\']([^"\']+)["\']',
            content,
            re.IGNORECASE,
        )
        if keywords_match:
            keywords = keywords_match.group(1)
            result.subject = [k.strip() for k in keywords.split(",") if k.strip()]

        # Extract author
        author_match = re.search(
            r'<meta\s+name=["\']author["\']\s+content=["\']([^"\']+)["\']',
            content,
            re.IGNORECASE,
        )
        if author_match:
            result.creator = [unescape(author_match.group(1).strip())]

        return result

    @staticmethod
    def _title_from_url(url: str) -> str:
        """Generate a title from URL path."""
        parsed = urlparse(url)
        path = parsed.path.strip("/")
        if path:
            # Use last path segment
            last_segment = path.split("/")[-1]
            # Remove file extension
            if "." in last_segment:
                last_segment = last_segment.rsplit(".", 1)[0]
            # Convert dashes/underscores to spaces
            return last_segment.replace("-", " ").replace("_", " ").title()
        return parsed.netloc
