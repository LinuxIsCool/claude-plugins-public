---
name: taxation-international
description: "Cross-border taxation, tax treaties, transfer pricing, FAPI, foreign tax credits. Use for international tax planning and compliance."
---

# International Taxation

Canadian international tax rules for cross-border operations and investments.

## Core Concepts

### Residence-Based Taxation

**Canadian Residents**: Taxed on worldwide income
**Non-Residents**: Taxed on Canadian-source income only

**Corporate Residence**:
- Incorporated in Canada = resident
- Central management and control in Canada = resident
- Can be resident in multiple jurisdictions (tie-breaker rules apply)

### Source Rules

**Income Source Determination**:
- Employment: Where services performed
- Business: Where business carried on
- Investment: Various rules by type
- Property: Location of property

## Foreign Affiliate Rules

### What is a Foreign Affiliate?

**Definition**: Non-resident corporation where Canadian taxpayer owns:
- At least 1% directly, AND
- At least 10% with related persons

**Controlled Foreign Affiliate (CFA)**: Foreign affiliate where:
- Canadian taxpayers own >50% of votes or value

### FAPI (Foreign Accrual Property Income)

**The Anti-Deferral Rule**: Certain passive income of CFAs is taxed in Canada currently, regardless of whether distributed.

**FAPI Includes**:
- Income from property (interest, dividends, rent, royalties)
- Income from investment business
- Income from non-qualifying businesses
- Capital gains from passive assets

**FAPI Excludes** (Active Business Income):
- Income from active business in affiliate's country
- Income from active business with arm's length parties
- Certain inter-affiliate income

**FAPI Calculation**:
```
Canadian Tax = FAPI × Relevant Tax Factor (currently 1.9)
               × Canadian Shareholder's Participation %
```

**Deductions**:
- Foreign taxes paid reduce FAPI
- "Deductible Loss" from prior years

### Exempt Surplus

**Tax-Free Repatriation**: Dividends from exempt surplus can be received tax-free by Canadian shareholders.

**Exempt Surplus Sources**:
- Active business income earned in treaty countries
- Capital gains on active business assets in treaty countries
- Dividends from other foreign affiliates (subject to rules)

**Exempt Surplus Countries**: Countries with tax treaty or TIEA with Canada

### Taxable Surplus

**Taxable Dividends**: Dividends from taxable surplus are included in income, with foreign tax credit for underlying foreign taxes.

**Taxable Surplus Sources**:
- Active business income in non-treaty countries
- Certain inter-company amounts
- Investment income (after FAPI inclusion)

### Hybrid Surplus

**Post-2018 Rules**: For certain dispositions of shares of foreign affiliates, gains may be treated as hybrid surplus.

## Tax Treaties

### Canada's Treaty Network

Canada has tax treaties with 90+ countries covering:
- Allocation of taxing rights
- Prevention of double taxation
- Reduced withholding rates
- Exchange of information

### Key Treaty Provisions

**Permanent Establishment (PE)**:
- Physical presence threshold for business taxation
- Typically: Fixed place of business, or
- Agent with authority to conclude contracts

**Withholding Tax Reductions**:

| Payment Type | Domestic Rate | Typical Treaty Rate |
|--------------|---------------|---------------------|
| Dividends (portfolio) | 25% | 15% |
| Dividends (substantial) | 25% | 5% |
| Interest | 25% | 0-10% |
| Royalties | 25% | 0-10% |
| Management fees | 25% | 0% (most) |

**Canada-US Tax Treaty** (Most Common):
- Dividends: 5% (>10% ownership), 15% (other)
- Interest: Generally 0%
- Royalties: 0%

### Treaty Shopping Prevention

**Limitation on Benefits (LOB)**: Anti-treaty shopping rules in some treaties (especially Canada-US)

**Principal Purpose Test**: CRA can deny treaty benefits if principal purpose was obtaining benefit

## Transfer Pricing

### The Arm's Length Principle

**Rule**: Transactions between related parties must be priced as if between arm's length parties.

**Section 247**: CRA can adjust transfer prices to arm's length amounts.

### Transfer Pricing Methods

**Traditional Methods**:

1. **Comparable Uncontrolled Price (CUP)**:
   - Compare to identical transactions
   - Most direct but rarely applicable

2. **Resale Price Method**:
   - Start with resale price
   - Deduct appropriate margin
   - Best for distributors

3. **Cost Plus Method**:
   - Start with costs
   - Add appropriate markup
   - Best for manufacturers, service providers

**Transactional Profit Methods**:

4. **Transactional Net Margin Method (TNMM)**:
   - Compare net profit margin to comparables
   - Most commonly used

5. **Profit Split Method**:
   - Split combined profits based on value contribution
   - Best for unique, integrated operations

### Documentation Requirements

**Contemporaneous Documentation**: Must be prepared by filing deadline.

**Required Elements**:
- Description of business
- Organizational structure
- Description of transactions
- Selection and application of transfer pricing method
- Comparability analysis
- Financial data

**Penalties for Non-Compliance**:
- Adjustment penalty: 10% of adjustment
- Documentation penalty: 10% of adjustment (if no contemporaneous docs)
- Can be concurrent

### Advance Pricing Agreements (APA)

**What**: Binding agreement with CRA on transfer pricing methodology.

