"""
Claude Code Integration - Minimal JSON registration for Plug.

This module registers Plug-managed plugins with Claude Code's native
infrastructure so they appear in Claude Code's plugin system.
"""

import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Optional


# Claude Code file locations
CLAUDE_HOME = Path.home() / '.claude'
PLUGINS_DIR = CLAUDE_HOME / 'plugins'
INSTALLED_PLUGINS_FILE = PLUGINS_DIR / 'installed_plugins.json'
KNOWN_MARKETPLACES_FILE = PLUGINS_DIR / 'known_marketplaces.json'
SETTINGS_FILE = CLAUDE_HOME / 'settings.json'


def infer_marketplace_name(source_url: str) -> str:
    """
    Infer marketplace name from git URL.

    Examples:
        https://github.com/ygg/plug.git -> ygg-plug
        https://github.com/anthropics/claude-plugins-official.git -> claude-plugins-official
        git@github.com:user/repo.git -> user-repo
    """
    # Extract org/repo from various URL formats
    patterns = [
        r'github\.com[/:]([^/]+)/([^/.]+)',  # HTTPS or SSH
        r'gitlab\.com[/:]([^/]+)/([^/.]+)',
        r'bitbucket\.org[/:]([^/]+)/([^/.]+)',
    ]

    for pattern in patterns:
        match = re.search(pattern, source_url)
        if match:
            org, repo = match.groups()
            # Use repo name as marketplace (Claude Code convention)
            return repo.replace('.git', '')

    # Fallback: use "plug" as marketplace
    return 'plug'


def extract_version(plugin_path: Path, git_sha: Optional[str] = None) -> str:
    """
    Extract version from plugin.json or use git SHA.

    Priority:
        1. plugin.json version field (if semver-like)
        2. First 12 chars of git SHA
        3. "unknown"
    """
    # Try plugin.json
    for plugin_json in [plugin_path / 'plugin.json', plugin_path / '.claude-plugin' / 'plugin.json']:
        if plugin_json.exists():
            try:
                data = json.loads(plugin_json.read_text())
                version = data.get('version', '')
                if version and re.match(r'^\d+\.\d+', version):
                    return version
            except (json.JSONDecodeError, KeyError):
                pass

    # Use git SHA
    if git_sha:
        return git_sha[:12]

    return 'unknown'


def get_plugin_name(plugin_path: Path) -> str:
    """Get plugin name from plugin.json or directory name."""
    for plugin_json in [plugin_path / 'plugin.json', plugin_path / '.claude-plugin' / 'plugin.json']:
        if plugin_json.exists():
            try:
                data = json.loads(plugin_json.read_text())
                return data.get('name', plugin_path.name)
            except (json.JSONDecodeError, KeyError):
                pass
    return plugin_path.name


def _read_json(path: Path, default: dict) -> dict:
    """Read JSON file or return default."""
    if path.exists():
        try:
            return json.loads(path.read_text())
        except json.JSONDecodeError:
            pass
    return default


def _write_json(path: Path, data: dict) -> None:
    """Write JSON file atomically."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix('.tmp')
    temp_path.write_text(json.dumps(data, indent=2) + '\n')
    temp_path.rename(path)


def register_plugin(
    plugin_name: str,
    install_path: Path,
    source_url: str,
    version: str,
    git_sha: Optional[str] = None,
    scope: str = 'user',
    enabled: bool = True,
) -> bool:
    """
    Register a plugin with Claude Code's infrastructure.

    Updates:
        - installed_plugins.json: Add plugin installation record
        - known_marketplaces.json: Ensure marketplace exists
        - settings.json: Enable plugin if requested

    Returns True on success.
    """
    marketplace = infer_marketplace_name(source_url)
    plugin_key = f"{plugin_name}@{marketplace}"
    now = datetime.utcnow().isoformat() + 'Z'

    # 1. Update installed_plugins.json
    installed = _read_json(INSTALLED_PLUGINS_FILE, {'version': 2, 'plugins': {}})
    installed.setdefault('version', 2)
    installed.setdefault('plugins', {})

    install_record = {
        'scope': scope,
        'installPath': str(install_path),
        'version': version,
        'installedAt': now,
        'lastUpdated': now,
    }
    if git_sha:
        install_record['gitCommitSha'] = git_sha

    installed['plugins'][plugin_key] = [install_record]
    _write_json(INSTALLED_PLUGINS_FILE, installed)

    # 2. Update known_marketplaces.json (only for git-based plugins)
    # Skip marketplace registration for local plugins using the fallback 'plug' name
    # as they don't have proper marketplace structure
    marketplaces = _read_json(KNOWN_MARKETPLACES_FILE, {})
    if marketplace not in marketplaces and 'github.com' in source_url:
        # Only create marketplace entries for GitHub-based plugins
        match = re.search(r'github\.com[/:]([^/]+)/([^/.]+)', source_url)
        if match:
            org, repo = match.groups()
            marketplaces[marketplace] = {
                'source': {'source': 'github', 'repo': f'{org}/{repo}'},
                'installLocation': str(PLUGINS_DIR / 'marketplaces' / marketplace),
                'lastUpdated': now,
            }
            _write_json(KNOWN_MARKETPLACES_FILE, marketplaces)

    # 3. Update settings.json if enabled
    if enabled:
        settings = _read_json(SETTINGS_FILE, {})
        settings.setdefault('enabledPlugins', {})
        settings['enabledPlugins'][plugin_key] = True
        _write_json(SETTINGS_FILE, settings)

    return True


def unregister_plugin(plugin_name: str, source_url: str) -> bool:
    """
    Unregister a plugin from Claude Code's infrastructure.

    Updates:
        - installed_plugins.json: Remove plugin
        - settings.json: Remove from enabledPlugins

    Returns True on success.
    """
    marketplace = infer_marketplace_name(source_url)
    plugin_key = f"{plugin_name}@{marketplace}"

    # 1. Remove from installed_plugins.json
    installed = _read_json(INSTALLED_PLUGINS_FILE, {'version': 2, 'plugins': {}})
    if plugin_key in installed.get('plugins', {}):
        del installed['plugins'][plugin_key]
        _write_json(INSTALLED_PLUGINS_FILE, installed)

    # 2. Remove from settings.json
    settings = _read_json(SETTINGS_FILE, {})
    if plugin_key in settings.get('enabledPlugins', {}):
        del settings['enabledPlugins'][plugin_key]
        _write_json(SETTINGS_FILE, settings)

    return True


def get_claude_cache_path(marketplace: str, plugin_name: str, version: str) -> Path:
    """
    Get the Claude Code-compatible cache path for a plugin.

    Pattern: ~/.claude/plugins/cache/{marketplace}/{plugin}/{version}/
    """
    return PLUGINS_DIR / 'cache' / marketplace / plugin_name / version


def is_plugin_registered(plugin_name: str, source_url: str) -> bool:
    """Check if a plugin is registered with Claude Code."""
    marketplace = infer_marketplace_name(source_url)
    plugin_key = f"{plugin_name}@{marketplace}"

    installed = _read_json(INSTALLED_PLUGINS_FILE, {'version': 2, 'plugins': {}})
    return plugin_key in installed.get('plugins', {})
