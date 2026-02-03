#!/bin/bash
# =============================================================================
# SENSITIVE DATA HISTORY PURGE SCRIPT
# =============================================================================
# This script removes .claude/messages/ and .claude/logging/ from git history.
#
# WARNING: This rewrites git history! All commit hashes will change.
# Anyone who cloned this repo will need to re-clone after force push.
#
# Run from repository root.
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}  SENSITIVE DATA HISTORY PURGE${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# Pre-flight checks
if [ ! -d ".git" ]; then
    echo -e "${RED}Error: Not in a git repository root${NC}"
    exit 1
fi

if ! command -v git-filter-repo &> /dev/null; then
    echo -e "${RED}Error: git-filter-repo not installed${NC}"
    echo "Install with: pip install git-filter-repo"
    exit 1
fi

# Capture remote URL BEFORE filter-repo removes it
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
if [ -n "$REMOTE_URL" ]; then
    echo -e "${CYAN}Remote URL captured: ${REMOTE_URL}${NC}"
    echo "$REMOTE_URL" > .git/REMOTE_URL_BACKUP
else
    echo -e "${YELLOW}No remote configured${NC}"
fi
echo ""

# Show what will be removed
echo -e "${YELLOW}Paths to be purged from ALL history:${NC}"
echo "  - .claude/messages/"
echo "  - .claude/logging/"
echo ""

# Get current stats
REPO_SIZE=$(du -sh .git | cut -f1)
COMMIT_COUNT=$(git rev-list --count HEAD)
echo -e "Current .git size: ${REPO_SIZE}"
echo -e "Total commits: ${COMMIT_COUNT}"
echo ""

# Safety warning
echo -e "${RED}┌─────────────────────────────────────────────────────────────┐${NC}"
echo -e "${RED}│  ⚠️  WARNING: This operation is IRREVERSIBLE!               │${NC}"
echo -e "${RED}│  • All commit hashes will change                           │${NC}"
echo -e "${RED}│  • You will need to force push after this                  │${NC}"
echo -e "${RED}│  • Anyone with a clone must re-clone                       │${NC}"
echo -e "${RED}│  • git-filter-repo will remove the 'origin' remote         │${NC}"
echo -e "${RED}└─────────────────────────────────────────────────────────────┘${NC}"
echo ""

# Backup recommendation
echo -e "${CYAN}BACKUP RECOMMENDATION:${NC}"
echo "If you want a true backup of the current state (with sensitive data),"
echo "create a tarball BEFORE proceeding:"
echo ""
echo -e "  ${CYAN}tar -czf ../claude-plugins-backup-\$(date +%Y%m%d).tar.gz .git${NC}"
echo ""
echo "Note: Creating a backup branch does NOT preserve original history"
echo "      because git-filter-repo rewrites ALL refs."
echo ""

read -p "Proceed with history purge? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo -e "${YELLOW}Running git-filter-repo...${NC}"
echo ""

# The actual purge command
# --invert-paths means "remove these paths"
# --force allows running in a repo with origin configured
git-filter-repo \
    --invert-paths \
    --path '.claude/messages/' \
    --path '.claude/logging/' \
    --force

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  PURGE COMPLETE${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Show new stats
NEW_REPO_SIZE=$(du -sh .git | cut -f1)
NEW_COMMIT_COUNT=$(git rev-list --count HEAD 2>/dev/null || echo "unknown")
echo -e "New .git size: ${GREEN}${NEW_REPO_SIZE}${NC} (was ${REPO_SIZE})"
echo -e "Total commits: ${NEW_COMMIT_COUNT}"
echo ""

# Restore/show remote URL
echo -e "${YELLOW}NEXT STEPS:${NC}"
echo ""
if [ -n "$REMOTE_URL" ]; then
    echo -e "1. Re-add the remote (it was removed by git-filter-repo):"
    echo -e "   ${CYAN}git remote add origin ${REMOTE_URL}${NC}"
    echo ""
    echo -e "2. Force push to overwrite remote history:"
    echo -e "   ${CYAN}git push --force origin main${NC}"
else
    echo -e "1. Add your remote and force push"
fi
echo ""

echo -e "${YELLOW}GITHUB CACHE WARNING:${NC}"
echo "Even after force push, GitHub may still cache sensitive data in:"
echo "  • Pull request diffs"
echo "  • Cached API responses"
echo "  • Forks of your repository"
echo ""
echo "For truly sensitive data, contact GitHub support to request a cache purge:"
echo "  https://support.github.com/contact"
echo ""
echo "Also consider: Settings → Actions → Caches (if applicable)"
echo ""

echo -e "${RED}IMPORTANT: Anyone who previously cloned this repo must:${NC}"
echo "  1. Delete their local clone"
echo "  2. Re-clone from scratch"
echo ""
echo "If they try to pull, they'll get merge conflicts due to rewritten history."
