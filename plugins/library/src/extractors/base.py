"""Base extractor interface."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from lib.metadata import ResourceType


@dataclass
class ExtractionResult:
    """Result of metadata extraction from a resource."""

    success: bool
    url: str
    title: str = ""
    description: str = ""
    resource_type: ResourceType = ResourceType.URL
    creator: list[str] = field(default_factory=list)
    date: str = ""
    subject: list[str] = field(default_factory=list)
    language: str = ""
    license: str = ""

    # Type-specific fields
    arxiv_id: str = ""
    doi: str = ""
    repo_name: str = ""
    repo_owner: str = ""
    repo_stars: int = 0
    repo_topics: list[str] = field(default_factory=list)

    # Extraction metadata
    extractor_name: str = ""
    error: str = ""

    def to_resource_kwargs(self) -> dict[str, Any]:
        """Convert to kwargs for Resource creation."""
        kwargs: dict[str, Any] = {}

        if self.title:
            kwargs["title"] = self.title
        if self.description:
            kwargs["description"] = self.description
        if self.resource_type != ResourceType.URL:
            kwargs["resource_type"] = self.resource_type
        if self.creator:
            kwargs["creator"] = self.creator
        if self.date:
            kwargs["date"] = self.date
        if self.subject:
            kwargs["subject"] = self.subject
        if self.language:
            kwargs["language"] = self.language
        if self.license:
            kwargs["license"] = self.license

        # Type-specific
        if self.arxiv_id:
            kwargs["arxiv_id"] = self.arxiv_id
        if self.doi:
            kwargs["doi"] = self.doi
        if self.repo_name:
            kwargs["repo_name"] = self.repo_name
        if self.repo_owner:
            kwargs["repo_owner"] = self.repo_owner
        if self.repo_stars:
            kwargs["repo_stars"] = self.repo_stars
        if self.repo_topics:
            kwargs["repo_topics"] = self.repo_topics

        return kwargs


class BaseExtractor(ABC):
    """
    Base class for resource metadata extractors.

    Extractors are responsible for:
    1. Recognizing URLs they can handle (can_handle)
    2. Extracting structured metadata from content (extract)

    Each extractor has a priority (0-100) that determines
    the order in which extractors are tried. Higher priority
    extractors are tried first.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Extractor name for logging and identification."""
        ...

    @property
    @abstractmethod
    def priority(self) -> int:
        """Priority for extractor selection (0-100, higher = tried first)."""
        ...

    @abstractmethod
    def can_handle(self, url: str) -> bool:
        """
        Check if this extractor can handle the given URL.

        Args:
            url: The URL to check

        Returns:
            True if this extractor should handle this URL
        """
        ...

    @abstractmethod
    def extract(self, url: str, content: str | None = None) -> ExtractionResult:
        """
        Extract metadata from a resource.

        Args:
            url: The resource URL
            content: Optional pre-fetched content (HTML, JSON, etc.)

        Returns:
            ExtractionResult with extracted metadata
        """
        ...
