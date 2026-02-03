/**
 * Message Analytics Module
 *
 * Efficient priority scoring and network analysis using SQL.
 * No LLM required - works directly with structured data.
 */

import { Database } from "bun:sqlite";
import { join } from "path";
import { getSearchDbPath } from "../config";
import { loadBlacklist, type ThreadBlacklist } from "./blacklist";
import {
  classifyThreadTier,
  type RelationshipTier,
  type TierConfig,
  type TierMetadata,
} from "./tiers";

/**
 * Thread priority score and metadata
 */
export interface ThreadPriority {
  thread_id: string;
  title?: string;
  priority_score: number;
  total_messages: number;
  messages_7d: number;
  messages_30d: number;
  days_since_last: number;
  last_active: number;
  first_active: number;
}

/**
 * Thread priority V2 with enhanced scoring
 *
 * Improvements over V1:
 * - Platform display
 * - Outbound/inbound message tracking
 * - Archived/muted state
 * - Reciprocity ratio
 * - Participant count for group dilution
 */
export interface ThreadPriorityV2 {
  thread_id: string;
  title?: string;
  platform: string;
  type?: string;
  priority_score: number;

  // Message counts
  total_messages: number;
  outbound_messages: number;
  inbound_messages: number;
  messages_7d: number;
  messages_30d: number;

  // Group info
  participant_count: number;

  // Temporal
  days_since_last: number;
  last_active: number;
  first_active: number;

  // State
  is_archived: boolean;
  is_muted: boolean;

  // Tier classification (optional, set when includeTiers: true)
  tier?: RelationshipTier;
  tier_reason?: string;
  is_blacklisted?: boolean;
}

/**
 * Contact/account statistics
 */
export interface ContactStats {
  account_id: string;
  name?: string;
  total_messages: number;
  thread_count: number;
  avg_messages_per_thread: number;
  days_since_last: number;
  last_active: number;
}

/**
 * Account priority score and metadata
 */
export interface AccountPriority {
  account_id: string;
  priority_score: number;
  total_messages: number;
  messages_7d: number;
  messages_30d: number;
  thread_count: number;
  days_since_last: number;
  last_active: number;
  first_active: number;
}

/**
 * Network node with degree information
 */
export interface NetworkNode {
  id: string;
  type: "thread" | "account";
  degree: number; // Number of connections
  messages: number;
  last_active: number;
}

/**
 * Time-based activity analysis
 */
export interface ActivityPattern {
  hour: number;
  day_of_week: number;
  message_count: number;
}

/**
 * Priority scoring weights (legacy thread/account scoring)
 */
export interface ScoringWeights {
  recency: number; // Weight for 1/days_since_last (default: 50)
  recent_activity: number; // Weight per message in last 7 days (default: 3)
  volume: number; // Weight for log(total_messages) (default: 20)
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  recency: 50,
  recent_activity: 3,
  volume: 20,
};

/**
 * Contact priority weights with outbound focus
 *
 * The insight: If YOU message someone, that indicates priority.
 * Inbound messages might just be group noise.
 */
export interface ContactPriorityWeights {
  outbound: number; // Weight per outbound message (default: 50)
  volume: number; // Weight for log(total_messages) (default: 20)
  recency: number; // Weight for 1/days_since_last (default: 10)
  diversity: number; // Weight per unique thread (default: 10)
}

const DEFAULT_CONTACT_WEIGHTS: ContactPriorityWeights = {
  outbound: 50,
  volume: 20,
  recency: 10,
  diversity: 10,
};

/**
 * Thread priority V2 scoring weights
 *
 * Key insight: Outgoing messages (from you) indicate priority.
 * A thread you actively message is more important than one
 * that just sends you noise.
 */
export interface ThreadScoringWeightsV2 {
  outbound: number; // Weight per outbound message (default: 100)
  reciprocity: number; // Bonus for bidirectional (default: 20)
  recency: number; // Weight for exponential decay (default: 30)
  recent_activity: number; // Weight per message last 7d (default: 2)
  volume: number; // Weight for log(total) (default: 10)
  recency_decay_halflife: number; // Days for 50% decay (default: 7)

  // Tier multipliers (optional, applied when includeTiers: true)
  tierMultipliers?: {
    engaged: number; // default: 1.0
    monitor: number; // default: 0.5
    noise: number; // default: 0.1
  };
}

