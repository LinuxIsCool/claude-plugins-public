---
name: daos-dunas
description: "DAOs, DUNAs, UNAs, legal wrappers, on-chain governance, token securities implications. Use for Web3 entity structures, decentralized organizations, and blockchain governance."
---

# DAOs and DUNAs

Decentralized Autonomous Organizations and their legal structures, including wrappers, governance mechanisms, and Canadian implications.

## Entity Overview

| Aspect | Traditional DAO | Wrapped DAO |
|--------|-----------------|-------------|
| **Legal Status** | Often none (unincorporated) | Legal entity exists |
| **Liability** | Potentially unlimited for participants | Limited (depends on wrapper) |
| **Taxation** | Uncertain, potentially personal | Entity-level taxation |
| **Governance** | On-chain, token-based | Hybrid (on-chain + legal) |
| **Enforceability** | Smart contracts only | Legal + smart contracts |

## DAO Fundamentals

### What is a DAO?

A Decentralized Autonomous Organization is:
- Coordination mechanism using blockchain
- Token-based governance
- Smart contract-executed decisions
- No traditional management hierarchy
- Global, permissionless participation (often)

### Core Components

**Governance Token**: Represents voting power
**Smart Contracts**: Encode rules and execute decisions
**Treasury**: Shared pool of assets (often crypto)
**Proposals**: Mechanisms for suggesting changes
**Voting**: Token-weighted or alternative mechanisms

### Common DAO Types

**Protocol DAOs**: Govern blockchain protocols (e.g., Uniswap, Aave)
**Investment DAOs**: Pool capital for investments
**Service DAOs**: Provide services, share revenue
**Social DAOs**: Community coordination
**Collector DAOs**: Collective ownership (NFTs, art)

## The Legal Wrapper Problem

### Why Wrapping Matters

Without legal wrapper, a DAO may be:
- General partnership by default (unlimited liability)
- Unable to sign contracts
- Unable to hold non-crypto assets
- Subject to securities law violations
- Taxable directly to participants

### Legal Wrapper Options

**1. Unincorporated Nonprofit Association (UNA)**
- Low formality
- Limited liability in some jurisdictions
- Wyoming, Nevada, Tennessee have DAO-specific UNA laws

**2. Limited Liability Company (LLC)**
- Wyoming DAO LLC popular
- Algorithmically managed
- Operating agreement can defer to smart contracts
- US-based, may have Canadian implications

**3. Foundation (Cayman, Switzerland, Panama)**
- No members/shareholders
- Council governs
- Often used by major protocols
- Expensive, offshore

**4. Cooperative**
- Democratic governance aligns with DAO ethos
- Member-owned
- Canadian cooperatives possible (see cooperatives.md)

**5. Trust Structure**
- Purpose trust in some jurisdictions
- Trustees execute DAO decisions
- Complex but flexible

## [US] Wyoming DAO LLC

Most established DAO legal framework.

### Key Features

- Recognized legal entity
- Limited liability for members
- Can be "algorithmically managed"
- Operating agreement can reference smart contracts
- Must have registered agent in Wyoming
- Annual report required

### Governance Options

**Member-Managed**: Token holders vote directly
**Algorithmically Managed**: Smart contracts make operational decisions
**Manager-Managed**: Designated managers with DAO oversight

### Canadian Implications

Wyoming DAO LLC can:
- Contract with Canadian parties
- Hold Canadian assets (with complexity)
- NOT directly provide Canadian tax benefits

Canadian participants may:
- Be taxable on DAO income
- Have foreign reporting obligations (T1135 if >$100k)
- Face CFA/FAPI rules if corporation-equivalent

## Decentralized Unincorporated Nonprofit Associations (DUNAs)

Wyoming (2024) introduced DUNA statute specifically for nonprofits.

### Key Features

- Nonprofit purposes
- Decentralized governance
- Smart contract integration
- Limited liability
- Can own property and contract

### Compared to UNA

| Aspect | Traditional UNA | DUNA |
|--------|-----------------|------|
| For-profit activities | Limited | No |
| DAO-native design | No | Yes |
| Smart contract integration | Informal | Explicit |
| Liability protection | Varies | Explicit |

## Canadian Context

### Current Landscape

Canada has NO DAO-specific legislation.

**Options for Canadian DAOs**:
1. Use foreign wrapper (Wyoming, Cayman)
2. Structure as Canadian corporation with DAO governance layer
3. Use cooperative structure
4. Operate as unincorporated (risky)

### Canadian Corporation with DAO Layer

**Structure**:
- BC or Federal corporation
- Shareholders are DAO token holders (or representative)
- Shareholder agreement references on-chain governance
- Directors execute decisions voted on-chain

