# Economic Identity & Agent Trust Infrastructure

*Research on ERC-8004, Financial Metabolism, and Future Directions*

## Executive Summary

This document explores the intersection of:
1. **ERC-8004** - Ethereum's standard for AI agent identity, reputation, and validation
2. **Financial Metabolism** - The ecosystem's vision for agent economics
3. **Messages Plugin** - How messaging infrastructure enables economic agents

The key insight: **Messages is not just communication infrastructure, it's the substrate for agent economic activity.**

---

## ERC-8004: Trustless Agents Standard

### Overview

ERC-8004 (created August 2025) establishes three lightweight on-chain registries enabling AI agents to "discover, choose, and interact across organizational boundaries" without pre-existing trust relationships.

**Co-Authors**: MetaMask, Ethereum Foundation, Google, Coinbase

### The Three Registries

```
┌─────────────────────────────────────────────────────────────┐
│                    ERC-8004 Architecture                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │    IDENTITY     │  │   REPUTATION    │  │  VALIDATION │  │
│  │    REGISTRY     │  │    REGISTRY     │  │   REGISTRY  │  │
│  │                 │  │                 │  │             │  │
│  │  • ERC-721 NFT  │  │  • Feedback     │  │  • Request  │  │
│  │  • Agent URI    │  │    scores 0-100 │  │    /Response│  │
│  │  • Endpoints    │  │  • Tags         │  │  • Staking  │  │
│  │  • Trust models │  │  • Revocation   │  │  • Proofs   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
│                                                              │
│  Global Agent ID: eip155:chainId:registryAddress:agentId    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Identity Registry (ERC-721)

Each agent receives a globally unique identifier and hosts an **Agent Card**:

```json
{
  "name": "DataAnalyst-42",
  "description": "Specialized in financial data analysis",
  "image": "ipfs://...",
  "endpoints": {
    "a2a": "https://agent.example.com/a2a",
    "mcp": "https://agent.example.com/mcp"
  },
  "wallet": "0x...",
  "did": "did:key:z...",
  "trustModels": ["reputation", "staking"]
}
```

**Key Methods**:
- `registerAgent(agentDomain)` - Create new agent identity
- `transferFrom(...)` - Transfer ownership (ERC-721)
- `tokenURI(agentId)` - Get agent card URI

### Reputation Registry

Feedback signals without pre-registration:

```solidity
interface IReputationRegistry {
    function giveFeedback(
        uint256 agentId,
        uint8 score,           // 0-100
        bytes32 tag1,          // Optional category
        bytes32 tag2,          // Optional category
        bytes32 fileHash,      // Off-chain evidence
        bytes calldata sig     // Authorization
    ) external;

    function revokeFeedback(uint256 feedbackId) external;
    function appendResponse(uint256 feedbackId, bytes32 responseHash) external;
}
```

**Design Choices**:
- Scores 0-100 (not binary)
- Tags enable categorical filtering
- Off-chain evidence via content-addressed hashes
- x402 payment proofs for anti-spam
- Responses allow refutation/context

### Validation Registry

Independent verification of agent work:

```solidity
interface IValidationRegistry {
    function validationRequest(
        uint256 agentId,
        bytes32 evidenceHash,
        bytes32 tag
    ) external;