const DEFAULT_THREAD_WEIGHTS_V2: ThreadScoringWeightsV2 = {
  outbound: 100,
  reciprocity: 20,
  recency: 30,
  recent_activity: 2,
  volume: 10,
  recency_decay_halflife: 7,
};

// =============================================================================
// Platform-Specific Scoring (Modular Architecture)
// =============================================================================

/**
 * Email priority scoring weights
 *
 * Email is fundamentally different from messaging:
 * - No clear "outbound" concept (replies are threaded)
 * - Urgency/financial signals matter
 * - Unreplied threads need attention
 * - Sender context matters (colleague vs newsletter)
 */
export interface EmailScoringWeights {
  recency_decay_halflife: number;  // Days for 50% decay (default: 2 - faster than chat)
  financial_keywords: number;       // Bonus for bill/payment/due (default: 500)
  urgency_keywords: number;         // Bonus for urgent/ASAP/deadline (default: 300)
  question_keywords: number;        // Bonus for threads with questions (default: 100)
  base_score: number;               // Base score per email (default: 10)
}

const DEFAULT_EMAIL_WEIGHTS: EmailScoringWeights = {
  recency_decay_halflife: 2,   // Emails decay faster (2-day half-life)
  financial_keywords: 500,      // Bills get boosted significantly
  urgency_keywords: 300,
  question_keywords: 100,
  base_score: 10,
};

/**
 * Email priority result with content signals
 */
export interface EmailPriority {
  thread_id: string;
  title: string;
  priority_score: number;
  message_count: number;
  days_since_last: number;
  last_active: number;
  // Content signals
  has_financial: boolean;
  has_urgency: boolean;
  has_question: boolean;
}

// Keyword patterns for email signal detection
const FINANCIAL_KEYWORDS = /\b(bill|invoice|payment|due|balance|pay|account|statement|amount|fee|charge|overdue|past due|fortis|telus|hydro|internet|utilities?)\b/i;
const URGENCY_KEYWORDS = /\b(urgent|asap|deadline|immediately|time.?sensitive|important|action.?required|by eod|respond|reminder|follow.?up)\b/i;
const QUESTION_KEYWORDS = /\?|(\b(can you|could you|would you|please|help|question|wondering|thoughts|feedback)\b)/i;

/**
 * Contact priority result
 */
export interface ContactPriority {
  normalized_name: string;
  display_name: string;
  platforms: string[];
  outbound_messages: number;
  inbound_messages: number;
  total_messages: number;
  thread_count: number;
  first_contact: number;
  last_contact: number;
  days_since_last: number;
  priority_score: number;
}

/**
 * Message Analytics Engine
 *
 * Efficient SQL-based analytics for message prioritization.
 */
export class MessageAnalytics {
  private db: Database;
  private weights: ScoringWeights;

  constructor(dbPath?: string, weights?: Partial<ScoringWeights>) {
    this.db = new Database(dbPath ?? getSearchDbPath(), { readonly: true });
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
  }

  /**
   * Get thread priorities with composite scoring
   *
   * Score = recency_weight * (1/days) + activity_weight * recent_msgs + volume_weight * log(total)
   */
  getThreadPriorities(options: {
    limit?: number;
    minMessages?: number;
    platform?: string;
    daysBack?: number;
  } = {}): ThreadPriority[] {
    const { limit = 50, minMessages = 1, platform, daysBack = 7 } = options;
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const recentThreshold = now - daysBack * DAY;

    let platformFilter = "";
    const params: (number | string)[] = [now, recentThreshold, now - 30 * DAY];

    if (platform) {
      platformFilter = "AND platform = ?";
      params.push(platform);
    }

    params.push(minMessages, limit);

    const sql = `
      WITH thread_stats AS (
        SELECT
          thread_id,
          COUNT(*) as total,
          MAX(created_at) as last_active,
          MIN(created_at) as first_active,
          (? - MAX(created_at)) / 86400000.0 as days_ago,
          COUNT(CASE WHEN created_at > ? THEN 1 END) as msgs_7d,
          COUNT(CASE WHEN created_at > ? THEN 1 END) as msgs_30d
        FROM messages_meta
        WHERE 1=1 ${platformFilter}
        GROUP BY thread_id
        HAVING total >= ?
      )
      SELECT
        ts.thread_id,
        t.title,
        ts.total as total_messages,
        ts.last_active,
        ts.first_active,
        ts.days_ago as days_since_last,
        ts.msgs_7d as messages_7d,
        ts.msgs_30d as messages_30d,
        (${this.weights.recency} / (ts.days_ago + 1)) +
        (ts.msgs_7d * ${this.weights.recent_activity}) +
        (${this.weights.volume} * LOG(ts.total + 1) / LOG(10)) as priority_score
      FROM thread_stats ts
      LEFT JOIN threads t ON ts.thread_id = t.id
      ORDER BY priority_score DESC
      LIMIT ?
    `;

    return this.db.query(sql).all(...params) as ThreadPriority[];
  }

