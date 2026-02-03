#!/bin/bash
# Export Signal Desktop database to decrypted SQLite
# Requires: sqlcipher (version 4+)
#
# Usage: ./scripts/signal-desktop-export.sh
#
# This script:
# 1. Finds your Signal Desktop database
# 2. Reads the encryption key from config.json
# 3. Exports to a decrypted SQLite file that can be read by Bun/Node

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Find Signal Desktop paths
HOME_DIR="${HOME:-/home/$USER}"

# Try Flatpak first, then standard path
if [ -f "$HOME_DIR/.var/app/org.signal.Signal/config/Signal/sql/db.sqlite" ]; then
    SIGNAL_DB="$HOME_DIR/.var/app/org.signal.Signal/config/Signal/sql/db.sqlite"
    SIGNAL_CONFIG="$HOME_DIR/.var/app/org.signal.Signal/config/Signal/config.json"
    echo -e "${GREEN}Found Signal Desktop (Flatpak)${NC}"
elif [ -f "$HOME_DIR/.config/Signal/sql/db.sqlite" ]; then
    SIGNAL_DB="$HOME_DIR/.config/Signal/sql/db.sqlite"
    SIGNAL_CONFIG="$HOME_DIR/.config/Signal/config.json"
    echo -e "${GREEN}Found Signal Desktop (Standard)${NC}"
else
    echo -e "${RED}Error: Signal Desktop database not found${NC}"
    echo "Checked:"
    echo "  - $HOME_DIR/.var/app/org.signal.Signal/config/Signal/sql/db.sqlite"
    echo "  - $HOME_DIR/.config/Signal/sql/db.sqlite"
    exit 1
fi

# Check for sqlcipher (prefer our built version)
if [ -x "/tmp/sqlcipher-build/sqlcipher/sqlite3" ]; then
    SQLCIPHER="/tmp/sqlcipher-build/sqlcipher/sqlite3"
    echo -e "${GREEN}Using built sqlcipher 4${NC}"
elif command -v sqlcipher &> /dev/null; then
    SQLCIPHER="sqlcipher"
    echo -e "${YELLOW}Warning: Using system sqlcipher (may not work with SQLCipher 4 databases)${NC}"
else
    echo -e "${RED}Error: sqlcipher not found${NC}"
    echo "Please build sqlcipher from source or install it"
    exit 1
fi

# Get encryption key
if [ ! -f "$SIGNAL_CONFIG" ]; then
    echo -e "${RED}Error: Signal Desktop config not found at $SIGNAL_CONFIG${NC}"
    exit 1
fi

SIGNAL_KEY=$(cat "$SIGNAL_CONFIG" | grep -o '"key": "[^"]*"' | cut -d'"' -f4)
if [ -z "$SIGNAL_KEY" ]; then
    echo -e "${RED}Error: Could not find encryption key in config.json${NC}"
    exit 1
fi

echo "Database: $SIGNAL_DB"
echo "Key: ${SIGNAL_KEY:0:8}..."

# Output path
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
OUTPUT_DIR="$REPO_ROOT/.claude/messages/signal-desktop"
OUTPUT_DB="$OUTPUT_DIR/decrypted.sqlite"

mkdir -p "$OUTPUT_DIR"

# Remove old export if it exists
if [ -f "$OUTPUT_DB" ]; then
    echo "Removing old export..."
    rm -f "$OUTPUT_DB"
fi

echo ""
echo "Exporting to: $OUTPUT_DB"
echo ""

# Export database
$SQLCIPHER "$SIGNAL_DB" <<EOF
PRAGMA key = "x'$SIGNAL_KEY'";
ATTACH DATABASE '$OUTPUT_DB' AS plaintext KEY '';
SELECT sqlcipher_export('plaintext');
DETACH DATABASE plaintext;
EOF

if [ $? -eq 0 ]; then
    SIZE=$(ls -lh "$OUTPUT_DB" | awk '{print $5}')
    echo -e "${GREEN}✓ Export complete!${NC}"
    echo "  Output: $OUTPUT_DB"
    echo "  Size: $SIZE"

    # Count messages
    MSG_COUNT=$(sqlite3 "$OUTPUT_DB" "SELECT COUNT(*) FROM messages;")
    CONV_COUNT=$(sqlite3 "$OUTPUT_DB" "SELECT COUNT(*) FROM conversations;")
    echo "  Messages: $MSG_COUNT"
    echo "  Conversations: $CONV_COUNT"

    echo ""
    echo "Next steps:"
    echo "  bun src/cli.ts signal-desktop --dry-run  # Preview import"
    echo "  bun src/cli.ts signal-desktop            # Import all messages"
else
    echo -e "${RED}Export failed${NC}"
    exit 1
fi
