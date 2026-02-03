# Memvid - QR Code Video-Based AI Memory

Memvid is a Python library that compresses knowledge bases into searchable MP4 files using QR code video encoding. It delivers 50-100x compression vs vector databases with sub-100ms retrieval, zero infrastructure requirements, and offline-first operation.

## What is Memvid?

Memvid transforms text into QR code videos, enabling:
- **Massive Compression**: Store millions of chunks in single MP4 files
- **Fast Retrieval**: Direct frame seek + QR decode in under 100ms
- **Zero Infrastructure**: No databases, Docker, or servers required
- **Portable Memory**: Copy or stream MP4 files anywhere
- **Offline-First**: Everything runs without internet after encoding
- **Conversational AI**: Built-in chat interface with context-aware memory

### Key Architecture

**Data Flow Pipeline:**
```
1. Text Input → Chunking → Embeddings → QR Codes → Video Frames → MP4 File
                    ↓
                Vector Index → FAISS Index → JSON Metadata

2. Query → Embedding → Vector Search → Frame Numbers → QR Decode → Text
                             ↓
                     Retrieved Context → LLM → Response
```

**Core Components:**
- **MemvidEncoder**: Text chunking and QR video creation
- **MemvidRetriever**: Semantic search, frame extraction, QR decoding
- **MemvidChat**: Conversational interface with LLM integration
- **IndexManager**: Embedding generation and vector search

## Installation

### Prerequisites
- Python 3.8+
- FFmpeg (for video encoding)
- libzbar0 (for QR decoding)

### System Dependencies

**macOS:**
```bash
brew install ffmpeg zbar
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install ffmpeg libzbar0
```

### Python Installation

```bash
# From PyPI
pip install memvid

# For PDF support
pip install memvid PyPDF2

# From source (development)
git clone https://github.com/olow304/memvid.git
cd memvid
python -m venv .memvid
source .memvid/bin/activate
pip install -r requirements.txt
pip install -e .
```

## Quick Start

### 1. Creating a Memory Video

```python
from memvid import MemvidEncoder

# Create encoder
encoder = MemvidEncoder()

# Add individual chunks
chunks = [
    "NASA founded 1958",
    "Apollo 11 landed 1969",
    "ISS launched 1998"
]
encoder.add_chunks(chunks)

# Or add text with automatic chunking
long_text = """Your long document text here..."""
encoder.add_text(long_text, chunk_size=200, overlap=50)

# Build video and index
encoder.build_video("space.mp4", "space_index.json")
```

### 2. Searching the Memory

```python
from memvid import MemvidRetriever

# Load retriever
retriever = MemvidRetriever("space.mp4", "space_index.json")

# Search for relevant chunks
results = retriever.search("moon landing", top_k=5)
for chunk in results:
    print(chunk)
```

### 3. Interactive Chat

```python
from memvid import MemvidChat
import os

# Set API key for LLM (OpenAI, Google, or Anthropic)
os.environ['OPENAI_API_KEY'] = 'your-key-here'

# Initialize chat
chat = MemvidChat(
    "space.mp4",
    "space_index.json",
    llm_provider="openai",  # or "google", "anthropic"
    llm_model="gpt-4o"
)

# Start session and chat
chat.start_session()
response = chat.chat("When did humans land on the moon?")
print(response)

# Or launch interactive mode
chat.interactive_chat()
```

## Encoding Examples

### From PDF Documents

```python
from memvid import MemvidEncoder

encoder = MemvidEncoder()

# Single PDF
encoder.add_pdf("deep_learning.pdf", chunk_size=512, overlap=50)
encoder.build_video("ml_library.mp4", "ml_index.json")

# Multiple PDFs
encoder = MemvidEncoder()
encoder.add_pdf("deep_learning.pdf")
encoder.add_pdf("machine_learning.pdf")
encoder.add_pdf("neural_networks.pdf")
encoder.build_video("ai_books.mp4", "ai_index.json")
```

### From Directory of Files

```python
from memvid import MemvidEncoder
from pathlib import Path

encoder = MemvidEncoder()

# Index all markdown files
for md_file in Path("docs/").glob("**/*.md"):
    with open(md_file) as f:
        encoder.add_text(
            f.read(),
            metadata={"file": str(md_file), "type": "documentation"}
        )

encoder.build_video("docs.mp4", "docs_index.json")
```

### Custom Chunking Strategy

