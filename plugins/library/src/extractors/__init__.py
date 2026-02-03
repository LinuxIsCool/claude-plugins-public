"""Resource extractors for different content types."""

from .base import BaseExtractor, ExtractionResult
from .registry import ExtractorRegistry
from .generic import GenericExtractor
from .arxiv import ArxivExtractor
from .github import GitHubExtractor
from .doi import DOIExtractor

__all__ = [
    "BaseExtractor",
    "ExtractionResult",
    "ExtractorRegistry",
    "GenericExtractor",
    "ArxivExtractor",
    "GitHubExtractor",
    "DOIExtractor",
]


def get_default_registry() -> ExtractorRegistry:
    """Get a registry with all default extractors registered."""
    registry = ExtractorRegistry()
    registry.register(ArxivExtractor())
    registry.register(GitHubExtractor())
    registry.register(DOIExtractor())
    registry.register(GenericExtractor())
    return registry
