---
name: anthropic-courses
description: Master Anthropic's official educational courses covering API fundamentals, prompt engineering, evaluations, and tool use. Use when learning Claude API patterns, prompt engineering techniques, building evaluation frameworks, or implementing tool calling. Contains 27+ interactive notebooks.
allowed-tools: Read, Glob, Grep, Bash
---

# Anthropic Courses Mastery

Comprehensive LLM education from API basics to advanced patterns.

## Territory Map

```
resources/embeddings/courses/
├── anthropic_api_fundamentals/
│   ├── 01_getting_started.ipynb
│   ├── 02_messages_format.ipynb
│   ├── 03_models.ipynb
│   ├── 04_parameters.ipynb
│   ├── 05_Streaming.ipynb
│   └── 06_vision.ipynb
├── prompt_engineering_interactive_tutorial/
│   ├── 01-09 chapters (beginner → advanced)
│   └── Appendix (chaining, tools, search)
├── real_world_prompting/
│   ├── Medical, Call summarizer, Customer support
│   └── Prompt engineering lifecycle
├── prompt_evaluations/
│   ├── Human, code, and model-graded evals
│   └── promptfoo integration (5 examples)
└── tool_use/
    ├── 01-06 tool use progression
    └── Complete workflow patterns
```

## Learning Progression

### Level 1: API Fundamentals
**Concepts**: SDK setup, message format, tokens, parameters

```python
from anthropic import Anthropic
client = Anthropic()

response = client.messages.create(
    model="claude-3-haiku-20240307",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}]
)
```

**Key Parameters**:
- `max_tokens`: Upper limit on output (doesn't guarantee length)
- `temperature`: 0=deterministic, 1=creative
- `stop_sequences`: Strings that halt generation
- `system`: High-level instructions for tone/role

### Level 2: Prompt Engineering (9 Chapters)

**Beginner**:
1. Basic prompt structure
2. Being clear and direct
3. Role prompting (personas)

**Intermediate**:
4. Separating data from instructions
5. Formatting output & speaking for Claude
6. Precognition (chain-of-thought)
7. Few-shot prompting

**Advanced**:
8. Avoiding hallucinations
9. Complex prompts (industry use cases)

### Level 3: Real-World Application

**The Prompt Engineering Lifecycle**:
```
1. Create initial prompt
2. Test and identify issues
3. Select appropriate techniques
4. Implement improvements
5. Iterate and refine
```

**Metrics to Track**:
- Accuracy: Correctness and relevance
- Consistency: Performance across inputs
- Completeness: All required information
- Adherence: Following directions

### Level 4: Evaluations

**Grading Approaches**:
1. **Human-based**: Expert review, domain validation
2. **Code-based**: Exact match, keyword, regex
3. **LLM-based**: Claude as evaluator with rubrics

**promptfoo Framework**:
```bash
# Configure test cases in YAML
# Run: promptfoo eval
# Compare prompt versions systematically
```

**Recommendation**: 100+ test case pairs for production

### Level 5: Tool Use

**4-Step Workflow**:
```
1. Provide tools & prompt → API call
2. Claude uses tool → returns tool_use
3. Extract, run, return → execute function
4. Claude formulates response → final answer
```

**Tool Definition**:
```python
{
    "name": "function_name",
    "description": "Clear description",
    "input_schema": {
        "type": "object",
        "properties": {...},
        "required": [...]
    }
}
```

## Key Techniques by Chapter

| Chapter | Technique | Description |
|---------|-----------|-------------|
| 3 | Role prompting | Assign personas for expertise |
| 5 | Prefill | Start Claude's response |
| 6 | Chain-of-thought | Step-by-step reasoning |
| 7 | Few-shot | In-context learning |
| 8 | Grounding | Prevent hallucinations |
| 9 | Chaining | Multi-step workflows |

## Course Recommendations

**Start Here**: `anthropic_api_fundamentals/01_getting_started.ipynb`

**For Prompt Engineers**: Complete all 9 chapters of `prompt_engineering_interactive_tutorial/`

**For Production**: `prompt_evaluations/` (build test suites before deploying)

**For Tool Builders**: `tool_use/04_complete_workflow.ipynb`

## When to Use This Skill

- Learning Claude API from scratch
- Mastering prompt engineering techniques
- Building evaluation frameworks
- Implementing tool/function calling
- Diagnosing prompt failures
- Training team members on LLM best practices

## Reference Files

- API basics: `anthropic_api_fundamentals/01_getting_started.ipynb`
- Prompt engineering: `prompt_engineering_interactive_tutorial/`
- Evals intro: `prompt_evaluations/01_intro_to_evals/`
- Tool workflow: `tool_use/04_complete_workflow.ipynb`
