/**
 * Gap Detector
 *
 * Compares local plugin capabilities against external catalog
 * to identify gaps and recommend plugins to explore.
 */

import type {
  Catalog,
  CatalogEntry,
  CapabilityGap,
  GapReport,
  LocalPluginEntry,
  CAPABILITY_CATEGORIES,
  CapabilityCategory,
} from "../catalog/schema.js";
import { loadFullCatalog } from "../catalog/loader.js";
import { scanAllLocalPlugins, getLocalCapabilitySummary } from "../catalog/local-scanner.js";

/**
 * Analyze capability gaps between local and external plugins
 */
export function analyzeGaps(): GapReport {
  const catalog = loadFullCatalog();
  const localPlugins = scanAllLocalPlugins();
  const localSummary = getLocalCapabilitySummary();

  // Build capability maps
  const externalCapabilities = buildExternalCapabilityMap(catalog);
  const localCapabilities = new Set(Object.keys(localSummary.capabilities));

  // Identify gaps
  const gaps: CapabilityGap[] = [];
  const coveredCapabilities: string[] = [];

  for (const [capability, externalPlugins] of Object.entries(
    externalCapabilities
  )) {
    const hasLocal = localCapabilities.has(capability);
    const localPlugins = localSummary.capabilities[capability] || [];

    if (hasLocal && localPlugins.length > 0) {
      // Full coverage
      coveredCapabilities.push(capability);
    } else if (externalPlugins.length > 0) {
      // Gap identified
      const priorityScore = calculateGapPriority(
        capability,
        externalPlugins,
        localPlugins
      );

      gaps.push({
        capability,
        localCoverage: localPlugins.length > 0,
        localPlugins,
        externalPlugins,
        priorityScore,
      });
    }
  }

  // Sort gaps by priority
  gaps.sort((a, b) => b.priorityScore - a.priorityScore);

  // Generate recommendations
  const recommendations = generateRecommendations(gaps);

  return {
    generatedAt: new Date().toISOString(),
    localPluginCount: localPlugins.length,
    externalPluginCount: Object.keys(catalog.entries).length,
    gaps,
    coveredCapabilities,
    recommendations,
  };
}

/**
 * Build a map of capabilities to external plugins that provide them
 */
function buildExternalCapabilityMap(
  catalog: Catalog
): Record<string, CatalogEntry[]> {
  const capabilityMap: Record<string, CatalogEntry[]> = {};

  for (const entry of Object.values(catalog.entries)) {
    for (const capability of entry.capabilities) {
      if (!capabilityMap[capability]) {
        capabilityMap[capability] = [];
      }
      capabilityMap[capability].push(entry);
    }
  }

  return capabilityMap;
}

/**
 * Calculate priority score for a gap
 *
 * Higher scores indicate more important gaps to fill.
 */