  /**
   * Get thread priorities with enhanced scoring (V2)
   *
   * Key improvements over V1:
   * 1. Archived/muted threads = 0 priority (hard filter)
   * 2. Outbound messages weighted exceptionally high
   * 3. Group size dilution via 1/sqrt(participants)
   * 4. Reciprocity bonus for two-way communication
   * 5. Exponential recency decay with configurable half-life
   * 6. Platform included in output
   *
   * Score formula:
   * - Base = outbound_weight * (outbound / sqrt(participants)) +
   *          reciprocity_weight * log(min(out, in) + 1) +
   *          recency_weight * 0.5^(days / halflife) +
   *          recent_activity_weight * msgs_7d +
   *          volume_weight * log(total)
   * - Final = Base * (archived || muted ? 0 : 1)
   */
  getThreadPrioritiesV2(options: {
    limit?: number;
    minMessages?: number;
    platform?: string;
    daysBack?: number;
    weights?: Partial<ThreadScoringWeightsV2>;
    includeArchived?: boolean;
    includeMuted?: boolean;
    // Blacklist options
    useBlacklist?: boolean;
    blacklistPath?: string;
    // Tier classification options
    includeTiers?: boolean;
    tierConfig?: Partial<TierConfig>;
  } = {}): ThreadPriorityV2[] {
    const {
      limit = 50,
      minMessages = 1,
      platform,
      daysBack = 7,
      includeArchived = false,
      includeMuted = false,
      weights: customWeights,
      useBlacklist = true,
      blacklistPath,
      includeTiers = false,
      tierConfig,
    } = options;

    const w = { ...DEFAULT_THREAD_WEIGHTS_V2, ...customWeights };
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const recentThreshold = now - daysBack * DAY;
    const halflife = w.recency_decay_halflife;

    // Load blacklist if enabled
    let blacklist: ThreadBlacklist | null = null;
    let blacklistFilter = "";
    if (useBlacklist) {
      blacklist = loadBlacklist(blacklistPath);
      const blacklistedIds = blacklist.getThreadIds();
      if (blacklistedIds.length > 0) {
        const placeholders = blacklistedIds.map(() => "?").join(", ");
        blacklistFilter = `AND m.thread_id NOT IN (${placeholders})`;
      }
    }

    // Build filters
    let platformFilter = "";
    let stateFilter = "";
    const params: (number | string)[] = [now, recentThreshold, now - 30 * DAY];

    if (platform) {
      platformFilter = "AND m.platform = ?";
      params.push(platform);
    }

    // Add blacklisted IDs to params (after platform, before minMessages)
    if (blacklist) {
      params.push(...blacklist.getThreadIds());
    }

    // Hard constraint: archived/muted = 0 priority (via WHERE clause)
    const stateConditions: string[] = [];
    if (!includeArchived) {
      stateConditions.push("(t.is_archived = 0 OR t.is_archived IS NULL)");
    }
    if (!includeMuted) {
      stateConditions.push("(t.is_muted = 0 OR t.is_muted IS NULL)");
    }
    if (stateConditions.length > 0) {
      stateFilter = "WHERE " + stateConditions.join(" AND ");
    }

    params.push(minMessages, limit);

    const sql = `
      WITH thread_stats AS (
        SELECT
          m.thread_id,
          COUNT(*) as total,
          COUNT(CASE WHEN m.direction = 'outgoing' THEN 1 END) as outbound,
          COUNT(CASE WHEN m.direction = 'incoming' THEN 1 END) as inbound,
          MAX(m.created_at) as last_active,
          MIN(m.created_at) as first_active,
          (? - MAX(m.created_at)) / 86400000.0 as days_ago,
          COUNT(CASE WHEN m.created_at > ? THEN 1 END) as msgs_7d,
          COUNT(CASE WHEN m.created_at > ? THEN 1 END) as msgs_30d
        FROM messages_meta m
        WHERE m.thread_id IS NOT NULL ${platformFilter} ${blacklistFilter}
        GROUP BY m.thread_id
        HAVING total >= ?
      )
      SELECT
        ts.thread_id,
        t.title,
        COALESCE(t.platform, 'unknown') as platform,
        t.type,
        COALESCE(t.participant_count, 1) as participant_count,
        COALESCE(t.is_archived, 0) as is_archived,
        COALESCE(t.is_muted, 0) as is_muted,
        ts.total as total_messages,
        ts.outbound as outbound_messages,
        ts.inbound as inbound_messages,
        ts.last_active,
        ts.first_active,
        ts.days_ago as days_since_last,
        ts.msgs_7d as messages_7d,
        ts.msgs_30d as messages_30d,

        -- Priority calculation: BaseScore × RecencyDecay × ActiveMultiplier
        -- RecencyDecay is MULTIPLICATIVE so old threads decay properly
        CASE
          WHEN COALESCE(t.is_archived, 0) = 1 OR COALESCE(t.is_muted, 0) = 1 THEN 0
          ELSE
            -- BaseScore (all additive components)
            (
              -- Outbound emphasis with group dilution (1/sqrt(N))
              (${w.outbound} * ts.outbound /
               CASE
                 WHEN COALESCE(t.participant_count, 1) <= 1 THEN 1.0
                 ELSE SQRT(CAST(COALESCE(t.participant_count, 1) AS REAL))
               END) +

              -- Reciprocity bonus (bidirectional communication)
              CASE
                WHEN ts.outbound > 0 AND ts.inbound > 0
                THEN ${w.reciprocity} * LOG(MIN(ts.outbound, ts.inbound) + 1) / LOG(10)
                ELSE 0
              END +

              -- Recent activity bonus (last 7 days)
              (ts.msgs_7d * ${w.recent_activity}) +

              -- Volume (logarithmic scale)
              (${w.volume} * LOG(ts.total + 1) / LOG(10))
            )
            -- MULTIPLY by exponential recency decay: 0.5^(days / halflife)
            -- This ensures old threads decay properly regardless of volume
            * POW(0.5, ts.days_ago / ${halflife})
        END as priority_score

      FROM thread_stats ts
      LEFT JOIN threads t ON ts.thread_id = t.id
      ${stateFilter}
      ORDER BY priority_score DESC
      LIMIT ?
    `;

    const rows = this.db.query(sql).all(...params) as Array<{
      thread_id: string;
      title: string | null;
      platform: string;
      type: string | null;
      participant_count: number;
      is_archived: number;
      is_muted: number;
      total_messages: number;
      outbound_messages: number;
      inbound_messages: number;
      last_active: number;
      first_active: number;
      days_since_last: number;
      messages_7d: number;
      messages_30d: number;
      priority_score: number;
    }>;

    // Transform to ThreadPriorityV2 with boolean flags and optional tier classification
    return rows.map((row) => {
      const result: ThreadPriorityV2 = {
        thread_id: row.thread_id,
        title: row.title || undefined,
        platform: row.platform,
        type: row.type || undefined,
        priority_score: Math.round(row.priority_score * 100) / 100,
        total_messages: row.total_messages,
        outbound_messages: row.outbound_messages,
        inbound_messages: row.inbound_messages,
        messages_7d: row.messages_7d,
        messages_30d: row.messages_30d,
        participant_count: row.participant_count,
        days_since_last: Math.round(row.days_since_last * 10) / 10,
        last_active: row.last_active,
        first_active: row.first_active,
        is_archived: row.is_archived === 1,
        is_muted: row.is_muted === 1,
      };

      // Add tier classification if requested
      if (includeTiers) {
        const tierMeta = classifyThreadTier(
          row.outbound_messages,
          row.inbound_messages,
          tierConfig
        );
        result.tier = tierMeta.tier;
        result.tier_reason = tierMeta.reason;

        // Apply tier multiplier to score if custom multipliers provided
        if (w.tierMultipliers) {
          result.priority_score = Math.round(
            result.priority_score * (w.tierMultipliers[tierMeta.tier] ?? 1) * 100
          ) / 100;
        }
      }

      return result;
    });
  }

