"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Filter, X, LayoutGrid, List, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RepositoryCard, RepositoryGrid } from "@/components/kg";
import {
  repositories,
  TIERS,
  IMPACTS,
  FRONTIERS,
  LANGUAGES,
} from "@/data/repositories";
import type { Repository, Tier, SingularityImpact, ResearchFrontier } from "@/lib/types";

type ViewMode = "grid" | "list";

// Wrapper component to handle Suspense for useSearchParams
export default function RepositoriesPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-muted rounded w-1/3"></div>
          <div className="h-10 bg-muted rounded w-full"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    }>
      <RepositoriesContent />
    </Suspense>
  );
}

function RepositoriesContent() {
  const searchParams = useSearchParams();
  const initialTier = searchParams.get("tier") as Tier | null;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTier, setSelectedTier] = useState<Tier | "all">(initialTier || "all");
  const [selectedImpact, setSelectedImpact] = useState<SingularityImpact | "all">("all");
  const [selectedFrontier, setSelectedFrontier] = useState<ResearchFrontier | "all">("all");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Update tier when URL changes
  useEffect(() => {
    if (initialTier && TIERS.includes(initialTier)) {
      setSelectedTier(initialTier);
    }
  }, [initialTier]);

  // Filter repositories
  const filteredRepositories = useMemo(() => {
    return repositories.filter((repo) => {
      // Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          repo.name.toLowerCase().includes(query) ||
          repo.description.toLowerCase().includes(query) ||
          repo.fullName.toLowerCase().includes(query) ||
          repo.singularityRelevance.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Tier filter
      if (selectedTier !== "all" && repo.tier !== selectedTier) {
        return false;
      }

      // Impact filter
      if (selectedImpact !== "all" && repo.singularityImpact !== selectedImpact) {
        return false;
      }

      // Frontier filter
      if (selectedFrontier !== "all") {
        if (selectedFrontier === "General") {
          if (repo.researchFrontier) return false;
        } else if (repo.researchFrontier !== selectedFrontier) {
          return false;
        }
      }

      // Language filter
      if (
        selectedLanguages.length > 0 &&
        !selectedLanguages.includes(repo.language || "")
      ) {
        return false;
      }

      return true;
    });
  }, [searchQuery, selectedTier, selectedImpact, selectedFrontier, selectedLanguages]);

  // Active filter count
  const activeFilters = [
    selectedTier !== "all",
    selectedImpact !== "all",
    selectedFrontier !== "all",
    selectedLanguages.length > 0,
  ].filter(Boolean).length;

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setSelectedTier("all");
    setSelectedImpact("all");
    setSelectedFrontier("all");
    setSelectedLanguages([]);
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Repository Database</h1>
          <p className="text-muted-foreground">
            {filteredRepositories.length} of {repositories.length} repositories
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("list")}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search repositories by name, description, or relevance..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery("")}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>

          {/* Filter row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Tier */}
            <Select
              value={selectedTier}
              onValueChange={(v) => setSelectedTier(v as Tier | "all")}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Tiers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                {TIERS.map((tier) => (
                  <SelectItem key={tier} value={tier}>
                    {tier.split(":")[0]} - {tier.split(":")[1]?.trim()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Impact */}
            <Select
              value={selectedImpact}
              onValueChange={(v) => setSelectedImpact(v as SingularityImpact | "all")}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Impacts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Impacts</SelectItem>
                {IMPACTS.map((impact) => (
                  <SelectItem key={impact} value={impact}>
                    {impact}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Frontier */}
            <Select
              value={selectedFrontier}
              onValueChange={(v) => setSelectedFrontier(v as ResearchFrontier | "all")}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Frontiers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Frontiers</SelectItem>
                {FRONTIERS.map((frontier) => (
                  <SelectItem key={frontier} value={frontier}>
                    {frontier}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Language dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <SlidersHorizontal className="w-4 h-4" />
                  Languages
                  {selectedLanguages.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {selectedLanguages.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuLabel>Programming Languages</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {LANGUAGES.map((lang) => (
                  <DropdownMenuCheckboxItem
                    key={lang}
                    checked={selectedLanguages.includes(lang)}
                    onCheckedChange={(checked) => {
                      setSelectedLanguages((prev) =>
                        checked
                          ? [...prev, lang]
                          : prev.filter((l) => l !== lang)
                      );
                    }}
                  >
                    {lang}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Clear filters */}
            {activeFilters > 0 && (
              <Button variant="ghost" onClick={clearFilters} className="gap-1">
                <X className="w-4 h-4" />
                Clear filters ({activeFilters})
              </Button>
            )}
          </div>

          {/* Active filters display */}
          {activeFilters > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedTier !== "all" && (
                <Badge variant="secondary" className="gap-1">
                  {selectedTier.split(":")[0]}
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() => setSelectedTier("all")}
                  />
                </Badge>
              )}
              {selectedImpact !== "all" && (
                <Badge variant="secondary" className="gap-1">
                  {selectedImpact}
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() => setSelectedImpact("all")}
                  />
                </Badge>
              )}
              {selectedFrontier !== "all" && (
                <Badge variant="secondary" className="gap-1">
                  {selectedFrontier}
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() => setSelectedFrontier("all")}
                  />
                </Badge>
              )}
              {selectedLanguages.map((lang) => (
                <Badge key={lang} variant="secondary" className="gap-1">
                  {lang}
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() =>
                      setSelectedLanguages((prev) =>
                        prev.filter((l) => l !== lang)
                      )
                    }
                  />
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {filteredRepositories.length === 0 ? (
        <Card className="py-12">
          <div className="text-center">
            <Filter className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-1">No repositories found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your filters or search query
            </p>
            <Button variant="outline" onClick={clearFilters}>
              Clear all filters
            </Button>
          </div>
        </Card>
      ) : viewMode === "grid" ? (
        <RepositoryGrid repositories={filteredRepositories} />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <RepositoryGrid repositories={filteredRepositories} compact />
          </CardContent>
        </Card>
      )}

      {/* Stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        {[
          {
            label: "Critical",
            value: filteredRepositories.filter(
              (r) => r.singularityImpact === "Critical"
            ).length,
          },
          {
            label: "High",
            value: filteredRepositories.filter(
              (r) => r.singularityImpact === "High"
            ).length,
          },
          {
            label: "Medium",
            value: filteredRepositories.filter(
              (r) => r.singularityImpact === "Medium"
            ).length,
          },
          {
            label: "Foundation",
            value: filteredRepositories.filter(
              (r) => r.singularityImpact === "Foundation"
            ).length,
          },
        ].map(({ label, value }) => (
          <div key={label} className="p-4 rounded-lg bg-muted/30">
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-sm text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
