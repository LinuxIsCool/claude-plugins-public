---
sidebar_position: 1
title: Installation
description: Install KG Explorer and its dependencies
keywords: [installation, setup, docker, npm, falkordb, graphiti]
---

# Installation

KG Explorer requires a graph database backend and several supporting services. This guide walks through the complete installation process.

## Prerequisites

Before installing KG Explorer, ensure you have:

- **Node.js** >= 18.0
- **Docker** and Docker Compose (for FalkorDB)
- **Python** >= 3.10 (for Graphiti ingestion)
- An **OpenAI API key** (for entity extraction)

## Quick Install

```bash
# Clone the repository
git clone https://github.com/your-org/kg-explorer.git
cd kg-explorer

# Install dependencies
npm install

# Start infrastructure
docker compose up -d

# Run the application
npm run dev
```

## Detailed Installation

### 1. Graph Database (FalkorDB)

```bash
docker run -d \
  --name kg-explorer-falkordb \
  -p 6379:6379 \
  -v falkordb-data:/data \
  falkordb/falkordb:latest
```

### 2. Graphiti (Knowledge Layer)

```bash
pip install graphiti-core
```

### 3. KG Explorer Application

```bash
cd apps/kg-explorer
npm install
cp .env.example .env
```

### 4. Environment Configuration

```bash
FALKORDB_HOST=localhost
FALKORDB_PORT=6379
GRAPHITI_LLM_MODEL=gpt-4o-mini
OPENAI_API_KEY=sk-your-key-here
```

## Verify Installation

```bash
npm run verify-install
```

## Next Steps

- [Quick Start](./quick-start) - Create your first knowledge graph
- [First Query](./first-query) - Write and execute graph queries
