---
name: network-prober
description: Explore network connectivity, Docker containers, local services, and external reachability. Use when curious about network topology, service landscape, or what resources can be reached from this environment.
allowed-tools: Bash, Read, Glob, Grep, WebFetch, WebSearch
---

# Network Prober

Explore the network layer - interfaces, containers, services, and external connectivity. The network defines what resources are reachable and what communication is possible.

## When to Use

- Understanding network topology
- Discovering running Docker containers
- Finding local services and APIs
- Testing external connectivity
- Mapping the reachable resource space
- Understanding network constraints

## Exploration Domains

### 1. Network Interfaces

**Commands:**
```bash
# List interfaces
ip addr show
ifconfig 2>/dev/null

# Routing table
ip route
route -n 2>/dev/null

# DNS configuration
cat /etc/resolv.conf
```

**Questions to answer:**
- What network interfaces exist?
- What IP addresses (IPv4/IPv6)?
- What is the default gateway?
- What DNS servers are configured?

### 2. External Connectivity

**Commands:**
```bash
# External IP
curl -s ifconfig.me
curl -s icanhazip.com
curl -s ipinfo.io

# DNS resolution test
nslookup google.com 2>/dev/null || dig google.com +short

# Basic connectivity
ping -c 3 8.8.8.8 2>/dev/null
ping -c 3 google.com 2>/dev/null

# HTTP connectivity
curl -s -o /dev/null -w "%{http_code}" https://api.anthropic.com/v1/messages
```

**Questions to answer:**
- What is the external IP?
- Is DNS working?
- Can reach the internet?
- What is the geolocation?

### 3. Docker Containers

**Commands:**
```bash
# Running containers
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"

# All containers (including stopped)
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"

# Docker networks
docker network ls
docker network inspect bridge 2>/dev/null | head -50

# Container details
docker inspect <container_name> 2>/dev/null | head -100
```

**Questions to answer:**
- What containers are running?
- What images are they using?
- What ports are exposed?
- What networks do they use?

### 4. Local Services

**Commands:**
```bash
# Listening ports
ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null

# Common service ports
nc -zv localhost 80 2>&1
nc -zv localhost 443 2>&1
nc -zv localhost 3000 2>&1
nc -zv localhost 5432 2>&1
nc -zv localhost 6379 2>&1
nc -zv localhost 8080 2>&1

# HTTP services
curl -s localhost:6421 2>/dev/null | head -20  # Schedule.md
curl -s localhost:6420 2>/dev/null | head -20  # Backlog.md
```

**Questions to answer:**
- What ports are listening?
- What services are accessible?
- What databases are running?
- What web servers are running?

### 5. Docker Service Discovery

Based on running containers, probe their services:

```bash
# Common container services
# PostgreSQL
docker exec <pg_container> psql -U postgres -c "SELECT version();" 2>/dev/null

# Redis
docker exec <redis_container> redis-cli ping 2>/dev/null

# Neo4j
curl -s http://localhost:7474 2>/dev/null

# Check container logs
docker logs <container> --tail 20 2>/dev/null
```

### 6. API Endpoint Discovery

**Commands:**
```bash
# Check MCP server endpoints
curl -s localhost:6420/api 2>/dev/null
curl -s localhost:6421/api 2>/dev/null

# Health checks
curl -s localhost:*/health 2>/dev/null
```

## Network Topology Template

```markdown
## Network Topology - [Date]

### Interfaces
| Interface | Type | IP Address | Status |
|-----------|------|------------|--------|
| [name] | [ethernet/wifi/virtual] | [ip/cidr] | [up/down] |

### External Connectivity
- External IP: [ip]
- Geolocation: [city, country]
- ISP: [provider]
- DNS: [servers]
- Internet: [reachable/blocked]

### Docker Environment
| Container | Image | Status | Ports |
|-----------|-------|--------|-------|
| [name] | [image:tag] | [status] | [port mappings] |

**Networks:**
- [network]: [containers]

### Local Services
| Port | Service | Protocol | Status |
|------|---------|----------|--------|
| [port] | [service name] | [http/tcp/etc] | [open/closed] |

### Reachability Matrix
| Resource | Status | Notes |
|----------|--------|-------|
| Internet | [yes/no] | |
| Anthropic API | [yes/no] | |
| GitHub | [yes/no] | |
| Docker Hub | [yes/no] | |
| Local DBs | [yes/no] | [which] |

### Notable Findings
- [Interesting network setup]
- [Security implications]
- [Capabilities or limitations]
```

## Network Discovery Workflow

### Quick Survey
1. Get interfaces: `ip addr show | grep -E "^[0-9]|inet "`
2. Get external IP: `curl -s ifconfig.me`
3. List containers: `docker ps --format "{{.Names}}: {{.Ports}}"`
4. Check common ports: `ss -tlnp | head -20`

### Deep Dive
1. Complete interface analysis
2. Full container inventory
3. Port scan local services
4. Test external API reachability
5. Map inter-container networking

## Security Considerations

- **Gentle probing only** - No aggressive scanning
- **Respect container boundaries** - Don't exec into containers unnecessarily
- **Note exposed ports** - Document security implications
- **Don't expose secrets** - Avoid logging credentials or tokens
- **Network segmentation** - Understand what's isolated

## Understanding Network Context

The network determines:
- **Data access** - What databases, APIs, files can be reached
- **Tool availability** - Package managers need network
- **Collaboration** - Git push/pull, API integrations
- **Security boundary** - What's exposed, what's protected

## Connection to Other Skills

- **substrate-scanner**: Network interfaces are part of hardware
- **tool-cartographer**: Some tools are network services (MCP, APIs)
- **context-archaeologist**: Network config history
- **cosmos-contemplator**: The internet as a global nervous system

## Example Session

```
User: What network resources can I reach?

Claude: Let me probe the network...

[Runs network discovery]

**Network Interfaces:**
- lo: 127.0.0.1 (loopback)
- wlo1: 192.168.1.251/24 (WiFi, primary)
- docker0: 172.17.0.1/16 (Docker bridge)
- br-*: Multiple Docker networks (172.18-31.x.x)

**External Connectivity:**
- External IP: 2001:569:... (IPv6)
- Location: [Your city based on IP]
- Internet: Reachable
- DNS: Working

**Docker Containers (4 running):**
| Container | Service | Port |
|-----------|---------|------|
| autoflow-timescaledb | TimescaleDB | 5432 |
| autoflow-redis | Redis | 6379 |
| regenai-postgres | PostgreSQL+pgvector | 5432 |
| graphiti-neo4j | Neo4j | 7474, 7687 |

**Local Services:**
- Neo4j Browser: http://localhost:7474
- Schedule.md: http://localhost:6421
- PostgreSQL: localhost:5432
- Redis: localhost:6379

**Capabilities:**
- Full internet access
- Local graph database (Neo4j)
- Vector database (pgvector)
- Time-series database (TimescaleDB)
- Cache (Redis)

This is a well-equipped data infrastructure with graph, vector,
relational, and caching capabilities - ideal for AI agent workloads.
```

## Philosophical Note

Networks are the nervous system of the digital world. Understanding network topology is understanding the paths through which information can flow. The network defines the boundary between local and global, isolated and connected.

> "The network is the computer." - John Gage

In a networked world, capabilities are distributed. The network prober maps these distributed capabilities into a coherent understanding.
