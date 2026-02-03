#!/usr/bin/env python3
"""
Log Entity Extractor for Claude Code JSONL Logs

Extracts semantic entities from conversation logs for memory storage.
Designed to feed into the three-tier memory system.

Usage:
    python log_entity_extractor.py extract <jsonl_file> [--output <json_file>]
    python log_entity_extractor.py batch <directory> [--output <json_file>]
    python log_entity_extractor.py stats <directory>
"""

import json
import re
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional, Generator
from dataclasses import dataclass, asdict
from collections import defaultdict


@dataclass
class ExtractedEntity:
    """A semantic entity extracted from logs."""
    entity_type: str  # decision, insight, error, tool_use, file_reference, question
    content: str
    importance: float  # 0.0-1.0
    source_file: str
    source_line: int
    timestamp: str
    session_id: str
    metadata: Dict[str, Any]


class LogEntityExtractor:
    """Extracts semantic entities from Claude Code JSONL logs."""

    # Patterns for entity detection
    PATTERNS = {
        'decision': [
            r'(?:decided|choosing|selected|going with|will use|opting for)\s+(.+?)(?:\.|$)',
            r'(?:the approach|strategy|solution) (?:is|will be)\s+(.+?)(?:\.|$)',
        ],
        'insight': [
            r'(?:discovered|found|realized|noticed|learned)\s+(?:that\s+)?(.+?)(?:\.|$)',
            r'(?:key insight|important|notably|interestingly)[:\s]+(.+?)(?:\.|$)',
        ],
        'error': [
            r'(?:error|exception|failed|failure)[:\s]+(.+?)(?:\.|$)',
            r'(?:traceback|stack trace)[:\s]*\n(.+?)(?:\n\n|$)',
        ],
        'question': [
            r'(?:wondering|unclear|need to understand|question)[:\s]+(.+?)(?:\?|$)',
            r'(.+\?)\s*$',  # Lines ending with ?
        ],
        'file_reference': [
            r'(?:file|path|reading|writing|editing)[:\s]+([/\w\-\.]+\.[a-z]+)',
            r'`([/\w\-\.]+\.[a-z]+)`',
        ],
    }

    # Importance weights by message type and entity type
    IMPORTANCE_WEIGHTS = {
        'assistant': {
            'decision': 0.8,
            'insight': 0.7,
            'error': 0.9,
            'question': 0.5,
            'file_reference': 0.4,
            'tool_use': 0.6,
        },
        'user': {
            'decision': 0.6,
            'insight': 0.5,
            'error': 0.7,
            'question': 0.8,  # User questions are important
            'file_reference': 0.5,
            'tool_use': 0.3,
        },
        'system': {
            'decision': 0.4,
            'insight': 0.4,
            'error': 0.8,
            'question': 0.3,
            'file_reference': 0.3,
            'tool_use': 0.5,
        },
    }

    def __init__(self, min_importance: float = 0.3):
        self.min_importance = min_importance
        self.compiled_patterns = {
            entity_type: [re.compile(p, re.IGNORECASE | re.MULTILINE)
                         for p in patterns]
            for entity_type, patterns in self.PATTERNS.items()
        }

    def extract_from_file(self, filepath: Path) -> Generator[ExtractedEntity, None, None]:
        """Extract entities from a single JSONL file."""
        session_id = filepath.stem

        with open(filepath, 'r') as f:
            for line_num, line in enumerate(f, 1):
                try:
                    event = json.loads(line)
                    yield from self._extract_from_event(
                        event,
                        source_file=str(filepath),
                        source_line=line_num,
                        session_id=session_id
                    )
                except json.JSONDecodeError:
                    continue

    def _extract_from_event(
        self,
        event: Dict[str, Any],
        source_file: str,
        source_line: int,
        session_id: str
    ) -> Generator[ExtractedEntity, None, None]:
        """Extract entities from a single log event."""

        event_type = event.get('type', '')
        timestamp = event.get('timestamp', '')

        # Handle different event types
        if event_type == 'assistant':
            yield from self._extract_from_assistant(
                event, source_file, source_line, session_id, timestamp
            )
        elif event_type == 'user':
            yield from self._extract_from_user(
                event, source_file, source_line, session_id, timestamp
            )
        elif event_type == 'system':
            yield from self._extract_from_system(
                event, source_file, source_line, session_id, timestamp
            )

    def _extract_from_assistant(
        self,
        event: Dict[str, Any],
        source_file: str,
        source_line: int,
        session_id: str,
        timestamp: str
    ) -> Generator[ExtractedEntity, None, None]:
        """Extract from assistant messages."""

        message = event.get('message', {})

        # Extract from text content
        for content_block in message.get('content', []):
            if content_block.get('type') == 'text':
                text = content_block.get('text', '')
                yield from self._extract_patterns(
                    text, 'assistant', source_file, source_line, session_id, timestamp
                )

            # Tool use is itself an entity
            elif content_block.get('type') == 'tool_use':
                tool_name = content_block.get('name', '')
                tool_input = content_block.get('input', {})

                importance = self.IMPORTANCE_WEIGHTS['assistant']['tool_use']

                # Boost importance for write operations
                if tool_name in ('Write', 'Edit', 'Bash'):
                    importance = min(1.0, importance + 0.2)

                if importance >= self.min_importance:
                    yield ExtractedEntity(
                        entity_type='tool_use',
                        content=f"{tool_name}: {self._summarize_tool_input(tool_name, tool_input)}",
                        importance=importance,
                        source_file=source_file,
                        source_line=source_line,
                        timestamp=timestamp,
                        session_id=session_id,
                        metadata={
                            'tool_name': tool_name,
                            'tool_input_keys': list(tool_input.keys()) if isinstance(tool_input, dict) else []
                        }
                    )

    def _extract_from_user(
        self,
        event: Dict[str, Any],
        source_file: str,
        source_line: int,
        session_id: str,
        timestamp: str
    ) -> Generator[ExtractedEntity, None, None]:
        """Extract from user messages."""

        message = event.get('message', {})

        for content_block in message.get('content', []):
            if content_block.get('type') == 'text':
                text = content_block.get('text', '')
                yield from self._extract_patterns(
                    text, 'user', source_file, source_line, session_id, timestamp
                )

    def _extract_from_system(
        self,
        event: Dict[str, Any],
        source_file: str,
        source_line: int,
        session_id: str,
        timestamp: str
    ) -> Generator[ExtractedEntity, None, None]:
        """Extract from system events."""

        # Tool results often contain important information
        if 'tool_result' in event:
            result = event.get('tool_result', {})
            content = result.get('content', '')

            if isinstance(content, str):
                yield from self._extract_patterns(
                    content, 'system', source_file, source_line, session_id, timestamp
                )

    def _extract_patterns(
        self,
        text: str,
        role: str,
        source_file: str,
        source_line: int,
        session_id: str,
        timestamp: str
    ) -> Generator[ExtractedEntity, None, None]:
        """Extract pattern-matched entities from text."""

        for entity_type, patterns in self.compiled_patterns.items():
            for pattern in patterns:
                for match in pattern.finditer(text):
                    content = match.group(1) if match.groups() else match.group(0)
                    content = content.strip()

                    # Skip very short or very long matches
                    if len(content) < 10 or len(content) > 500:
                        continue

                    importance = self.IMPORTANCE_WEIGHTS.get(role, {}).get(
                        entity_type, 0.5
                    )

                    if importance >= self.min_importance:
                        yield ExtractedEntity(
                            entity_type=entity_type,
                            content=content,
                            importance=importance,
                            source_file=source_file,
                            source_line=source_line,
                            timestamp=timestamp,
                            session_id=session_id,
                            metadata={'role': role, 'pattern': pattern.pattern[:50]}
                        )

    def _summarize_tool_input(self, tool_name: str, tool_input: Dict) -> str:
        """Create a concise summary of tool input."""
        if tool_name == 'Read':
            return tool_input.get('file_path', '')[:100]
        elif tool_name == 'Write':
            path = tool_input.get('file_path', '')
            return f"wrote {path}"[:100]
        elif tool_name == 'Edit':
            path = tool_input.get('file_path', '')
            return f"edited {path}"[:100]
        elif tool_name == 'Bash':
            cmd = tool_input.get('command', '')
            return cmd[:100]
        elif tool_name == 'Grep':
            pattern = tool_input.get('pattern', '')
            return f"searched for '{pattern}'"[:100]
        elif tool_name == 'Task':
            desc = tool_input.get('description', '')
            return desc[:100]
        else:
            return str(tool_input)[:100]