**Challenges**:
- Securities law compliance for token distribution
- Maintaining CCPC status with global token holders
- Reconciling on-chain votes with corporate law requirements

### Securities Law Considerations

**Key Question**: Is the DAO token a security?

Under Canadian securities law, likely YES if:
- Investment of money
- In common enterprise
- Expectation of profits
- From efforts of others

Most governance tokens likely securities in Canada.

**Implications**:
- Prospectus exemption required for distribution
- Resale restrictions
- Potential registration requirements
- Accredited investor exemptions may help

### Tax Treatment

**For Canadian Residents Participating in DAOs**:

**Token Receipt**: May be income if compensation for services
**Token Staking/Yield**: Likely income when received
**Token Sale**: Capital gain or loss (50% inclusion)
**DAO Income Allocation**: Depends on DAO structure, may be taxable

**For DAOs with Canadian Activities**:
- May create Canadian permanent establishment
- Could be taxable in Canada on Canadian-source income

## Governance Mechanisms

### Token Voting

**Simple Majority**: >50% of votes cast
**Supermajority**: 66% or higher threshold
**Quorum**: Minimum participation required

### Plutocracy Concerns

Token voting = plutocracy (wealth = power)

**Mitigations**:
- Quadratic voting (cost increases quadratically)
- Conviction voting (time-weighted)
- Delegation (representative democracy)
- Snapshot voting (prevent flash loans)

### Vitalik's Governance Insights

**Exit Rights**: Members can leave with their share
**Credible Neutrality**: Protocol doesn't favor particular parties
**Fork Rights**: Community can fork if governance captured
**Minimal Governance**: Reduce attack surface by minimizing governance scope

### Multi-Sig Implementation

Many DAOs use multi-signature wallets:
- 3-of-5, 4-of-7 configurations common
- Balance security with efficiency
- Signers often publicly known
- Can be combined with on-chain voting (vote triggers multisig execution)

## Token Design

### Governance Token Considerations

**Distribution**:
- Team allocation (with vesting)
- Community treasury
- Airdrops to users
- Liquidity mining
- Investor allocation

**Vesting/Lock-up**:
- Align long-term incentives
- Typical: 4-year vest, 1-year cliff
- Can be enforced via smart contract

**Supply/Inflation**:
- Fixed supply vs inflationary
- Inflation can fund ongoing development
- Must balance with token value

### Token Rights

**Can Include**:
- Voting on proposals
- Fee sharing (revenue distribution)
- Staking rewards
- Access to services
- Governance over treasury

**Securities Risk**:
More rights = more likely a security.
Pure governance with no financial return may be safer.

## Common Scenarios

### Protocol Development DAO

**Structure**: Wyoming DAO LLC or Cayman Foundation
- Token-based governance
- Treasury funds development
- Grants program for contributors
- Progressive decentralization path

### Investment DAO (Canada-focused)

**Challenges**:
- Securities law compliance
- Investment fund regulations
- AML/KYC requirements

**Potential Structure**:
- Limited partnership with token tracking interests
- Accredited investors only
- Exemptive relief may be needed

### Service DAO

**Structure**: Could use Canadian cooperative
- Members are service providers
- Revenue sharing based on contribution
- Democratic governance
- Aligns with cooperative principles

### NFT Collector DAO

**Structure**: Wyoming DAO LLC or UNA
- Pool funds to acquire NFTs
- Fractional ownership via tokens
- Governance over acquisitions
- Exit mechanisms important

## Canadian DAO Checklist

- [ ] Securities law analysis for token
- [ ] Choose legal wrapper (or understand unincorporated risks)
- [ ] Foreign reporting obligations (T1135 if >$100k foreign property)
- [ ] Tax treatment analysis (income vs capital, timing)
- [ ] AML/KYC requirements if financial activities
- [ ] Governance mechanism design
- [ ] Exit/dissolution procedures
- [ ] Insurance considerations
- [ ] Cross-border implications

## Emerging Developments

### Wyoming Innovations

- DAO LLC (2021)
- DUNA (2024)
- Continued development of DAO-friendly law

### Other Jurisdictions

- Tennessee, Nevada following Wyoming
- Switzerland (Canton Zug) friendly to crypto
- Singapore developing frameworks
- Marshall Islands DAO-specific entity (2022)

### Canadian Prospects

- No current DAO legislation
- Canadian Securities Administrators monitoring space
- Cooperative structures may be best current fit
- Stay tuned for regulatory developments

## Disclaimer

DAO structures involve significant legal, regulatory, and tax complexity. This sub-skill provides general guidance only. Consult qualified legal counsel familiar with both crypto/DAO structures and Canadian law before creating or participating in DAOs.
