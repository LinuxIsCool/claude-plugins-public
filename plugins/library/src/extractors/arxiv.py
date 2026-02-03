"""arXiv paper extractor."""

from __future__ import annotations

import re
from html import unescape
from urllib.parse import urlparse

from .base import BaseExtractor, ExtractionResult
from lib.metadata import ResourceType


class ArxivExtractor(BaseExtractor):
    """
    Extractor for arXiv papers.

    Handles URLs like:
    - https://arxiv.org/abs/2312.12345
    - https://arxiv.org/abs/2312.12345v2
    - https://arxiv.org/pdf/2312.12345.pdf

    Extracts:
    - Paper title
    - Authors
    - Abstract
    - arXiv ID
    - Categories/subjects
    """

    # Pattern for arXiv IDs: YYMM.NNNNN or YYMM.NNNNNvN
    ARXIV_ID_PATTERN = re.compile(r"(\d{4}\.\d{4,5})(v\d+)?")

    @property
    def name(self) -> str:
        return "arxiv"

    @property
    def priority(self) -> int:
        return 90  # High priority for academic papers

    def can_handle(self, url: str) -> bool:
        """Check if URL is an arXiv paper."""
        parsed = urlparse(url)
        return "arxiv.org" in parsed.netloc.lower()

    def extract(self, url: str, content: str | None = None) -> ExtractionResult:
        """Extract metadata from arXiv page."""
        result = ExtractionResult(
            success=True,
            url=url,
            resource_type=ResourceType.PAPER,
            extractor_name=self.name,
        )

        # Extract arXiv ID from URL
        arxiv_id = self._extract_arxiv_id(url)
        if arxiv_id:
            result.arxiv_id = arxiv_id

        if not content:
            # No content - return with just arXiv ID
            if arxiv_id:
                result.title = f"arXiv:{arxiv_id}"
            return result

        # Extract title
        title_patterns = [
            r'<h1 class="title[^"]*"[^>]*>(?:<span[^>]*>)?Title:(?:</span>)?\s*(.+?)</h1>',
            r'<meta name="citation_title" content="([^"]+)"',
            r'<title>([^<]+)</title>',
        ]
        for pattern in title_patterns:
            title_match = re.search(pattern, content, re.IGNORECASE | re.DOTALL)
            if title_match:
                title = title_match.group(1).strip()
                # Clean up arXiv title formatting
                title = re.sub(r"\s*\[.*?\]\s*$", "", title)  # Remove trailing [...]
                title = re.sub(r"^\s*\[\d+\.\d+\]\s*", "", title)  # Remove leading arxiv id
                result.title = unescape(title)
                break

        # Extract authors
        author_patterns = [
            r'<meta name="citation_author" content="([^"]+)"',
            r'<div class="authors"[^>]*>.*?Authors?:\s*(.+?)</div>',
        ]

        authors = []
        for pattern in author_patterns:
            author_matches = re.findall(pattern, content, re.IGNORECASE | re.DOTALL)
            if author_matches:
                for match in author_matches:
                    # Clean up author names
                    name = re.sub(r"<[^>]+>", "", match)  # Remove HTML tags
                    name = unescape(name.strip())
                    if name and name not in authors:
                        authors.append(name)
                break

        if authors:
            result.creator = authors

        # Extract abstract
        abstract_match = re.search(
            r'<blockquote class="abstract[^"]*"[^>]*>(?:<span[^>]*>)?Abstract:(?:</span>)?\s*(.+?)</blockquote>',
            content,
            re.IGNORECASE | re.DOTALL,
        )
        if abstract_match:
            abstract = abstract_match.group(1).strip()
            abstract = re.sub(r"<[^>]+>", "", abstract)  # Remove HTML tags
            abstract = re.sub(r"\s+", " ", abstract)  # Normalize whitespace
            result.description = unescape(abstract)

        # Extract subjects/categories
        subjects_match = re.search(
            r'<td class="tablecell subjects"[^>]*>.*?<span class="primary-subject">([^<]+)</span>',
            content,
            re.IGNORECASE | re.DOTALL,
        )
        if subjects_match:
            primary_subject = subjects_match.group(1).strip()
            result.subject = [primary_subject]

            # Additional subjects
            additional = re.findall(r'<span class="[^"]*">([^<]+\([^)]+\))</span>', content)
            for subj in additional:
                subj = subj.strip()
                if subj and subj not in result.subject:
                    result.subject.append(subj)

        # Extract date
        date_match = re.search(
            r'<meta name="citation_date" content="([^"]+)"',
            content,
            re.IGNORECASE,
        )
        if date_match:
            result.date = date_match.group(1)

        return result

    def _extract_arxiv_id(self, url: str) -> str:
        """Extract arXiv ID from URL."""
        # Try to match in URL path
        match = self.ARXIV_ID_PATTERN.search(url)
        if match:
            arxiv_id = match.group(1)
            version = match.group(2) or ""
            return arxiv_id + version
        return ""