```python
import re
from memvid import MemvidEncoder

def chunk_by_sentences(text, max_size=300):
    """Chunk text by sentences while respecting max size"""
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current = ""

    for sentence in sentences:
        if len(current) + len(sentence) > max_size and current:
            chunks.append(current.strip())
            current = sentence
        else:
            current += " " + sentence

    if current:
        chunks.append(current.strip())

    return chunks

encoder = MemvidEncoder()
chunks = chunk_by_sentences(long_text)
encoder.add_chunks(chunks)
encoder.build_video("output.mp4", "output_index.json")
```

## Codec Optimization

Memvid supports multiple video codecs with different compression/speed tradeoffs.

### Available Codecs

| Codec | File Type | Compression | Speed | Use Case |
|-------|-----------|-------------|-------|----------|
| **mp4v** | .mp4 | Low | Fast | Quick testing, compatibility |
| **h264** | .mkv | Medium | Medium | Balanced performance |
| **h265** | .mkv | High | Slow | Best compression, archival |
| **av1** | .mkv | Very High | Very Slow | Future-proof, max compression |

### Codec Configuration

```python
from memvid import MemvidEncoder

encoder = MemvidEncoder()
encoder.add_chunks(chunks)

# Maximum compression (H.265)
encoder.build_video(
    "compressed.mp4",
    "index.json",
    codec='h265',
    show_progress=True
)

# Fast encoding (MP4V)
encoder.build_video(
    "fast.mp4",
    "index.json",
    codec='mp4v',
    show_progress=True
)

# Future-proof (AV1) - requires FFmpeg with AV1 support
encoder.build_video(
    "future.mp4",
    "index.json",
    codec='av1',
    show_progress=True
)
```

### Codec Comparison Tool

Compare multiple codecs on your data:

```bash
# Compare H.265 vs MP4V on a PDF
python examples/codec_comparison.py document.pdf --codecs h265 mp4v

# Test all available codecs
python examples/codec_comparison.py document.pdf --codecs all

# Compare on directory of files
python examples/codec_comparison.py ./docs/ --codecs h265 h264 mp4v

# Custom chunking
python examples/codec_comparison.py document.pdf \
    --codecs h265 h264 \
    --chunk-size 512 \
    --overlap 100
```

### Advanced Codec Parameters

Configure codec-specific settings in `memvid/config.py`:

```python
# Custom H.265 settings for maximum compression
H265_PARAMETERS = {
    "video_file_type": "mkv",
    "video_fps": 30,
    "video_crf": 28,              # 0-51, lower = better quality
    "frame_height": 256,
    "frame_width": 256,
    "video_preset": "slower",      # slower = better compression
    "video_profile": "mainstillpicture",
    "pix_fmt": "yuv420p",
    "extra_ffmpeg_args": "-x265-params keyint=1:tune=stillimage"
}
```

### Codec Performance Metrics

Typical results for 10,000 text chunks (200 chars each):

```
Codec    Size      Chunks/MB  Encoding Time  Ratio
------   -------   ---------  -------------  -----
h265     15.2 MB   658        45s            1.0x (baseline)
h264     18.7 MB   535        32s            1.2x
mp4v     45.3 MB   221        12s            3.0x
av1      12.1 MB   826        180s           0.8x
```

## Retrieval Patterns

### Basic Search

```python
from memvid import MemvidRetriever

retriever = MemvidRetriever("knowledge.mp4", "knowledge_index.json")

# Simple search
results = retriever.search("quantum computing", top_k=5)
for text in results:
    print(text)
```

### Search with Metadata

```python
# Get full result details
results = retriever.search_with_metadata("AI ethics", top_k=3)
for result in results:
    print(f"Score: {result['score']:.3f}")
    print(f"Text: {result['text'][:100]}...")
    print(f"Frame: {result['frame']}")
    print(f"Chunk ID: {result['chunk_id']}")
    print(f"Metadata: {result['metadata']}")
    print()
```

### Context Window Retrieval

```python
# Get chunk with surrounding context
chunk_id = 42
context_window = retriever.get_context_window(chunk_id, window_size=2)
# Returns: [chunk_40, chunk_41, chunk_42, chunk_43, chunk_44]
```

### Prefetching for Performance

```python
# Prefetch frames for common queries
common_queries = ["AI", "machine learning", "neural networks"]
for query in common_queries:
    results = retriever.search(query, top_k=10)

# Or prefetch specific frame numbers
frame_numbers = [10, 20, 30, 40, 50]
retriever.prefetch_frames(frame_numbers)
```