def extract_command(args):
    """Extract entities from a single file."""
    filepath = Path(args[0])
    output = args[2] if len(args) > 2 and args[1] == '--output' else None

    extractor = LogEntityExtractor()
    entities = list(extractor.extract_from_file(filepath))

    result = [asdict(e) for e in entities]

    if output:
        with open(output, 'w') as f:
            json.dump(result, f, indent=2)
        print(f"Extracted {len(entities)} entities to {output}")
    else:
        print(json.dumps(result, indent=2))


def batch_command(args):
    """Extract entities from all JSONL files in a directory."""
    directory = Path(args[0])
    output = args[2] if len(args) > 2 and args[1] == '--output' else None

    extractor = LogEntityExtractor()
    all_entities = []

    jsonl_files = list(directory.rglob('*.jsonl'))
    print(f"Processing {len(jsonl_files)} files...")

    for filepath in jsonl_files:
        entities = list(extractor.extract_from_file(filepath))
        all_entities.extend(entities)
        print(f"  {filepath.name}: {len(entities)} entities")

    result = [asdict(e) for e in all_entities]

    if output:
        with open(output, 'w') as f:
            json.dump(result, f, indent=2)
        print(f"\nTotal: {len(all_entities)} entities extracted to {output}")
    else:
        print(f"\nTotal: {len(all_entities)} entities extracted")
        # Print summary by type
        by_type = defaultdict(int)
        for e in all_entities:
            by_type[e.entity_type] += 1
        for t, c in sorted(by_type.items(), key=lambda x: -x[1]):
            print(f"  {t}: {c}")


