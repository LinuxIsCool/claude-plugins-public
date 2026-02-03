"""
Plug Core - Plugin management for Claude Code.

This module implements the core functionality:
- Plugfile parsing (Lua and YAML)
- State reconciliation
- Git operations
- Lockfile management
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

import claude_integration as claude


# ═══════════════════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════════════════

CLAUDE_HOME = Path.home() / '.claude'
PLUGINS_DIR = CLAUDE_HOME / 'plugins'
CACHE_DIR = PLUGINS_DIR / 'cache'
USER_PLUGFILE = CLAUDE_HOME / 'plug.lua'
USER_LOCKFILE = CLAUDE_HOME / 'plug-lock.json'
PROJECT_PLUGFILE = Path('.claude/plug.lua')
PROJECT_LOCKFILE = Path('.claude/plug-lock.json')

MAX_PARALLEL_JOBS = 8
GIT_DEPTH = 1


# ═══════════════════════════════════════════════════════════════════════════════
# Data Structures
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class PluginSpec:
    """A plugin specification from the Plugfile."""
    name: str
    source: str  # Git URL or local path
    subpath: Optional[str] = None  # Subdirectory within repo
    branch: Optional[str] = None
    tag: Optional[str] = None
    commit: Optional[str] = None
    enabled: bool = True
    is_local: bool = False

    @property
    def ref(self) -> str:
        """Get the git ref to checkout."""
        if self.commit:
            return self.commit
        if self.tag:
            return self.tag
        if self.branch:
            return self.branch
        return 'HEAD'

    @property
    def display_name(self) -> str:
        """Human-readable name for display."""
        if self.subpath:
            return f"{self.name}/{self.subpath}"
        return self.name


@dataclass
class LockedPlugin:
    """A locked plugin version from plug-lock.json."""
    name: str
    source: str
    subpath: Optional[str]
    ref: str
    sha: str
    locked_at: str


@dataclass
class InstalledPlugin:
    """An actually installed plugin."""
    name: str
    path: Path
    sha: Optional[str] = None
    is_dirty: bool = False


@dataclass
class SyncActions:
    """Actions to perform during sync."""
    to_install: list = field(default_factory=list)
    to_update: list = field(default_factory=list)
    to_remove: list = field(default_factory=list)

    def has_changes(self) -> bool:
        return bool(self.to_install or self.to_update or self.to_remove)

    def total(self) -> int:
        return len(self.to_install) + len(self.to_update) + len(self.to_remove)


# ═══════════════════════════════════════════════════════════════════════════════
# Plugfile Parser
# ═══════════════════════════════════════════════════════════════════════════════

def parse_plugfile(path: Path) -> list[PluginSpec]:
    """Parse a Lua Plugfile into plugin specifications."""
    if not path.exists():
        return []

    content = path.read_text()
    plugins = []

    # Remove comments
    content = re.sub(r'--.*$', '', content, flags=re.MULTILINE)

    # Find the return statement
    match = re.search(r'return\s*\{(.*)\}', content, re.DOTALL)
    if not match:
        return []

    table_content = match.group(1)

    # Parse entries - both string and table formats
    # String format: 'username/repo' or "username/repo"
    # Match quoted strings that are standalone (not after = sign)
    for string_match in re.finditer(r"(?<![=\s])\s*['\"]([^'\"]+)['\"]", table_content):
        spec_str = string_match.group(1)
        spec = parse_spec_string(spec_str)
        if spec:
            plugins.append(spec)

    # Table format: { 'username/repo', opts... } or { dir = '...', ... }
    # This is a simplified parser - for full Lua support, use lupa
    table_pattern = r'\{\s*(?:([\'"][^\'"]+[\'"])|dir\s*=\s*([\'"][^\'"]+[\'"]))([^}]*)\}'
    for table_match in re.finditer(table_pattern, table_content):
        repo_str = table_match.group(1)
        dir_str = table_match.group(2)
        opts_str = table_match.group(3)

        if dir_str:
            # Local plugin
            dir_path = dir_str.strip("'\"")
            dir_path = os.path.expanduser(dir_path)
            name = extract_opt(opts_str, 'name') or Path(dir_path).name
            plugins.append(PluginSpec(
                name=name,
                source=dir_path,
                is_local=True,
                enabled=extract_opt(opts_str, 'enabled', True),
            ))
        elif repo_str:
            # Remote plugin with options
            spec_str = repo_str.strip("'\"")
            spec = parse_spec_string(spec_str)
            if spec:
                spec.branch = extract_opt(opts_str, 'branch')
                spec.tag = extract_opt(opts_str, 'tag')
                spec.commit = extract_opt(opts_str, 'commit')
                spec.enabled = extract_opt(opts_str, 'enabled', True)
                url = extract_opt(opts_str, 'url')
                if url:
                    spec.source = url
                plugins.append(spec)

    return [p for p in plugins if p.enabled]


def parse_spec_string(spec: str) -> Optional[PluginSpec]:
    """Parse a string spec like 'username/repo' or 'username/repo/subpath'."""
    parts = spec.split('/')

    if len(parts) < 2:
        return None

    if len(parts) == 2:
        # username/repo
        username, repo = parts
        return PluginSpec(
            name=repo,
            source=f'https://github.com/{username}/{repo}.git',
        )
    else:
        # username/repo/subpath or more
        username, repo = parts[0], parts[1]
        subpath = '/'.join(parts[2:])
        return PluginSpec(
            name=parts[-1],  # Use last component as name
            source=f'https://github.com/{username}/{repo}.git',
            subpath=subpath,
        )


def extract_opt(opts_str: str, key: str, default=None):
    """Extract an option value from Lua table options string."""
    # Match: key = value or key = 'value' or key = "value" or key = true/false
    pattern = rf"{key}\s*=\s*(?:['\"]([^'\"]*)['\"]|(true|false|\d+))"
    match = re.search(pattern, opts_str)
    if match:
        if match.group(1) is not None:
            return match.group(1)
        val = match.group(2)
        if val == 'true':
            return True
        if val == 'false':
            return False
        return val
    return default


# ═══════════════════════════════════════════════════════════════════════════════
# Lockfile Management
# ═══════════════════════════════════════════════════════════════════════════════

def load_lockfile(path: Path) -> dict[str, LockedPlugin]:
    """Load lockfile into a dict of name -> LockedPlugin."""
    if not path.exists():
        return {}

    try:
        data = json.loads(path.read_text())
        plugins = {}
        for name, info in data.get('plugins', {}).items():
            plugins[name] = LockedPlugin(
                name=name,
                source=info.get('source', ''),
                subpath=info.get('subpath'),
                ref=info.get('ref', ''),
                sha=info.get('sha', ''),
                locked_at=info.get('locked_at', ''),
            )
        return plugins
    except (json.JSONDecodeError, KeyError):
        return {}


def save_lockfile(path: Path, plugins: dict[str, LockedPlugin]):
    """Save lockfile from dict of name -> LockedPlugin."""
    data = {
        'version': 1,
        'generated': datetime.utcnow().isoformat() + 'Z',
        'plugins': {}
    }

    for name in sorted(plugins.keys()):
        p = plugins[name]
        data['plugins'][name] = {
            'source': p.source,
            'ref': p.ref,
            'sha': p.sha,
            'locked_at': p.locked_at,
        }
        if p.subpath:
            data['plugins'][name]['subpath'] = p.subpath

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + '\n')


# ═══════════════════════════════════════════════════════════════════════════════
# Git Operations
# ═══════════════════════════════════════════════════════════════════════════════

def git_clone(url: str, dest: Path, ref: Optional[str] = None, depth: int = GIT_DEPTH) -> bool:
    """Clone a git repository."""
    cmd = ['git', 'clone', '--depth', str(depth)]

    if ref and not looks_like_sha(ref):
        cmd.extend(['--branch', ref])

    cmd.extend([url, str(dest)])

    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)

        # If we have a specific commit, checkout to it
        if ref and looks_like_sha(ref):
            subprocess.run(
                ['git', '-C', str(dest), 'fetch', '--depth', '1', 'origin', ref],
                check=True, capture_output=True, text=True
            )
            subprocess.run(
                ['git', '-C', str(dest), 'checkout', ref],
                check=True, capture_output=True, text=True
            )

        return True
    except subprocess.CalledProcessError as e:
        print(f"  Error cloning {url}: {e.stderr}", file=sys.stderr)
        return False


def git_get_sha(repo_path: Path) -> Optional[str]:
    """Get current commit SHA of a repository."""
    try:
        result = subprocess.run(
            ['git', '-C', str(repo_path), 'rev-parse', 'HEAD'],
            check=True, capture_output=True, text=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return None


def git_is_dirty(repo_path: Path) -> bool:
    """Check if repository has uncommitted changes."""
    try:
        result = subprocess.run(
            ['git', '-C', str(repo_path), 'diff-index', '--quiet', 'HEAD', '--'],
            capture_output=True
        )
        return result.returncode != 0
    except subprocess.CalledProcessError:
        return True  # Assume dirty on error


def git_fetch_and_checkout(repo_path: Path, ref: str) -> bool:
    """Fetch and checkout a specific ref."""
    try:
        subprocess.run(
            ['git', '-C', str(repo_path), 'fetch', '--all', '--tags'],
            check=True, capture_output=True, text=True
        )

        if looks_like_sha(ref):
            target = ref
        elif ref.startswith('v') or '.' in ref:
            # Looks like a tag
            target = f'tags/{ref}'
        else:
            target = f'origin/{ref}'

        subprocess.run(
            ['git', '-C', str(repo_path), 'checkout', target],
            check=True, capture_output=True, text=True
        )
        return True
    except subprocess.CalledProcessError as e:
        print(f"  Error updating {repo_path}: {e.stderr}", file=sys.stderr)
        return False


def looks_like_sha(ref: str) -> bool:
    """Check if ref looks like a commit SHA."""
    return len(ref) >= 7 and all(c in '0123456789abcdef' for c in ref.lower())


# ═══════════════════════════════════════════════════════════════════════════════
# Plugin Discovery
# ═══════════════════════════════════════════════════════════════════════════════

def scan_installed_plugins(cache_dir: Path) -> dict[str, InstalledPlugin]:
    """Scan cache directory for installed plugins."""
    plugins = {}

    if not cache_dir.exists():
        return plugins

    # Scan for plugin.json files
    for plugin_json in cache_dir.rglob('plugin.json'):
        plugin_dir = plugin_json.parent
        if plugin_dir.name == '.claude-plugin':
            plugin_dir = plugin_dir.parent

        try:
            data = json.loads(plugin_json.read_text())
            name = data.get('name', plugin_dir.name)

            sha = git_get_sha(plugin_dir)
            is_dirty = git_is_dirty(plugin_dir) if sha else False

            plugins[name] = InstalledPlugin(
                name=name,
                path=plugin_dir,
                sha=sha,
                is_dirty=is_dirty,
            )
        except (json.JSONDecodeError, KeyError):
            continue

    return plugins


def get_install_path(spec: PluginSpec, version: str = 'latest') -> Path:
    """
    Get the Claude Code-compatible installation path for a plugin.

    Pattern: ~/.claude/plugins/cache/{marketplace}/{plugin}/{version}/
    """
    if spec.is_local:
        return Path(spec.source)

    marketplace = claude.infer_marketplace_name(spec.source)
    return claude.get_claude_cache_path(marketplace, spec.name, version)


# ═══════════════════════════════════════════════════════════════════════════════
# Reconciler
# ═══════════════════════════════════════════════════════════════════════════════

def compute_sync_actions(
    specs: list[PluginSpec],
    installed: dict[str, InstalledPlugin],
    lockfile: dict[str, LockedPlugin],
    frozen: bool = False
) -> SyncActions:
    """
    Compute actions needed to sync installed plugins with specs.

    IMPORTANT: Only manages plugins that Plug installed (tracked in lockfile).
    Plugins installed via other means (Claude Code UI, other tools) are left alone.
    """
    actions = SyncActions()

    spec_names = {s.name for s in specs}

    # Find plugins to install (in spec but not installed)
    for spec in specs:
        if spec.name not in installed:
            actions.to_install.append(spec)

    # Find plugins to update (in both but different SHA)
    for spec in specs:
        if spec.name in installed:
            inst = installed[spec.name]

            if frozen:
                # In frozen mode, check against lockfile
                if spec.name in lockfile:
                    locked = lockfile[spec.name]
                    if inst.sha != locked.sha:
                        actions.to_update.append((spec, inst, locked.sha))
            else:
                # In normal mode, we'd check against remote
                # For now, skip update detection (requires network)
                pass

    # Find plugins to remove (in lockfile but not in spec)
    # ONLY remove plugins that Plug previously installed (tracked in lockfile)
    for name, locked in lockfile.items():
        if name not in spec_names:
            # Plugin was installed by Plug but is no longer in spec
            if name in installed:
                actions.to_remove.append(installed[name])
            else:
                # Plugin not found in scan (e.g., local plugin)
                # Create a synthetic InstalledPlugin for unregistration
                actions.to_remove.append(InstalledPlugin(
                    name=name,
                    path=Path(locked.source) if locked.source else Path('/dev/null'),
                    sha=locked.sha,
                    is_dirty=False,
                ))

    return actions


# ═══════════════════════════════════════════════════════════════════════════════
# Commands
# ═══════════════════════════════════════════════════════════════════════════════

def cmd_init(args):
    """Create a new Plugfile."""
    path = PROJECT_PLUGFILE if args.project else USER_PLUGFILE

    if path.exists():
        print(f"Plugfile already exists: {path}")
        return 1

    path.parent.mkdir(parents=True, exist_ok=True)

    template = '''-- plug.lua - Claude Code Plugin Specification
--
-- Declare your plugins here. Run `plug sync` to install.
--
-- Format:
--   'username/repo'                    -- Simple GitHub plugin
--   { 'username/repo', opts }          -- Plugin with options
--   { dir = '~/path', name = 'name' }  -- Local plugin

return {
  -- ═══════════════════════════════════════════════════════════════════════════
  -- Official Plugins
  -- ═══════════════════════════════════════════════════════════════════════════

  -- 'anthropics/claude-code-plugins/security-guidance',
  -- 'anthropics/claude-code-plugins/feature-dev',

  -- ═══════════════════════════════════════════════════════════════════════════
  -- Community Plugins
  -- ═══════════════════════════════════════════════════════════════════════════

  -- Add community plugins here

  -- ═══════════════════════════════════════════════════════════════════════════
  -- Local Development
  -- ═══════════════════════════════════════════════════════════════════════════

  -- { dir = '~/projects/my-plugin' },
}
'''

    path.write_text(template)
    print(f"Created {path}")
    print("Edit this file to add plugins, then run `plug sync`")
    return 0


def cmd_sync(args):
    """Synchronize installed plugins with Plugfile."""
    # Load specifications
    specs = []
    if USER_PLUGFILE.exists():
        specs.extend(parse_plugfile(USER_PLUGFILE))
    if PROJECT_PLUGFILE.exists():
        specs.extend(parse_plugfile(PROJECT_PLUGFILE))

    # Load current state
    lockfile = load_lockfile(USER_LOCKFILE)
    installed = scan_installed_plugins(CACHE_DIR)

    if not specs and not lockfile:
        print("No plugins specified in Plugfile.")
        print(f"Create one with: plug init")
        return 0

    # Compute actions
    actions = compute_sync_actions(specs, installed, lockfile, args.frozen)

    if not actions.has_changes():
        if not args.quiet:
            print("Already in sync. Nothing to do.")
        return 0

    # Preview
    if not args.quiet:
        print("\nPlug Sync Plan")
        print("=" * 50)

        if actions.to_install:
            print(f"\nInstall ({len(actions.to_install)}):")
            for spec in actions.to_install:
                print(f"  + {spec.display_name}")

        if actions.to_update:
            print(f"\nUpdate ({len(actions.to_update)}):")
            for spec, inst, target_sha in actions.to_update:
                print(f"  ~ {spec.display_name} ({inst.sha[:7]}... -> {target_sha[:7]}...)")

        if actions.to_remove:
            print(f"\nRemove ({len(actions.to_remove)}):")
            for inst in actions.to_remove:
                print(f"  - {inst.name}")

        print()

    if args.dry_run:
        return 0

    # Execute
    errors = []
    new_lockfile = dict(lockfile)

    # Phase 1: Remove orphaned plugins
    for inst in actions.to_remove:
        if not args.quiet:
            print(f"Removing {inst.name}...")
        try:
            # Unregister from Claude Code first
            source_url = ''
            if inst.name in lockfile:
                source_url = lockfile[inst.name].source
            if source_url:
                claude.unregister_plugin(inst.name, source_url)

            # Only delete files if they're in our cache directory (not local plugins)
            if inst.path.exists() and str(CACHE_DIR) in str(inst.path):
                if inst.path.is_symlink():
                    inst.path.unlink()
                else:
                    shutil.rmtree(inst.path)

            if inst.name in new_lockfile:
                del new_lockfile[inst.name]
        except Exception as e:
            errors.append((inst.name, 'remove', str(e)))

    # Phase 2: Install missing plugins (parallel)
    if actions.to_install:
        if not args.quiet:
            print(f"\nInstalling {len(actions.to_install)} plugin(s)...")

        def install_one(spec: PluginSpec):
            # Clone to temp location first to get version info
            temp_dest = CACHE_DIR / '.plug-temp' / spec.name
            if temp_dest.exists():
                shutil.rmtree(temp_dest)
            temp_dest.parent.mkdir(parents=True, exist_ok=True)

            if spec.is_local:
                # Symlink for local plugins
                local_path = Path(spec.source).expanduser()
                version = claude.extract_version(local_path)
                dest = get_install_path(spec, version)
                dest.parent.mkdir(parents=True, exist_ok=True)
                if not dest.exists():
                    dest.symlink_to(local_path)
                return spec, True, None, dest, version, None
            else:
                success = git_clone(spec.source, temp_dest, spec.ref)
                if not success:
                    return spec, False, "Clone failed", None, None, None

                # Get version and SHA
                sha = git_get_sha(temp_dest)
                version = claude.extract_version(temp_dest, sha)

                # Move to final Claude Code-compatible path
                dest = get_install_path(spec, version)
                dest.parent.mkdir(parents=True, exist_ok=True)
                if dest.exists():
                    shutil.rmtree(dest)
                shutil.move(str(temp_dest), str(dest))

                return spec, True, None, dest, version, sha

        with ThreadPoolExecutor(max_workers=MAX_PARALLEL_JOBS) as executor:
            futures = {executor.submit(install_one, spec): spec for spec in actions.to_install}
            for future in as_completed(futures):
                spec, success, error, dest, version, sha = future.result()
                if success:
                    if not args.quiet:
                        print(f"  Installed: {spec.display_name} ({version})")

                    # Register with Claude Code
                    claude.register_plugin(
                        plugin_name=spec.name,
                        install_path=dest,
                        source_url=spec.source,
                        version=version,
                        git_sha=sha,
                        enabled=True,
                    )

                    # Update lockfile
                    new_lockfile[spec.name] = LockedPlugin(
                        name=spec.name,
                        source=spec.source,
                        subpath=spec.subpath,
                        ref=spec.ref,
                        sha=sha or 'local',
                        locked_at=datetime.utcnow().isoformat() + 'Z',
                    )
                else:
                    errors.append((spec.name, 'install', error))

    # Phase 3: Update outdated plugins
    for spec, inst, target_sha in actions.to_update:
        if inst.is_dirty and not args.force:
            errors.append((spec.name, 'update', 'Has local modifications (use --force to override)'))
            continue

        if not args.quiet:
            print(f"Updating {spec.display_name}...")

        if git_fetch_and_checkout(inst.path, spec.ref):
            sha = git_get_sha(inst.path)
            new_lockfile[spec.name] = LockedPlugin(
                name=spec.name,
                source=spec.source,
                subpath=spec.subpath,
                ref=spec.ref,
                sha=sha or target_sha,
                locked_at=datetime.utcnow().isoformat() + 'Z',
            )
        else:
            errors.append((spec.name, 'update', 'Checkout failed'))

    # Save lockfile
    save_lockfile(USER_LOCKFILE, new_lockfile)

    # Report
    if errors:
        print(f"\nCompleted with {len(errors)} error(s):")
        for name, action, error in errors:
            print(f"  {action} {name}: {error}")
        return 1

    if not args.quiet:
        print(f"\nSync complete. {actions.total()} plugin(s) processed.")
        print("Restart Claude Code to load changes.")
    return 0


def cmd_list(args):
    """List installed plugins."""
    installed = scan_installed_plugins(CACHE_DIR)

    if not installed:
        print("No plugins installed.")
        return 0

    print(f"Installed plugins ({len(installed)}):\n")
    for name, plugin in sorted(installed.items()):
        status = ""
        if plugin.is_dirty:
            status = " [modified]"
        sha = plugin.sha[:7] + '...' if plugin.sha else 'local'
        print(f"  {name} ({sha}){status}")
        print(f"    {plugin.path}")

    return 0


def cmd_status(args):
    """Show sync status."""
    specs = []
    if USER_PLUGFILE.exists():
        specs.extend(parse_plugfile(USER_PLUGFILE))
    if PROJECT_PLUGFILE.exists():
        specs.extend(parse_plugfile(PROJECT_PLUGFILE))

    lockfile = load_lockfile(USER_LOCKFILE)
    installed = scan_installed_plugins(CACHE_DIR)

    actions = compute_sync_actions(specs, installed, lockfile)

    if not actions.has_changes():
        print("All plugins are in sync.")
        return 0

    if actions.to_install:
        print(f"To install ({len(actions.to_install)}):")
        for spec in actions.to_install:
            print(f"  + {spec.display_name}")

    if actions.to_remove:
        print(f"To remove ({len(actions.to_remove)}):")
        for inst in actions.to_remove:
            print(f"  - {inst.name}")

    print("\nRun `plug sync` to apply changes.")
    return 0


def cmd_doctor(args):
    """Diagnose common issues."""
    issues = []

    print("Plug Doctor")
    print("=" * 50)

    # Check git
    print("\nChecking git... ", end='')
    try:
        subprocess.run(['git', '--version'], check=True, capture_output=True)
        print("OK")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("FAIL")
        issues.append("Git is not installed or not in PATH")

    # Check Plugfile
    print("Checking Plugfile... ", end='')
    if USER_PLUGFILE.exists() or PROJECT_PLUGFILE.exists():
        print("OK")
    else:
        print("MISSING")
        issues.append(f"No Plugfile found. Run `plug init` to create one.")

    # Check plugins directory
    print("Checking plugins directory... ", end='')
    if PLUGINS_DIR.exists():
        print("OK")
    else:
        print("MISSING")
        issues.append(f"Plugins directory does not exist: {PLUGINS_DIR}")

    # Check lockfile
    print("Checking lockfile... ", end='')
    if USER_LOCKFILE.exists():
        print("OK")
    else:
        print("MISSING")
        issues.append("No lockfile. Run `plug sync` to generate one.")

    # Check for dirty plugins
    print("Checking plugin integrity... ", end='')
    installed = scan_installed_plugins(CACHE_DIR)
    dirty = [p for p in installed.values() if p.is_dirty]
    if dirty:
        print(f"WARNING ({len(dirty)} modified)")
        for p in dirty:
            issues.append(f"Plugin has local modifications: {p.name}")
    else:
        print("OK")

    # Summary
    print()
    if issues:
        print(f"Found {len(issues)} issue(s):")
        for issue in issues:
            print(f"  - {issue}")
        return 1
    else:
        print("No issues found.")
        return 0


def cmd_lock(args):
    """Regenerate lockfile from current state."""
    installed = scan_installed_plugins(CACHE_DIR)

    if not installed:
        print("No plugins installed.")
        return 0

    lockfile = {}
    for name, plugin in installed.items():
        lockfile[name] = LockedPlugin(
            name=name,
            source='',  # Unknown without Plugfile
            subpath=None,
            ref='',
            sha=plugin.sha or '',
            locked_at=datetime.utcnow().isoformat() + 'Z',
        )

    save_lockfile(USER_LOCKFILE, lockfile)
    print(f"Lockfile written: {USER_LOCKFILE}")
    return 0


# ═══════════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description='Plug - Declarative plugin manager for Claude Code',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    subparsers = parser.add_subparsers(dest='command', help='Commands')

    # init
    init_parser = subparsers.add_parser('init', help='Create a new Plugfile')
    init_parser.add_argument('--project', action='store_true', help='Create project-local Plugfile')

    # sync
    sync_parser = subparsers.add_parser('sync', help='Synchronize plugins with Plugfile')
    sync_parser.add_argument('--dry-run', action='store_true', help='Show what would happen')
    sync_parser.add_argument('--force', action='store_true', help='Force sync even with local changes')
    sync_parser.add_argument('--quiet', action='store_true', help='Suppress output')
    sync_parser.add_argument('--frozen', action='store_true', help='Use lockfile versions exactly')

    # list
    list_parser = subparsers.add_parser('list', help='List installed plugins')
    list_parser.add_argument('--skills', action='store_true', help='Show skills')
    list_parser.add_argument('--commands', action='store_true', help='Show commands')
    list_parser.add_argument('--agents', action='store_true', help='Show agents')

    # status
    subparsers.add_parser('status', help='Show sync status')

    # doctor
    subparsers.add_parser('doctor', help='Diagnose issues')

    # lock
    subparsers.add_parser('lock', help='Regenerate lockfile')

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 0

    commands = {
        'init': cmd_init,
        'sync': cmd_sync,
        'list': cmd_list,
        'status': cmd_status,
        'doctor': cmd_doctor,
        'lock': cmd_lock,
    }

    return commands[args.command](args)


if __name__ == '__main__':
    sys.exit(main())
