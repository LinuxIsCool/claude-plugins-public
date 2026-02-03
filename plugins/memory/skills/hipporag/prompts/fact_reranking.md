# Fact Reranking (Recognition Memory) Prompt

## Purpose

Filter and rerank candidate facts based on their relevance to a query. This "recognition memory" step mimics the hippocampal pattern completion process, selecting the most relevant (subject, predicate, object) triples that will seed the Personalized PageRank algorithm. The selected facts determine which entity nodes receive initial weight in the graph traversal.

## Variables

| Variable | Type | Description |
|----------|------|-------------|
| `${question}` | string | The user's query requiring multi-hop reasoning |
| `${fact_before_filter}` | string | JSON object containing candidate facts |

## Prompt Template

### System Message

```
Your input fields are:
1. `question` (str): Query for retrieval
2. `fact_before_filter` (str): Candidate facts to be filtered

Your output fields are:
1. `fact_after_filter` (Fact): Filtered facts in JSON format

All interactions will be structured in the following way, with the appropriate values filled in.

[[ ## question ## ]]
{question}

[[ ## fact_before_filter ## ]]
{fact_before_filter}

[[ ## fact_after_filter ## ]]
{fact_after_filter}        # note: the value you produce must be pareseable according to the following JSON schema: {"type": "object", "properties": {"fact": {"type": "array", "description": "A list of facts, each fact is a list of 3 strings: [subject, predicate, object]", "items": {"type": "array", "items": {"type": "string"}}, "title": "Fact"}}, "required": ["fact"], "title": "Fact"}

[[ ## completed ## ]]

In adhering to this structure, your objective is:
You are a critical component of a high-stakes question-answering system used by top researchers and decision-makers worldwide. Your task is to filter facts based on their relevance to a given query, ensuring that the most crucial information is presented to these stakeholders. The query requires careful analysis and possibly multi-hop reasoning to connect different pieces of information. You must select up to 4 relevant facts from the provided candidate list that have a strong connection to the query, aiding in reasoning and providing an accurate answer. The output should be in JSON format, e.g., {"fact": [["s1", "p1", "o1"], ["s2", "p2", "o2"]]}, and if no facts are relevant, return an empty list, {"fact": []}. The accuracy of your response is paramount, as it will directly impact the decisions made by these high-level stakeholders. You must only use facts from the candidate list and not generate new facts. The future of critical decision-making relies on your ability to accurately filter and present relevant information.
```

### User Prompt Format