function calculateGapPriority(
  capability: string,
  externalPlugins: CatalogEntry[],
  localPlugins: string[]
): number {
  let score = 0;

  // More external options = more validated need
  score += Math.min(externalPlugins.length * 5, 30);

  // Partial local coverage reduces priority
  if (localPlugins.length > 0) {
    score -= 20;
  }

  // Boost for high-value capabilities
  const highValueCapabilities = [
    "security-audit",
    "testing",
    "code-review",
    "devops-cicd",
    "ai-ml",
    "llm-tooling",
  ];

  if (highValueCapabilities.includes(capability)) {
    score += 25;
  }

  // Boost for development essentials
  const essentialCapabilities = [
    "backend-development",
    "frontend-development",
    "database-management",
    "debugging",
  ];

  if (essentialCapabilities.includes(capability)) {
    score += 15;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Generate top recommendations based on gaps
 */
function generateRecommendations(
  gaps: CapabilityGap[]
): GapReport["recommendations"] {
  const recommendations: GapReport["recommendations"] = [];

  // Take top 5 gaps
  const topGaps = gaps.slice(0, 5);

  for (const gap of topGaps) {
    if (gap.externalPlugins.length === 0) continue;

    // Pick the best external plugin for this capability
    const topPlugin = selectBestPlugin(gap.externalPlugins);

    let reason = "";
    if (!gap.localCoverage) {
      reason = `No local plugins currently provide ${gap.capability}`;
    } else {
      reason = `Would enhance existing ${gap.capability} capabilities`;
    }

    recommendations.push({
      capability: gap.capability,
      topPlugin,
      reason,
    });
  }

  return recommendations;
}

/**
 * Select the best plugin from a list based on various factors
 */
function selectBestPlugin(plugins: CatalogEntry[]): CatalogEntry {
  // Simple heuristic: prefer plugins with more capabilities (more versatile)
  // and longer descriptions (better documented)
  return plugins.reduce((best, current) => {
    const bestScore =
      best.capabilities.length * 2 + best.description.length / 50;
    const currentScore =
      current.capabilities.length * 2 + current.description.length / 50;
    return currentScore > bestScore ? current : best;
  });
}

/**
 * Format gap report as markdown
 */
export function formatGapReportMarkdown(report: GapReport): string {
  const lines: string[] = [];

  lines.push("# Plugin Observatory - Gap Analysis Report");
  lines.push("");
  lines.push(`*Generated: ${new Date(report.generatedAt).toLocaleString()}*`);
  lines.push("");

  // Summary
  lines.push("## Summary");
  lines.push("");
  lines.push(`- **Local Plugins**: ${report.localPluginCount}`);
  lines.push(`- **External Catalog Size**: ${report.externalPluginCount}`);
  lines.push(`- **Capabilities Covered**: ${report.coveredCapabilities.length}`);
  lines.push(`- **Capability Gaps**: ${report.gaps.length}`);
  lines.push("");

  // Top Recommendations
  if (report.recommendations.length > 0) {
    lines.push("## Top Recommendations");
    lines.push("");

    for (let i = 0; i < report.recommendations.length; i++) {
      const rec = report.recommendations[i];
      lines.push(`### ${i + 1}. ${rec.capability}`);
      lines.push("");
      lines.push(`**Recommended**: \`${rec.topPlugin.name}\` (${rec.topPlugin.source})`);
      lines.push("");
      lines.push(`> ${rec.topPlugin.description}`);
      lines.push("");
      lines.push(`*${rec.reason}*`);
      lines.push("");
    }
  }

  // Gaps Detail
  if (report.gaps.length > 0) {
    lines.push("## Capability Gaps");
    lines.push("");
    lines.push("| Capability | Priority | Local Coverage | External Options |");
    lines.push("|------------|----------|----------------|------------------|");

    for (const gap of report.gaps) {
      const coverage = gap.localCoverage
        ? `Partial (${gap.localPlugins.join(", ")})`
        : "None";
      lines.push(
        `| ${gap.capability} | ${gap.priorityScore} | ${coverage} | ${gap.externalPlugins.length} |`
      );
    }
    lines.push("");
  }

  // Covered Capabilities
  if (report.coveredCapabilities.length > 0) {
    lines.push("## Covered Capabilities");
    lines.push("");
    lines.push(
      report.coveredCapabilities.map((c) => `- ${c}`).join("\n")
    );
    lines.push("");
  }

  lines.push("---");
  lines.push("*Generated by Plugin Observatory*");

  return lines.join("\n");
}

/**
 * Get a quick summary of gaps for CLI output
 */
export function getGapSummary(): string {
  const report = analyzeGaps();

  const lines: string[] = [];
  lines.push(`Local plugins: ${report.localPluginCount}`);
  lines.push(`External catalog: ${report.externalPluginCount} entries`);
  lines.push(`Covered capabilities: ${report.coveredCapabilities.length}`);
  lines.push(`Gaps identified: ${report.gaps.length}`);
  lines.push("");

  if (report.recommendations.length > 0) {
    lines.push("Top recommendations:");
    for (const rec of report.recommendations.slice(0, 3)) {
      lines.push(`  - ${rec.capability}: ${rec.topPlugin.name}`);
    }
  }

  return lines.join("\n");
}
