---
name: cfa-analysis
description: "DCF valuation, comparable analysis, financial ratios, portfolio theory, risk assessment. Use for quantitative financial analysis and valuation."
---

# CFA Analysis

Chartered Financial Analyst framework for rigorous quantitative financial analysis.

## Core Philosophy

"In the short run, the market is a voting machine but in the long run, it is a weighing machine." - Benjamin Graham

Financial analysis provides the quantitative foundation for investment and business decisions.

## Valuation Methods

### Discounted Cash Flow (DCF)

**The Gold Standard for Intrinsic Value**

**Formula**:
```
Enterprise Value = Σ (FCF_t / (1 + WACC)^t) + Terminal Value / (1 + WACC)^n
```

**Components**:

**Free Cash Flow (FCF)**:
```
FCF = EBIT × (1 - Tax Rate) + Depreciation - CapEx - Δ Working Capital
```

**Weighted Average Cost of Capital (WACC)**:
```
WACC = (E/V × Re) + (D/V × Rd × (1 - T))

Where:
E = Market value of equity
D = Market value of debt
V = E + D
Re = Cost of equity
Rd = Cost of debt
T = Tax rate
```

**Cost of Equity (CAPM)**:
```
Re = Rf + β × (Rm - Rf)

Where:
Rf = Risk-free rate
β = Beta (systematic risk)
Rm - Rf = Market risk premium
```

**Terminal Value Methods**:

**Gordon Growth Model**:
```
TV = FCF_n × (1 + g) / (WACC - g)
```

**Exit Multiple**:
```
TV = EBITDA_n × Exit Multiple
```

### Comparable Company Analysis

**Market-Based Valuation**

**Process**:
1. Select peer companies
2. Calculate trading multiples
3. Apply to target company
4. Triangulate valuation range

**Common Multiples**:

| Multiple | Formula | Best For |
|----------|---------|----------|
| EV/Revenue | Enterprise Value / Revenue | Early-stage, high growth |
| EV/EBITDA | Enterprise Value / EBITDA | Mature companies |
| P/E | Price / Earnings | Profitable companies |
| P/S | Price / Sales | Unprofitable growth |
| P/B | Price / Book | Asset-heavy |

**Canadian Context**:
- TSX Venture companies trade at different multiples than TSX
- Resource companies use specialized metrics (NAV, reserves)
- Limited Canadian tech comps - often use US peers with discount

### Precedent Transactions

**Acquisition-Based Valuation**

**Process**:
1. Identify relevant M&A transactions
2. Calculate implied multiples
3. Adjust for control premium, synergies
4. Apply to target

**Adjustments**:
- Control premium: 20-40% typical
- Synergy value: Often 50% credited to target
- Market conditions: Adjust for cycle timing

## Financial Statement Analysis

### Profitability Ratios

**Gross Margin**:
```
Gross Margin = (Revenue - COGS) / Revenue
```

**Operating Margin**:
```
Operating Margin = EBIT / Revenue
```

**Net Margin**:
```
Net Margin = Net Income / Revenue
```

**Return on Equity (ROE)**:
```
ROE = Net Income / Shareholders' Equity
```

**DuPont Analysis**:
```
ROE = Net Margin × Asset Turnover × Equity Multiplier
    = (NI/Rev) × (Rev/Assets) × (Assets/Equity)
```

**Return on Assets (ROA)**:
```
ROA = Net Income / Total Assets
```

**Return on Invested Capital (ROIC)**:
```
ROIC = NOPAT / Invested Capital
     = EBIT × (1 - T) / (Equity + Debt - Cash)
```

### Liquidity Ratios

**Current Ratio**:
```
Current Ratio = Current Assets / Current Liabilities
Target: > 1.5 (varies by industry)
```

**Quick Ratio (Acid Test)**:
```
Quick Ratio = (Current Assets - Inventory) / Current Liabilities
Target: > 1.0
```

