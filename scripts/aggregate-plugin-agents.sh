#!/usr/bin/env bash
#
# Aggregate plugin agents into .claude/agents/ with namespace prefixes
#
# This script scans all plugins for agents/ directories and creates
# namespaced copies in .claude/agents/{plugin}:{agent}.md
#
# Usage: ./scripts/aggregate-plugin-agents.sh
#
# Run this after adding/modifying plugin agents to make them available
# as Task tool subagent_types.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PLUGINS_DIR="$PROJECT_ROOT/plugins"
AGENTS_DIR="$PROJECT_ROOT/.claude/agents"

# Ensure agents directory exists
mkdir -p "$AGENTS_DIR"

echo "Aggregating plugin agents..."

# Track what we create for cleanup of stale entries
declare -a created_agents=()

# Scan each plugin for agents/ directory
for plugin_dir in "$PLUGINS_DIR"/*/; do
    plugin_name=$(basename "$plugin_dir")
    agents_source="$plugin_dir/agents"

    if [[ -d "$agents_source" ]]; then
        echo "  Found agents in: $plugin_name"

        for agent_file in "$agents_source"/*.md; do
            if [[ -f "$agent_file" ]]; then
                agent_name=$(basename "$agent_file" .md)
                namespaced_name="${plugin_name}:${agent_name}"
                target_file="$AGENTS_DIR/${namespaced_name}.md"

                # Copy with namespace prefix
                cp "$agent_file" "$target_file"
                created_agents+=("$namespaced_name")
                echo "    -> $namespaced_name"
            fi
        done
    fi
done

echo ""
echo "Aggregated ${#created_agents[@]} plugin agent(s):"
for agent in "${created_agents[@]}"; do
    echo "  - $agent"
done

echo ""
echo "Plugin agents are now available as Task tool subagent_types."
echo "Restart Claude Code for changes to take effect."
