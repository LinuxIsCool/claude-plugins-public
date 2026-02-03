/**
 * Priority Calculator
 *
 * Implements deadline-dominant priority ranking with configurable weights.
 *
 * Scoring factors (default weights):
 * - Deadline urgency: 40% (dominant factor)
 * - Manual priority: 25%
 * - Financial value: 20%
 * - Recurrence boost: 10%
 * - Stage modifier: 5%
 */

import type {
  Project,
  Deadline,
  PriorityContext,
  PriorityScore,
  PriorityBreakdown,
  PriorityWeights,
  ProjectStageValue,
  PriorityLevelValue,
} from "../types";
import { DEFAULT_PRIORITY_WEIGHTS } from "../types";

// =============================================================================
// Date Utilities
// =============================================================================

/**
 * Calculate days between two dates (negative if target is in the past)
 */
function daysBetween(from: Date, to: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return (to.getTime() - from.getTime()) / msPerDay;
}

/**
 * Parse a deadline into a Date object
 */
function parseDeadline(deadline: Deadline): Date {
  const date = new Date(deadline.date);
  if (deadline.time) {
    const [hours, minutes] = deadline.time.split(":").map(Number);
    date.setHours(hours, minutes, 0, 0);
  } else {
    // Default to end of day for deadlines without time
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

// =============================================================================
// Component Calculators
// =============================================================================

/**
 * Find the nearest deadline across project, milestones, and deliverables
 */
function findNearestDeadline(project: Project): Deadline | null {
  const deadlines: Deadline[] = [];

  // Project-level deadline
  if (project.deadline) {
    deadlines.push(project.deadline);
  }

  // Milestone and deliverable deadlines
  for (const milestone of project.milestones) {
    if (!milestone.completed && milestone.deadline) {
      deadlines.push(milestone.deadline);
    }
    for (const deliverable of milestone.deliverables) {
      if (!deliverable.completed && deliverable.deadline) {
        deadlines.push(deliverable.deadline);
      }
    }
  }

  if (deadlines.length === 0) return null;

  // Sort by date and return nearest
  deadlines.sort(
    (a, b) => parseDeadline(a).getTime() - parseDeadline(b).getTime()
  );
  return deadlines[0];
}

/**
 * Calculate deadline urgency score (0-100)
 *
 * Scoring curve:
 * - Overdue: 100 (maximum urgency)
 * - Due today: 95
 * - Due in 1-3 days: 85-95
 * - Due in 4-7 days: 70-85
 * - Due in 1-2 weeks: 50-70
 * - Due in 2-4 weeks: 30-50
 * - Due in 1-3 months: 10-30
 * - Due > 3 months: 5-10
 * - No deadline: 0
 */
function calculateDeadlineUrgency(project: Project, now: Date): number {
  const nearest = findNearestDeadline(project);
  if (!nearest) return 0;

  const deadlineDate = parseDeadline(nearest);
  const daysUntil = daysBetween(now, deadlineDate);

  // Urgency curve (higher score = more urgent)
  if (daysUntil < 0) return 100; // Overdue
  if (daysUntil < 1) return 95; // Due today
  if (daysUntil < 3) return 95 - daysUntil * 3.33; // 88-95
  if (daysUntil < 7) return 85 - (daysUntil - 3) * 3.75; // 70-85
  if (daysUntil < 14) return 70 - (daysUntil - 7) * 2.86; // 50-70
  if (daysUntil < 30) return 50 - (daysUntil - 14) * 1.25; // 30-50
  if (daysUntil < 90) return 30 - (daysUntil - 30) * 0.33; // 10-30
  return Math.max(5, 10 - (daysUntil - 90) * 0.05); // 5-10
}

/**
 * Calculate manual priority score (0-100)
 */
function calculateManualPriority(priority: PriorityLevelValue): number {
  const scores: Record<PriorityLevelValue, number> = {
    critical: 100,
    high: 75,
    medium: 50,
    low: 25,
    none: 0,
  };
  return scores[priority] ?? 0;
}

/**
 * Calculate financial value score (0-100)
 *
 * Uses logarithmic scale:
 * - $1,000: ~37
 * - $10,000: ~50
 * - $100,000: ~62
 * - $1,000,000: ~75
 */
function calculateFinancialValue(project: Project): number {
  if (!project.financial) return 0;

  const { outstanding, rate, total_invoiced } = project.financial;

  // Prioritize outstanding payments
  if (outstanding.amount > 0) {
    // Logarithmic scale normalized to 0-100
    const logValue = Math.log10(Math.max(outstanding.amount, 1));
    return Math.min(100, (logValue / 6) * 100); // $1M = 100
  }

  // Otherwise estimate from rate
  let estimatedValue = 0;

  if (rate.type === "fixed" && rate.fixed_amount) {
    estimatedValue = rate.fixed_amount.amount;
  } else if (rate.type === "hourly" && rate.hourly_rate && rate.estimated_hours) {
    estimatedValue = rate.hourly_rate.amount * rate.estimated_hours;
  } else if (rate.type === "retainer" && rate.retainer_monthly) {
    estimatedValue = rate.retainer_monthly.amount * 3; // ~3 months value
  } else if (total_invoiced.amount > 0) {
    estimatedValue = total_invoiced.amount;
  }

  if (estimatedValue > 0) {
    const logValue = Math.log10(Math.max(estimatedValue, 1));
    return Math.min(100, (logValue / 6) * 100);
  }

  return 0;
}

/**
 * Calculate recurrence boost (0-100)
 *
 * Items get a boost as they approach their next occurrence.
 * The boost ramps up linearly within the boost window.
 */
function calculateRecurrenceBoost(project: Project, now: Date): number {
  if (!project.recurrence?.enabled) return 0;

  const {
    frequency,
    interval = 1,
    anchor_date,
    priority_boost = 50,
    boost_window_days = 7,
  } = project.recurrence;

  if (!anchor_date) return 0;

  // Calculate frequency in days
  const frequencyDays: Record<string, number> = {
    daily: 1,
    weekly: 7,
    monthly: 30,
    quarterly: 90,
  };

  const cycleDays = (frequencyDays[frequency] ?? 7) * interval;
  const anchorDate = new Date(anchor_date);
  const daysSinceAnchor = daysBetween(anchorDate, now);

  // Calculate days until next occurrence
  const daysIntoCurrentCycle = daysSinceAnchor % cycleDays;
  const daysUntilNext =
    daysIntoCurrentCycle >= 0
      ? cycleDays - daysIntoCurrentCycle
      : -daysIntoCurrentCycle;

  // Apply boost if within window
  if (daysUntilNext <= boost_window_days) {
    // Linear ramp: closer = higher boost
    const boostFactor = 1 - daysUntilNext / boost_window_days;
    return priority_boost * boostFactor;
  }

  return 0;
}

/**
 * Calculate stage modifier (multiplier 0.0-1.0)
 *
 * Active work gets highest priority, closed work gets none.
 */
function calculateStageModifier(stage: ProjectStageValue): number {
  const modifiers: Record<ProjectStageValue, number> = {
    active: 1.0,
    delivered: 0.9,
    negotiation: 0.8,
    proposal: 0.6,
    lead: 0.4,
    closed: 0.0,
  };
  return modifiers[stage] ?? 0.5;
}

// =============================================================================
// Main Calculator
// =============================================================================

/**
 * Create a default priority context
 */
export function createDefaultContext(
  weights?: Partial<PriorityWeights>
): PriorityContext {
  return {
    now: new Date(),
    weights: { ...DEFAULT_PRIORITY_WEIGHTS, ...weights },
  };
}

/**
 * Calculate priority score for a project
 */
export function calculatePriority(
  project: Project,
  context: PriorityContext = createDefaultContext()
): PriorityScore {
  const { now, weights } = context;

  // Skip closed projects
  if (project.stage === "closed") {
    return {
      total: 0,
      breakdown: {
        deadline_urgency: 0,
        manual_priority: 0,
        financial_value: 0,
        recurrence_boost: 0,
        base_score: 0,
        stage_scale: 0,
      },
    };
  }

  // Calculate component scores
  const deadlineUrgency = calculateDeadlineUrgency(project, now);
  const manualPriority = calculateManualPriority(project.priority);
  const financialValue = calculateFinancialValue(project);
  const recurrenceBoost = calculateRecurrenceBoost(project, now);
  const stageModifier = calculateStageModifier(project.stage);

  // Weighted sum of primary factors (weights should sum to ~1.0)
  const baseScore =
    deadlineUrgency * weights.deadline_urgency +
    manualPriority * weights.manual_priority +
    financialValue * weights.financial_value +
    recurrenceBoost * weights.recurrence_boost;

  // Stage acts as a scaling multiplier (not a weighted component):
  // - Active (1.0): 100% of base score
  // - Delivered (0.9): 95% of base score
  // - Lead (0.4): 70% of base score
  // This ensures active work always outranks leads at same urgency.
  // Formula: total = baseScore * (0.5 + stageModifier * 0.5)
  // Range: 0.5x to 1.0x depending on stage
  const stageScale = 0.5 + stageModifier * 0.5;
  const total = baseScore * stageScale;

  // Build breakdown
  const breakdown: PriorityBreakdown = {
    deadline_urgency: Math.round(deadlineUrgency * weights.deadline_urgency),
    manual_priority: Math.round(manualPriority * weights.manual_priority),
    financial_value: Math.round(financialValue * weights.financial_value),
    recurrence_boost: Math.round(recurrenceBoost * weights.recurrence_boost),
    base_score: Math.round(baseScore),
    stage_scale: Math.round(stageScale * 100) / 100, // e.g., 0.70
  };

  // Get nearest deadline info
  const nearestDeadline = findNearestDeadline(project);
  const daysUntilDeadline = nearestDeadline
    ? daysBetween(now, parseDeadline(nearestDeadline))
    : undefined;

  return {
    total: Math.min(100, Math.max(0, Math.round(total))),
    breakdown,
    nearest_deadline: nearestDeadline?.date,
    days_until_deadline:
      daysUntilDeadline !== undefined ? Math.round(daysUntilDeadline) : undefined,
  };
}

/**
 * Sort projects by priority (highest first)
 */
export function sortByPriority(
  projects: Project[],
  context?: PriorityContext
): Project[] {
  const ctx = context || createDefaultContext();

  return [...projects]
    .map((project) => ({
      project,
      score: calculatePriority(project, ctx),
    }))
    .sort((a, b) => b.score.total - a.score.total)
    .map(({ project, score }) => ({
      ...project,
      calculated_priority: score.total,
    }));
}

/**
 * Get projects that are overdue or due soon
 */
export function getUrgentProjects(
  projects: Project[],
  daysThreshold = 7
): Project[] {
  const now = new Date();

  return projects.filter((project) => {
    if (project.stage === "closed") return false;

    const nearest = findNearestDeadline(project);
    if (!nearest) return false;

    const daysUntil = daysBetween(now, parseDeadline(nearest));
    return daysUntil <= daysThreshold;
  });
}
