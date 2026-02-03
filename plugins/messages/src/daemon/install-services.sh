#!/bin/bash
# Install Messages Daemon systemd services
#
# This script installs both:
#   - signal-cli-daemon: Real-time Signal sync via TCP
#   - messages-daemon: Unified sync for all platforms
#
# Usage:
#   ./install-services.sh          # Install and start
#   ./install-services.sh --status # Check status
#   ./install-services.sh --stop   # Stop services
#   ./install-services.sh --remove # Remove services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYSTEMD_DIR="$HOME/.config/systemd/user"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

info() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }

status() {
    echo "=== Service Status ==="
    echo ""
    systemctl --user status signal-cli-daemon --no-pager 2>/dev/null || warn "signal-cli-daemon not running"
    echo ""
    systemctl --user status messages-daemon --no-pager 2>/dev/null || warn "messages-daemon not running"
    echo ""
    echo "=== Resource Usage ==="
    ps aux | grep -E "(signal-cli.*daemon|messages.*daemon)" | grep -v grep || echo "No daemon processes found"
}

stop() {
    echo "Stopping services..."
    systemctl --user stop messages-daemon 2>/dev/null && info "messages-daemon stopped" || warn "messages-daemon was not running"
    systemctl --user stop signal-cli-daemon 2>/dev/null && info "signal-cli-daemon stopped" || warn "signal-cli-daemon was not running"

    # Also stop any CLI-started daemons
    pkill -f "messages-daemon.pid" 2>/dev/null || true
    rm -f /tmp/messages-daemon.pid /tmp/messages-daemon.sock 2>/dev/null || true
}

remove() {
    stop
    echo "Removing services..."
    systemctl --user disable messages-daemon 2>/dev/null || true
    systemctl --user disable signal-cli-daemon 2>/dev/null || true
    rm -f "$SYSTEMD_DIR/messages-daemon.service"
    rm -f "$SYSTEMD_DIR/signal-cli-daemon.service"
    systemctl --user daemon-reload
    info "Services removed"
}

install() {
    echo "Installing Messages Daemon services..."
    echo ""

    # Create systemd user directory
    mkdir -p "$SYSTEMD_DIR"

    # Stop any existing processes
    stop 2>/dev/null || true

    # Copy service files
    cp "$SCRIPT_DIR/signal-cli-daemon.service" "$SYSTEMD_DIR/"
    cp "$SCRIPT_DIR/messages-daemon.service" "$SYSTEMD_DIR/"
    info "Service files copied to $SYSTEMD_DIR"

    # Reload systemd
    systemctl --user daemon-reload
    info "systemd configuration reloaded"

    # Enable services (auto-start on login)
    systemctl --user enable signal-cli-daemon
    systemctl --user enable messages-daemon
    info "Services enabled for auto-start"

    # Start signal-cli daemon first
    echo ""
    echo "Starting signal-cli daemon..."
    systemctl --user start signal-cli-daemon

    # Wait for signal-cli to be ready
    echo "Waiting for signal-cli daemon to be ready..."
    for i in {1..10}; do
        if ss -tlnp 2>/dev/null | grep -q 7583; then
            info "signal-cli daemon is listening on port 7583"
            break
        fi
        sleep 1
    done

    # Start messages daemon
    echo ""
    echo "Starting messages daemon..."
    systemctl --user start messages-daemon
    sleep 3

    # Verify
    echo ""
    echo "=== Installation Complete ==="
    echo ""
    if systemctl --user is-active --quiet signal-cli-daemon; then
        info "signal-cli-daemon: running"
    else
        error "signal-cli-daemon: failed to start"
        echo "Check logs: journalctl --user -u signal-cli-daemon -n 50"
    fi

    if systemctl --user is-active --quiet messages-daemon; then
        info "messages-daemon: running"
    else
        error "messages-daemon: failed to start"
        echo "Check logs: journalctl --user -u messages-daemon -n 50"
    fi

    echo ""
    echo "Management commands:"
    echo "  systemctl --user status signal-cli-daemon messages-daemon"
    echo "  journalctl --user -u messages-daemon -f"
    echo "  messages daemon status"
}

case "${1:-}" in
    --status|-s)
        status
        ;;
    --stop)
        stop
        ;;
    --remove|--uninstall)
        remove
        ;;
    --help|-h)
        echo "Usage: $0 [--status|--stop|--remove|--help]"
        echo ""
        echo "Options:"
        echo "  (none)    Install and start services"
        echo "  --status  Show service status"
        echo "  --stop    Stop services"
        echo "  --remove  Remove services"
        ;;
    *)
        install
        ;;
esac