### Cache Management

```python
# Get cache statistics
stats = retriever.get_stats()
print(f"Cache size: {stats['cache_size']}/{stats['max_cache_size']}")
print(f"Total frames: {stats['total_frames']}")

# Clear cache
retriever.clear_cache()
```

## Chat Integration Patterns

### Multi-Provider LLM Support

```python
from memvid import MemvidChat

# OpenAI
chat = MemvidChat(
    "memory.mp4",
    "index.json",
    llm_provider="openai",
    llm_model="gpt-4o",
    llm_api_key="sk-..."
)

# Google Gemini
chat = MemvidChat(
    "memory.mp4",
    "index.json",
    llm_provider="google",
    llm_model="gemini-2.0-flash-exp",
    llm_api_key="AIza..."
)

# Anthropic Claude
chat = MemvidChat(
    "memory.mp4",
    "index.json",
    llm_provider="anthropic",
    llm_model="claude-3-5-sonnet-20241022",
    llm_api_key="sk-ant-..."
)
```

### Custom System Prompts

```python
chat = MemvidChat("memory.mp4", "index.json")

system_prompt = """You are a technical documentation assistant.
Use the provided knowledge base to answer questions about the codebase.
Always cite specific file names when referencing code examples.
If information is missing, suggest related topics the user might explore."""

chat.start_session(system_prompt=system_prompt)
response = chat.chat("How do I configure the database?")
```

### Streaming Responses

```python
# Enable streaming for better UX
chat = MemvidChat("memory.mp4", "index.json")
chat.start_session()

# Stream response (prints in real-time)
response = chat.chat("Explain quantum entanglement", stream=True)
```

### Session Management

```python
chat = MemvidChat("memory.mp4", "index.json")

# Start named session
chat.start_session(session_id="research_session_001")

# Chat
chat.chat("What is quantum superposition?")
chat.chat("How does it differ from classical probability?")

# Export conversation
chat.export_conversation("sessions/research_001.json")

# Later: Load session
chat.load_session("sessions/research_001.json")

# Get session stats
stats = chat.get_stats()
print(f"Messages exchanged: {stats['messages_exchanged']}")
print(f"Session ID: {stats['session_id']}")
```

### Context-Only Mode (No LLM)

```python
# Works without API keys - returns raw context
chat = MemvidChat("memory.mp4", "index.json", llm_provider=None)

response = chat.chat("quantum computing")
# Returns: "Based on the knowledge base, here's what I found: ..."
```

### Direct Context Search

```python
chat = MemvidChat("memory.mp4", "index.json")

# Search without generating LLM response
context_chunks = chat.search_context("machine learning", top_k=10)
for chunk in context_chunks:
    print(chunk)
```

## Performance Optimization

### Encoding Performance

```python
from memvid import MemvidEncoder

# Parallel processing for large datasets
encoder = MemvidEncoder()
encoder.add_chunks(large_chunk_list)

# Fast encoding settings
encoder.build_video(
    "fast.mp4",
    "index.json",
    codec='mp4v',        # Fastest codec
    show_progress=True
)
```

### Retrieval Performance

```python
from memvid import MemvidRetriever

# Configure for speed
retriever = MemvidRetriever(
    "large_memory.mp4",
    "index.json",
    config={
        "retrieval": {
            "cache_size": 5000,      # Larger cache
            "batch_size": 100,       # Bigger batches
            "max_workers": 8         # More parallel threads
        }
    }
)

# Warm up cache
for query in ["AI", "ML", "data"]:
    retriever.search(query, top_k=10)
```

### Custom Embedding Models

```python
from memvid import MemvidEncoder

# Use higher-quality embedding model
encoder = MemvidEncoder(config={
    "embedding": {
        "model": "all-mpnet-base-v2",  # Higher quality
        "dimension": 768,
        "batch_size": 32
    }
})
```

## Advanced Patterns

### Multi-Video Federation

