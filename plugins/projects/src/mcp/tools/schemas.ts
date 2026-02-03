/**
 * MCP Tool Schemas
 *
 * JSON Schema definitions for all project management tools.
 */

export const projectCreateSchema = {
  type: "object" as const,
  properties: {
    title: {
      type: "string",
      description: "Project title",
    },
    type: {
      type: "string",
      enum: ["assignment", "opportunity"],
      description: "Type: assignment (committed work) or opportunity (potential work)",
    },
    stage: {
      type: "string",
      enum: ["lead", "proposal", "negotiation", "active", "delivered", "closed"],
      description: "Pipeline stage",
      default: "lead",
    },
    priority: {
      type: "string",
      enum: ["critical", "high", "medium", "low", "none"],
      description: "Manual priority level",
      default: "none",
    },
    description: {
      type: "string",
      description: "Project description",
    },
    client: {
      type: "string",
      description: "Client or company name",
    },
    contact: {
      type: "string",
      description: "Primary contact",
    },
    tags: {
      type: "array",
      items: { type: "string" },
      description: "Tags for categorization",
    },
    deadline: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description: "Deadline date (YYYY-MM-DD)",
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        },
        time: {
          type: "string",
          description: "Optional time (HH:MM)",
          pattern: "^\\d{2}:\\d{2}$",
        },
        hard: {
          type: "boolean",
          description: "True for hard deadline, false for soft target",
          default: true,
        },
      },
      required: ["date"],
      description: "Project deadline",
    },
    rate: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["hourly", "fixed", "retainer", "equity"],
          description: "Billing type",
        },
        amount: {
          type: "number",
          description: "Rate amount",
        },
        currency: {
          type: "string",
          description: "Currency code (e.g., USD, EUR)",
          default: "USD",
        },
        estimated_hours: {
          type: "number",
          description: "Estimated hours (for hourly rates)",
        },
      },
      required: ["type"],
      description: "Rate information",
    },
  },
  required: ["title", "type"],
};

export const projectListSchema = {
  type: "object" as const,
  properties: {
    type: {
      type: "string",
      enum: ["assignment", "opportunity"],
      description: "Filter by project type",
    },
    stage: {
      type: "string",
      enum: ["lead", "proposal", "negotiation", "active", "delivered", "closed"],
      description: "Filter by stage",
    },
    priority: {
      type: "string",
      enum: ["critical", "high", "medium", "low", "none"],
      description: "Filter by manual priority",
    },
    tags: {
      type: "array",
      items: { type: "string" },
      description: "Filter by tags (match any)",
    },
    client: {
      type: "string",
      description: "Filter by client",
    },
    overdue: {
      type: "boolean",
      description: "Filter to only overdue projects",
    },
    due_within_days: {
      type: "number",
      description: "Filter to projects due within N days",
    },
    min_priority: {
      type: "number",
      description: "Filter by minimum calculated priority (0-100)",
    },
    sort_by: {
      type: "string",
      enum: ["priority", "deadline", "created", "updated", "stage", "title"],
      description: "Sort field (default: priority)",
      default: "priority",
    },
    sort_order: {
      type: "string",
      enum: ["asc", "desc"],
      description: "Sort order (default: desc for priority, asc for others)",
    },
    limit: {
      type: "number",
      description: "Maximum results to return",
    },
  },
};

export const projectGetSchema = {
  type: "object" as const,
  properties: {
    id: {
      type: "string",
      description: "Project ID",
    },
  },
  required: ["id"],
};

export const projectUpdateSchema = {
  type: "object" as const,
  properties: {
    id: {
      type: "string",
      description: "Project ID",
    },
    title: {
      type: "string",
      description: "New title",
    },
    type: {
      type: "string",
      enum: ["assignment", "opportunity"],
      description: "New type",
    },
    stage: {
      type: "string",
      enum: ["lead", "proposal", "negotiation", "active", "delivered", "closed"],
      description: "New stage",
    },
    priority: {
      type: "string",
      enum: ["critical", "high", "medium", "low", "none"],
      description: "New priority",
    },
    description: {
      type: "string",
      description: "New description",
    },
    client: {
      type: "string",
      description: "New client",
    },
    contact: {
      type: "string",
      description: "New contact",
    },
    tags: {
      type: "array",
      items: { type: "string" },
      description: "New tags (replaces existing)",
    },
    deadline: {
      type: "object" as const,
      properties: {
        date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        time: { type: "string", pattern: "^\\d{2}:\\d{2}$" },
        hard: { type: "boolean" },
      },
      required: ["date"],
      description: "New deadline",
    },
    notes: {
      type: "string",
      description: "Append notes (markdown)",
    },
  },
  required: ["id"],
};

