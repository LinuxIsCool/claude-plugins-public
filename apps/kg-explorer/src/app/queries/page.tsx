"use client";

import { useState, useCallback } from "react";
import { Search, BookOpen, History, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QueryBuilder } from "@/components/kg";
import type { CatalogedQuery, QueryLanguage, QueryResult } from "@/lib/types";
import { repositories } from "@/data/repositories";

// Sample cataloged queries
const INITIAL_CATALOGED_QUERIES: CatalogedQuery[] = [
  {
    id: "q1",
    name: "Critical Impact Repos",
    description: "Find all repositories with Critical singularity impact",
    language: "cypher",
    query: `MATCH (r:Repository {singularityImpact: "Critical"})
RETURN r.name, r.description, r.tier
ORDER BY r.name`,
    naturalLanguage: "Show me all repositories with Critical singularity impact",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    tags: ["critical", "impact"],
    executionCount: 12,
  },
  {
    id: "q2",
    name: "Agent Memory Stack",
    description: "Repositories focused on agent memory systems",
    language: "cypher",
    query: `MATCH (r:Repository)
WHERE r.researchFrontier = "Agent Memory"
RETURN r.name, r.singularityRelevance, r.singularityImpact
ORDER BY r.singularityImpact`,
    naturalLanguage: "Find all agent memory repositories",
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    tags: ["agents", "memory"],
    executionCount: 8,
  },
  {
    id: "q3",
    name: "Tier 2 RAG+KG",
    description: "All RAG + Knowledge Graph repositories",
    language: "sparql",
    query: `PREFIX kg: <http://knowledge-graphs.org/>
SELECT ?name ?description ?impact
WHERE {
  ?repo kg:tier "Tier 2: RAG + Knowledge Graphs" ;
        kg:name ?name ;
        kg:description ?description ;
        kg:singularityImpact ?impact .
}
ORDER BY ?impact`,
    naturalLanguage: "Get all Tier 2 RAG and Knowledge Graph repositories",
    createdAt: new Date(Date.now() - 259200000).toISOString(),
    tags: ["rag", "tier2"],
    executionCount: 5,
  },
];

