"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, GitFork, Star, Zap, TrendingUp, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Repository, SingularityImpact, ResearchFrontier } from "@/lib/types";

interface RepositoryCardProps {
  repository: Repository;
  compact?: boolean;
}

// Impact color mapping
const IMPACT_COLORS: Record<SingularityImpact, string> = {
  Critical: "bg-red-500/20 text-red-400 border-red-500/30",
  High: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Foundation: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

// Frontier color mapping
const FRONTIER_COLORS: Record<ResearchFrontier, string> = {
  "Temporal KGs": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "Multi-modal KGs": "bg-pink-500/20 text-pink-400 border-pink-500/30",
  "Neuro-symbolic": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  "Agent Memory": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  General: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

// Tier accent mapping
const TIER_ACCENTS: Record<string, string> = {
  "Tier 1: Core Infrastructure": "from-blue-500/20 to-blue-600/10",
  "Tier 2: RAG + Knowledge Graphs": "from-purple-500/20 to-purple-600/10",
  "Tier 3: KG Embedding & Reasoning": "from-cyan-500/20 to-cyan-600/10",
  "Tier 4: Graph Neural Networks": "from-green-500/20 to-green-600/10",
  "Tier 5: Knowledge Bases & Datasets": "from-yellow-500/20 to-yellow-600/10",
  "Tier 6: Visualization & Exploration": "from-orange-500/20 to-orange-600/10",
  "Tier 7: NLP & Entity Extraction": "from-red-500/20 to-red-600/10",
  "Tier 8: Agent Frameworks": "from-pink-500/20 to-pink-600/10",
  "Tier 9: Research & Awesome Lists": "from-indigo-500/20 to-indigo-600/10",
};

export function RepositoryCard({ repository, compact = false }: RepositoryCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const tierNumber = repository.tier.match(/Tier (\d+)/)?.[1] || "?";
  const tierGradient = TIER_ACCENTS[repository.tier] || "from-gray-500/20 to-gray-600/10";

  if (compact) {
    return (
      <div
        className="group flex items-center gap-3 p-3 rounded-lg bg-card/50 hover:bg-card/80 border border-border/50 hover:border-primary/30 transition-all duration-200 cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Tier indicator */}
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br ${tierGradient} flex items-center justify-center text-sm font-bold`}
        >
          {tierNumber}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium truncate">{repository.name}</h4>
            {repository.singularityImpact === "Critical" && (
              <Zap className="w-3 h-3 text-red-400 flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {repository.description}
          </p>
        </div>

        {/* Quick badges */}
        <div className="flex-shrink-0 flex items-center gap-1">
          {repository.language && (
            <Badge variant="outline" className="text-xs px-1.5 py-0">
              {repository.language}
            </Badge>
          )}
          <Link
            href={repository.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 hover:bg-primary/20 rounded transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <Card
      className={`relative overflow-hidden transition-all duration-300 ${
        isHovered ? "glow-primary scale-[1.02]" : ""
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Gradient accent stripe */}
      <div
        className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${tierGradient}`}
      />

      {/* Animated border glow */}
      {repository.singularityImpact === "Critical" && (
        <div className="absolute inset-0 border-gradient-animate pointer-events-none" />
      )}

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Tier badge */}
            <div
              className={`w-10 h-10 rounded-lg bg-gradient-to-br ${tierGradient} flex items-center justify-center text-lg font-bold`}
            >
              {tierNumber}
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {repository.name}
                {repository.singularityImpact === "Critical" && (
                  <Zap className="w-4 h-4 text-red-400 animate-pulse" />
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {repository.fullName}
              </p>
            </div>
          </div>

          <Link
            href={repository.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 hover:bg-primary/20 rounded-lg transition-colors flex-shrink-0"
          >
            <ExternalLink className="w-5 h-5" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Description */}
        <p className="text-sm">{repository.description}</p>

        {/* Singularity Relevance */}
        <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <TrendingUp className="w-3 h-3" />
            Singularity Relevance
          </div>
          <p className="text-sm font-medium">{repository.singularityRelevance}</p>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          {repository.singularityImpact && (
            <Badge
              variant="outline"
              className={IMPACT_COLORS[repository.singularityImpact]}
            >
              <Zap className="w-3 h-3 mr-1" />
              {repository.singularityImpact}
            </Badge>
          )}

          {repository.researchFrontier && (
            <Badge
              variant="outline"
              className={FRONTIER_COLORS[repository.researchFrontier]}
            >
              <TrendingUp className="w-3 h-3 mr-1" />
              {repository.researchFrontier}
            </Badge>
          )}

          {repository.language && (
            <Badge variant="secondary">{repository.language}</Badge>
          )}
        </div>

        {/* Stats (if available) */}
        {(repository.stars || repository.forks || repository.lastUpdated) && (
          <div className="flex items-center gap-4 pt-2 border-t border-border/50 text-sm text-muted-foreground">
            {repository.stars && (
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4" />
                {repository.stars.toLocaleString()}
              </div>
            )}
            {repository.forks && (
              <div className="flex items-center gap-1">
                <GitFork className="w-4 h-4" />
                {repository.forks.toLocaleString()}
              </div>
            )}
            {repository.lastUpdated && (
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {repository.lastUpdated}
              </div>
            )}
          </div>
        )}

        {/* Tier label */}
        <div className="text-xs text-muted-foreground truncate">
          {repository.tier}
        </div>
      </CardContent>
    </Card>
  );
}

// Grid component for repository cards
export function RepositoryGrid({
  repositories,
  compact = false,
}: {
  repositories: Repository[];
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="space-y-2">
        {repositories.map((repo) => (
          <RepositoryCard key={repo.id} repository={repo} compact />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {repositories.map((repo) => (
        <RepositoryCard key={repo.id} repository={repo} />
      ))}
    </div>
  );
}
