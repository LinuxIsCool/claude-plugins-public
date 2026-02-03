# Memory Plugin Core Library
#
# This module provides the core memory system implementation.
# Hooks and tools should import from here for consistent behavior.

from pathlib import Path

__version__ = "0.1.0"

def get_plugin_root() -> Path:
    """Get the memory plugin root directory."""
    return Path(__file__).resolve().parent.parent

def get_lib_path() -> Path:
    """Get the lib directory path."""
    return Path(__file__).resolve().parent
