/**
 * @fileoverview Freshness monitoring for detecting stale data
 * @module kg-explorer/pipelines/monitors/freshness-monitor
 *
 * Monitors data freshness and triggers alerts/refreshes when data becomes stale:
 * - Configurable freshness thresholds per entity type
 * - Stale data detection and reporting
 * - Automatic refresh scheduling
 */

import {
  Entity,
  EntityType,
  SourceType,
  PipelineId,
  SourceId,
} from "../types";
import { createTimestamp, ISOTimestamp } from "@/types/utility-types";

// ============================================================================
// Freshness Configuration
// ============================================================================

export interface FreshnessThreshold {
  /** Entity type this threshold applies to */
  readonly entityType?: EntityType;
  /** Source type this threshold applies to */
  readonly sourceType?: SourceType;
  /** Maximum age in hours before data is considered stale */
  readonly maxAgeHours: number;
  /** Warning age in hours (before stale) */
  readonly warningAgeHours: number;
  /** Priority for refresh scheduling */
  readonly refreshPriority: "high" | "medium" | "low";
}

export interface FreshnessConfig {
  /** Enable freshness monitoring */
  readonly enabled: boolean;
  /** Default maximum age in hours */
  readonly defaultMaxAgeHours: number;
  /** Default warning age in hours */
  readonly defaultWarningAgeHours: number;
  /** Custom thresholds per type */
  readonly thresholds: FreshnessThreshold[];
  /** Check interval in milliseconds */
  readonly checkIntervalMs: number;
  /** Callback when data becomes stale */
  readonly onStale?: (report: StaleDataReport) => void | Promise<void>;
  /** Callback when data enters warning state */
  readonly onWarning?: (report: StaleDataReport) => void | Promise<void>;
}

export const DEFAULT_FRESHNESS_CONFIG: FreshnessConfig = {
  enabled: true,
  defaultMaxAgeHours: 168, // 1 week
  defaultWarningAgeHours: 72, // 3 days
  thresholds: [
    { entityType: "repository", maxAgeHours: 24, warningAgeHours: 12, refreshPriority: "high" },
    { entityType: "package", maxAgeHours: 48, warningAgeHours: 24, refreshPriority: "medium" },
    { entityType: "paper", maxAgeHours: 720, warningAgeHours: 336, refreshPriority: "low" }, // 30 days, 14 days
    { sourceType: "github", maxAgeHours: 24, warningAgeHours: 12, refreshPriority: "high" },
    { sourceType: "npm", maxAgeHours: 48, warningAgeHours: 24, refreshPriority: "medium" },
  ],
  checkIntervalMs: 3600000, // 1 hour
};

// ============================================================================
// Freshness Report Types
// ============================================================================

export interface FreshnessReport {
  readonly timestamp: ISOTimestamp;
  readonly summary: FreshnessSummary;
  readonly staleEntities: StaleDataReport[];
  readonly warningEntities: StaleDataReport[];
  readonly freshEntities: number;
  readonly byType: Record<string, TypeFreshnessStats>;
  readonly bySource: Record<string, SourceFreshnessStats>;
  readonly refreshQueue: RefreshQueueItem[];
}

export interface FreshnessSummary {
  readonly totalEntities: number;
  readonly freshCount: number;
  readonly warningCount: number;
  readonly staleCount: number;
  readonly freshnessScore: number;
  readonly avgAgeHours: number;
  readonly oldestEntityAge: number;
  readonly newestEntityAge: number;
}

export interface StaleDataReport {
  readonly entityId: string;
  readonly entityType: EntityType;
  readonly sourceType: SourceType;
  readonly name: string;
  readonly extractedAt: ISOTimestamp;
  readonly ageHours: number;
  readonly thresholdHours: number;
  readonly status: "stale" | "warning";
  readonly refreshPriority: "high" | "medium" | "low";
}

export interface TypeFreshnessStats {
  readonly total: number;
  readonly fresh: number;
  readonly warning: number;
  readonly stale: number;
  readonly avgAgeHours: number;
}

export interface SourceFreshnessStats {
  readonly total: number;
  readonly fresh: number;
  readonly warning: number;
  readonly stale: number;
  readonly avgAgeHours: number;
}

export interface RefreshQueueItem {
  readonly entityId: string;
  readonly sourceType: SourceType;
  readonly sourceId: SourceId;
  readonly priority: "high" | "medium" | "low";
  readonly reason: "stale" | "warning";
  readonly ageHours: number;
}

// ============================================================================
// Freshness Monitor
// ============================================================================

export class FreshnessMonitor {
  private readonly config: FreshnessConfig;
  private monitoredEntities = new Map<string, Entity>();
  private checkInterval: NodeJS.Timeout | null = null;
  private lastReport: FreshnessReport | null = null;