export default function QueriesPage() {
  const [catalogedQueries, setCatalogedQueries] = useState<CatalogedQuery[]>(
    INITIAL_CATALOGED_QUERIES
  );
  const [activeTab, setActiveTab] = useState<"builder" | "catalog" | "docs">("builder");

  // Execute query (simulated - in production would hit actual graph DB)
  const executeQuery = useCallback(
    async (query: string, language: QueryLanguage): Promise<QueryResult> => {
      // Simulate execution delay
      await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500));

      // Parse query to determine what to return (simplified simulation)
      const lowerQuery = query.toLowerCase();

      // Simulate query execution based on keywords
      let results: object[] = [];

      if (
        lowerQuery.includes("critical") ||
        lowerQuery.includes("singularityimpact")
      ) {
        results = repositories
          .filter((r) => r.singularityImpact === "Critical")
          .map((r) => ({
            name: r.name,
            description: r.description,
            tier: r.tier,
            impact: r.singularityImpact,
          }));
      } else if (lowerQuery.includes("agent memory")) {
        results = repositories
          .filter((r) => r.researchFrontier === "Agent Memory")
          .map((r) => ({
            name: r.name,
            relevance: r.singularityRelevance,
            impact: r.singularityImpact,
          }));
      } else if (lowerQuery.includes("tier 2") || lowerQuery.includes("rag")) {
        results = repositories
          .filter((r) => r.tier === "Tier 2: RAG + Knowledge Graphs")
          .map((r) => ({
            name: r.name,
            description: r.description,
            impact: r.singularityImpact,
          }));
      } else if (lowerQuery.includes("python")) {
        results = repositories
          .filter((r) => r.language === "Python")
          .map((r) => ({
            name: r.name,
            description: r.description,
            tier: r.tier,
          }));
      } else {
        // Return sample of all repos
        results = repositories.slice(0, 10).map((r) => ({
          name: r.name,
          description: r.description,
          tier: r.tier,
        }));
      }

      return {
        success: true,
        data: results,
        rowCount: results.length,
        executionTime: Math.round(500 + Math.random() * 500),
      };
    },
    []
  );

  // Save query to catalog
  const saveQuery = useCallback((query: CatalogedQuery) => {
    setCatalogedQueries((prev) => [query, ...prev]);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Search className="w-8 h-8 text-primary" />
            Query Interface
          </h1>
          <p className="text-muted-foreground">
            Write, execute, and catalog queries across multiple graph query languages
          </p>
        </div>
      </div>

      {/* Main content */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="builder" className="gap-2">
            <Sparkles className="w-4 h-4" />
            Query Builder
          </TabsTrigger>
          <TabsTrigger value="catalog" className="gap-2">
            <History className="w-4 h-4" />
            Catalog ({catalogedQueries.length})
          </TabsTrigger>
          <TabsTrigger value="docs" className="gap-2">
            <BookOpen className="w-4 h-4" />
            Documentation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Query Builder</CardTitle>
            </CardHeader>
            <CardContent>
              <QueryBuilder
                onExecute={executeQuery}
                onSave={saveQuery}
                catalogedQueries={catalogedQueries}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="catalog" className="mt-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {catalogedQueries.map((query) => (
              <Card key={query.id} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{query.name}</CardTitle>
                    <span className="text-xs px-2 py-1 bg-muted rounded">
                      {query.language.toUpperCase()}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {query.description}
                  </p>
                  <pre className="text-xs p-3 bg-muted/50 rounded overflow-auto max-h-32">
                    {query.query}
                  </pre>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Executed {query.executionCount} times</span>
                    <span>
                      {new Date(query.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="docs" className="mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Cypher (Neo4j)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Pattern-matching query language for property graphs.
                </p>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Key Concepts</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>
                      <code className="text-xs bg-muted px-1 rounded">MATCH</code> - Pattern matching
                    </li>
                    <li>
                      <code className="text-xs bg-muted px-1 rounded">WHERE</code> - Filtering
                    </li>
                    <li>
                      <code className="text-xs bg-muted px-1 rounded">RETURN</code> - Results
                    </li>
                    <li>
                      <code className="text-xs bg-muted px-1 rounded">CREATE</code> - Node/relationship creation
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">TypeQL (TypeDB)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Strongly-typed query language for polymorphic databases.
                </p>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Key Concepts</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>
                      <code className="text-xs bg-muted px-1 rounded">match</code> - Pattern matching
                    </li>
                    <li>
                      <code className="text-xs bg-muted px-1 rounded">get</code> - Retrieve data
                    </li>
                    <li>
                      <code className="text-xs bg-muted px-1 rounded">insert</code> - Add data
                    </li>
                    <li>
                      <code className="text-xs bg-muted px-1 rounded">define</code> - Schema definition
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">SPARQL</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  W3C standard for RDF graph querying.
                </p>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Key Concepts</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>
                      <code className="text-xs bg-muted px-1 rounded">SELECT</code> - Query variables
                    </li>
                    <li>
                      <code className="text-xs bg-muted px-1 rounded">WHERE</code> - Triple patterns
                    </li>
                    <li>
                      <code className="text-xs bg-muted px-1 rounded">PREFIX</code> - Namespace shortcuts
                    </li>
                    <li>
                      <code className="text-xs bg-muted px-1 rounded">FILTER</code> - Conditions
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Gremlin (TinkerPop)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Functional graph traversal language.
                </p>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Key Concepts</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>
                      <code className="text-xs bg-muted px-1 rounded">g.V()</code> - Start at vertices
                    </li>
                    <li>
                      <code className="text-xs bg-muted px-1 rounded">has()</code> - Property filter
                    </li>
                    <li>
                      <code className="text-xs bg-muted px-1 rounded">out()</code> - Traverse outgoing
                    </li>
                    <li>
                      <code className="text-xs bg-muted px-1 rounded">values()</code> - Get properties
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