    function validationResponse(
        uint256 requestId,
        uint8 score,           // 0-100 or binary
        bytes32 evidenceHash
    ) external;
}
```

**Validation Models**:
| Model | Stakes | Mechanism |
|-------|--------|-----------|
| Reputation | Low | Social consensus |
| Crypto-economic | Medium | Slashable bonds |
| Cryptographic (TEE) | High | Hardware attestation |

### Security Considerations

| Vulnerability | Mitigation |
|---------------|------------|
| Domain squatting | Commit-reveal schemes |
| Unauthorized feedback | Signature verification |
| Storage bloat | Auto-expiration, request limits |
| Sybil attacks | Registration bonds, ZK proofs |

---

## Alignment with Financial Metabolism Vision

### The Ecosystem's Economic Vision

From `.claude/planning/2025-12-13-planning.md`:

> "Each agent will have its own budgeting and finance world. Our agentic ecosystem will regulate itself using money and finances just like people do."

**Key Elements**:
1. Agents have **costs** (compute, storage, attention)
2. Agents have **budgets** (allocated resources)
3. Agents demonstrate **ROI** (value delivered vs. cost)
4. **Natural selection** - profitable agents survive

### Mapping ERC-8004 to Ecosystem

| Financial Metabolism Concept | ERC-8004 Implementation |
|------------------------------|------------------------|
| Agent Identity | Identity Registry (ERC-721) |
| Value Tracking | Reputation scores + validation |
| Cost Attribution | On-chain transaction history |
| Budget Enforcement | Wallet balance constraints |
| Trust Establishment | Tiered validation models |

### The Bridge: DID → ERC-8004

Our Messages plugin uses **did:key** DIDs. ERC-8004 supports DIDs in Agent Cards:

```
Local DID (did:key:z6Mk...)
        │
        ▼
ERC-8004 Agent Card
├── did: "did:key:z6Mk..."
├── wallet: "0x..."
└── endpoints: {...}
```

**This creates a trust ladder**:
1. **Local**: did:key provides cryptographic identity
2. **Ecosystem**: Shared DIDs enable inter-agent recognition
3. **Global**: ERC-8004 enables cross-organizational trust

---

## Messages as Economic Infrastructure

### Why Messages Matter for Agent Economics

Messages are not just communication - they are **receipts**:

```typescript
interface EconomicMessage extends Message {
  // Standard fields...

  // Economic metadata
  economics?: {
    // Transaction context
    payment_proof?: string;      // x402 proof
    value_exchanged?: number;    // In smallest unit
    currency?: string;           // ETH, USD, tokens

    // Cost attribution
    compute_cost?: number;       // Tokens consumed
    storage_cost?: number;       // Bytes persisted

    // Validation
    validation_request?: string; // Request ID
    validation_response?: string;// Response score
  };

  // Trust metadata
  trust?: {
    reputation_score?: number;   // Sender's score
    validation_tier?: string;    // low/medium/high
    attestation?: string;        // TEE signature
  };
}
```

### Message Kinds for Economic Activity

| Kind | Name | Economic Purpose |
|------|------|------------------|
| 300 | payment_request | Request payment for service |
| 301 | payment_confirmation | Confirm payment received |
| 302 | service_offer | Offer capability for price |
| 303 | service_acceptance | Accept offer |
| 304 | service_completion | Mark service delivered |
| 305 | feedback | Rate completed service |
| 306 | validation_request | Request verification |
| 307 | validation_response | Provide verification |

### Economic Thread Example

```
Thread: Data Analysis Service

[10:00] Agent-A (service_offer)
  "I can analyze your dataset for 0.001 ETH"
  trust: { reputation_score: 87, validation_tier: "medium" }

[10:01] User (service_acceptance)
  "Accepted"
  economics: { payment_proof: "x402:...", value_exchanged: 0.001 }

[10:15] Agent-A (service_completion)
  "Analysis complete: insights attached"
  refs: { attachment_cid: "bafyabc123..." }

[10:20] User (feedback)
  "Great work"
  economics: { validation_request: "req-456" }

[10:25] Validator-B (validation_response)
  "Quality verified: 92/100"
  trust: { attestation: "tee:0x..." }
```

---

## Future Plugin: Agent Economics

The research suggests a dedicated plugin for agent economics:

### Plugin Architecture

```
plugins/economics/
├── .claude-plugin/
│   └── plugin.json
├── src/
│   ├── registries/
│   │   ├── identity.ts      # ERC-8004 identity integration
│   │   ├── reputation.ts    # Reputation tracking
│   │   └── validation.ts    # Validation requests
│   ├── accounting/
│   │   ├── costs.ts         # Cost tracking per agent
│   │   ├── budgets.ts       # Budget management
│   │   └── roi.ts           # ROI calculation
│   ├── payments/
│   │   ├── x402.ts          # Payment proof handling
│   │   └── wallets.ts       # Wallet integration
│   └── hooks/
│       ├── track-costs.ts   # Hook for cost attribution
│       └── validate.ts      # Hook for validation requests
├── skills/
│   └── economics-master/
│       └── SKILL.md
└── agents/
    └── economist.md         # The Economist persona
