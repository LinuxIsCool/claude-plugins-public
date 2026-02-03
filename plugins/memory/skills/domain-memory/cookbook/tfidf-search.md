# Understanding TF-IDF Scoring

Deep dive into how Domain Memory Agent's TF-IDF semantic search works.

## Purpose

Understand the mathematics and intuition behind TF-IDF scoring to:
- Write better search queries
- Interpret relevance scores accurately
- Debug unexpected search results
- Optimize document content for discoverability

## Variables

```yaml
TOKENIZATION_MIN_LENGTH: 3
SMOOTHING_CONSTANT: 1
IDF_BASE: natural_log
NORMALIZATION: document_length
```

## The TF-IDF Algorithm

TF-IDF (Term Frequency-Inverse Document Frequency) scores how relevant a term is to a document within a collection.

### Core Formula

```
TF-IDF(term, document) = TF(term, document) * IDF(term)
```

Where:
- **TF** = How frequently the term appears in this document
- **IDF** = How rare the term is across all documents

### Step-by-Step Breakdown

#### Step 1: Text Tokenization

Convert text to searchable tokens:

```python
def tokenize(text: str) -> list[str]:
    """
    Normalize and split text into tokens.

    Process:
    1. Convert to lowercase
    2. Remove punctuation (replace with spaces)
    3. Split on whitespace
    4. Filter tokens shorter than 3 characters
    """
    tokens = text.lower()
    tokens = re.sub(r'[^\w\s]', ' ', tokens)
    tokens = tokens.split()
    return [t for t in tokens if len(t) > 2]

# Example
text = "Python's dict.get() method returns None by default!"
tokens = tokenize(text)
# Result: ['python', 'dict', 'get', 'method', 'returns', 'none', 'default']
```

**Key behaviors:**
- `"OAuth2.0"` becomes `["oauth2", "0"]` (punctuation splits)
- `"AI"` is filtered out (too short)
- `"machine-learning"` becomes `["machine", "learning"]`

#### Step 2: Term Frequency (TF)

Count how often each term appears in a document:

```python
def calculate_tf(tokens: list[str]) -> dict[str, float]:
    """
    Calculate normalized term frequency.

    TF(term) = (count of term in doc) / (total terms in doc)
    """
    from collections import Counter
    term_counts = Counter(tokens)
    total = len(tokens)
    return {term: count / total for term, count in term_counts.items()}

# Example document: "Python is great. Python is powerful."
tokens = ["python", "great", "python", "powerful"]
tf = calculate_tf(tokens)
# Result: {'python': 0.5, 'great': 0.25, 'powerful': 0.25}
```

**Normalization matters:**
- Raw counts favor longer documents
- Dividing by document length gives fair comparison
- A term appearing 10 times in a 100-word doc = 0.1
- A term appearing 10 times in a 1000-word doc = 0.01

#### Step 3: Document Frequency (DF)

Track how many documents contain each term:

```python
# Example corpus with 3 documents
documents = {
    "doc1": ["python", "programming", "language"],
    "doc2": ["python", "data", "science"],
    "doc3": ["javascript", "programming", "web"]
}

document_frequencies = {
    "python": 2,       # appears in doc1, doc2
    "programming": 2,  # appears in doc1, doc3
    "language": 1,     # appears in doc1 only
    "data": 1,         # appears in doc2 only
    "science": 1,      # appears in doc2 only
    "javascript": 1,   # appears in doc3 only
    "web": 1           # appears in doc3 only
}
```

#### Step 4: Inverse Document Frequency (IDF)

Calculate how rare/important a term is across the corpus:

```python
import math

def calculate_idf(term: str, total_docs: int, doc_freq: dict) -> float:
    """
    Calculate IDF with smoothing.

    IDF(term) = log((N + 1) / (DF(term) + 1))

    Where:
    - N = total number of documents
    - DF = number of documents containing the term
    - +1 prevents division by zero and log(1)=0
    """
    df = doc_freq.get(term, 0)
    return math.log((total_docs + 1) / (df + 1))

# With 3 documents:
idf_python = math.log((3 + 1) / (2 + 1))      # 0.288 (common term)
idf_language = math.log((3 + 1) / (1 + 1))    # 0.693 (rarer term)
idf_quantum = math.log((3 + 1) / (0 + 1))     # 1.386 (not in corpus)
```

**IDF intuition:**
- Common terms (appear in many docs) get LOW IDF
- Rare terms (appear in few docs) get HIGH IDF
- Terms not in corpus get highest IDF (but may indicate poor query)

#### Step 5: Combined TF-IDF Score

```python
def calculate_tfidf(query_tokens: list[str], doc_id: str) -> float:
    """
    Calculate total TF-IDF score for query against document.
    """
    score = 0.0
    doc_length = document_lengths[doc_id]

    for term in query_tokens:
        # Get term frequency in this document
        tf = term_frequencies.get(term, {}).get(doc_id, 0) / doc_length

        # Get inverse document frequency
        df = document_frequencies.get(term, 0)
        idf = math.log((total_documents + 1) / (df + 1))

        # Accumulate TF-IDF for each query term
        score += tf * idf

    return score
```

## Instructions

### Optimizing Search Queries

#### Use Specific, Rare Terms