```python
from memvid import MemvidRetriever

class MemvidFederation:
    """Search across multiple video memories"""

    def __init__(self):
        self.retrievers = {}

    def add_memory(self, name, video_file, index_file):
        self.retrievers[name] = MemvidRetriever(video_file, index_file)

    def search_all(self, query, top_k=5):
        all_results = []

        for name, retriever in self.retrievers.items():
            results = retriever.search_with_metadata(query, top_k)
            for r in results:
                r['source'] = name
                all_results.append(r)

        # Sort by score
        all_results.sort(key=lambda x: x['score'], reverse=True)
        return all_results[:top_k]

# Usage
fed = MemvidFederation()
fed.add_memory("tech_docs", "tech.mp4", "tech_index.json")
fed.add_memory("science_papers", "science.mp4", "science_index.json")
fed.add_memory("company_wiki", "wiki.mp4", "wiki_index.json")

results = fed.search_all("quantum computing applications")
for result in results:
    print(f"Source: {result['source']}")
    print(f"Score: {result['score']:.3f}")
    print(f"Text: {result['text'][:100]}...")
    print()
```

### Metadata-Rich Encoding

```python
from memvid import MemvidEncoder

encoder = MemvidEncoder()

# Add chunks with rich metadata
chunks_with_metadata = [
    {
        "text": "Quantum computers use superposition...",
        "metadata": {
            "source": "quantum_physics_101.pdf",
            "page": 42,
            "author": "Dr. Smith",
            "date": "2024-01-15",
            "category": "quantum_computing",
            "keywords": ["quantum", "superposition", "qubits"]
        }
    },
    # ... more chunks
]

for item in chunks_with_metadata:
    encoder.add_chunk(item["text"], metadata=item["metadata"])

encoder.build_video("enriched.mp4", "enriched_index.json")
```

### Batch Processing Pipeline

```python
from pathlib import Path
from memvid import MemvidEncoder

def process_document_library(input_dir, output_prefix):
    """Process entire document library into searchable video"""
    encoder = MemvidEncoder()

    # Process all supported files
    for pdf_file in Path(input_dir).glob("**/*.pdf"):
        try:
            encoder.add_pdf(
                str(pdf_file),
                chunk_size=400,
                overlap=80,
                metadata={
                    "filename": pdf_file.name,
                    "path": str(pdf_file),
                    "type": "pdf"
                }
            )
            print(f"Processed: {pdf_file.name}")
        except Exception as e:
            print(f"Failed: {pdf_file.name} - {e}")

    # Build with optimal codec
    encoder.build_video(
        f"{output_prefix}.mp4",
        f"{output_prefix}_index.json",
        codec='h265',
        show_progress=True
    )

    # Print statistics
    stats = encoder.get_stats()
    print(f"Total chunks: {stats['total_chunks']}")
    print(f"Total characters: {stats['total_characters']}")
    print(f"Avg chunk size: {stats['avg_chunk_size']:.0f}")

# Usage
process_document_library("./research_papers/", "output/research_library")
```

## Configuration Reference

### Default Configuration

```python
from memvid.config import get_default_config

config = get_default_config()
```

### Key Configuration Options

```python
config = {
    "qr": {
        "version": 35,              # QR code version (1-40)
        "error_correction": "M",    # L, M, Q, H
        "box_size": 5,
        "border": 3
    },
    "chunking": {
        "chunk_size": 1024,
        "overlap": 32
    },
    "codec": "h265",                # mp4v, h264, h265, av1
    "embedding": {
        "model": "all-MiniLM-L6-v2",
        "dimension": 384
    },
    "retrieval": {
        "top_k": 5,
        "batch_size": 100,
        "max_workers": 4,
        "cache_size": 1000
    },
    "chat": {
        "max_history": 10,
        "context_chunks": 5
    }
}
```

## Upcoming v2 Features

Memvid v2 will introduce:

- **Living-Memory Engine**: Continuously add new data without full reindexing
- **Capsule Context (.mv2)**: Shareable memory capsules with expiry and access rules
- **Time-Travel Debugging**: Rewind or branch conversations to review context
- **Smart Recall**: Local cache with <5ms prediction and preloading
- **Codec Intelligence**: Auto-tune AV1 and future codecs for optimal compression
- **CLI & Dashboard**: Branch management, analytics, and one-command cloud publishing
- **Delta Encoding**: Version control for knowledge bases
- **GPU Acceleration**: 100x faster bulk encoding with GPU support

## Common Patterns

### Documentation Search System

```python
from memvid import MemvidEncoder, MemvidChat

# Build documentation memory
encoder = MemvidEncoder()
encoder.add_text(api_docs, metadata={"type": "api"})
encoder.add_text(tutorials, metadata={"type": "tutorial"})
encoder.add_text(examples, metadata={"type": "examples"})
encoder.build_video("docs.mp4", "docs_index.json", codec='h265')

# Interactive documentation assistant
chat = MemvidChat("docs.mp4", "docs_index.json", llm_provider="openai")
chat.start_session(system_prompt="""You are a helpful documentation assistant.
Use the knowledge base to help users understand the API and find code examples.""")
chat.interactive_chat()
```

