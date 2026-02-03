---
name: popos
description: Pop!_OS distribution layer - System76's Ubuntu-based distro with COSMIC DE, Pop Shell tiling, apt/flatpak packages, and systemd services.
allowed-tools: Bash, Read, Glob
---

# Pop!_OS Layer

Pop!_OS is System76's Ubuntu-based Linux distribution. It provides the highest layer of system software, including package management, desktop environment, and system services.

## Detection

```bash
# Identify Pop!_OS
cat /etc/os-release

# Specifically check for Pop
grep -i pop /etc/os-release

# Pop version
cat /etc/pop-os/os-release 2>/dev/null || cat /etc/os-release | grep VERSION
```

## System Information

```bash
# Full system info
hostnamectl

# Pop-specific
cat /etc/pop-os/os-release 2>/dev/null

# Hardware (System76)
cat /sys/class/dmi/id/sys_vendor 2>/dev/null
cat /sys/class/dmi/id/product_name 2>/dev/null
```

## Package Management

### APT (Debian/Ubuntu packages)

```bash
# List installed packages
apt list --installed 2>/dev/null | head -30

# Search packages
apt search keyword 2>/dev/null | head -20

# Show package info
apt show package-name 2>/dev/null

# Check for updates (don't run apt update in Claude)
apt list --upgradable 2>/dev/null | head -20
```

### Flatpak

```bash
# List installed flatpaks
flatpak list 2>/dev/null | head -20

# List remotes
flatpak remotes 2>/dev/null

# Show app info
flatpak info com.app.Name 2>/dev/null
```

### System76 Packages

```bash
# System76 specific packages
dpkg -l | grep system76 | head -10

# System76 driver
dpkg -l | grep system76-driver

# Firmware daemon
dpkg -l | grep firmware-manager
```

## COSMIC Desktop Environment

```bash
# Check for COSMIC
echo "XDG_CURRENT_DESKTOP: $XDG_CURRENT_DESKTOP"
echo "DESKTOP_SESSION: $DESKTOP_SESSION"

# COSMIC settings directory
ls ~/.config/cosmic/ 2>/dev/null | head -20

# COSMIC components
dpkg -l | grep cosmic 2>/dev/null | head -10
```

### Pop Shell (Tiling)

```bash
# Check if Pop Shell is active
gnome-extensions list 2>/dev/null | grep pop-shell

# Pop Shell settings
dconf dump /org/gnome/shell/extensions/pop-shell/ 2>/dev/null | head -30

# Or gsettings
gsettings list-recursively org.gnome.shell.extensions.pop-shell 2>/dev/null | head -20
```

## Systemd Services

```bash
# List running services
systemctl list-units --type=service --state=running | head -20

# List all services
systemctl list-unit-files --type=service | head -30

# Check specific service
systemctl status gdm 2>/dev/null | head -15
systemctl status NetworkManager 2>/dev/null | head -15
```

### User Services

```bash
# User-level services
systemctl --user list-units --type=service --state=running | head -15

# User service directory
ls ~/.config/systemd/user/ 2>/dev/null
```

### System Targets

```bash
# Current target (runlevel equivalent)
systemctl get-default

# List targets
systemctl list-units --type=target
```

## Display Server

```bash
# X11 or Wayland?
echo "XDG_SESSION_TYPE: $XDG_SESSION_TYPE"
echo "WAYLAND_DISPLAY: $WAYLAND_DISPLAY"
echo "DISPLAY: $DISPLAY"

# Check which is running
if [[ -n "$WAYLAND_DISPLAY" ]]; then
  echo "Running on Wayland"
elif [[ -n "$DISPLAY" ]]; then
  echo "Running on X11"
fi
```

## GNOME Settings (Pop uses GNOME-based stack)

```bash
# GNOME version
gnome-shell --version 2>/dev/null

# Desktop settings
gsettings list-schemas | grep -E "^org.gnome" | head -10

# Specific setting
gsettings get org.gnome.desktop.interface color-scheme 2>/dev/null
gsettings get org.gnome.desktop.interface gtk-theme 2>/dev/null
```

