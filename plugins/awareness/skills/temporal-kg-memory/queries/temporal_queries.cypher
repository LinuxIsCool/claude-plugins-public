-- =============================================================================
-- Temporal Knowledge Graph Queries for Claude Code Logs
-- =============================================================================
-- These queries work with FalkorDB via Graphiti's schema
-- Entity types are extracted automatically by Graphiti's LLM pipeline

-- =============================================================================
-- BASIC QUERIES
-- =============================================================================

-- Find all entities in a session
MATCH (e:Entity)
WHERE e.group_id = $session_id
RETURN e.name, e.entity_type, e.created_at
ORDER BY e.created_at;

-- Find all relationships (edges/facts) in a session
MATCH (s:Entity)-[r:RELATES_TO]->(t:Entity)
WHERE s.group_id = $session_id
RETURN s.name, r.fact, t.name, r.created_at
ORDER BY r.created_at;

-- Count entities by type
MATCH (e:Entity)
WHERE e.group_id = $session_id
RETURN e.entity_type, COUNT(e) as count
ORDER BY count DESC;

-- =============================================================================
-- TEMPORAL QUERIES
-- =============================================================================

-- What happened in a time window?
MATCH (e:Entity)-[r:RELATES_TO]->(t:Entity)
WHERE r.created_at >= $start_time
  AND r.created_at <= $end_time
RETURN s.name, r.fact, t.name, r.created_at
ORDER BY r.created_at;

-- When did we first discuss a topic?
MATCH (e:Entity)
WHERE e.name CONTAINS $topic
RETURN e.name, e.created_at
ORDER BY e.created_at
LIMIT 1;

-- How did understanding of a concept evolve?
MATCH (e:Entity)-[r:RELATES_TO]->(t:Entity)
WHERE e.name CONTAINS $concept OR t.name CONTAINS $concept
RETURN e.name, r.fact, t.name, r.created_at
ORDER BY r.created_at;

-- =============================================================================
-- TOOL USAGE QUERIES
-- =============================================================================

-- Which tools were used most?
MATCH (e:Entity)
WHERE e.entity_type = 'Tool'
RETURN e.name, COUNT(*) as usage_count
ORDER BY usage_count DESC;

-- Which files were modified?
MATCH (e:Entity)-[r:RELATES_TO]->(f:Entity)
WHERE r.fact CONTAINS 'edit' OR r.fact CONTAINS 'write' OR r.fact CONTAINS 'modif'
  AND f.entity_type = 'File'
RETURN f.name, COUNT(r) as modifications
ORDER BY modifications DESC;

-- Tool usage timeline
MATCH (e:Entity)
WHERE e.entity_type = 'Tool'
RETURN e.name, e.created_at
ORDER BY e.created_at;

-- =============================================================================
-- CONCEPT DISCOVERY QUERIES
-- =============================================================================

-- Find connected concepts (2 hops)
MATCH (c1:Entity {name: $concept})-[:RELATES_TO*1..2]-(c2:Entity)
WHERE c1 <> c2
RETURN DISTINCT c2.name, c2.entity_type;

-- Find concepts that appear together
MATCH (c1:Entity)-[r:RELATES_TO]->(c2:Entity)
WHERE c1.entity_type = 'Concept' AND c2.entity_type = 'Concept'
RETURN c1.name, c2.name, r.fact, COUNT(*) as co_occurrence
ORDER BY co_occurrence DESC;

-- =============================================================================
-- SESSION ANALYSIS QUERIES
-- =============================================================================

-- Session summary
MATCH (e:Entity)
WHERE e.group_id = $session_id
WITH e.entity_type as type, COUNT(e) as count
RETURN type, count
ORDER BY count DESC;

-- Cross-session patterns (what topics appear in multiple sessions?)
MATCH (e:Entity)
WITH e.name as entity, COLLECT(DISTINCT e.group_id) as sessions
WHERE SIZE(sessions) > 1
RETURN entity, SIZE(sessions) as session_count, sessions
ORDER BY session_count DESC;

-- =============================================================================
-- GRAPH STRUCTURE QUERIES
-- =============================================================================

-- Most connected entities (hubs)
MATCH (e:Entity)-[r:RELATES_TO]-(other:Entity)
WITH e, COUNT(r) as connections
RETURN e.name, e.entity_type, connections
ORDER BY connections DESC
LIMIT 20;

-- Find paths between two entities
MATCH path = shortestPath((a:Entity {name: $entity1})-[:RELATES_TO*..5]-(b:Entity {name: $entity2}))
RETURN [n IN nodes(path) | n.name] as path_nodes,
       [r IN relationships(path) | r.fact] as path_facts;

-- =============================================================================
-- DEBUGGING QUERIES
-- =============================================================================

-- Show graph statistics
CALL db.stats() YIELD * RETURN *;

-- List all labels (entity types)
CALL db.labels() YIELD label RETURN label;

-- List all relationship types
CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType;

-- Sample recent entries
MATCH (e:Entity)
RETURN e.name, e.entity_type, e.created_at
ORDER BY e.created_at DESC
LIMIT 10;
