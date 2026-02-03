---
name: kernel
description: Linux kernel layer - system calls, process management, file descriptors, signals, devices. The boundary between userspace and kernel.
allowed-tools: Bash, Read, Glob
---

# Linux Kernel Layer

The Linux kernel is the core of the operating system. Every operation Claude Code performs eventually becomes a system call to the kernel. Understanding this layer reveals the true capabilities and constraints.

## Detection

```bash
# Kernel version
uname -r

# Full kernel info
uname -a

# Kernel config (if available)
cat /boot/config-$(uname -r) 2>/dev/null | head -20 || \
  zcat /proc/config.gz 2>/dev/null | head -20 || \
  echo "Kernel config not available"
```

## System Calls

System calls are the interface between userspace and kernel:

```bash
# Trace system calls of a command
strace -c ls /tmp 2>&1 | head -30

# See specific syscalls
strace -e open,read,write ls /tmp 2>&1 | head -20

# Count syscalls by type
strace -c -f bash -c "echo hello" 2>&1 | tail -20
```

### Common System Calls
```bash
# What syscalls are available
ausyscall --dump 2>/dev/null | head -30 || \
  cat /usr/include/asm/unistd_64.h 2>/dev/null | head -30
```

Key syscalls:
- `read`, `write` - File I/O
- `open`, `close` - File management
- `fork`, `exec` - Process creation
- `socket`, `connect`, `send`, `recv` - Networking
- `mmap`, `brk` - Memory management
- `ioctl` - Device control

## Process Management

```bash
# Current process info
echo "PID: $$"
echo "PPID: $PPID"
cat /proc/$$/status | head -20

# Process tree
pstree -p $$ 2>/dev/null || ps --forest -p $$

# Process limits
cat /proc/$$/limits

# Process file descriptors
ls -la /proc/$$/fd/ | head -20
```

### Process States
```bash
# See process state
cat /proc/$$/stat | awk '{print "State: " $3}'

# States: R=running, S=sleeping, D=disk sleep, Z=zombie, T=stopped
```

## File Descriptors

Everything is a file in Linux:

```bash
# Standard file descriptors
ls -la /proc/$$/fd/
# 0 = stdin, 1 = stdout, 2 = stderr

# Open file descriptor limit
ulimit -n

# Current FD count
ls /proc/$$/fd | wc -l

# What files are open
lsof -p $$ 2>/dev/null | head -20
```

## Memory

```bash
# System memory
cat /proc/meminfo | head -10

# Process memory
cat /proc/$$/statm

# Memory map
cat /proc/$$/maps | head -20

# Memory usage summary
free -h
```

### Memory Details
```bash
# Detailed memory breakdown
cat /proc/$$/smaps_rollup 2>/dev/null || \
  cat /proc/$$/status | grep -E "^(VmSize|VmRSS|VmData|VmStk)"
```

## Signals

```bash
# Pending signals
cat /proc/$$/status | grep Sig

# List signals
kill -l

# Common signals:
# SIGTERM (15) - Terminate
# SIGKILL (9) - Force kill
# SIGINT (2) - Interrupt (Ctrl+C)
# SIGSTOP (19) - Stop
# SIGCONT (18) - Continue
```

## Devices

```bash
# List block devices
lsblk

# List all devices
ls /dev | head -30

# Character devices
cat /proc/devices | head -20

# PCI devices
lspci | head -10

# USB devices
lsusb | head -10
```

### Device Info
```bash
# Specific device info
udevadm info /dev/sda 2>/dev/null | head -20

# Kernel messages about devices
dmesg | tail -30
```

## Kernel Modules

```bash
# Loaded modules
lsmod | head -20

# Module info
modinfo $(lsmod | awk 'NR==2{print $1}') 2>/dev/null | head -10

# Module parameters
cat /sys/module/*/parameters/* 2>/dev/null | head -20
```

## Virtual Filesystems

### /proc
```bash
# Kernel version
cat /proc/version

# CPU info
cat /proc/cpuinfo | head -20

# Command line
cat /proc/cmdline

# Uptime
cat /proc/uptime
```

### /sys
```bash
# System info
ls /sys/class/

# Block device info
ls /sys/block/

# Power management
cat /sys/power/state 2>/dev/null
```

## Networking (Kernel Level)

```bash
# Network interfaces (kernel)
cat /proc/net/dev | head -10

# TCP connections
cat /proc/net/tcp | head -10

# UDP connections
cat /proc/net/udp | head -10

# Routing table
cat /proc/net/route

# Socket statistics
cat /proc/net/sockstat
```

## Kernel Parameters

```bash
# View kernel parameters
sysctl -a 2>/dev/null | head -30

# Specific parameters
sysctl kernel.hostname
sysctl kernel.osrelease
sysctl vm.swappiness
sysctl net.ipv4.ip_forward
```

## Security Features

```bash
# SELinux status
getenforce 2>/dev/null || echo "SELinux not active"

# AppArmor status
aa-status 2>/dev/null | head -10 || echo "AppArmor status not available"

# Capabilities
cat /proc/$$/status | grep Cap

# Seccomp
cat /proc/$$/status | grep Seccomp
```

## Kernel Logs

```bash
# Recent kernel messages
dmesg | tail -30

# With timestamps
dmesg -T | tail -20

# Follow live
# dmesg -w  # Don't use in Claude - blocks

# Filter by level
dmesg --level=err,warn | tail -20
```

## Resource Limits

```bash
# Process resource limits
ulimit -a

# System-wide limits
cat /proc/sys/kernel/pid_max
cat /proc/sys/fs/file-max
cat /proc/sys/kernel/threads-max
```

## CPU Information

```bash
# CPU details
lscpu

# CPU frequency
cat /proc/cpuinfo | grep "MHz" | head -4

# CPU governor
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor 2>/dev/null
```

## Integration Patterns

### Understand Process Hierarchy
```bash
# How Claude Code relates to kernel
pstree -p $$ 2>/dev/null
# Shows: shell → (possibly tmux) → shell → claude process
```

### Monitor Resource Usage
```bash
# Real-time process stats
cat /proc/$$/stat | awk '{print "utime:"$14" stime:"$15" vsize:"$23" rss:"$24}'
```

### Check Kernel Support
```bash
# Does kernel support feature?
grep CONFIG_FEATURE /boot/config-$(uname -r) 2>/dev/null
```

## Safety Considerations

- Read-only access to /proc and /sys is safe
- Don't write to /proc or /sys without understanding
- Kernel parameters (sysctl) affect whole system
- Some information requires root access

## Relationship to Other Layers

- **Claude Code**: All tools use syscalls
- **tmux/nvim/fish**: All are userspace processes
- **alacritty**: Uses kernel for display (DRM/KMS)
- **Pop!_OS**: Configures kernel via sysctl, modules
