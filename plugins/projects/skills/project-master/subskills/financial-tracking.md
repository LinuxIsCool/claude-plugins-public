---
name: financial-tracking
description: Manage invoices, payments, and financial summaries
---

# Financial Tracking Sub-Skill

## When to Use

Use this sub-skill when:
- Creating invoices for projects
- Recording payments received
- Reviewing financial status
- Understanding financial impact on priority

## Adding Invoices

```
project_add_invoice({
  project_id: "proj-xxx",
  amount: 2500,
  currency: "USD",
  description: "Phase 1 completion",
  date: "2026-01-15"
})
```

## Marking Invoices Paid

```
project_mark_paid({
  project_id: "proj-xxx",
  invoice_id: "inv-xxx"
})
```

## Financial Summary

Get totals across projects:

```
project_financials({})  // All projects
project_financials({ stage: "active" })  // Active only
project_financials({ type: "assignment" })  // Assignments only
```

Returns per-currency totals:
- **Invoiced**: Total amount billed
- **Received**: Total amount paid
- **Outstanding**: Invoiced - Received

## Financial Impact on Priority

Outstanding payments contribute to priority score (20% weight):
- Uses logarithmic scale
- $1,000 outstanding ≈ 37/100
- $10,000 outstanding ≈ 50/100
- $100,000 outstanding ≈ 62/100

Projects with higher outstanding amounts get priority attention.

## Rate Types Reference

| Type | Created As | Priority Calculation |
|------|------------|---------------------|
| Hourly | `rate.hourly_rate * estimated_hours` | Uses estimate |
| Fixed | `rate.fixed_amount` | Uses full amount |
| Retainer | `rate.retainer_monthly * 3` | Uses ~quarterly value |
| Equity | N/A | No financial priority boost |

## Financial Tracking Fields

Each project's `financial` object contains:
```typescript
{
  rate: { type, hourly_rate?, fixed_amount?, retainer_monthly?, equity_percentage?, estimated_hours? },
  invoices: [{ id, date, amount, description, paid, paid_date? }],
  total_invoiced: { amount, currency },
  total_received: { amount, currency },
  outstanding: { amount, currency },
  next_invoice_date?: string,
  next_invoice_amount?: { amount, currency }
}
```

## Best Practices

1. **Invoice promptly**: Keeps financial tracking accurate
2. **Mark payments immediately**: Affects priority calculation
3. **Set next invoice date**: For recurring billing reminders
4. **Review financials weekly**: Use `project_financials` to stay on top of AR