```python
# Less effective - common terms
results = await semantic_search(query="how to code")
# "how", "to" filtered; "code" appears in many documents = low IDF

# More effective - specific terms
results = await semantic_search(query="async await implementation")
# Specific terms likely have higher IDF = better discrimination
```

#### Match Document Vocabulary

```python
# If documents use "authentication":
results = await semantic_search(query="authentication flow")  # Good

# But query uses "login":
results = await semantic_search(query="login flow")  # May miss matches
# TF-IDF is literal - no synonym understanding
```

#### Query Length Sweet Spot

```python
# Too short - not enough signal
results = await semantic_search(query="error")

# Too long - dilutes important terms
results = await semantic_search(
    query="I want to find information about handling errors in Python applications"
)
# Stop words filtered, but "information", "applications" add noise

# Optimal - key terms only
results = await semantic_search(query="Python error handling exceptions")
```

### Interpreting Scores

```python
results = await semantic_search(query="machine learning models")

for result in results["results"]:
    score = result["score"]

    if score > 0.5:
        # High relevance: Multiple query terms appear frequently
        print(f"Excellent: {result['title']}")
    elif score > 0.2:
        # Moderate relevance: Some terms match
        print(f"Related: {result['title']}")
    else:
        # Low relevance: Minimal overlap
        print(f"Tangential: {result['title']}")
```

### Debugging Search Results

#### Why did this document rank higher?

```python
# Check which query terms appear in the document
results = await semantic_search(query="Python async programming")

# The relevantExcerpts field shows which sentences matched
for result in results["results"]:
    print(f"Score: {result['score']}")
    print(f"Title: {result['title']}")
    for excerpt in result["relevantExcerpts"]:
        print(f"  Matched: {excerpt}")
```

#### Why didn't my document appear?

```python
# 1. Check if document exists
all_docs = await list_documents()
doc_titles = [d["title"] for d in all_docs["documents"]]

# 2. Verify query terms exist in document
doc = await get_document(documentId="expected-doc-id")
doc_tokens = set(tokenize(doc["content"]))
query_tokens = set(tokenize("your search query"))
overlap = doc_tokens & query_tokens
print(f"Matching terms: {overlap}")

# 3. Check for vocabulary mismatch
# Document uses: "authentication", "credentials"
# Query uses: "login", "password"
# No overlap = no match with TF-IDF
```

## Common Patterns

### Pattern 1: Multi-Term Scoring

```python
# Query: "Python web framework"
# Document scores accumulate across all matching terms

document_1 = "Python Flask is a lightweight web framework..."
# - "python": TF=0.05, IDF=0.4 -> 0.02
# - "web": TF=0.03, IDF=0.5 -> 0.015
# - "framework": TF=0.03, IDF=0.6 -> 0.018
# Total: 0.053

document_2 = "Django is a Python web framework for perfectionists..."
# - "python": TF=0.04, IDF=0.4 -> 0.016
# - "web": TF=0.04, IDF=0.5 -> 0.02
# - "framework": TF=0.04, IDF=0.6 -> 0.024
# Total: 0.06 (ranks higher due to better term distribution)
```

### Pattern 2: Rare Term Boost

```python
# Rare terms discriminate better
# Query: "PostgreSQL connection pooling"

# "PostgreSQL" appears in 2 of 100 docs -> high IDF (3.9)
# "connection" appears in 20 of 100 docs -> medium IDF (1.6)
# "pooling" appears in 3 of 100 docs -> high IDF (3.5)

# Documents with "PostgreSQL" and "pooling" will rank much higher
# than documents only mentioning "connection"
```

### Pattern 3: Document Length Normalization

```python
# Short document with focused content
doc_short = "PostgreSQL connection pooling with pgbouncer configuration."
# 6 tokens, "pooling" appears once -> TF = 1/6 = 0.167

# Long document mentioning pooling once
doc_long = "..." * 500 + "pooling" + "..." * 500
# 1000 tokens, "pooling" appears once -> TF = 1/1000 = 0.001

# Short, focused document scores higher for specific queries
```

## Score Calibration Reference

| Scenario | Expected Score Range |
|----------|---------------------|
| Exact title match | 0.7 - 1.0 |
| Multiple key terms match | 0.4 - 0.7 |
| Single key term match | 0.1 - 0.4 |
| Only common terms match | 0.01 - 0.1 |
| No meaningful overlap | 0.0 |

## Limitations to Understand

### No Semantic Understanding

```python
# TF-IDF cannot match:
# Query: "automobile" -> Document: "car" (synonyms)
# Query: "happy" -> Document: "joyful" (similar meaning)
# Query: "NYC" -> Document: "New York City" (abbreviations)
```

### Word Order Ignored

```python
# These queries produce identical results:
await semantic_search(query="Python learning machine")
await semantic_search(query="machine learning Python")
# TF-IDF treats queries as bags of words
```

### No Phrase Matching

```python
# Cannot search for exact phrases:
# Query: "machine learning" (as a concept)
# Matches: "the machine was learning slowly" (unrelated context)
```

## When TF-IDF Excels

- Keyword-rich technical documentation
- Code snippets and API references
- Structured data with consistent vocabulary
- Domain-specific knowledge bases
- Fast, explainable search results

## See Also

- `hybrid-approach.md` - Combine TF-IDF with embeddings for semantic understanding
- `extractive-summarization.md` - How summarization uses term importance
- `../tools/tfidf_calculator.py` - Standalone implementation for experimentation
