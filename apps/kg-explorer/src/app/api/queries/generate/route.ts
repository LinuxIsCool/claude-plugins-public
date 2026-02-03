import { NextRequest, NextResponse } from "next/server";
import type { QueryLanguage } from "@/lib/types";

// Simple natural language to query translation
// In production, this would use an LLM
function translateToQuery(naturalLanguage: string, targetLanguage: QueryLanguage): string {
  const lower = naturalLanguage.toLowerCase();

  // Extract key patterns
  const hasCritical = lower.includes("critical");
  const hasAgentMemory = lower.includes("agent") && lower.includes("memory");
  const hasTemporal = lower.includes("temporal");
  const hasTier = lower.match(/tier\s*(\d+)/);
  const hasCount = lower.includes("count") || lower.includes("how many");
  const hasPython = lower.includes("python");

  switch (targetLanguage) {
    case "cypher":
      if (hasCritical) {
        return `MATCH (r:Repository {singularityImpact: "Critical"})
RETURN r.name, r.description, r.tier
ORDER BY r.name`;
      }
      if (hasAgentMemory) {
        return `MATCH (r:Repository)
WHERE r.researchFrontier = "Agent Memory"
RETURN r.name, r.singularityRelevance, r.singularityImpact`;
      }
      if (hasTier) {
        return `MATCH (r:Repository)
WHERE r.tier CONTAINS "Tier ${hasTier[1]}"
RETURN r.name, r.description
ORDER BY r.name`;
      }
      if (hasCount) {
        return `MATCH (r:Repository)
RETURN r.tier, count(r) as count
ORDER BY count DESC`;
      }
      if (hasPython) {
        return `MATCH (r:Repository {language: "Python"})
RETURN r.name, r.description, r.tier
LIMIT 20`;
      }
      return `MATCH (r:Repository)
RETURN r.name, r.description
LIMIT 10`;

    case "typeql":
      if (hasCritical) {
        return `match
  $repo isa repository,
    has name $name,
    has singularityImpact "Critical";
get $name;`;
      }
      if (hasAgentMemory) {
        return `match
  $repo isa repository,
    has researchFrontier "Agent Memory",
    has name $name;
get $name;`;
      }
      return `match
  $repo isa repository,
    has name $name;
get $name; limit 10;`;

    case "sparql":
      if (hasCritical) {
        return `PREFIX kg: <http://knowledge-graphs.org/>
SELECT ?name ?description ?tier
WHERE {
  ?repo a kg:Repository ;
        kg:singularityImpact "Critical" ;
        kg:name ?name ;
        kg:description ?description ;
        kg:tier ?tier .
}
ORDER BY ?name`;
      }
      if (hasCount) {
        return `PREFIX kg: <http://knowledge-graphs.org/>
SELECT ?tier (COUNT(?repo) as ?count)
WHERE {
  ?repo kg:tier ?tier .
}
GROUP BY ?tier
ORDER BY DESC(?count)`;
      }
      return `PREFIX kg: <http://knowledge-graphs.org/>
SELECT ?name ?description
WHERE {
  ?repo a kg:Repository ;
        kg:name ?name ;
        kg:description ?description .
}
LIMIT 10`;

    case "gremlin":
      if (hasCritical) {
        return `g.V().hasLabel('repository')
  .has('singularityImpact', 'Critical')
  .valueMap('name', 'description', 'tier')`;
      }
      if (hasAgentMemory) {
        return `g.V().hasLabel('repository')
  .has('researchFrontier', 'Agent Memory')
  .valueMap('name', 'singularityRelevance')`;
      }
      return `g.V().hasLabel('repository')
  .limit(10)
  .valueMap('name', 'description')`;

    default:
      return "";
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { naturalLanguage, targetLanguage } = body as {
      naturalLanguage: string;
      targetLanguage: QueryLanguage;
    };

    if (!naturalLanguage || !targetLanguage) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing naturalLanguage or targetLanguage parameter",
        },
        { status: 400 }
      );
    }

    // Simulate LLM thinking time
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500));

    const query = translateToQuery(naturalLanguage, targetLanguage);

    return NextResponse.json({
      success: true,
      query,
      naturalLanguage,
      targetLanguage,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Query generation failed",
      },
      { status: 500 }
    );
  }
}