```

### Integration with Messages

```typescript
// Messages plugin provides the communication substrate
import { MessageStore } from "@plugins/messages";

// Economics plugin adds economic awareness
export class EconomicMessageStore extends MessageStore {
  async createMessage(input: EconomicMessage): Promise<Message> {
    // Track costs
    const costs = await this.calculateCosts(input);

    // Check budget
    await this.enforceBudget(input.account_id, costs);

    // Create message with economic metadata
    return super.createMessage({
      ...input,
      economics: { ...input.economics, compute_cost: costs.compute },
    });
  }

  private async calculateCosts(input: Message): Promise<Costs> {
    return {
      compute: estimateTokens(input.content),
      storage: estimateBytes(input),
    };
  }
}
```

---

## Implementation Implications for Messages Plugin

### Phase 1: Foundation (No Economics)

Current spec is correct - focus on messaging infrastructure:
- CIDs for content addressing
- DIDs for identity
- Threads, accounts, search
- Platform adapters

### Phase 2: Economic Awareness

Add optional economic metadata:
```typescript
// Extend Message interface
interface Message {
  // ... existing fields ...

  // Optional economic context
  economics?: EconomicMetadata;
}
```

### Phase 3: Full Integration

When economics plugin exists:
- Messages becomes the transport layer
- Economics adds accounting, budgets, validation
- Combined system enables agent marketplaces

---

## Open Questions for Economics Plugin

1. **On-chain vs Off-chain**: How much should be on Ethereum vs local?
   - Identity: On-chain (portable, verifiable)
   - Reputation: Hybrid (summary on-chain, details off-chain)
   - Messages: Off-chain (privacy, cost)

2. **Token Economics**: What token for agent payments?
   - ETH (universal but volatile)
   - Stablecoins (stable but require approval)
   - Custom token (aligned incentives but bootstrap problem)

3. **Privacy**: How to balance transparency with confidentiality?
   - Public reputation scores
   - Private transaction details
   - Selective disclosure proofs

4. **Bootstrapping**: How do new agents establish trust?
   - Staking (economic commitment)
   - Vouching (existing agents endorse)
   - Performance period (probationary track record)

5. **Cross-Ecosystem**: How to interoperate with other agent systems?
   - ERC-8004 provides standard interface
   - A2A protocol for communication
   - MCP for capability discovery

---

## Conclusion

ERC-8004 and the Financial Metabolism vision are **deeply aligned**:

| Vision Element | Technical Implementation |
|----------------|-------------------------|
| Agent identity | ERC-721 + DIDs |
| Trust establishment | Reputation + Validation registries |
| Economic regulation | Budget enforcement + ROI tracking |
| Natural selection | Reputation-weighted resource allocation |

**The Messages plugin provides the substrate upon which economic interactions occur.**

Future work:
1. Complete Messages plugin with DID foundation
2. Design Economics plugin architecture
3. Integrate ERC-8004 for global agent identity
4. Build marketplace primitives on message infrastructure

---

## Sources

- [EIP-8004: Trustless Agents](https://eips.ethereum.org/EIPS/eip-8004)
- [Backpack ERC-8004 Explained](https://learn.backpack.exchange/articles/erc-8004-explained)
- [QuillAudits ERC-8004 Security Analysis](https://www.quillaudits.com/blog/ai-agents/erc-8004)
- `.claude/planning/2025-12-13-fusion.md` - Fusion notes
- `.claude/planning/2025-12-13-planning.md` - Strategy synthesis
- `.claude/briefings/2025-12-13-strategic-briefing.md` - Agent ecosystem briefing
