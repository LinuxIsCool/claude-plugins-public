# Cards Plugin

Morphological data modeling for Claude Code.

## Concept

A **Card** is a universal data primitive. The same information can manifest in different *forms*:

| Form | Example |
|------|---------|
| Markdown | `card.md` with YAML frontmatter |
| JSON | `{"id": "...", "type": "...", ...}` |
| JSONL | One card per line in append-only log |
| CSV | Row in spreadsheet/dataframe |
| SQL | Record in relational database |
| Graph | Node with typed edges |
| Message | Event, transaction, request |
| Object | In-memory ORM instance |

**Morphological design** recognizes that data has *form* and that forms can transform.

## Base Ontology

Cards share a base schema:

```yaml
id: uuid
type: string
created: datetime
modified: datetime[]  # history of modifications
tags: string[]
embedding: float[]
priority: float
location: string      # virtual path
parent: card_id
neighbors: card_id[]
children: card_id[]
```

## Plugin Structure

```
plugins/cards/
├── .claude-plugin/plugin.json
├── skills/
│   ├── resources/                    # Resource acquisition skill
│   │   ├── SKILL.md
│   │   ├── cookbook/
│   │   │   ├── clone-repo.md
│   │   │   └── git-management.md
│   │   ├── prompts/
│   │   │   └── analyze-repo.md
│   │   ├── repos/                    # Cloned repositories (gitignored)
│   │   │   ├── awesome-ontology/
│   │   │   ├── claude-plugins-official/
│   │   │   ├── koi-research/
│   │   │   ├── koi-net/
│   │   │   ├── fork-repository-skill/
│   │   │   └── agent-sandbox-skill/
│   │   ├── urls/                     # Stored URL content
│   │   ├── transcripts/              # Stored transcripts
│   │   ├── repos.jsonl               # Repository index
│   │   ├── urls.jsonl                # URL index
│   │   ├── references.jsonl          # External references index
│   │   └── transcripts.jsonl         # Transcript index
│   └── research/                     # Research generation skill
│       ├── SKILL.md
│       ├── cookbook/
│       │   └── scan-repo.md
│       ├── prompts/
│       │   └── extract-patterns.md
│       ├── maps/                     # Resource structure maps
│       ├── insights/                 # Generated analysis
│       └── index.jsonl               # Research output index
├── commands/
├── .gitignore
└── README.md
```

## Skills

### resources
Acquire and manage external knowledge resources.
- Clone repositories with `@repos/{name}` tagging
- Fetch and store URL content
- Store transcripts and documents
- Track external references

### research
Generate insights and maps from acquired resources.
- Scan resources to create structure maps
- Extract patterns across resources
- Synthesize findings into insights
- Track research questions and progress

## Usage

### Reference Resources with @ Tags
```
@repos/koi-research                    # Reference entire repo
@repos/koi-research/ontologies/rea.ttl # Reference specific file
```

### Invoke Skills
```
/resources   # Resource acquisition workflows
/research    # Research generation workflows
```

## Development Status

**Phase: Initialization & Research**

### Acquired Resources
| Repository | Purpose |
|------------|---------|
| awesome-ontology | Ontology tools reference |
| claude-plugins-official | Official plugin patterns |
| koi-research | Regen Network ontologies |
| koi-net | KOI protocol schemas |
| fork-repository-skill | Skill pattern reference |
| agent-sandbox-skill | Skill pattern reference |

### Research Questions
- Minimal viable Card schema
- Transformation patterns between forms
- Graph relationship representation
- Embedding integration strategies

## Inspiration

- **KOI Protocol**: RID addressing, FUN events (Forget/Update/New)
- **personal-digital**: "Everything is a Card" pattern
- **Regen ontologies**: REA economic agents, discourse graphs
- **Morphology**: The study of form and its transformations

## License

MIT