## Hardware Support

### System76 Firmware

```bash
# Firmware manager
dpkg -l | grep firmware-manager

# Check firmware versions
system76-firmware-cli schedule 2>/dev/null | head -10
```

### Power Management

```bash
# Power profiles
powerprofilesctl list 2>/dev/null

# Current profile
powerprofilesctl get 2>/dev/null

# System76 power
system76-power profile 2>/dev/null
```

### Graphics

```bash
# GPU info
lspci | grep -E "VGA|3D"

# NVIDIA (if present)
nvidia-smi 2>/dev/null | head -20

# Graphics switching (hybrid laptops)
system76-power graphics 2>/dev/null
```

## File System

```bash
# Disk layout (Pop often uses btrfs or ext4)
lsblk -f

# Mount points
mount | grep "^/dev" | head -10

# Pop recovery partition
lsblk | grep recovery
```

## Network Configuration

```bash
# NetworkManager connections
nmcli connection show | head -10

# Current connection
nmcli device status

# WiFi networks
nmcli device wifi list 2>/dev/null | head -10
```

## User Environment

### XDG Directories

```bash
# Standard directories
echo "XDG_CONFIG_HOME: ${XDG_CONFIG_HOME:-~/.config}"
echo "XDG_DATA_HOME: ${XDG_DATA_HOME:-~/.local/share}"
echo "XDG_CACHE_HOME: ${XDG_CACHE_HOME:-~/.cache}"
echo "XDG_RUNTIME_DIR: $XDG_RUNTIME_DIR"
```

### Desktop Entries

```bash
# Application entries
ls ~/.local/share/applications/ 2>/dev/null | head -20

# System applications
ls /usr/share/applications/ | head -30
```

## Pop!_OS Specific Features

### Pop Shop

```bash
# Pop Shop (eddy) installed apps
ls ~/.local/share/pop-os/ 2>/dev/null
```

### Keyboard Shortcuts

```bash
# Pop shortcuts
gsettings list-recursively org.gnome.shell.extensions.pop-shell 2>/dev/null | grep -i key | head -20

# System shortcuts
gsettings list-recursively org.gnome.desktop.wm.keybindings 2>/dev/null | head -20
```

### Auto-tiling

```bash
# Check if auto-tiling is enabled
gsettings get org.gnome.shell.extensions.pop-shell tile-by-default 2>/dev/null
```

## Logs

```bash
# System logs
journalctl -b -p err 2>/dev/null | tail -20

# User session logs
journalctl --user -b 2>/dev/null | tail -20

# Specific service
journalctl -u gdm 2>/dev/null | tail -15
```

## Updates and Recovery

```bash
# Check for updates
apt list --upgradable 2>/dev/null | wc -l

# Recovery partition
ls /recovery/ 2>/dev/null | head -10

# Refresh install possible?
pop-upgrade status 2>/dev/null
```

## Integration Patterns

### Check Pop Environment
```bash
# Full Pop context
echo "=== Pop!_OS Environment ==="
cat /etc/os-release | grep -E "^(NAME|VERSION|ID)"
echo "Desktop: $XDG_CURRENT_DESKTOP"
echo "Session: $XDG_SESSION_TYPE"
echo "Display: ${WAYLAND_DISPLAY:-$DISPLAY}"
```

### Work with Pop Features
```bash
# Adjust tiling
gsettings set org.gnome.shell.extensions.pop-shell tile-by-default true

# Check power profile
system76-power profile 2>/dev/null || powerprofilesctl get 2>/dev/null
```

## Safety Considerations

- Don't run `apt upgrade` without user consent
- Changing gsettings affects user's desktop
- systemctl operations require caution
- firmware updates require user authorization

## Relationship to Other Layers

- **Claude Code**: Runs on Pop!_OS userspace
- **tmux/nvim/fish/alacritty**: Installed via apt/flatpak
- **Kernel**: Pop ships specific kernel version
- **Hardware**: System76 hardware has special support