def stats_command(args):
    """Show statistics about extractable entities in a directory."""
    directory = Path(args[0])

    extractor = LogEntityExtractor(min_importance=0.0)  # Extract all for stats

    stats = {
        'total_files': 0,
        'total_events': 0,
        'total_entities': 0,
        'by_type': defaultdict(int),
        'by_importance': defaultdict(int),
        'by_role': defaultdict(int),
    }

    jsonl_files = list(directory.rglob('*.jsonl'))
    stats['total_files'] = len(jsonl_files)

    for filepath in jsonl_files:
        with open(filepath, 'r') as f:
            stats['total_events'] += sum(1 for _ in f)

        for entity in extractor.extract_from_file(filepath):
            stats['total_entities'] += 1
            stats['by_type'][entity.entity_type] += 1

            # Bucket importance
            bucket = f"{int(entity.importance * 10) / 10:.1f}"
            stats['by_importance'][bucket] += 1

            role = entity.metadata.get('role', 'unknown')
            stats['by_role'][role] += 1

    print(f"Log Entity Extraction Statistics")
    print(f"================================")
    print(f"Files: {stats['total_files']}")
    print(f"Events: {stats['total_events']}")
    print(f"Entities: {stats['total_entities']}")
    print(f"\nBy Type:")
    for t, c in sorted(stats['by_type'].items(), key=lambda x: -x[1]):
        print(f"  {t}: {c}")
    print(f"\nBy Importance:")
    for i, c in sorted(stats['by_importance'].items()):
        print(f"  {i}: {c}")
    print(f"\nBy Role:")
    for r, c in sorted(stats['by_role'].items(), key=lambda x: -x[1]):
        print(f"  {r}: {c}")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]
    args = sys.argv[2:]

    commands = {
        'extract': extract_command,
        'batch': batch_command,
        'stats': stats_command,
    }

    if command in commands:
        commands[command](args)
    else:
        print(f"Unknown command: {command}")
        print(__doc__)
        sys.exit(1)


if __name__ == '__main__':
    main()
