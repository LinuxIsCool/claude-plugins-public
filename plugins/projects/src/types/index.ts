/**
 * Project Manager Plugin - Core Type Definitions
 *
 * Tracks projects with real-time priority ranking based on:
 * - Deadline urgency (dominant factor)
 * - Assignment vs opportunity classification
 * - Financial tracking (rates, invoiced, received, outstanding)
 * - Recurring items with time-based priority boost
 */

// =============================================================================
// Enums & Constants
// =============================================================================

/**
 * Project pipeline stages: Lead → Closed
 */
export const ProjectStage = {
  Lead: "lead",
  Proposal: "proposal",
  Negotiation: "negotiation",
  Active: "active",
  Delivered: "delivered",
  Closed: "closed",
} as const;

export type ProjectStageValue = (typeof ProjectStage)[keyof typeof ProjectStage];

export const PROJECT_STAGES_ORDERED: ProjectStageValue[] = [
  "lead",
  "proposal",
  "negotiation",
  "active",
  "delivered",
  "closed",
];

/**
 * Project type: committed work vs potential work
 */
export const ProjectType = {
  Assignment: "assignment", // Committed work (contracts, deliverables)
  Opportunity: "opportunity", // Potential work (proposals, leads)
} as const;

export type ProjectTypeValue = (typeof ProjectType)[keyof typeof ProjectType];

/**
 * Manual priority level (user-specified)
 */
export const PriorityLevel = {
  Critical: "critical",
  High: "high",
  Medium: "medium",
  Low: "low",
  None: "none",
} as const;

export type PriorityLevelValue = (typeof PriorityLevel)[keyof typeof PriorityLevel];

/**
 * Rate types for billing
 */
export const RateType = {
  Hourly: "hourly",
  Fixed: "fixed",
  Retainer: "retainer",
  Equity: "equity",
} as const;

export type RateTypeValue = (typeof RateType)[keyof typeof RateType];

/**
 * Recurrence frequency
 */
export const RecurrenceFrequency = {
  Daily: "daily",
  Weekly: "weekly",
  Monthly: "monthly",
  Quarterly: "quarterly",
} as const;

export type RecurrenceFrequencyValue =
  (typeof RecurrenceFrequency)[keyof typeof RecurrenceFrequency];

// =============================================================================
// Financial Types
// =============================================================================

/**
 * Money amount with currency
 */
export interface MoneyAmount {
  amount: number;
  currency: string; // ISO 4217 (e.g., "USD", "EUR", "CAD")
}

/**
 * Rate information for billing
 */
export interface RateInfo {
  type: RateTypeValue;
  hourly_rate?: MoneyAmount;
  fixed_amount?: MoneyAmount;
  retainer_monthly?: MoneyAmount;
  equity_percentage?: number;
  estimated_hours?: number;
}

/**
 * Invoice record
 */
export interface Invoice {
  id: string;
  date: string; // ISO 8601 date
  amount: MoneyAmount;
  description?: string;
  paid: boolean;
  paid_date?: string;
}

/**
 * Financial tracking for a project
 */
export interface FinancialTracking {
  rate: RateInfo;
  invoices: Invoice[];
  total_invoiced: MoneyAmount;
  total_received: MoneyAmount;
  outstanding: MoneyAmount;
  next_invoice_date?: string;
  next_invoice_amount?: MoneyAmount;
}

// =============================================================================
// Deadline & Milestone Types
// =============================================================================

/**
 * Deadline with optional time and timezone
 */
export interface Deadline {
  date: string; // ISO 8601 date (YYYY-MM-DD)
  time?: string; // HH:MM (24-hour)
  timezone?: string; // IANA timezone
  description?: string;
  hard: boolean; // true = hard deadline, false = soft target
}

/**
 * Deliverable within a milestone
 */
export interface Deliverable {
  id: string;
  title: string;
  description?: string;
  deadline?: Deadline;
  completed: boolean;
  completed_at?: string;
}