  /**
   * Get email priorities with content-based scoring
   *
   * Email scoring is fundamentally different from messaging:
   * - No reliable outbound/inbound direction
   * - Title keywords indicate importance (bills, urgency)
   * - Faster decay (2-day half-life vs 7-day)
   * - Question detection for follow-up needs
   *
   * Score = (base + financial_bonus + urgency_bonus + question_bonus) × decay
   */
  getEmailPriorities(options: {
    limit?: number;
    weights?: Partial<EmailScoringWeights>;
  } = {}): EmailPriority[] {
    const { limit = 30, weights: customWeights } = options;
    const w = { ...DEFAULT_EMAIL_WEIGHTS, ...customWeights };
    const now = Date.now();

    // Query email threads with titles
    const sql = `
      SELECT
        m.thread_id,
        t.title,
        COUNT(*) as total,
        MAX(m.created_at) as last_active,
        (? - MAX(m.created_at)) / 86400000.0 as days_ago
      FROM messages_meta m
      LEFT JOIN threads t ON m.thread_id = t.id
      WHERE m.platform = 'email' AND m.thread_id IS NOT NULL
      GROUP BY m.thread_id
      ORDER BY last_active DESC
      LIMIT ?
    `;

    const rows = this.db.query(sql).all(now, limit * 3) as Array<{
      thread_id: string;
      title: string | null;
      total: number;
      last_active: number;
      days_ago: number;
    }>;

    // Score each thread based on title keywords
    const results: EmailPriority[] = rows.map((row) => {
      const title = row.title || "";

      // Detect signals from title
      const hasFinancial = FINANCIAL_KEYWORDS.test(title);
      const hasUrgency = URGENCY_KEYWORDS.test(title);
      const hasQuestion = QUESTION_KEYWORDS.test(title);

      // Calculate base score with bonuses
      let baseScore = w.base_score * row.total;
      if (hasFinancial) baseScore += w.financial_keywords;
      if (hasUrgency) baseScore += w.urgency_keywords;
      if (hasQuestion) baseScore += w.question_keywords;

      // Apply multiplicative recency decay
      const decayFactor = Math.pow(0.5, row.days_ago / w.recency_decay_halflife);
      const priorityScore = baseScore * decayFactor;

      return {
        thread_id: row.thread_id,
        title: title || row.thread_id,
        priority_score: Math.round(priorityScore * 100) / 100,
        message_count: row.total,
        days_since_last: Math.round(row.days_ago * 10) / 10,
        last_active: row.last_active,
        has_financial: hasFinancial,
        has_urgency: hasUrgency,
        has_question: hasQuestion,
      };
    });

    // Sort by priority and limit
    return results
      .sort((a, b) => b.priority_score - a.priority_score)
      .slice(0, limit);
  }

