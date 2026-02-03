# Cache Manager Sub-Skill

Manage the content-addressed storage cache.

## Cache Structure

```
.claude/library/.cache/
├── objects/
│   └── {hash[:2]}/
│       └── {hash}/
│           ├── content          # Raw bytes
│           ├── metadata.json    # CacheEntry
│           └── verified         # Integrity timestamp
└── index/
    └── url_to_hash.json         # URL -> hash mapping
```

## Cache Operations

### Store Content

```python
from lib.cache import ContentAddressedCache
from pathlib import Path

cache = ContentAddressedCache(Path(".claude/library/.cache"))

content = b"<html>...</html>"
content_hash, is_new = cache.store(
    content=content,
    url="https://example.com",
    content_type="text/html",
)

print(f"Hash: {content_hash[:16]}")
print(f"New: {is_new}")
```

### Retrieve Content

```python
# By hash
content = cache.retrieve(content_hash)

# By URL
content = cache.retrieve_by_url("https://example.com")
```

### Check Existence

```python
# By hash
if cache.has(content_hash):
    print("Content exists")

# By URL
if cache.has_url("https://example.com"):
    print("URL is cached")
```

### Get Hash for URL

```python
content_hash = cache.get_hash_for_url("https://example.com")
if content_hash:
    print(f"Cached as: {content_hash[:16]}")
```

## Integrity Verification

Verify content integrity:

```python
if cache.verify(content_hash):
    print("Content integrity verified")
else:
    print("WARNING: Content corrupted!")
```

## Cache Metadata

Get entry metadata:

```python
entry = cache.get_metadata(content_hash)
if entry:
    print(f"URL: {entry.url}")
    print(f"Size: {entry.size} bytes")
    print(f"Stored: {entry.stored_at}")
    print(f"Type: {entry.content_type}")
```

## Cache Statistics

```python
stats = cache.get_stats()
print(f"Objects: {stats['object_count']}")
print(f"URLs: {stats['url_count']}")
print(f"Size: {stats['total_size_human']}")
print(f"Dedup ratio: {stats['deduplication_ratio']:.2f}")
```

## Listing Cached Objects

```python
hashes = cache.list_all()
for h in hashes:
    entry = cache.get_metadata(h)
    print(f"{h[:16]} - {entry.url if entry else 'unknown'}")
```

## Deleting Cache Entries

```python
if cache.delete(content_hash):
    print("Deleted successfully")
else:
    print("Not found")
```

## Hash Computation

Compute hash without storing:

```python
content_hash = ContentAddressedCache.compute_hash(content)
```

## Deduplication

The cache automatically deduplicates:
- Same content from different URLs -> single storage
- URL index maps all URLs to their content hash
- Storage savings visible in stats

Example:
```python
# Same content, different URLs
cache.store(b"Hello", "https://a.com/page")
cache.store(b"Hello", "https://b.com/page")

stats = cache.get_stats()
# object_count: 1 (content stored once)
# url_count: 2 (both URLs indexed)
```

## Cache Maintenance

Clear stale entries:

```python
import time
from datetime import datetime

for h in cache.list_all():
    entry = cache.get_metadata(h)
    if entry and entry.stored_at:
        stored = datetime.fromisoformat(entry.stored_at.rstrip('Z'))
        age_days = (datetime.utcnow() - stored).days
        if age_days > 90:  # Older than 90 days
            cache.delete(h)
            print(f"Deleted old entry: {h[:16]}")
```