/**
 * Milestone containing deliverables
 */
export interface Milestone {
  id: string;
  title: string;
  description?: string;
  deadline: Deadline;
  deliverables: Deliverable[];
  completed: boolean;
  completed_at?: string;
}

// =============================================================================
// Recurrence Types
// =============================================================================

/**
 * Recurrence rule for recurring work
 */
export interface RecurrenceRule {
  enabled: boolean;
  frequency: RecurrenceFrequencyValue;
  interval: number; // Every N periods (default: 1)
  anchor_date: string; // ISO 8601 date to calculate from
  priority_boost: number; // Boost amount (0-100)
  boost_window_days: number; // Days before due when boost applies
}

// =============================================================================
// Integration Types
// =============================================================================

/**
 * External platform integrations
 */
export interface ProjectIntegrations {
  // Communication
  slack?: {
    channel_id: string;
    channel_name: string;
    workspace?: string;
  };
  discord?: {
    channel_id: string;
    server_id?: string;
  };

  // Documentation
  notion?: {
    page_id: string;
    page_url: string;
    database_id?: string;
  };
  confluence?: {
    page_id: string;
    space_key: string;
  };

  // Code & Development
  github?: {
    repo: string; // owner/repo format
    issues_label?: string;
    project_board?: string;
  };
  linear?: {
    project_id: string;
    team_id?: string;
  };

  // Internal plugins
  library_tags?: string[];        // Tags to filter library resources
  transcript_sessions?: string[]; // Related conversation session IDs

  // Generic resources (URLs, references)
  resources?: Array<{
    url: string;
    title?: string;
    type?: "doc" | "api" | "reference" | "competitor" | "tool" | "other";
  }>;
}

// =============================================================================
// Project Type
// =============================================================================

/**
 * Core Project structure
 */
export interface Project {
  // Identity
  id: string;
  title: string;
  description?: string;

  // Classification
  type: ProjectTypeValue;
  stage: ProjectStageValue;
  priority: PriorityLevelValue;

  // Calculated priority (set by system)
  calculated_priority?: number;

  // Temporal
  created_at: string;
  updated_at: string;
  started_at?: string;
  deadline?: Deadline;
  milestones: Milestone[];

  // Financial
  financial?: FinancialTracking;

  // Recurrence
  recurrence?: RecurrenceRule;

  // Organization
  tags: string[];
  client?: string;
  contact?: string;

  // Cross-plugin references
  related_projects?: string[];
  backlog_tasks?: string[];
  schedule_blocks?: string[];

  // External integrations
  integrations?: ProjectIntegrations;

  // Notes (markdown content)
  notes?: string;

  // File metadata (set by store)
  file_path?: string;
}

/**
 * Input for creating a project (id and timestamps are generated)
 */
export type CreateProjectInput = Omit<
  Project,
  "id" | "created_at" | "updated_at" | "calculated_priority" | "file_path"
>;

/**
 * Input for updating a project
 */
export type UpdateProjectInput = Partial<
  Omit<Project, "id" | "created_at" | "file_path">
>;

// =============================================================================
// Query & Filter Types
// =============================================================================

/**
 * Filter options for listing projects
 */
export interface ProjectFilter {
  type?: ProjectTypeValue | ProjectTypeValue[];
  stage?: ProjectStageValue | ProjectStageValue[];
  priority?: PriorityLevelValue | PriorityLevelValue[];
  tags?: string[];
  client?: string;
  has_deadline?: boolean;
  overdue?: boolean;
  due_within_days?: number;
  min_priority?: number;
}

/**
 * Sort options
 */
export type SortField =
  | "priority"
  | "deadline"
  | "created"
  | "updated"
  | "stage"
  | "title";
export type SortOrder = "asc" | "desc";

/**
 * Query options for listing projects
 */