  /**
   * Get contact/account statistics
   */
  getContactStats(options: {
    limit?: number;
    minMessages?: number;
    platform?: string;
  } = {}): ContactStats[] {
    const { limit = 50, minMessages = 1, platform } = options;
    const now = Date.now();

    let platformFilter = "";
    const params: (number | string)[] = [now];

    if (platform) {
      platformFilter = "AND platform = ?";
      params.push(platform);
    }

    params.push(minMessages, limit);

    const sql = `
      SELECT
        account_id,
        COUNT(*) as total_messages,
        COUNT(DISTINCT thread_id) as thread_count,
        CAST(COUNT(*) AS REAL) / COUNT(DISTINCT thread_id) as avg_messages_per_thread,
        (? - MAX(created_at)) / 86400000.0 as days_since_last,
        MAX(created_at) as last_active
      FROM messages_meta
      WHERE 1=1 ${platformFilter}
      GROUP BY account_id
      HAVING total_messages >= ?
      ORDER BY total_messages DESC
      LIMIT ?
    `;

    return this.db.query(sql).all(...params) as ContactStats[];
  }

  /**
   * Get account priorities with composite scoring
   *
   * Score = recency_weight * (1/days) + activity_weight * recent_msgs + volume_weight * log(total)
   */
  getAccountPriorities(options: {
    limit?: number;
    minMessages?: number;
    platform?: string;
    daysBack?: number;
  } = {}): AccountPriority[] {
    const { limit = 50, minMessages = 1, platform, daysBack = 7 } = options;
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const recentThreshold = now - daysBack * DAY;

    let platformFilter = "";
    const params: (number | string)[] = [now, recentThreshold, now - 30 * DAY];

    if (platform) {
      platformFilter = "AND platform = ?";
      params.push(platform);
    }

    params.push(minMessages, limit);

    const sql = `
      WITH account_stats AS (
        SELECT
          account_id,
          COUNT(*) as total,
          COUNT(DISTINCT thread_id) as threads,
          MAX(created_at) as last_active,
          MIN(created_at) as first_active,
          (? - MAX(created_at)) / 86400000.0 as days_ago,
          COUNT(CASE WHEN created_at > ? THEN 1 END) as msgs_7d,
          COUNT(CASE WHEN created_at > ? THEN 1 END) as msgs_30d
        FROM messages_meta
        WHERE 1=1 ${platformFilter}
        GROUP BY account_id
        HAVING total >= ?
      )
      SELECT
        account_id,
        total as total_messages,
        threads as thread_count,
        last_active,
        first_active,
        days_ago as days_since_last,
        msgs_7d as messages_7d,
        msgs_30d as messages_30d,
        (${this.weights.recency} / (days_ago + 1)) +
        (msgs_7d * ${this.weights.recent_activity}) +
        (${this.weights.volume} * LOG(total + 1) / LOG(10)) as priority_score
      FROM account_stats
      ORDER BY priority_score DESC
      LIMIT ?
    `;

    return this.db.query(sql).all(...params) as AccountPriority[];
  }