  constructor(config: Partial<FreshnessConfig> = {}) {
    this.config = { ...DEFAULT_FRESHNESS_CONFIG, ...config };
  }

  // ============================================================================
  // Entity Registration
  // ============================================================================

  registerEntity(entity: Entity): void {
    this.monitoredEntities.set(entity.id, entity);
  }

  registerEntities(entities: Entity[]): void {
    for (const entity of entities) {
      this.registerEntity(entity);
    }
  }

  unregisterEntity(entityId: string): void {
    this.monitoredEntities.delete(entityId);
  }

  clearEntities(): void {
    this.monitoredEntities.clear();
  }

  // ============================================================================
  // Freshness Assessment
  // ============================================================================

  async assessFreshness(): Promise<FreshnessReport> {
    const now = Date.now();
    const staleEntities: StaleDataReport[] = [];
    const warningEntities: StaleDataReport[] = [];
    let freshCount = 0;
    const ages: number[] = [];

    const byType: Record<string, TypeFreshnessStats> = {};
    const bySource: Record<string, SourceFreshnessStats> = {};
    const refreshQueue: RefreshQueueItem[] = [];

    for (const entity of this.monitoredEntities.values()) {
      const extractedTime = new Date(entity.extractedAt).getTime();
      const ageHours = (now - extractedTime) / (1000 * 60 * 60);
      ages.push(ageHours);

      const threshold = this.getThreshold(entity);
      const status = this.getStatus(ageHours, threshold);

      // Update type stats
      const typeStats = byType[entity.type] ?? this.createEmptyTypeStats();
      typeStats.total++;
      typeStats.avgAgeHours = (typeStats.avgAgeHours * (typeStats.total - 1) + ageHours) / typeStats.total;

      // Update source stats
      const sourceStats = bySource[entity.sourceType] ?? this.createEmptySourceStats();
      sourceStats.total++;
      sourceStats.avgAgeHours = (sourceStats.avgAgeHours * (sourceStats.total - 1) + ageHours) / sourceStats.total;

      const report: StaleDataReport = {
        entityId: entity.id,
        entityType: entity.type,
        sourceType: entity.sourceType,
        name: entity.name,
        extractedAt: entity.extractedAt,
        ageHours,
        thresholdHours: threshold.maxAgeHours,
        status: status === "fresh" ? "warning" : status,
        refreshPriority: threshold.refreshPriority,
      };

      switch (status) {
        case "stale":
          staleEntities.push(report);
          typeStats.stale++;
          sourceStats.stale++;
          refreshQueue.push({
            entityId: entity.id,
            sourceType: entity.sourceType,
            sourceId: entity.sourceId,
            priority: threshold.refreshPriority,
            reason: "stale",
            ageHours,
          });
          break;

        case "warning":
          warningEntities.push(report);
          typeStats.warning++;
          sourceStats.warning++;
          refreshQueue.push({
            entityId: entity.id,
            sourceType: entity.sourceType,
            sourceId: entity.sourceId,
            priority: this.lowerPriority(threshold.refreshPriority),
            reason: "warning",
            ageHours,
          });
          break;

        case "fresh":
          freshCount++;
          typeStats.fresh++;
          sourceStats.fresh++;
          break;
      }

      byType[entity.type] = typeStats;
      bySource[entity.sourceType] = sourceStats;
    }

    // Sort refresh queue by priority
    refreshQueue.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    const totalEntities = this.monitoredEntities.size;
    const avgAge = ages.length > 0 ? ages.reduce((a, b) => a + b, 0) / ages.length : 0;

    const report: FreshnessReport = {
      timestamp: createTimestamp(),
      summary: {
        totalEntities,
        freshCount,
        warningCount: warningEntities.length,
        staleCount: staleEntities.length,
        freshnessScore: totalEntities > 0 ? (freshCount / totalEntities) * 100 : 100,
        avgAgeHours: avgAge,
        oldestEntityAge: ages.length > 0 ? Math.max(...ages) : 0,
        newestEntityAge: ages.length > 0 ? Math.min(...ages) : 0,
      },
      staleEntities,
      warningEntities,
      freshEntities: freshCount,
      byType,
      bySource,
      refreshQueue,
    };

    this.lastReport = report;

    // Trigger callbacks
    if (staleEntities.length > 0) {
      for (const stale of staleEntities) {
        this.config.onStale?.(stale);
      }
    }

    if (warningEntities.length > 0) {
      for (const warning of warningEntities) {
        this.config.onWarning?.(warning);
      }
    }

    return report;
  }

