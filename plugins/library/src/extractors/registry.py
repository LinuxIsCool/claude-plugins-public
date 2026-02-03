"""Extractor registry with priority-based routing."""

from __future__ import annotations

from .base import BaseExtractor, ExtractionResult


class ExtractorRegistry:
    """
    Registry of extractors with priority-based routing.

    Extractors are tried in priority order (highest first) until
    one successfully handles the URL. If no specialized extractor
    handles the URL, the generic extractor (if registered) is used.
    """

    def __init__(self):
        self._extractors: list[BaseExtractor] = []

    def register(self, extractor: BaseExtractor) -> None:
        """
        Register an extractor.

        Maintains sorted order by priority (highest first).
        """
        self._extractors.append(extractor)
        self._extractors.sort(key=lambda e: e.priority, reverse=True)

    def unregister(self, name: str) -> bool:
        """Remove an extractor by name."""
        original_len = len(self._extractors)
        self._extractors = [e for e in self._extractors if e.name != name]
        return len(self._extractors) < original_len

    def get_extractor(self, url: str) -> BaseExtractor | None:
        """
        Find the best extractor for a URL.

        Tries extractors in priority order until one can handle the URL.
        """
        for extractor in self._extractors:
            if extractor.can_handle(url):
                return extractor
        return None

    def extract(self, url: str, content: str | None = None) -> ExtractionResult:
        """
        Extract metadata using the appropriate extractor.

        Args:
            url: Resource URL
            content: Optional pre-fetched content

        Returns:
            ExtractionResult from the first matching extractor,
            or a failure result if no extractor handles the URL.
        """
        extractor = self.get_extractor(url)
        if extractor:
            return extractor.extract(url, content)

        return ExtractionResult(
            success=False,
            url=url,
            error="No extractor found for URL",
        )

    def list_extractors(self) -> list[tuple[str, int]]:
        """List registered extractors with their priorities."""
        return [(e.name, e.priority) for e in self._extractors]