### Research Paper Archive

```python
from memvid import MemvidEncoder, MemvidRetriever

# Index research papers
encoder = MemvidEncoder()
papers = load_papers()  # Your paper loader

for paper in papers:
    encoder.add_text(
        paper["abstract"] + "\n\n" + paper["content"],
        metadata={
            "title": paper["title"],
            "authors": paper["authors"],
            "year": paper["year"],
            "doi": paper["doi"],
            "keywords": paper["keywords"]
        }
    )

encoder.build_video("papers.mp4", "papers_index.json", codec='h265')

# Semantic search across papers
retriever = MemvidRetriever("papers.mp4", "papers_index.json")
results = retriever.search_with_metadata("deep learning transformers", top_k=10)

for result in results:
    meta = result['metadata']
    print(f"{meta['title']} ({meta['year']})")
    print(f"Authors: {meta['authors']}")
    print(f"Score: {result['score']:.3f}")
    print(f"Excerpt: {result['text'][:200]}...")
    print()
```

### Personal Knowledge Base

```python
from memvid import MemvidEncoder, MemvidChat
from pathlib import Path

# Build from markdown notes
encoder = MemvidEncoder()
for md_file in Path("notes/").glob("**/*.md"):
    with open(md_file) as f:
        encoder.add_text(
            f.read(),
            metadata={
                "file": str(md_file),
                "modified": md_file.stat().st_mtime
            }
        )

encoder.build_video("knowledge.mp4", "knowledge_index.json", codec='h265')

# Chat with your knowledge
chat = MemvidChat("knowledge.mp4", "knowledge_index.json", llm_provider="google")
chat.interactive_chat()
```

## Tech Stack

- **QR Generation**: qrcode, Pillow
- **Video Processing**: OpenCV (cv2), FFmpeg
- **QR Decoding**: pyzbar
- **Embeddings**: sentence-transformers, HuggingFace
- **Vector Search**: FAISS, NumPy
- **LLM Integration**: OpenAI, Google Gemini, Anthropic Claude
- **Codecs**: H.264, H.265/HEVC, AV1, MP4V

## Performance Characteristics

- **Indexing Speed**: ~10K chunks/second on modern CPUs
- **Search Latency**: <100ms for 1M chunks (includes QR decode)
- **Storage Efficiency**: 100MB text → 1-2MB video (H.265)
- **Memory Usage**: Constant 500MB RAM regardless of dataset size
- **Compression Ratio**: 50-100x vs traditional vector databases

## Troubleshooting

### QR Decode Failures

```python
# Increase QR code quality
encoder = MemvidEncoder(config={
    "qr": {
        "error_correction": "H",  # Highest error correction
        "version": 15,            # Larger QR codes
        "box_size": 15
    }
})
```

### Memory Issues with Large Videos

```python
# Enable streaming mode
retriever = MemvidRetriever(
    "large.mp4",
    "index.json",
    config={
        "retrieval": {
            "cache_size": 500,      # Smaller cache
            "batch_size": 50
        }
    }
)
```

### Slow Search Performance

```python
# Debug performance
stats = retriever.get_stats()
print(f"Cache hit rate: {stats['cache_hit_rate']:.2%}")

# Increase cache and workers
retriever = MemvidRetriever(
    "memory.mp4",
    "index.json",
    config={
        "retrieval": {
            "cache_size": 5000,
            "max_workers": 8
        }
    }
)
```

## Best Practices

1. **Chunk Size**: 100-500 characters works best for most use cases
2. **Overlap**: 20-30% overlap prevents context loss at boundaries
3. **Codec Selection**: Use H.265 for production, MP4V for development/testing
4. **Cache Size**: Set to 10% of total frames for optimal performance
5. **Error Correction**: Use "H" for archival, "M" for general use, "L" for speed
6. **Embedding Models**: all-MiniLM-L6-v2 (fast) or all-mpnet-base-v2 (quality)

## Resources

- GitHub: https://github.com/olow304/memvid
- PyPI: https://pypi.org/project/memvid/
- Documentation: See USAGE.md in repository
- Examples: examples/ directory in repository

## License

MIT License - see LICENSE file for details
