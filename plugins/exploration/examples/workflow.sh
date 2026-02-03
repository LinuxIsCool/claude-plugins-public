#!/bin/bash
# Exploration Plugin - Example Workflow
#
# Demonstrates Unix-style tools for knowledge graph operations.
# All tools use direct parsing (no LLM) for speed.

TOOLS_DIR="$(dirname "$0")/../tools"

echo "=== Exploration Plugin Workflow Demo ==="
echo ""

# 1. Quick memory additions
echo "1. Adding quick memories..."
python "$TOOLS_DIR/remember.py" "Claude Code version is 2.0.67" --circle tools
python "$TOOLS_DIR/remember.py" "GPU is RTX 4070 with 12GB VRAM" --circle substrate
echo ""

# 2. Piped discovery (e.g., from docker)
echo "2. Capturing from command output..."
echo "neo4j:7474, redis:6379, falkordb:6380" | python "$TOOLS_DIR/remember.py" --circle network
echo ""

# 3. Structured discovery ingestion
echo "3. Ingesting structured discovery..."
python "$TOOLS_DIR/ingest_exploration.py" "$(dirname "$0")/sample-discovery.json"
echo ""

# 4. Search the graph
echo "4. Searching for 'database'..."
python "$TOOLS_DIR/recall.py" database
echo ""

echo "5. Searching network circle for 'port'..."
python "$TOOLS_DIR/recall.py" --circle network port
echo ""

# 6. JSON output for scripting
echo "6. JSON output (for scripting)..."
python "$TOOLS_DIR/recall.py" --json GPU | head -20
echo ""

echo "=== Workflow Complete ==="
echo ""
echo "View graph at: http://localhost:3001"
echo "Try this Cypher query:"
echo "  MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 50"
