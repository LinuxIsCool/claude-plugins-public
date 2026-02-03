import Link from "next/link";
import {
  Database,
  Network,
  Zap,
  TrendingUp,
  GitBranch,
  ArrowRight,
  Sparkles,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { repositories, computeStatistics, TIERS } from "@/data/repositories";

export default function DashboardPage() {
  const stats = computeStatistics();

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Hero Section */}
      <section className="relative rounded-2xl overflow-hidden border border-border/50 bg-card/30 backdrop-blur-sm p-8 md:p-12">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-nebula-glow opacity-50 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-stellar-burst opacity-30 pointer-events-none" />

        <div className="relative z-10 max-w-3xl">
          <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
            Singularity Research v1
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-gradient-primary">Knowledge Graph</span>
            <br />
            Explorer
          </h1>
          <p className="text-lg text-muted-foreground mb-6 max-w-2xl">
            Compiled by 22 specialized agents exploring the knowledge graph
            frontier. Navigate 378 repositories across 9 tiers of the
            singularity acceleration stack.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="gap-2 glow-primary">
              <Link href="/repositories">
                <Database className="w-4 h-4" />
                Explore Repositories
              </Link>
            </Button>
            <Button variant="outline" asChild className="gap-2">
              <Link href="/ontology">
                <Network className="w-4 h-4" />
                View Ontology
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Key Statistics */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Repositories"
          value={stats.totalRepositories}
          icon={Database}
          gradient="from-blue-500 to-cyan-500"
        />
        <StatCard
          title="Critical Impact"
          value={stats.byImpact.Critical}
          icon={Zap}
          gradient="from-red-500 to-orange-500"
        />
        <StatCard
          title="Research Frontiers"
          value={stats.trends.length}
          icon={TrendingUp}
          gradient="from-purple-500 to-pink-500"
        />
        <StatCard
          title="Tiers"
          value={9}
          icon={GitBranch}
          gradient="from-emerald-500 to-teal-500"
        />
      </section>

      {/* Main Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Singularity Impact Distribution */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Singularity Impact Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(
                [
                  { level: "Critical", color: "bg-red-500" },
                  { level: "High", color: "bg-orange-500" },
                  { level: "Medium", color: "bg-yellow-500" },
                  { level: "Foundation", color: "bg-blue-500" },
                ] as const
              ).map(({ level, color }) => {
                const count =
                  stats.byImpact[level as keyof typeof stats.byImpact];
                const percentage = Math.round(
                  (count / stats.totalRepositories) * 100
                );
                return (
                  <div key={level} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${color}`} />
                        {level}
                      </span>
                      <span className="text-muted-foreground">
                        {count} repos ({percentage}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className={`h-full ${color} transition-all duration-1000`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Research Frontiers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Research Frontiers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.trends.map((trend) => (
                <div
                  key={trend.label}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <TrendingIcon trend={trend.trend} />
                    <div>
                      <div className="font-medium text-sm">{trend.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {trend.count} repositories
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={getTrendBadgeClass(trend.trend)}
                  >
                    {trend.trend}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tier Overview */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-primary" />
            Tier Overview
          </h2>
          <Button variant="ghost" asChild className="gap-1">
            <Link href="/repositories">
              View all
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TIERS.map((tier, index) => {
            const tierRepos = repositories.filter((r) => r.tier === tier);
            const tierNumber = index + 1;
            return (
              <TierCard
                key={tier}
                tier={tier}
                tierNumber={tierNumber}
                repoCount={tierRepos.length}
                criticalCount={
                  tierRepos.filter((r) => r.singularityImpact === "Critical")
                    .length
                }
              />
            );
          })}
        </div>
      </section>

      {/* Quick Actions */}
      <section className="grid sm:grid-cols-3 gap-4">
        <QuickActionCard
          href="/insights"
          icon={Sparkles}
          title="AI Insights"
          description="Generate AI-powered insights from knowledge graph patterns"
          gradient="from-purple-500/20 to-pink-500/20"
        />
        <QuickActionCard
          href="/queries"
          icon={Database}
          title="Query Builder"
          description="Write and execute Cypher, TypeQL, SPARQL, or Gremlin queries"
          gradient="from-blue-500/20 to-cyan-500/20"
        />
        <QuickActionCard
          href="/ontology"
          icon={Network}
          title="Graph Visualization"
          description="Explore the repository ontology with interactive force graph"
          gradient="from-emerald-500/20 to-teal-500/20"
        />
      </section>
    </div>
  );
}

// Stat Card Component
function StatCard({
  title,
  value,
  icon: Icon,
  gradient,
}: {
  title: string;
  value: number;
  icon: typeof Database;
  gradient: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div
        className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-10`}
      />
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold animate-count">{value}</p>
          </div>
          <div
            className={`p-3 rounded-lg bg-gradient-to-br ${gradient} bg-opacity-20`}
          >
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Tier Card Component
function TierCard({
  tier,
  tierNumber,
  repoCount,
  criticalCount,
}: {
  tier: string;
  tierNumber: number;
  repoCount: number;
  criticalCount: number;
}) {
  const tierLabel = tier.split(":")[1]?.trim() || tier;
  return (
    <Link href={`/repositories?tier=${encodeURIComponent(tier)}`}>
      <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer group">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <Badge variant="outline" className="text-xs">
                Tier {tierNumber}
              </Badge>
              <h3 className="font-medium group-hover:text-primary transition-colors">
                {tierLabel}
              </h3>
              <p className="text-sm text-muted-foreground">
                {repoCount} repositories
              </p>
            </div>
            {criticalCount > 0 && (
              <div className="flex items-center gap-1 text-red-400">
                <Zap className="w-4 h-4" />
                <span className="text-sm font-medium">{criticalCount}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// Quick Action Card Component
function QuickActionCard({
  href,
  icon: Icon,
  title,
  description,
  gradient,
}: {
  href: string;
  icon: typeof Database;
  title: string;
  description: string;
  gradient: string;
}) {
  return (
    <Link href={href}>
      <Card className="h-full hover:border-primary/50 transition-all cursor-pointer group relative overflow-hidden">
        <div
          className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-100 transition-opacity`}
        />
        <CardContent className="pt-6 relative">
          <Icon className="w-8 h-8 mb-3 text-primary" />
          <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground">{description}</p>
          <ArrowRight className="w-4 h-4 mt-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
        </CardContent>
      </Card>
    </Link>
  );
}

// Trend Icon Component
function TrendingIcon({
  trend,
}: {
  trend: "rising" | "emerging" | "accelerating" | "explosive" | "stable";
}) {
  const colors: Record<typeof trend, string> = {
    rising: "text-emerald-400 bg-emerald-500/20",
    emerging: "text-blue-400 bg-blue-500/20",
    accelerating: "text-orange-400 bg-orange-500/20",
    explosive: "text-red-400 bg-red-500/20",
    stable: "text-gray-400 bg-gray-500/20",
  };

  return (
    <div className={`p-2 rounded-lg ${colors[trend]}`}>
      <TrendingUp className="w-4 h-4" />
    </div>
  );
}

function getTrendBadgeClass(
  trend: "rising" | "emerging" | "accelerating" | "explosive" | "stable"
): string {
  const classes: Record<typeof trend, string> = {
    rising: "border-emerald-500/30 text-emerald-400",
    emerging: "border-blue-500/30 text-blue-400",
    accelerating: "border-orange-500/30 text-orange-400",
    explosive: "border-red-500/30 text-red-400 animate-pulse",
    stable: "border-gray-500/30 text-gray-400",
  };
  return classes[trend];
}