**Cash Ratio**:
```
Cash Ratio = Cash / Current Liabilities
```

### Leverage Ratios

**Debt to Equity**:
```
D/E = Total Debt / Shareholders' Equity
```

**Debt to EBITDA**:
```
Leverage = Total Debt / EBITDA
Target: < 3.0x for investment grade
```

**Interest Coverage**:
```
Interest Coverage = EBIT / Interest Expense
Target: > 3.0x
```

### Efficiency Ratios

**Asset Turnover**:
```
Asset Turnover = Revenue / Average Total Assets
```

**Inventory Turnover**:
```
Inventory Turnover = COGS / Average Inventory
```

**Days Sales Outstanding (DSO)**:
```
DSO = (Accounts Receivable / Revenue) × 365
```

**Days Payable Outstanding (DPO)**:
```
DPO = (Accounts Payable / COGS) × 365
```

**Cash Conversion Cycle**:
```
CCC = DSO + DIO - DPO
Where DIO = (Inventory / COGS) × 365
```

## SaaS Metrics

### Growth Metrics

**Monthly Recurring Revenue (MRR)**:
```
MRR = Σ (Active Subscriptions × Monthly Price)
```

**Annual Recurring Revenue (ARR)**:
```
ARR = MRR × 12
```

**Net Revenue Retention (NRR)**:
```
NRR = (Starting MRR + Expansion - Contraction - Churn) / Starting MRR
Target: > 100% (ideally > 120%)
```

**Gross Revenue Retention (GRR)**:
```
GRR = (Starting MRR - Contraction - Churn) / Starting MRR
Target: > 90%
```

### Unit Economics

**Customer Acquisition Cost (CAC)**:
```
CAC = (Sales + Marketing Spend) / New Customers Acquired
```

**Lifetime Value (LTV)**:
```
LTV = ARPU × Gross Margin / Churn Rate
Or: LTV = ARPU × Gross Margin × Average Customer Lifetime
```

**LTV:CAC Ratio**:
```
Target: > 3:1 (ideally 5:1)
```

**CAC Payback Period**:
```
Payback = CAC / (ARPU × Gross Margin)
Target: < 12 months (ideally < 6)
```

### SaaS Rule of 40

```
Rule of 40 = Revenue Growth % + EBITDA Margin %
Target: > 40%
```

**Interpretation**:
- >40%: Strong business
- 20-40%: Average
- <20%: Needs improvement

## Portfolio Theory

### Risk Measures

**Standard Deviation (Total Risk)**:
```
σ = √[Σ(Ri - R̄)² / (n-1)]
```

**Beta (Systematic Risk)**:
```
β = Cov(Ri, Rm) / Var(Rm)

β = 1: Market risk
β > 1: More volatile than market
β < 1: Less volatile than market
```

**Sharpe Ratio**:
```
Sharpe = (Rp - Rf) / σp
```

**Sortino Ratio** (downside risk only):
```
Sortino = (Rp - Rf) / σd
```

### Portfolio Diversification

**Portfolio Variance**:
```
σp² = Σ wi² σi² + ΣΣ wi wj σi σj ρij
```

**Key Insight**: Correlation (ρ) between assets matters more than individual volatility for diversification.

### Capital Asset Pricing Model (CAPM)

```
E(Ri) = Rf + βi × (E(Rm) - Rf)
```

**Components**:
- Rf: Risk-free rate (Government of Canada bonds)
- β: Systematic risk of asset
- E(Rm) - Rf: Equity risk premium (4-7% historical)

## Startup Valuation

### Pre-Revenue Methods

**Scorecard Method**:
- Compare to average seed valuation
- Adjust for: Team (0-30%), Market (0-25%), Product (0-15%), etc.

**Berkus Method**:
| Factor | Max Value |
|--------|-----------|
| Sound idea | $500K |
| Prototype | $500K |
| Quality team | $500K |
| Strategic relationships | $500K |
| Product rollout/sales | $500K |
| **Maximum pre-money** | **$2.5M** |

