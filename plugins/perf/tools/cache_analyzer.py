#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Plugin cache analyzer.

Analyzes Claude Code plugin cache for size, staleness, and optimization opportunities.
"""

import json
import sys
from pathlib import Path
from datetime import datetime

# Add lib to path for shared utilities
sys.path.insert(0, str(Path(__file__).parent.parent / "lib"))
from utils import (
    get_plugin_cache_dir,
    get_local_plugins_dir,
    get_newest_mtime,
    get_directory_size,
    count_files,
    format_size
)


def analyze_cache() -> dict:
    """Analyze the plugin cache directory."""
    cache_base = get_plugin_cache_dir()

    if not cache_base.exists():
        return {
            "error": "Plugin cache directory not found",
            "cache_dir": str(cache_base)
        }

    total_size = 0
    total_files = 0
    plugins = []

    # Analyze each cache source (linuxiscool-claude-plugins, claude-plugins-official, etc.)
    for source_dir in cache_base.iterdir():
        if not source_dir.is_dir():
            continue

        source_name = source_dir.name

        # Analyze each plugin in this source
        for plugin_dir in source_dir.iterdir():
            if not plugin_dir.is_dir():
                continue

            plugin_name = plugin_dir.name
            size = get_directory_size(plugin_dir)
            files = count_files(plugin_dir)
            mtime = get_newest_mtime(plugin_dir)

            total_size += size
            total_files += files

            plugins.append({
                "name": plugin_name,
                "source": source_name,
                "size_bytes": size,
                "size_human": format_size(size),
                "file_count": files,
                "last_modified": datetime.fromtimestamp(mtime).isoformat() if mtime else None
            })

    # Sort by size descending
    plugins.sort(key=lambda p: p["size_bytes"], reverse=True)

    return {
        "cache_dir": str(cache_base),
        "total_size_bytes": total_size,
        "total_size_human": format_size(total_size),
        "total_files": total_files,
        "plugin_count": len(plugins),
        "plugins": plugins,
        "largest_plugins": plugins[:5] if len(plugins) > 5 else plugins
    }


def check_staleness(cwd: str) -> dict:
    """Check for stale plugin caches (source newer than cache)."""
    stale = []

    plugins_dir = get_local_plugins_dir(cwd)
    cache_base = get_plugin_cache_dir()

    if not plugins_dir.exists() or not cache_base.exists():
        return {"stale_plugins": [], "checked": 0}

    checked = 0

    for plugin_dir in plugins_dir.iterdir():
        if not plugin_dir.is_dir():
            continue

        plugin_name = plugin_dir.name
        source_mtime = get_newest_mtime(plugin_dir)

        if source_mtime == 0:
            continue

        checked += 1

        # Check all cache sources for this plugin
        for source_dir in cache_base.iterdir():
            if source_dir.is_dir():
                plugin_cache = source_dir / plugin_name
                if plugin_cache.exists():
                    cache_mtime = get_newest_mtime(plugin_cache)
                    if source_mtime > cache_mtime:
                        stale.append({
                            "name": plugin_name,
                            "source_modified": datetime.fromtimestamp(source_mtime).isoformat(),
                            "cache_modified": datetime.fromtimestamp(cache_mtime).isoformat(),
                            "delta_seconds": round(source_mtime - cache_mtime, 1)
                        })
                        break

    return {
        "stale_plugins": stale,
        "stale_count": len(stale),
        "checked": checked
    }


def generate_recommendations(cache_analysis: dict, staleness: dict) -> list[dict]:
    """Generate optimization recommendations based on analysis."""
    recommendations = []

    # Stale cache recommendation
    stale_plugins = staleness.get("stale_plugins", [])
    if stale_plugins:
        names = [p["name"] for p in stale_plugins]
        recommendations.append({
            "priority": "high",
            "category": "staleness",
            "title": "Clear stale plugin caches",
            "description": f"{len(stale_plugins)} plugin(s) have stale caches: {', '.join(names)}",
            "action": f"Run: /dev-tools:reload {'all' if len(stale_plugins) > 2 else ' '.join(names)}",
            "impact": "Reduces startup time and ensures latest code runs"
        })

    # Large cache recommendation
    total_mb = cache_analysis.get("total_size_bytes", 0) / (1024 * 1024)
    if total_mb > 200:
        recommendations.append({
            "priority": "medium",
            "category": "size",
            "title": "Consider pruning large plugin cache",
            "description": f"Plugin cache is {total_mb:.1f} MB with {cache_analysis.get('total_files', 0)} files",
            "action": "Review largest plugins and remove unused ones",
            "impact": "Reduces disk usage and potentially speeds up cache scanning"
        })

    # Large individual plugins
    for plugin in cache_analysis.get("largest_plugins", [])[:3]:
        size_mb = plugin["size_bytes"] / (1024 * 1024)
        if size_mb > 50:
            recommendations.append({
                "priority": "low",
                "category": "size",
                "title": f"Large plugin: {plugin['name']}",
                "description": f"{plugin['name']} uses {size_mb:.1f} MB ({plugin['file_count']} files)",
                "action": "Consider if all files are necessary",
                "impact": "May slow down cache operations"
            })

    return recommendations


def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Analyze plugin cache")
    parser.add_argument("--cwd", default=".", help="Working directory for staleness check")
    parser.add_argument("--format", choices=["json", "summary"], default="json")
    parser.add_argument("--check-staleness", action="store_true", help="Check for stale caches")

    args = parser.parse_args()

    cache_analysis = analyze_cache()
    staleness = check_staleness(args.cwd) if args.check_staleness else {"stale_plugins": [], "checked": 0}
    recommendations = generate_recommendations(cache_analysis, staleness)

    result = {
        "cache": cache_analysis,
        "staleness": staleness,
        "recommendations": recommendations
    }

    if args.format == "summary":
        print(f"Cache directory: {cache_analysis.get('cache_dir')}")
        print(f"Total size: {cache_analysis.get('total_size_human')}")
        print(f"Total files: {cache_analysis.get('total_files')}")
        print(f"Plugins: {cache_analysis.get('plugin_count')}")

        if staleness.get("stale_plugins"):
            print(f"\nStale plugins: {staleness['stale_count']}")
            for p in staleness["stale_plugins"]:
                print(f"  - {p['name']}")

        if recommendations:
            print("\nRecommendations:")
            for rec in recommendations:
                print(f"  [{rec['priority']}] {rec['title']}")
    else:
        print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
