/**
 * Relationship Tier Classification
 *
 * Classifies threads into relationship tiers based on historical messaging patterns.
 *
 * Tiers:
 * - Engaged: You've messaged them (outbound > threshold)
 * - Monitor: Only inbound messages (they message you, you never replied)
 * - Noise: Below minimum activity threshold
 *
 * The key insight: If YOU message someone, that indicates priority.
 * Inbound-only threads (like spam or broadcast groups) get deprioritized.
 */

/**
 * Relationship tier type
 */
export type RelationshipTier = "engaged" | "monitor" | "noise";

/**
 * Configuration for tier classification thresholds
 */
export interface TierConfig {
  /** Minimum outbound messages to be considered "engaged" (default: 1) */
  engagedThreshold: number;

  /** Minimum total messages to avoid noise category (default: 3) */
  minimumActivity: number;
}

/**
 * Result of tier classification with reasoning
 */
export interface TierMetadata {
  tier: RelationshipTier;
  reason: string;
  multiplier: number;
}

/**
 * Default tier configuration
 */
export const DEFAULT_TIER_CONFIG: TierConfig = {
  engagedThreshold: 1, // Even 1 message from you = engaged
  minimumActivity: 3, // Need at least 3 messages to not be noise
};

/**
 * Default tier multipliers for priority scoring
 *
 * These can be overridden via ThreadScoringWeightsV2.tierMultipliers
 */
export const DEFAULT_TIER_MULTIPLIERS: Record<RelationshipTier, number> = {
  engaged: 1.0, // Full priority
  monitor: 0.5, // Half priority (inbound only)
  noise: 0.1, // Very low priority
};

/**
 * Classify a thread's relationship tier based on message patterns
 *
 * @param outboundMessages - Messages YOU sent to this thread
 * @param inboundMessages - Messages received from this thread
 * @param config - Optional custom thresholds
 * @returns Tier classification with reason and scoring multiplier
 *
 * @example
 * ```typescript
 * const tier = classifyThreadTier(5, 20);
 * // { tier: "engaged", reason: "Historical outbound: 5", multiplier: 1.0 }
 *
 * const tier2 = classifyThreadTier(0, 50);
 * // { tier: "monitor", reason: "Only inbound (50 messages)", multiplier: 0.5 }
 * ```
 */
export function classifyThreadTier(
  outboundMessages: number,
  inboundMessages: number,
  config?: Partial<TierConfig>
): TierMetadata {
  const cfg = { ...DEFAULT_TIER_CONFIG, ...config };
  const totalMessages = outboundMessages + inboundMessages;

  // Engaged tier: you've messaged them at least once
  // This is the most important check - historical outbound indicates relationship
  if (outboundMessages >= cfg.engagedThreshold) {
    return {
      tier: "engaged",
      reason: `Historical outbound: ${outboundMessages}`,
      multiplier: DEFAULT_TIER_MULTIPLIERS.engaged,
    };
  }

  // Noise tier: below minimum activity threshold
  // Catches empty threads and very low activity
  if (totalMessages < cfg.minimumActivity) {
    return {
      tier: "noise",
      reason: `Low activity (${totalMessages} messages)`,
      multiplier: DEFAULT_TIER_MULTIPLIERS.noise,
    };
  }

  // Monitor tier: only inbound, never messaged them
  // Could be spam, broadcasts, or threads you haven't responded to yet
  if (inboundMessages > 0 && outboundMessages === 0) {
    return {
      tier: "monitor",
      reason: `Only inbound (${inboundMessages} messages)`,
      multiplier: DEFAULT_TIER_MULTIPLIERS.monitor,
    };
  }

  // Fallback to noise (shouldn't normally reach here)
  return {
    tier: "noise",
    reason: "Unclassified",
    multiplier: DEFAULT_TIER_MULTIPLIERS.noise,
  };
}

/**
 * Apply tier multiplier to a priority score
 *
 * @param baseScore - The base priority score before tier adjustment
 * @param tier - The relationship tier
 * @param customMultipliers - Optional custom multipliers
 * @returns Adjusted score
 */
export function applyTierMultiplier(
  baseScore: number,
  tier: RelationshipTier,
  customMultipliers?: Partial<Record<RelationshipTier, number>>
): number {
  const multipliers = { ...DEFAULT_TIER_MULTIPLIERS, ...customMultipliers };
  return baseScore * multipliers[tier];
}

/**
 * Get tier display label for UI
 */
export function getTierLabel(tier: RelationshipTier): string {
  switch (tier) {
    case "engaged":
      return "Engaged";
    case "monitor":
      return "Monitor";
    case "noise":
      return "Noise";
  }
}

/**
 * Get tier emoji for compact display
 */
export function getTierEmoji(tier: RelationshipTier): string {
  switch (tier) {
    case "engaged":
      return "★";
    case "monitor":
      return "○";
    case "noise":
      return "·";
  }
}