**Types**:
- Unilateral: With CRA only
- Bilateral: With CRA and treaty partner
- Multilateral: Multiple jurisdictions

**Process**: 18-36+ months
**Fees**: Application fees plus professional costs

**Benefits**:
- Certainty for multi-year period
- Reduced audit risk
- Eliminates potential double taxation (bilateral)

## Foreign Tax Credits

### Mechanism

**Purpose**: Prevent double taxation of same income.

**Types**:
- Foreign non-business income tax credit
- Foreign business income tax credit

### Calculation

**Formula**:
```
FTC = Lesser of:
  (a) Foreign taxes paid, AND
  (b) Canadian tax × (Foreign income / Total income)
```

**Separate Baskets**: Calculate separately for:
- Business income
- Non-business income

### Limitations

**Excess Foreign Tax Credits**: Cannot exceed Canadian tax on foreign income.

**Carryforward**:
- Business income FTC: 10 years forward, 3 years back
- Non-business income FTC: No carryover

## Outbound Structures

### Canadian Holding Company

**Benefits**:
- Access to Canadian treaty network
- Exempt surplus regime for dividends
- Participation exemption for gains

**Requirements**:
- Real substance in Canada
- Active management
- Not a conduit structure

### Foreign Subsidiary vs. Branch

**Subsidiary (Foreign Affiliate)**:
- Deferral of active business income
- Exempt surplus regime
- Limited liability
- More complex compliance

**Branch**:
- Current taxation in Canada
- No deferral
- Foreign tax credit for foreign taxes
- Simpler structure

## Inbound Considerations

### Non-Resident Taxation

**Branch Tax**: 25% additional tax on after-tax profits (reduced by treaty)

**Withholding Taxes**: On payments to non-residents

**Thin Capitalization**:
- Debt-to-equity ratio limit: 1.5:1
- Interest deduction denied on excess debt

### Back-to-Back Rules

**Anti-Avoidance**: Prevent circumvention of withholding tax through intermediaries.

**Application**: Where payment flows through intermediary with corresponding arrangement.

## Specific Situations

### US Subsidiaries of Canadian Companies

**Structure**:
- Canadian parent, US subsidiary
- US sub pays dividends to Canada

**Tax Treatment**:
- US corporate tax on US income
- US withholding on dividends (5% treaty rate)
- Canadian tax on dividends (with FTC)

**Planning**:
- Consider check-the-box election (US tax)
- S-corp election if individual shareholders

### Canadian Subsidiaries of US Companies

**Structure**:
- US parent, Canadian subsidiary
- Canadian sub pays dividends/interest to US

**Tax Treatment**:
- Canadian corporate tax on Canadian income
- Canadian withholding on payments (treaty rates)
- US taxation with FTC

**Considerations**:
- GILTI rules (US) may tax low-taxed Canadian income
- FDII deduction for US parent on Canadian sales

### E-Commerce and Digital

**PE Risk**: Digital activities may create PE in customer jurisdictions

**BEPS Pillar One**: New international rules (evolving)

**Canadian DST**: Proposed Digital Services Tax (3% on certain digital revenues)

## Compliance Requirements

### Foreign Reporting Forms

**T1134**: Foreign Affiliate Information
- Due: 10 months after year-end
- Required for each foreign affiliate

**T1135**: Foreign Income Verification Statement
- Due: With tax return
- Required if foreign property >$100K

**T106**: Related Party Transactions
- Due: 6 months after year-end
- Required for non-arm's length transactions with non-residents

### Penalties

| Form | Late Filing Penalty |
|------|---------------------|
| T1134 | $25/day, max $2,500 |
| T1135 | $25/day, max $2,500 (+ gross negligence penalties) |
| T106 | $100-$12,000 per failure |

## Planning Considerations

### Structure Selection

**Factors**:
- Nature of foreign operations
- Treaty access
- Repatriation timing
- Foreign tax rates
- Administrative complexity

### Financing

**Interest Deductibility**:
- Thin capitalization limits
- EIFEL rules (Excessive Interest and Financing Expenses Limitation)
- Hybrid mismatch rules

### IP Planning

**Transfer Pricing**: Critical for IP-owning structures
**GILTI/FAPI**: Anti-deferral rules limit IP migration benefits

## Recent Developments

### BEPS 2.0 (Pillar Two)

**Global Minimum Tax**: 15% minimum effective tax rate

**Canadian Implementation**:
- Global Minimum Tax Act (GMT)
- Applies to MNEs with revenue >€750M
- Effective for fiscal years beginning after December 30, 2023

**Top-Up Tax**: If effective rate <15% in any jurisdiction, top-up tax payable

### EIFEL Rules

**Excessive Interest and Financing Expenses Limitation**:
- Limits interest deductions to 30% of adjusted taxable income
- Group ratio election available
- Phase-in: 40% (2023), 30% (2024+)

## Integration with Other Skills

### With Taxation-Corporate

Domestic rules interact with international; understand both for complete picture.

### With Entity Selection

Structure choice affects international tax efficiency dramatically.

### With Transfer Pricing

Nearly all international structures require transfer pricing analysis.

## Disclaimer

International taxation is highly complex and fact-specific. Treaties, domestic law, and foreign law all interact. This sub-skill provides frameworks only. Obtain professional advice for specific situations—errors in international tax can be extremely costly.