export interface ProjectQuery {
  filter?: ProjectFilter;
  sort_by?: SortField;
  sort_order?: SortOrder;
  limit?: number;
  offset?: number;
}

// =============================================================================
// Priority Calculation Types
// =============================================================================

/**
 * Weights for priority calculation
 *
 * These weights apply to the primary scoring factors.
 * They should sum to 1.0 for predictable scoring.
 *
 * Note: Stage is handled separately as a scale factor (0.5x-1.0x),
 * not as a weighted component, to ensure active work always
 * outranks leads at the same urgency level.
 */
export interface PriorityWeights {
  deadline_urgency: number; // Urgency from deadline proximity (default: 0.4)
  manual_priority: number; // User-set priority level (default: 0.25)
  financial_value: number; // Outstanding/estimated value (default: 0.2)
  recurrence_boost: number; // Boost for recurring items near due (default: 0.15)
}

/**
 * Default priority weights (deadline-dominant as requested)
 * Weights sum to 1.0 for predictable scoring.
 */
export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  deadline_urgency: 0.4,
  manual_priority: 0.25,
  financial_value: 0.2,
  recurrence_boost: 0.15,
};

/**
 * Context for priority calculation
 */
export interface PriorityContext {
  now: Date;
  weights: PriorityWeights;
}

/**
 * Breakdown of priority score components
 */
export interface PriorityBreakdown {
  deadline_urgency: number; // Weighted deadline score
  manual_priority: number; // Weighted manual priority score
  financial_value: number; // Weighted financial score
  recurrence_boost: number; // Weighted recurrence boost
  base_score: number; // Sum of weighted components (before stage)
  stage_scale: number; // Stage scaling factor (0.5-1.0)
}

/**
 * Priority score with breakdown
 */
export interface PriorityScore {
  total: number; // 0-100
  breakdown: PriorityBreakdown;
  nearest_deadline?: string;
  days_until_deadline?: number;
}

// =============================================================================
// Store Interface
// =============================================================================

/**
 * Project store interface
 */
export interface ProjectStore {
  // CRUD
  create(input: CreateProjectInput): Promise<Project>;
  get(id: string): Promise<Project | null>;
  update(id: string, input: UpdateProjectInput): Promise<Project>;
  delete(id: string): Promise<void>;
  archive(id: string): Promise<void>;

  // Queries
  list(query?: ProjectQuery): Promise<Project[]>;
  search(text: string): Promise<Project[]>;

  // Milestones
  addMilestone(
    projectId: string,
    milestone: Omit<Milestone, "id">
  ): Promise<Milestone>;
  updateMilestone(
    projectId: string,
    milestoneId: string,
    updates: Partial<Milestone>
  ): Promise<Milestone>;
  completeMilestone(projectId: string, milestoneId: string): Promise<void>;

  // Deliverables
  addDeliverable(
    projectId: string,
    milestoneId: string,
    deliverable: Omit<Deliverable, "id">
  ): Promise<Deliverable>;
  completeDeliverable(
    projectId: string,
    milestoneId: string,
    deliverableId: string
  ): Promise<void>;

  // Stage transitions
  transitionStage(
    projectId: string,
    newStage: ProjectStageValue,
    notes?: string
  ): Promise<Project>;

  // Financial
  addInvoice(projectId: string, invoice: Omit<Invoice, "id">): Promise<Invoice>;
  markInvoicePaid(projectId: string, invoiceId: string): Promise<void>;
}

// =============================================================================
// Config Types
// =============================================================================

/**
 * Plugin configuration
 */
export interface ProjectsConfig {
  priority_weights: PriorityWeights;
  default_currency: string;
  archive_after_days?: number;
  auto_archive_closed?: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: ProjectsConfig = {
  priority_weights: DEFAULT_PRIORITY_WEIGHTS,
  default_currency: "USD",
  archive_after_days: 90,
  auto_archive_closed: true,
};