  /**
   * Get contact priorities with outbound message weighting
   *
   * This is the key insight: If YOU message someone, that indicates priority.
   * Inbound messages might just be group chat noise.
   *
   * The algorithm:
   * 1. For INCOMING messages (them → me): attribute to the message author
   * 2. For OUTGOING messages (me → them): attribute to the THREAD, then to
   *    contacts who participate in that thread (via their own messages)
   *
   * Score = outbound_weight * outbound_msgs +
   *         volume_weight * log(total_msgs) +
   *         recency_weight / (days_since_last + 1) +
   *         diversity_weight * thread_count
   *
   * Contacts are aggregated by normalized name for cross-platform identity.
   */
  getContactPriorities(options: {
    limit?: number;
    excludeSelf?: string[]; // Names/patterns to exclude (the user's own names)
    weights?: Partial<ContactPriorityWeights>;
  } = {}): ContactPriority[] {
    const {
      limit = 50,
      excludeSelf = [],
      weights: customWeights,
    } = options;

    const w = { ...DEFAULT_CONTACT_WEIGHTS, ...customWeights };
    const now = Date.now();

    // Build exclusion patterns (lowercase)
    const excludePatterns = excludeSelf.map((s) => s.toLowerCase());

    // Helper to check if a name is "self"
    const isSelf = (name: string): boolean => {
      const normalized = name
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      return excludePatterns.some((p) => normalized.includes(p));
    };

    // Get all messages
    const sql = `
      SELECT
        data,
        direction,
        thread_id,
        platform,
        created_at
      FROM messages_meta
      WHERE 1=1
    `;

    const rows = this.db.query(sql).all() as Array<{
      data: string;
      direction: string | null;
      thread_id: string | null;
      platform: string;
      created_at: number;
    }>;

    // First pass: Build thread → participants mapping
    // For each thread, collect all non-self authors who have messaged in it
    const threadParticipants = new Map<string, Set<string>>();
    const threadPlatforms = new Map<string, string>();

    for (const row of rows) {
      const msg = JSON.parse(row.data) as { author?: { name?: string } };
      const authorName = msg.author?.name;
      if (!authorName || !row.thread_id) continue;

      if (!isSelf(authorName)) {
        if (!threadParticipants.has(row.thread_id)) {
          threadParticipants.set(row.thread_id, new Set());
          threadPlatforms.set(row.thread_id, row.platform);
        }
        threadParticipants.get(row.thread_id)!.add(authorName);
      }
    }

    // Aggregate by normalized name
    const contactMap = new Map<
      string,
      {
        names: Set<string>;
        platforms: Set<string>;
        threads: Set<string>;
        outbound: number; // Messages I sent to threads they're in
        inbound: number; // Messages they sent to me
        total: number;
        firstContact: number;
        lastContact: number;
      }
    >();

    // Helper to normalize name
    const normalizeName = (name: string): string => {
      return name
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    };

    // Helper to get or create contact
    const getContact = (name: string, platform: string, timestamp: number) => {
      const normalized = normalizeName(name);

      // Skip system/unknown
      if (
        normalized === "unknown" ||
        normalized === "telegram" ||
        normalized === "claude" ||
        normalized === "user"
      )
        return null;

      let contact = contactMap.get(normalized);
      if (!contact) {
        contact = {
          names: new Set(),
          platforms: new Set(),
          threads: new Set(),
          outbound: 0,
          inbound: 0,
          total: 0,
          firstContact: timestamp,
          lastContact: timestamp,
        };
        contactMap.set(normalized, contact);
      }

      contact.names.add(name);
      contact.platforms.add(platform);

      if (timestamp < contact.firstContact) contact.firstContact = timestamp;
      if (timestamp > contact.lastContact) contact.lastContact = timestamp;

      return contact;
    };

    // Second pass: Process messages
    for (const row of rows) {
      const msg = JSON.parse(row.data) as { author?: { name?: string } };
      const authorName = msg.author?.name;
      if (!authorName) continue;

      const authorIsSelf = isSelf(authorName);

      if (row.direction === "outgoing" && authorIsSelf) {
        // I sent this message - attribute to contacts in this thread
        // Weight by 1/participant_count to avoid group chat inflation
        // DM (1 participant) = 1.0, 12-person group = 0.083 each
        if (row.thread_id) {
          const participants = threadParticipants.get(row.thread_id);
          if (participants && participants.size > 0) {
            const weight = 1 / participants.size;
            for (const participantName of participants) {
              const contact = getContact(
                participantName,
                row.platform,
                row.created_at
              );
              if (contact) {
                contact.outbound += weight;
                contact.total += weight;
                contact.threads.add(row.thread_id);
              }
            }
          }
        }
      } else if (!authorIsSelf) {
        // They sent this message - count as inbound
        const contact = getContact(authorName, row.platform, row.created_at);
        if (contact) {
          contact.inbound++;
          contact.total++;
          if (row.thread_id) contact.threads.add(row.thread_id);
        }
      }
    }

    // Calculate priority scores and format results
    const results: ContactPriority[] = [];

    for (const [normalized, contact] of contactMap) {
      const daysSinceLast =
        (now - contact.lastContact) / (24 * 60 * 60 * 1000);

      // The scoring formula with outbound emphasis
      const score =
        w.outbound * contact.outbound +
        w.volume * Math.log10(contact.total + 1) +
        w.recency / (daysSinceLast + 1) +
        w.diversity * contact.threads.size;

      // Choose display name (longest variant)
      const displayName = [...contact.names].reduce((a, b) =>
        a.length >= b.length ? a : b
      );

      results.push({
        normalized_name: normalized,
        display_name: displayName,
        platforms: [...contact.platforms],
        outbound_messages: contact.outbound,
        inbound_messages: contact.inbound,
        total_messages: contact.total,
        thread_count: contact.threads.size,
        first_contact: contact.firstContact,
        last_contact: contact.lastContact,
        days_since_last: Math.round(daysSinceLast * 10) / 10,
        priority_score: Math.round(score * 100) / 100,
      });
    }

    // Sort by priority and limit
    return results
      .sort((a, b) => b.priority_score - a.priority_score)
      .slice(0, limit);
  }

