# Interview Conduct Cookbook

Execute the main interview loop with adaptive questioning.

## Pre-Interview Setup

1. **Parse Parameters**
   - Extract `n` (question count) from invocation
   - Default to 5 if not specified
   - Extract domain if specified, otherwise auto-detect

2. **Gather Context**
   - Check for existing project context (CLAUDE.md, README, etc.)
   - Note any previous interview findings in session
   - Identify domain signals from file types and content

3. **Announce Structure**
   Tell the user:
   ```
   I'll conduct a {n}-question interview to help us align on direction.
   Questions will adapt based on your responses.
   Feel free to answer briefly or elaborate—both are valuable.
   ```

## Interview Loop

For each question (1 to n):

### Question Generation Strategy

**Opening Questions (1-2)**
- Start broad: goals, context, desired outcomes
- Establish baseline understanding
- Examples:
  - "What's the primary outcome you're hoping to achieve?"
  - "What's the current state of this project/initiative?"

**Exploration Questions (middle)**
- Follow threads from previous answers
- Probe areas of uncertainty or opportunity
- Balance across dimensions:
  - Functional requirements
  - Non-functional requirements
  - Stakeholder concerns
  - Constraints and boundaries

**Closing Questions (n-1, n)**
- Consolidate understanding
- Identify priorities
- Surface anything missed
- Examples:
  - "What would make this a clear success?"
  - "What concerns do you have that we haven't addressed?"

### Question Delivery

Use `AskUserQuestion` tool with:

```json
{
  "questions": [{
    "question": "[Your adaptive question]",
    "header": "Q{i}/{n}",
    "options": [
      {"label": "[Relevant option 1]", "description": "[Context]"},
      {"label": "[Relevant option 2]", "description": "[Context]"},
      {"label": "[Relevant option 3]", "description": "[Context]"}
    ],
    "multiSelect": false
  }]
}
```

**Note**: Options should be genuinely useful suggestions, not artificial constraints. The user can always select "Other" to provide their own answer.

### Response Processing

After each response:
1. **Acknowledge** the input briefly
2. **Note** key insights for synthesis
3. **Adjust** subsequent questions based on new information
4. **Track** emerging themes and patterns

## Adaptive Rules

### Thread Following
If user reveals strong interest or concern:
- Dedicate 1-2 follow-up questions to that thread
- Adjust remaining question allocation

### Domain Pivoting
If answers indicate different domain than initially detected:
- Shift question themes accordingly
- Announce the pivot: "I'm noticing this is more about [X] than [Y]—adjusting focus."

### Depth vs. Breadth
- Early questions: broad coverage
- Middle questions: depth on key threads
- Late questions: consolidation and gaps

### Red Flag Detection
Watch for:
- Contradictory requirements
- Unstated assumptions
- Scope creep signals
- Misaligned stakeholder priorities

When detected, surface with clarifying questions.

## Question Budget Management

| Total Questions | Opening | Exploration | Closing |
|-----------------|---------|-------------|---------|
| 3 | 1 | 1 | 1 |
| 5 | 2 | 2 | 1 |
| 7 | 2 | 4 | 1 |
| 10 | 2 | 6 | 2 |
| 15+ | 2 | n-4 | 2 |

## Anti-Patterns

- **Don't** ask multiple unrelated questions at once
- **Don't** offer options that don't fit the question
- **Don't** ignore user's previous answers
- **Don't** front-load all hard questions
- **Don't** make assumptions without validating

## Transition to Synthesis

After final question:
1. Thank the user for their input
2. Announce synthesis phase
3. Proceed to `cookbook/synthesize.md`
