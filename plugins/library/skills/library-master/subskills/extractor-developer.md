# Extractor Developer Sub-Skill

Create new extractors for additional resource types.

## Extractor Architecture

Extractors implement the `BaseExtractor` interface:

```python
from extractors.base import BaseExtractor, ExtractionResult
from lib.metadata import ResourceType

class MyExtractor(BaseExtractor):
    @property
    def name(self) -> str:
        return "my-extractor"

    @property
    def priority(self) -> int:
        return 75  # Between DOI (70) and GitHub (80)

    def can_handle(self, url: str) -> bool:
        return "mysite.com" in url.lower()

    def extract(self, url: str, content: str | None = None) -> ExtractionResult:
        result = ExtractionResult(
            success=True,
            url=url,
            resource_type=ResourceType.URL,
            extractor_name=self.name,
        )

        if content:
            # Parse content for metadata
            result.title = self._extract_title(content)
            result.description = self._extract_description(content)

        return result
```

## Priority Levels

| Priority | Use For |
|----------|---------|
| 90+ | Very specific domains (arXiv) |
| 80-89 | Major platforms (GitHub, GitLab) |
| 70-79 | Standard identifiers (DOI) |
| 60-69 | Domain categories (news sites) |
| 50 | Generic fallback |
| <50 | Lower priority fallbacks |

## ExtractionResult Fields

```python
@dataclass
class ExtractionResult:
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

    # Type-specific
    arxiv_id: str = ""
    doi: str = ""
    repo_name: str = ""
    repo_owner: str = ""
    repo_stars: int = 0
    repo_topics: list[str] = field(default_factory=list)

    # Metadata
    extractor_name: str = ""
    error: str = ""
```

## Example: YouTube Extractor

```python
import re
from extractors.base import BaseExtractor, ExtractionResult
from lib.metadata import ResourceType

class YouTubeExtractor(BaseExtractor):
    @property
    def name(self) -> str:
        return "youtube"

    @property
    def priority(self) -> int:
        return 85

    def can_handle(self, url: str) -> bool:
        return "youtube.com" in url.lower() or "youtu.be" in url.lower()

    def extract(self, url: str, content: str | None = None) -> ExtractionResult:
        result = ExtractionResult(
            success=True,
            url=url,
            resource_type=ResourceType.VIDEO,
            extractor_name=self.name,
        )

        # Extract video ID
        video_id = self._extract_video_id(url)

        if content:
            # Title from og:title
            title_match = re.search(
                r'<meta property="og:title" content="([^"]+)"',
                content, re.IGNORECASE
            )
            if title_match:
                result.title = title_match.group(1)

            # Channel name
            channel_match = re.search(
                r'"ownerChannelName":"([^"]+)"',
                content
            )
            if channel_match:
                result.creator = [channel_match.group(1)]

        return result

    def _extract_video_id(self, url: str) -> str:
        patterns = [
            r'youtube\.com/watch\?v=([^&]+)',
            r'youtu\.be/([^?]+)',
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return ""
```

## Registering Extractors

Add to the default registry:

```python
from extractors import get_default_registry
from my_extractor import MyExtractor

registry = get_default_registry()
registry.register(MyExtractor())
```

Or create a custom registry:

```python
from extractors import ExtractorRegistry, GenericExtractor

registry = ExtractorRegistry()
registry.register(MyExtractor())
registry.register(GenericExtractor())  # Fallback
```

## Testing Extractors

```python
def test_my_extractor():
    extractor = MyExtractor()

    # Test URL matching
    assert extractor.can_handle("https://mysite.com/page")
    assert not extractor.can_handle("https://other.com")

    # Test extraction
    result = extractor.extract(
        "https://mysite.com/page",
        content="<title>Test Page</title>"
    )
    assert result.success
    assert result.title == "Test Page"
```

## HTML Parsing Tips

Use regex for simple extraction (no dependencies):

```python
import re
from html import unescape

def extract_meta(content: str, name: str) -> str:
    patterns = [
        rf'<meta\s+name="{name}"\s+content="([^"]+)"',
        rf'<meta\s+content="([^"]+)"\s+name="{name}"',
        rf"<meta\s+name='{name}'\s+content='([^']+)'",
    ]
    for pattern in patterns:
        match = re.search(pattern, content, re.IGNORECASE)
        if match:
            return unescape(match.group(1))
    return ""
```

## Error Handling

Always return a valid result, even on failure:

```python
def extract(self, url: str, content: str | None = None) -> ExtractionResult:
    try:
        # Extraction logic...
        return ExtractionResult(success=True, url=url, ...)
    except Exception as e:
        return ExtractionResult(
            success=False,
            url=url,
            error=str(e),
            extractor_name=self.name,
        )
```