  /**
   * Get network degree for threads (how many unique accounts participate)
   */
  getThreadNetworkDegree(limit = 50): NetworkNode[] {
    const sql = `
      SELECT
        thread_id as id,
        'thread' as type,
        COUNT(DISTINCT account_id) as degree,
        COUNT(*) as messages,
        MAX(created_at) as last_active
      FROM messages_meta
      GROUP BY thread_id
      ORDER BY degree DESC
      LIMIT ?
    `;

    return this.db.query(sql).all(limit) as NetworkNode[];
  }

  /**
   * Get network degree for accounts (how many threads they participate in)
   */
  getAccountNetworkDegree(limit = 50): NetworkNode[] {
    const sql = `
      SELECT
        account_id as id,
        'account' as type,
        COUNT(DISTINCT thread_id) as degree,
        COUNT(*) as messages,
        MAX(created_at) as last_active
      FROM messages_meta
      GROUP BY account_id
      ORDER BY degree DESC
      LIMIT ?
    `;

    return this.db.query(sql).all(limit) as NetworkNode[];
  }

  /**
   * Get activity patterns by hour and day of week
   */
  getActivityPatterns(): ActivityPattern[] {
    const sql = `
      SELECT
        CAST(strftime('%H', created_at / 1000, 'unixepoch', 'localtime') AS INTEGER) as hour,
        CAST(strftime('%w', created_at / 1000, 'unixepoch', 'localtime') AS INTEGER) as day_of_week,
        COUNT(*) as message_count
      FROM messages_meta
      GROUP BY hour, day_of_week
      ORDER BY day_of_week, hour
    `;

    return this.db.query(sql).all() as ActivityPattern[];
  }