**Risk Factor Summation**:
- Start with average valuation
- Adjust ±$250K per risk factor
- 12 standard risk factors

### VC Method

```
Post-Money Valuation = Exit Value / Target ROI
Pre-Money = Post-Money - Investment

Where Target ROI typically = 10-30x for early stage
```

**Example**:
- Expected exit: $100M in 5 years
- Target return: 10x
- Post-money: $10M
- Investment: $2M
- Pre-money: $8M

### Option Pool Shuffle

**Pre-Money Option Pool**:
- Pool created before investment
- Dilutes founders only
- Reduces effective pre-money valuation

**Calculation**:
```
Effective Pre-Money = Stated Pre-Money - Option Pool Value
```

## Canadian-Specific Considerations

### Valuation Discounts

**Small Company Premium**: +1-5% to discount rate for size risk

**Illiquidity Discount**: 15-35% for private companies

**Country Risk**: Generally minimal for Canada vs. US

### Tax-Affected Valuation

**CCPC Considerations**:
- Lower corporate tax rate affects after-tax cash flows
- LCGE affects after-tax proceeds for shareholders
- Integration principle affects dividend decisions

**SR&ED Impact**:
- Include expected SR&ED credits in cash flow projections
- Verify claim eligibility and history

### Industry Benchmarks

**Canadian SaaS Benchmarks** (2024-2025):
- Median growth rate: 25-40%
- Median NRR: 105-115%
- Median gross margin: 70-80%

**Canadian VC Valuations**:
- Pre-seed: $2-5M pre-money
- Seed: $5-12M pre-money
- Series A: $15-40M pre-money

## Financial Modeling Best Practices

### Model Architecture

**Three-Statement Model**:
1. Income Statement
2. Balance Sheet
3. Cash Flow Statement

**Drivers → Projections → Outputs**

### Projection Periods

- **Explicit Forecast**: 5-10 years
- **Terminal Value**: Beyond explicit period
- **Avoid**: Forecasting perpetual high growth

### Sensitivity Analysis

**Key Variables**:
- Revenue growth rate
- Gross margin
- WACC
- Terminal growth rate
- Exit multiple

**Presentation**:
- Tornado charts for single variable
- Data tables for two variables
- Monte Carlo for full distribution

### Scenario Analysis

**Standard Scenarios**:
- Base Case: Management projections
- Bull Case: Upside scenario (+20-30%)
- Bear Case: Downside scenario (-20-30%)

**Probability Weighting**:
```
Expected Value = Σ (Probability × Scenario Value)
```

## Due Diligence Checklist

### Financial Due Diligence

**Historical Analysis**:
- [ ] Revenue recognition policies
- [ ] Customer concentration
- [ ] EBITDA adjustments
- [ ] Working capital normalization
- [ ] CapEx vs. maintenance CapEx
- [ ] Related party transactions

**Quality of Earnings**:
- [ ] Recurring vs. non-recurring
- [ ] Cash vs. non-cash
- [ ] Sustainable vs. one-time

### Operational Due Diligence

- [ ] Customer unit economics
- [ ] Churn analysis by cohort
- [ ] Sales pipeline quality
- [ ] Technology assessment
- [ ] Team evaluation

## Integration with Other Frameworks

### With First Principles

CFA analysis provides the numbers; first principles questions whether those numbers are meaningful.

### With Business Judgment

Quantitative analysis informs judgment but doesn't replace it. The best businesses often look expensive on traditional metrics.

### With Leverage Analysis

Valuation reflects current state; leverage analysis identifies potential for non-linear growth.

## Disclaimer

Financial analysis requires current market data and professional judgment. Historical metrics and benchmarks change with market conditions. This sub-skill provides frameworks and methods, not investment advice. Consult qualified financial professionals for specific situations.