```
[[ ## question ## ]]
{question}

[[ ## fact_before_filter ## ]]
{fact_before_filter}

Respond with the corresponding output fields, starting with the field `[[ ## fact_after_filter ## ]]` (must be formatted as a valid Python Fact), and then ending with the marker for `[[ ## completed ## ]]`.
```

### Assistant Response Format

```
[[ ## fact_after_filter ## ]]
{"fact": [["subject1", "predicate1", "object1"], ["subject2", "predicate2", "object2"]]}

[[ ## completed ## ]]
```

## Full Message Array (Python)

```python
from pydantic import BaseModel, Field

class Fact(BaseModel):
    fact: list[list[str]] = Field(
        description="A list of facts, each fact is a list of 3 strings: [subject, predicate, object]"
    )

# System prompt with full DSPy-style instructions
system_prompt = """Your input fields are:
1. `question` (str): Query for retrieval
2. `fact_before_filter` (str): Candidate facts to be filtered

Your output fields are:
1. `fact_after_filter` (Fact): Filtered facts in JSON format

All interactions will be structured in the following way, with the appropriate values filled in.

[[ ## question ## ]]
{question}

[[ ## fact_before_filter ## ]]
{fact_before_filter}

[[ ## fact_after_filter ## ]]
{fact_after_filter}

[[ ## completed ## ]]

In adhering to this structure, your objective is:
You are a critical component of a high-stakes question-answering system used by top researchers and decision-makers worldwide. Your task is to filter facts based on their relevance to a given query, ensuring that the most crucial information is presented to these stakeholders. The query requires careful analysis and possibly multi-hop reasoning to connect different pieces of information. You must select up to 4 relevant facts from the provided candidate list that have a strong connection to the query, aiding in reasoning and providing an accurate answer. The output should be in JSON format, e.g., {"fact": [["s1", "p1", "o1"], ["s2", "p2", "o2"]]}, and if no facts are relevant, return an empty list, {"fact": []}. The accuracy of your response is paramount, as it will directly impact the decisions made by these high-level stakeholders. You must only use facts from the candidate list and not generate new facts."""

one_input_template = """[[ ## question ## ]]
{question}

[[ ## fact_before_filter ## ]]
{fact_before_filter}

Respond with the corresponding output fields, starting with the field `[[ ## fact_after_filter ## ]]` (must be formatted as a valid Python Fact), and then ending with the marker for `[[ ## completed ## ]]`."""

one_output_template = """[[ ## fact_after_filter ## ]]
{fact_after_filter}

[[ ## completed ## ]]"""
```

## Few-Shot Examples

### Example 1: Bridge Question (Location)

**Question:** Are Imperial River (Florida) and Amaradia (Dolj) both located in the same country?

**Facts Before Filter:**
```json
{"fact": [
    ["imperial river", "is located in", "florida"],
    ["imperial river", "is a river in", "united states"],
    ["imperial river", "may refer to", "south america"],
    ["amaradia", "flows through", "ro ia de amaradia"],
    ["imperial river", "may refer to", "united states"]
]}
```

**Facts After Filter:**
```json
{"fact": [
    ["imperial river", "is located in", "florida"],
    ["imperial river", "is a river in", "united states"],
    ["amaradia", "flows through", "ro ia de amaradia"]
]}
```

**Reasoning:** Selected facts that establish locations for both rivers. Excluded duplicate/ambiguous facts.

### Example 2: Compositional Question (Film Director)

**Question:** When is the director of film The Ancestor's birthday?

**Facts Before Filter:**
```json
{"fact": [
    ["jean jacques annaud", "born on", "1 october 1943"],
    ["tsui hark", "born on", "15 february 1950"],
    ["pablo trapero", "born on", "4 october 1971"],
    ["the ancestor", "directed by", "guido brignone"],
    ["benh zeitlin", "born on", "october 14  1982"]
]}
```

**Facts After Filter:**
```json
{"fact": [
    ["the ancestor", "directed by", "guido brignone"]
]}
```

**Reasoning:** Only the fact linking "The Ancestor" to its director is relevant. Birth dates of unrelated directors are filtered out.

### Example 3: Multi-Hop Reasoning (Geography)

**Question:** In what geographic region is the country where Teafuone is located?

**Facts Before Filter:**
```json
{"fact": [
    ["teafuaniua", "is on the", "east"],
    ["motuloa", "lies between", "teafuaniua"],
    ["motuloa", "lies between", "teafuanonu"],
    ["teafuone", "is", "islet"],
    ["teafuone", "located in", "nukufetau"]
]}
```

**Facts After Filter:**
```json
{"fact": [
    ["teafuone", "is", "islet"],
    ["teafuone", "located in", "nukufetau"]
]}
```

**Reasoning:** Selected facts about Teafuone specifically. Similar-sounding entities (teafuaniua) are excluded.

### Example 4: Comparison Question (Film Origin)

**Question:** Do both films: Gloria (1980 Film) and A New Life (Film) have the directors from the same country?

**Facts Before Filter:**
```json
{"fact": [
    ["sebasti n lelio watt", "received acclaim for directing", "gloria"],
    ["gloria", "is", "1980 american thriller crime drama film"],
    ["a brand new life", "is directed by", "ounie lecomte"],
    ["gloria", "written and directed by", "john cassavetes"],
    ["a new life", "directed by", "alan alda"]
]}
```

**Facts After Filter:**
```json
{"fact": [
    ["gloria", "is", "1980 american thriller crime drama film"],
    ["gloria", "written and directed by", "john cassavetes"],
    ["a new life", "directed by", "alan alda"]
]}
```

**Reasoning:** Selected facts about both films and their directors. Excluded "A Brand New Life" (different film) and unrelated Gloria (different director).

## Parsing the Response

```python
import re
import json
import ast
from pydantic import TypeAdapter

class Fact(BaseModel):
    fact: list[list[str]]

def parse_filter_response(response: str) -> list:
    """
    Parse the fact filter response from LLM.
    """
    sections = [(None, [])]
    field_header_pattern = re.compile(r'\[\[ ## (\w+) ## \]\]')

    for line in response.splitlines():
        match = field_header_pattern.match(line.strip())
        if match:
            sections.append((match.group(1), []))
        else:
            sections[-1][1].append(line)

    sections = [(k, "\n".join(v).strip()) for k, v in sections]

    parsed = []
    for k, value in sections:
        if k == "fact_after_filter":
            try:
                # Try JSON parsing first
                try:
                    parsed_value = json.loads(value)
                except json.JSONDecodeError:
                    # Fallback to ast.literal_eval
                    try:
                        parsed_value = ast.literal_eval(value)
                    except (ValueError, SyntaxError):
                        parsed_value = value

                # Validate with Pydantic
                parsed = TypeAdapter(Fact).validate_python(parsed_value).fact
            except Exception as e:
                print(f"Error parsing field {k}: {e}")

    return parsed
```

## Selection Criteria

### Facts to Include

1. **Directly mentioned entities**: Facts containing entities from the query
2. **Bridge facts**: Facts that connect query entities to answer entities
3. **Type/attribute facts**: Facts defining what an entity is
4. **Relationship facts**: Facts showing how entities relate

### Facts to Exclude

1. **Irrelevant entities**: Facts about different entities with similar names
2. **Duplicate information**: Multiple facts expressing the same relationship
3. **Ambiguous facts**: Facts with unclear or generic predicates
4. **Unrelated domains**: Facts from clearly different contexts

## Implementation in HippoRAG

### DSPyFilter Class

```python
class DSPyFilter:
    def __init__(self, hipporag):
        self.one_input_template = """[[ ## question ## ]]
{question}

[[ ## fact_before_filter ## ]]
{fact_before_filter}

Respond with the corresponding output fields..."""

        self.one_output_template = """[[ ## fact_after_filter ## ]]
{fact_after_filter}

[[ ## completed ## ]]"""

        self.message_template = self.make_template(dspy_file_path)
        self.llm_infer_fn = hipporag.llm_model.infer

    def rerank(self, query: str, candidate_items: list,
               candidate_indices: list, len_after_rerank: int = None):
        """
        Rerank candidate facts based on query relevance.
        """
        fact_before_filter = {"fact": [list(item) for item in candidate_items]}

        response = self.llm_call(query, json.dumps(fact_before_filter))
        generated_facts = self.parse_filter(response)

        # Match generated facts back to original candidates
        result_indices = []
        for gen_fact in generated_facts:
            closest = difflib.get_close_matches(
                str(gen_fact),
                [str(i) for i in candidate_items],
                n=1,
                cutoff=0.0
            )[0]
            result_indices.append(candidate_items.index(eval(closest)))

        sorted_indices = [candidate_indices[i] for i in result_indices]
        sorted_items = [candidate_items[i] for i in result_indices]

        return (sorted_indices[:len_after_rerank],
                sorted_items[:len_after_rerank],
                {'confidence': None})
```

## Performance Notes

### Token Budget

- **Max output tokens**: 512 (sufficient for up to 4 facts)
- **Input includes**: System prompt + few-shot demos + query + candidate facts
- **Typical latency**: 200-500ms per query

### Optimization Strategies

1. **Batch reranking**: Process multiple queries in parallel
2. **Cache responses**: Cache for identical query-fact combinations
3. **Early termination**: Skip reranking if fact scores are very low
4. **Reduced candidates**: Pre-filter by embedding similarity before LLM reranking

### Fallback Behavior

```python
def rerank_with_fallback(hipporag, query: str, fact_scores: np.ndarray):
    """
    Rerank facts with fallback to embedding-only ranking.
    """
    try:
        indices, facts, log = hipporag.rerank_facts(query, fact_scores)
        if len(facts) > 0:
            return indices, facts, log
    except Exception as e:
        logger.warning(f"Reranking failed: {e}")

    # Fallback: use top-k by embedding similarity only
    top_k = hipporag.global_config.linking_top_k
    top_indices = np.argsort(fact_scores)[-top_k:][::-1].tolist()
    top_facts = [
        eval(hipporag.fact_embedding_store.get_row(
            hipporag.fact_node_keys[idx]
        )['content'])
        for idx in top_indices
    ]

    return top_indices, top_facts, {'fallback': True}
```

## Debugging

### Logging Reranking Decisions

```python
def debug_reranking(hipporag, query: str):
    """
    Debug fact reranking for a specific query.
    """
    hipporag.prepare_retrieval_objects()
    hipporag.get_query_embeddings([query])

    fact_scores = hipporag.get_fact_scores(query)

    # Get candidates before reranking
    link_top_k = hipporag.global_config.linking_top_k
    candidate_indices = np.argsort(fact_scores)[-link_top_k:][::-1].tolist()
    candidate_facts = [
        eval(hipporag.fact_embedding_store.get_row(
            hipporag.fact_node_keys[idx]
        )['content'])
        for idx in candidate_indices
    ]

    print(f"Query: {query}")
    print(f"\nCandidate facts (by embedding score):")
    for i, (idx, fact) in enumerate(zip(candidate_indices, candidate_facts)):
        print(f"  {i+1}. [{fact_scores[idx]:.4f}] {fact}")

    # Run reranking
    result_indices, result_facts, log = hipporag.rerank_facts(query, fact_scores)

    print(f"\nReranked facts:")
    for i, fact in enumerate(result_facts):
        print(f"  {i+1}. {fact}")

    print(f"\nFiltered out:")
    kept = set(map(str, result_facts))
    for fact in candidate_facts:
        if str(fact) not in kept:
            print(f"  - {fact}")
```