  /**
   * Get threads active in the last N days
   */
  getRecentlyActiveThreads(days: number, limit = 50): ThreadPriority[] {
    const threshold = Date.now() - days * 24 * 60 * 60 * 1000;

    const sql = `
      SELECT
        thread_id,
        COUNT(*) as total_messages,
        MAX(created_at) as last_active,
        MIN(created_at) as first_active,
        0 as days_since_last,
        COUNT(*) as messages_7d,
        COUNT(*) as messages_30d,
        COUNT(*) as priority_score
      FROM messages_meta
      WHERE created_at > ?
      GROUP BY thread_id
      ORDER BY last_active DESC
      LIMIT ?
    `;

    return this.db.query(sql).all(threshold, limit) as ThreadPriority[];
  }

  /**
   * Get message volume over time (daily)
   */
  getVolumeOverTime(days: number = 30): Array<{ date: string; count: number }> {
    const threshold = Date.now() - days * 24 * 60 * 60 * 1000;

    const sql = `
      SELECT
        date(created_at / 1000, 'unixepoch', 'localtime') as date,
        COUNT(*) as count
      FROM messages_meta
      WHERE created_at > ?
      GROUP BY date
      ORDER BY date
    `;

    return this.db.query(sql).all(threshold) as Array<{ date: string; count: number }>;
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    total_messages: number;
    total_threads: number;
    total_accounts: number;
    platforms: Record<string, number>;
    date_range: { first: number; last: number };
  } {
    const stats = this.db
      .query(
        `SELECT
          COUNT(*) as total_messages,
          COUNT(DISTINCT thread_id) as total_threads,
          COUNT(DISTINCT account_id) as total_accounts,
          MIN(created_at) as first_message,
          MAX(created_at) as last_message
        FROM messages_meta`
      )
      .get() as {
      total_messages: number;
      total_threads: number;
      total_accounts: number;
      first_message: number;
      last_message: number;
    };

    const platformRows = this.db
      .query("SELECT platform, COUNT(*) as count FROM messages_meta GROUP BY platform")
      .all() as Array<{ platform: string; count: number }>;

    const platforms: Record<string, number> = {};
    for (const row of platformRows) {
      platforms[row.platform] = row.count;
    }

    return {
      total_messages: stats.total_messages,
      total_threads: stats.total_threads,
      total_accounts: stats.total_accounts,
      platforms,
      date_range: {
        first: stats.first_message,
        last: stats.last_message,
      },
    };
  }

  /**
   * Get thread details with recent messages
   */
  getThreadDetails(
    threadId: string,
    messageLimit = 10
  ): {
    stats: {
      total_messages: number;
      unique_accounts: number;
      first_message: number;
      last_message: number;
    };
    recent_messages: Array<{
      id: string;
      author: string;
      content: string;
      created_at: number;
    }>;
  } | null {
    const stats = this.db
      .query(
        `SELECT
          COUNT(*) as total_messages,
          COUNT(DISTINCT account_id) as unique_accounts,
          MIN(created_at) as first_message,
          MAX(created_at) as last_message
        FROM messages_meta
        WHERE thread_id = ?`
      )
      .get(threadId) as {
      total_messages: number;
      unique_accounts: number;
      first_message: number;
      last_message: number;
    };

    if (!stats || stats.total_messages === 0) {
      return null;
    }

    const messages = this.db
      .query(
        `SELECT data FROM messages_meta
         WHERE thread_id = ?
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .all(threadId, messageLimit) as Array<{ data: string }>;

    const recent_messages = messages.map((row) => {
      const msg = JSON.parse(row.data);
      return {
        id: msg.id,
        author: msg.author?.name || "unknown",
        content: msg.content?.slice(0, 500) || "",
        created_at: msg.created_at,
      };
    });

    return { stats, recent_messages };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

/**
 * Create analytics instance
 */
export function createAnalytics(
  dbPath?: string,
  weights?: Partial<ScoringWeights>
): MessageAnalytics {
  return new MessageAnalytics(dbPath, weights);
}
