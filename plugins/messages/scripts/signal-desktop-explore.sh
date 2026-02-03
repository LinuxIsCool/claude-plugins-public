#!/bin/bash
# Explore Signal Desktop database schema
# Requires: sqlcipher

SIGNAL_DB="$HOME/.var/app/org.signal.Signal/config/Signal/sql/db.sqlite"
SIGNAL_KEY=$(cat "$HOME/.var/app/org.signal.Signal/config/Signal/config.json" | grep -o '"key": "[^"]*"' | cut -d'"' -f4)

if [ -z "$SIGNAL_KEY" ]; then
    echo "Error: Could not find Signal Desktop encryption key"
    exit 1
fi

if [ ! -f "$SIGNAL_DB" ]; then
    echo "Error: Signal Desktop database not found at $SIGNAL_DB"
    exit 1
fi

echo "Signal Desktop Database Explorer"
echo "================================="
echo "Database: $SIGNAL_DB"
echo "Key: ${SIGNAL_KEY:0:8}..."
echo ""

# List tables
echo "=== Tables ==="
sqlcipher "$SIGNAL_DB" "PRAGMA key = \"x'$SIGNAL_KEY'\"; .tables"

echo ""
echo "=== Messages Table Schema ==="
sqlcipher "$SIGNAL_DB" "PRAGMA key = \"x'$SIGNAL_KEY'\"; .schema messages"

echo ""
echo "=== Conversations Table Schema ==="
sqlcipher "$SIGNAL_DB" "PRAGMA key = \"x'$SIGNAL_KEY'\"; .schema conversations"

echo ""
echo "=== Message Count ==="
sqlcipher "$SIGNAL_DB" "PRAGMA key = \"x'$SIGNAL_KEY'\"; SELECT COUNT(*) FROM messages;"

echo ""
echo "=== Sample Messages (last 5) ==="
sqlcipher "$SIGNAL_DB" "PRAGMA key = \"x'$SIGNAL_KEY'\"; SELECT id, sent_at, type, body FROM messages ORDER BY sent_at DESC LIMIT 5;"

echo ""
echo "=== Date Range ==="
sqlcipher "$SIGNAL_DB" "PRAGMA key = \"x'$SIGNAL_KEY'\"; SELECT datetime(MIN(sent_at)/1000, 'unixepoch') as earliest, datetime(MAX(sent_at)/1000, 'unixepoch') as latest FROM messages;"
