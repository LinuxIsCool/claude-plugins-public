"use client";

import { useState, useCallback } from "react";
import { Play, Copy, Save, Trash2, History, Code2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { QueryLanguage, CatalogedQuery, QueryResult } from "@/lib/types";

interface QueryBuilderProps {
  onExecute?: (query: string, language: QueryLanguage) => Promise<QueryResult>;
  onSave?: (query: CatalogedQuery) => void;
  catalogedQueries?: CatalogedQuery[];
}

// Example queries for different languages
const EXAMPLE_QUERIES: Record<QueryLanguage, string[]> = {
  cypher: [
    `// Find all Critical impact repositories
MATCH (r:Repository {singularityImpact: "Critical"})
RETURN r.name, r.description, r.tier`,
    `// Find connections between Agent Memory repos
MATCH (r:Repository)-[:RELATES_TO]->(other:Repository)
WHERE r.researchFrontier = "Agent Memory"
RETURN r.name, other.name, type(r)`,
    `// Count repositories by tier
MATCH (r:Repository)
RETURN r.tier, count(r) as count
ORDER BY count DESC`,
  ],
  typeql: [
    `# Find all repositories in Tier 2
match
  $repo isa repository,
    has name $name,
    has tier "Tier 2: RAG + Knowledge Graphs";
get $name;`,
    `# Find temporal KG repos with Critical impact
match
  $repo isa repository,
    has researchFrontier "Temporal KGs",
    has singularityImpact "Critical";
get;`,
  ],
  sparql: [
    `# Find all Python repositories
PREFIX kg: <http://knowledge-graphs.org/>
SELECT ?name ?description
WHERE {
  ?repo a kg:Repository ;
        kg:language "Python" ;
        kg:name ?name ;
        kg:description ?description .
}`,
    `# Count by singularity impact
PREFIX kg: <http://knowledge-graphs.org/>
SELECT ?impact (COUNT(?repo) as ?count)
WHERE {
  ?repo kg:singularityImpact ?impact .
}
GROUP BY ?impact
ORDER BY DESC(?count)`,
  ],
  gremlin: [
    `// Find all Critical repos
g.V().hasLabel('repository')
  .has('singularityImpact', 'Critical')
  .values('name', 'description')`,
    `// Traverse from a tier to its repos
g.V().hasLabel('tier')
  .has('name', 'Tier 2: RAG + Knowledge Graphs')
  .out('contains')
  .values('name')`,
  ],
};

// Language syntax hints
const LANGUAGE_HINTS: Record<QueryLanguage, string> = {
  cypher: "Neo4j Query Language - Use MATCH, WHERE, RETURN",
  typeql: "TypeDB Query Language - Use match, get, insert",
  sparql: "W3C Standard - Use SELECT, WHERE, PREFIX",
  gremlin: "Apache TinkerPop - Use g.V(), g.E(), has(), out()",
};

export function QueryBuilder({
  onExecute,
  onSave,
  catalogedQueries = [],
}: QueryBuilderProps) {
  const [language, setLanguage] = useState<QueryLanguage>("cypher");
  const [query, setQuery] = useState(EXAMPLE_QUERIES.cypher[0]);
  const [naturalLanguage, setNaturalLanguage] = useState("");
  const [queryName, setQueryName] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [activeTab, setActiveTab] = useState<"write" | "natural" | "catalog">("write");

  // Execute query
  const handleExecute = useCallback(async () => {
    if (!onExecute || !query.trim()) return;

    setIsExecuting(true);
    setResult(null);

    try {
      const queryResult = await onExecute(query, language);
      setResult(queryResult);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Query execution failed",
      });
    } finally {
      setIsExecuting(false);
    }
  }, [query, language, onExecute]);

  // Generate query from natural language
  const handleGenerateFromNL = useCallback(async () => {
    if (!naturalLanguage.trim()) return;

    setIsGenerating(true);

    try {
      // Call API to generate query
      const response = await fetch("/api/queries/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          naturalLanguage,
          targetLanguage: language,
        }),
      });

      const data = await response.json();
      if (data.success && data.query) {
        setQuery(data.query);
        setActiveTab("write");
      }
    } catch (error) {
      console.error("Failed to generate query:", error);
    } finally {
      setIsGenerating(false);
    }
  }, [naturalLanguage, language]);

  // Save query to catalog
  const handleSave = useCallback(() => {
    if (!onSave || !query.trim() || !queryName.trim()) return;

    const catalogedQuery: CatalogedQuery = {
      id: `query-${Date.now()}`,
      name: queryName,
      description: naturalLanguage || "No description provided",
      language,
      query,
      naturalLanguage,
      createdAt: new Date().toISOString(),
      tags: [],
      executionCount: 0,
    };

    onSave(catalogedQuery);
    setQueryName("");
  }, [query, queryName, naturalLanguage, language, onSave]);

  // Load example query
  const loadExample = useCallback(
    (index: number) => {
      const examples = EXAMPLE_QUERIES[language];
      if (examples[index]) {
        setQuery(examples[index]);
      }
    },
    [language]
  );

  // Copy to clipboard
  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(query);
  }, [query]);

  return (
    <div className="space-y-4">
      {/* Language selector and controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Select
            value={language}
            onValueChange={(v) => {
              setLanguage(v as QueryLanguage);
              setQuery(EXAMPLE_QUERIES[v as QueryLanguage][0]);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cypher">Cypher (Neo4j)</SelectItem>
              <SelectItem value="typeql">TypeQL (TypeDB)</SelectItem>
              <SelectItem value="sparql">SPARQL</SelectItem>
              <SelectItem value="gremlin">Gremlin</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-xs text-muted-foreground hidden sm:inline">
            {LANGUAGE_HINTS[language]}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={copyToClipboard}
            className="gap-1"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuery("")}
            className="gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </Button>
        </div>
      </div>

      {/* Query input tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="write" className="gap-1">
            <Code2 className="w-3.5 h-3.5" />
            Write Query
          </TabsTrigger>
          <TabsTrigger value="natural" className="gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            Natural Language
          </TabsTrigger>
          <TabsTrigger value="catalog" className="gap-1">
            <History className="w-3.5 h-3.5" />
            Catalog ({catalogedQueries.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="write" className="space-y-4 mt-4">
          {/* Query editor */}
          <div className="relative">
            <Textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Enter your ${language.toUpperCase()} query...`}
              className="min-h-[200px] font-mono text-sm bg-muted/50 border-border/50 focus:border-primary/50"
            />

            {/* Line numbers overlay */}
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-muted/30 rounded-l-md border-r border-border/30 pointer-events-none">
              <div className="p-2 text-xs text-muted-foreground font-mono space-y-[6px]">
                {query.split("\n").map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Example queries */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Examples:</span>
            {EXAMPLE_QUERIES[language].map((_, i) => (
              <Button
                key={i}
                variant="ghost"
                size="sm"
                onClick={() => loadExample(i)}
                className="h-7 px-2 text-xs"
              >
                Query {i + 1}
              </Button>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="natural" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Textarea
              value={naturalLanguage}
              onChange={(e) => setNaturalLanguage(e.target.value)}
              placeholder="Describe your query in plain English, e.g., 'Find all repositories with Critical singularity impact that focus on Agent Memory'"
              className="min-h-[120px] bg-muted/50"
            />
            <Button
              onClick={handleGenerateFromNL}
              disabled={isGenerating || !naturalLanguage.trim()}
              className="w-full gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate {language.toUpperCase()} Query
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="catalog" className="mt-4">
          {catalogedQueries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No saved queries yet</p>
              <p className="text-xs">Save queries to build your catalog</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-auto">
              {catalogedQueries.map((q) => (
                <Card
                  key={q.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    setQuery(q.query);
                    setLanguage(q.language);
                    setActiveTab("write");
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-sm">{q.name}</h4>
                        <p className="text-xs text-muted-foreground truncate">
                          {q.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {q.language}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {q.executionCount} runs
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Execute and save controls */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleExecute}
          disabled={isExecuting || !query.trim()}
          className="flex-1 gap-2 glow-primary"
        >
          {isExecuting ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Executing...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Execute Query
            </>
          )}
        </Button>

        <div className="flex items-center gap-2">
          <Input
            value={queryName}
            onChange={(e) => setQueryName(e.target.value)}
            placeholder="Query name..."
            className="w-40"
          />
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={!query.trim() || !queryName.trim()}
            className="gap-1"
          >
            <Save className="w-4 h-4" />
            Save
          </Button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <Card className={result.success ? "" : "border-destructive/50"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Query Result</span>
              {result.executionTime && (
                <span className="text-xs text-muted-foreground font-normal">
                  {result.executionTime}ms
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.success ? (
              <div className="space-y-2">
                {result.rowCount !== undefined && (
                  <p className="text-sm text-muted-foreground">
                    {result.rowCount} row{result.rowCount !== 1 ? "s" : ""} returned
                  </p>
                )}
                <pre className="p-3 rounded-lg bg-muted/50 text-xs font-mono overflow-auto max-h-[300px]">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="text-destructive text-sm">{result.error}</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