  // ============================================================================
  // Threshold Management
  // ============================================================================

  private getThreshold(entity: Entity): FreshnessThreshold {
    // First, try to find type-specific threshold
    for (const threshold of this.config.thresholds) {
      if (threshold.entityType === entity.type) {
        return threshold;
      }
    }

    // Then, try source-specific threshold
    for (const threshold of this.config.thresholds) {
      if (threshold.sourceType === entity.sourceType && !threshold.entityType) {
        return threshold;
      }
    }

    // Return default threshold
    return {
      maxAgeHours: this.config.defaultMaxAgeHours,
      warningAgeHours: this.config.defaultWarningAgeHours,
      refreshPriority: "medium",
    };
  }

  private getStatus(
    ageHours: number,
    threshold: FreshnessThreshold
  ): "fresh" | "warning" | "stale" {
    if (ageHours >= threshold.maxAgeHours) {
      return "stale";
    }
    if (ageHours >= threshold.warningAgeHours) {
      return "warning";
    }
    return "fresh";
  }

  private lowerPriority(priority: "high" | "medium" | "low"): "high" | "medium" | "low" {
    switch (priority) {
      case "high":
        return "medium";
      case "medium":
        return "low";
      case "low":
        return "low";
    }
  }

  // ============================================================================
  // Monitoring Control
  // ============================================================================

  startMonitoring(): void {
    if (this.checkInterval || !this.config.enabled) return;

    this.checkInterval = setInterval(async () => {
      await this.assessFreshness();
    }, this.config.checkIntervalMs);
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  // ============================================================================
  // Reporting
  // ============================================================================

  getLastReport(): FreshnessReport | null {
    return this.lastReport;
  }

  getRefreshQueue(): RefreshQueueItem[] {
    return this.lastReport?.refreshQueue ?? [];
  }

  getStaleEntities(): StaleDataReport[] {
    return this.lastReport?.staleEntities ?? [];
  }

  getEntityFreshness(entityId: string): {
    status: "fresh" | "warning" | "stale" | "unknown";
    ageHours: number;
    threshold: FreshnessThreshold;
  } {
    const entity = this.monitoredEntities.get(entityId);
    if (!entity) {
      return {
        status: "unknown",
        ageHours: 0,
        threshold: {
          maxAgeHours: this.config.defaultMaxAgeHours,
          warningAgeHours: this.config.defaultWarningAgeHours,
          refreshPriority: "medium",
        },
      };
    }

    const ageHours =
      (Date.now() - new Date(entity.extractedAt).getTime()) / (1000 * 60 * 60);
    const threshold = this.getThreshold(entity);
    const status = this.getStatus(ageHours, threshold);

    return { status, ageHours, threshold };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private createEmptyTypeStats(): TypeFreshnessStats {
    return { total: 0, fresh: 0, warning: 0, stale: 0, avgAgeHours: 0 };
  }

  private createEmptySourceStats(): SourceFreshnessStats {
    return { total: 0, fresh: 0, warning: 0, stale: 0, avgAgeHours: 0 };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createFreshnessMonitor(
  config: Partial<FreshnessConfig> = {}
): FreshnessMonitor {
  return new FreshnessMonitor(config);
}

// ============================================================================
// Refresh Scheduler
// ============================================================================

export interface RefreshSchedulerConfig {
  /** Maximum concurrent refresh operations */
  readonly maxConcurrency: number;
  /** Delay between refresh batches (ms) */
  readonly batchDelayMs: number;
  /** Callback to perform refresh */
  readonly onRefresh: (item: RefreshQueueItem) => Promise<void>;
}

export class RefreshScheduler {
  private readonly config: RefreshSchedulerConfig;
  private isRunning = false;
  private queue: RefreshQueueItem[] = [];

  constructor(config: RefreshSchedulerConfig) {
    this.config = config;
  }

  enqueue(items: RefreshQueueItem[]): void {
    this.queue.push(...items);

    // Sort by priority
    this.queue.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    while (this.isRunning && this.queue.length > 0) {
      const batch = this.queue.splice(0, this.config.maxConcurrency);

      await Promise.all(
        batch.map((item) =>
          this.config.onRefresh(item).catch((error) => {
            console.error(`Refresh failed for ${item.entityId}:`, error);
          })
        )
      );

      if (this.queue.length > 0) {
        await this.sleep(this.config.batchDelayMs);
      }
    }

    this.isRunning = false;
  }

  stop(): void {
    this.isRunning = false;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  clearQueue(): void {
    this.queue = [];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export function createRefreshScheduler(
  config: RefreshSchedulerConfig
): RefreshScheduler {
  return new RefreshScheduler(config);
}