export const projectDeleteSchema = {
  type: "object" as const,
  properties: {
    id: {
      type: "string",
      description: "Project ID to delete",
    },
  },
  required: ["id"],
};

export const projectSearchSchema = {
  type: "object" as const,
  properties: {
    query: {
      type: "string",
      description: "Search text (matches title, description, client, notes, tags)",
    },
  },
  required: ["query"],
};

export const addMilestoneSchema = {
  type: "object" as const,
  properties: {
    project_id: {
      type: "string",
      description: "Project ID",
    },
    title: {
      type: "string",
      description: "Milestone title",
    },
    description: {
      type: "string",
      description: "Milestone description",
    },
    deadline: {
      type: "object" as const,
      properties: {
        date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        time: { type: "string", pattern: "^\\d{2}:\\d{2}$" },
        hard: { type: "boolean", default: true },
      },
      required: ["date"],
      description: "Milestone deadline",
    },
  },
  required: ["project_id", "title", "deadline"],
};

export const addDeliverableSchema = {
  type: "object" as const,
  properties: {
    project_id: {
      type: "string",
      description: "Project ID",
    },
    milestone_id: {
      type: "string",
      description: "Milestone ID",
    },
    title: {
      type: "string",
      description: "Deliverable title",
    },
    description: {
      type: "string",
      description: "Deliverable description",
    },
    deadline: {
      type: "object" as const,
      properties: {
        date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        time: { type: "string", pattern: "^\\d{2}:\\d{2}$" },
        hard: { type: "boolean", default: true },
      },
      required: ["date"],
      description: "Deliverable deadline (optional, inherits from milestone)",
    },
  },
  required: ["project_id", "milestone_id", "title"],
};

export const completeItemSchema = {
  type: "object" as const,
  properties: {
    project_id: {
      type: "string",
      description: "Project ID",
    },
    milestone_id: {
      type: "string",
      description: "Milestone ID",
    },
    deliverable_id: {
      type: "string",
      description: "Deliverable ID (omit to complete the milestone)",
    },
  },
  required: ["project_id", "milestone_id"],
};

export const transitionStageSchema = {
  type: "object" as const,
  properties: {
    id: {
      type: "string",
      description: "Project ID",
    },
    stage: {
      type: "string",
      enum: ["lead", "proposal", "negotiation", "active", "delivered", "closed"],
      description: "New stage",
    },
    notes: {
      type: "string",
      description: "Optional transition notes",
    },
  },
  required: ["id", "stage"],
};

export const addInvoiceSchema = {
  type: "object" as const,
  properties: {
    project_id: {
      type: "string",
      description: "Project ID",
    },
    amount: {
      type: "number",
      description: "Invoice amount",
    },
    currency: {
      type: "string",
      description: "Currency code (default: USD)",
      default: "USD",
    },
    description: {
      type: "string",
      description: "Invoice description",
    },
    date: {
      type: "string",
      description: "Invoice date (YYYY-MM-DD)",
      pattern: "^\\d{4}-\\d{2}-\\d{2}$",
    },
  },
  required: ["project_id", "amount"],
};

export const markPaidSchema = {
  type: "object" as const,
  properties: {
    project_id: {
      type: "string",
      description: "Project ID",
    },
    invoice_id: {
      type: "string",
      description: "Invoice ID",
    },
  },
  required: ["project_id", "invoice_id"],
};

export const financialSummarySchema = {
  type: "object" as const,
  properties: {
    type: {
      type: "string",
      enum: ["assignment", "opportunity"],
      description: "Filter by type",
    },
    stage: {
      type: "string",
      enum: ["lead", "proposal", "negotiation", "active", "delivered", "closed"],
      description: "Filter by stage",
    },
  },
};

export const timelineSchema = {
  type: "object" as const,
  properties: {
    days_ahead: {
      type: "number",
      description: "Days to look ahead (default: 90)",
      default: 90,
    },
    include_overdue: {
      type: "boolean",
      description: "Include overdue projects",
      default: true,
    },
  },
};

export const projectInitSchema = {
  type: "object" as const,
  properties: {
    default_currency: {
      type: "string",
      description: "Default currency for new projects (default: USD)",
      default: "USD",
    },
  },
};
