"""DOI (Digital Object Identifier) extractor."""

from __future__ import annotations

import re
from html import unescape
from urllib.parse import urlparse, unquote

from .base import BaseExtractor, ExtractionResult
from lib.metadata import ResourceType


class DOIExtractor(BaseExtractor):
    """
    Extractor for DOI-identified resources.

    Handles URLs like:
    - https://doi.org/10.1234/example
    - https://dx.doi.org/10.1234/example
    - URLs containing /doi/10.1234/example

    DOIs identify academic papers, datasets, and other scholarly works.
    Metadata is extracted from the resolved page or CrossRef.
    """

    # DOI pattern: 10.XXXX/... where XXXX is 4+ digits
    DOI_PATTERN = re.compile(r"10\.\d{4,}/[^\s\"<>]+")

    @property
    def name(self) -> str:
        return "doi"

    @property
    def priority(self) -> int:
        return 70  # Below arXiv (which may have DOIs too)

    def can_handle(self, url: str) -> bool:
        """Check if URL contains a DOI."""
        parsed = urlparse(url)

        # Direct DOI resolver
        if "doi.org" in parsed.netloc.lower():
            return True

        # URL path contains DOI
        if "/doi/" in parsed.path.lower():
            return True

        # Check if DOI pattern in URL
        return bool(self.DOI_PATTERN.search(url))

    def extract(self, url: str, content: str | None = None) -> ExtractionResult:
        """Extract metadata from DOI-identified resource."""
        result = ExtractionResult(
            success=True,
            url=url,
            resource_type=ResourceType.PAPER,
            extractor_name=self.name,
        )

        # Extract DOI from URL
        doi = self._extract_doi(url)
        if doi:
            result.doi = doi

        if not content:
            if doi:
                result.title = f"DOI:{doi}"
            return result

        # Extract title from common meta tags
        title_patterns = [
            r'<meta name="citation_title" content="([^"]+)"',
            r'<meta name="DC\.title" content="([^"]+)"',
            r'<meta property="og:title" content="([^"]+)"',
            r'<h1[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)</h1>',
            r'<title>([^<]+)</title>',
        ]
        for pattern in title_patterns:
            title_match = re.search(pattern, content, re.IGNORECASE)
            if title_match:
                result.title = unescape(title_match.group(1).strip())
                break

        # Extract authors
        author_matches = re.findall(
            r'<meta name="citation_author" content="([^"]+)"',
            content,
            re.IGNORECASE,
        )
        if author_matches:
            result.creator = [unescape(a.strip()) for a in author_matches]

        # Extract description/abstract
        desc_patterns = [
            r'<meta name="description" content="([^"]+)"',
            r'<meta name="DC\.description" content="([^"]+)"',
            r'<meta property="og:description" content="([^"]+)"',
            r'<div class="[^"]*abstract[^"]*"[^>]*>(.+?)</div>',
        ]
        for pattern in desc_patterns:
            desc_match = re.search(pattern, content, re.IGNORECASE | re.DOTALL)
            if desc_match:
                desc = desc_match.group(1).strip()
                desc = re.sub(r"<[^>]+>", "", desc)  # Remove HTML tags
                desc = re.sub(r"\s+", " ", desc)  # Normalize whitespace
                result.description = unescape(desc)
                break

        # Extract publication date
        date_patterns = [
            r'<meta name="citation_publication_date" content="([^"]+)"',
            r'<meta name="DC\.date" content="([^"]+)"',
            r'<meta name="citation_date" content="([^"]+)"',
        ]
        for pattern in date_patterns:
            date_match = re.search(pattern, content, re.IGNORECASE)
            if date_match:
                result.date = date_match.group(1)
                break

        # Extract subjects/keywords
        keywords_match = re.search(
            r'<meta name="citation_keywords" content="([^"]+)"',
            content,
            re.IGNORECASE,
        )
        if keywords_match:
            keywords = keywords_match.group(1)
            result.subject = [k.strip() for k in keywords.split(",") if k.strip()]

        return result

    def _extract_doi(self, url: str) -> str:
        """Extract DOI from URL."""
        # Decode URL encoding
        url = unquote(url)

        # Direct doi.org URL
        parsed = urlparse(url)
        if "doi.org" in parsed.netloc.lower():
            # DOI is in the path
            path = parsed.path.lstrip("/")
            if path:
                return path

        # Look for DOI pattern
        match = self.DOI_PATTERN.search(url)
        if match:
            return match.group(0)

        return ""
