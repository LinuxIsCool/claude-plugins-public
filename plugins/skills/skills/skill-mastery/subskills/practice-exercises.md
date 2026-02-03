# Practice Exercises - Practitioner Level

Hands-on exercises to build skill development fluency.

## Learning Objectives

By the end of this level, you will:
- Create skills for different use cases independently
- Write descriptions that reliably trigger
- Debug skills that don't work as expected
- Understand when to use different skill patterns

## The Practice Framework

Each exercise follows this structure:
1. **Scenario** - What you're building and why
2. **Requirements** - Specific constraints
3. **Hints** - Guidance without solutions
4. **Reflection** - Questions to deepen learning

## Exercise Set 1: Core Patterns

### Exercise 1.1: Analysis Skill

**Scenario**: Create a skill that analyzes a codebase for TODO comments and technical debt markers.

**Requirements**:
- Name: `todo-hunter`
- Should trigger on: "find todos", "technical debt", "what needs fixing"
- Must search for: TODO, FIXME, HACK, XXX comments
- Should provide a summary with file locations

**Hints**:
- What tools does Claude need to search code?
- How will you format the output for readability?
- What if there are hundreds of TODOs?

**Reflection**:
- What made your description effective or ineffective?
- Did you anticipate edge cases (empty results, huge results)?

---

### Exercise 1.2: Creation Skill

**Scenario**: Create a skill that generates a conventional commit message by analyzing staged changes.

**Requirements**:
- Name: `commit-crafter`
- Should trigger on: "write commit", "commit message", "what should I commit"
- Must analyze: git diff --staged
- Should follow: Conventional Commits format (feat/fix/docs/etc.)

**Hints**:
- What git commands reveal staged changes?
- How do you determine the commit type?
- What makes a commit message "good"?

**Reflection**:
- How did you balance brevity vs. detail in instructions?
- Would this work on repositories with different conventions?

---

### Exercise 1.3: Transformation Skill

**Scenario**: Create a skill that converts JSON to TypeScript types.

**Requirements**:
- Name: `json-to-types`
- Should trigger on: "convert json to typescript", "generate types from json"
- Must handle: nested objects, arrays, nullable fields
- Should produce: valid TypeScript interface definitions

**Hints**:
- What's the structure of a TypeScript interface?
- How do you handle arrays of objects?
- What about optional vs. required fields?

**Reflection**:
- How did your instructions handle ambiguous cases?
- Did you include examples in your skill?

---

### Exercise 1.4: Research Skill

**Scenario**: Create a skill that researches npm packages before adding them to a project.

**Requirements**:
- Name: `package-scout`
- Should trigger on: "should I use this package", "evaluate npm package"
- Must check: maintenance status, download stats, security advisories
- Should provide: recommendation with reasoning

**Hints**:
- What sources have reliable package information?
- How do you assess "maintenance status"?
- What security signals matter?

**Reflection**:
- How did you balance thoroughness vs. speed?
- What would make you trust/distrust a package?

## Exercise Set 2: Description Refinement

### Exercise 2.1: Description A/B Testing

Take one of your Exercise Set 1 skills and write **three different descriptions** for it.

**Version A**: Emphasize capabilities
**Version B**: Emphasize triggers
**Version C**: Balance both

Test each version. Which triggers most reliably?

---

### Exercise 2.2: Disambiguation

You have two skills:
- `code-review`: Reviews code for bugs
- `code-style`: Reviews code for style issues

The user says: "Review my code"

**Challenge**: Write descriptions that let Claude choose correctly:
- "Review my code for bugs" → code-review
- "Check my code style" → code-style
- "Review my code" → Claude asks for clarification OR picks the more general one

---

### Exercise 2.3: Negative Triggers

Create a skill with a description that explicitly states when NOT to use it.

**Example**:
```yaml
description: Generates test files for JavaScript functions. Use when asked to write tests or create test coverage. NOT for: reviewing existing tests, running tests, or test configuration.
```

Does the negative condition work? Test it.

## Exercise Set 3: Debugging Skills

### Exercise 3.1: The Silent Skill

Your skill doesn't trigger. Debug it.

**Check**:
1. Is the SKILL.md in the right location?
2. Is frontmatter valid YAML?
3. Is description under 1024 characters?
4. Does `/skill-name` work (direct invocation)?
5. Are there conflicting skills with similar descriptions?

Create a debugging checklist you'll use for future skills.

---

### Exercise 3.2: The Overeager Skill

Your skill triggers when it shouldn't. Debug it.

**Check**:
1. Is description too broad?
2. Are trigger phrases too common?
3. Consider adding `disable-model-invocation: true`
4. Add specificity to use cases

Document what made the skill too eager and how you fixed it.

---

### Exercise 3.3: The Confused Skill

Your skill triggers but Claude doesn't follow instructions correctly. Debug it.

**Check**:
1. Are instructions clear and imperative?
2. Is there ambiguity in steps?
3. Are there missing tools in `allowed-tools`?
4. Are examples included for complex outputs?

Rewrite your instructions to be unambiguous.

## Exercise Set 4: Integration Challenge

### The Personal Toolkit

Create a **suite of 3 related skills** that work together.

**Example Theme**: Documentation
1. `doc-generator` - Creates documentation from code
2. `doc-reviewer` - Reviews existing documentation
3. `doc-linker` - Suggests internal documentation links

**Requirements**:
- Skills must have distinct, non-overlapping triggers
- Skills should complement each other
- Consider: should there be a master skill?

**Deliverables**:
1. Three working skills
2. Test cases showing correct trigger selection
3. Notes on how you differentiated them

## Checkpoint: Practitioner Completion

You've completed the practitioner level when you can:

- [ ] Create skills without referring to documentation
- [ ] Write descriptions that trigger reliably (>90% accuracy)
- [ ] Debug common skill issues independently
- [ ] Differentiate between similar skills via descriptions
- [ ] Create complementary skill suites

## Next Steps

Ready for advanced patterns?

```
Read: plugins/skills/skills/skill-mastery/subskills/expert-patterns.md
```

Want to assess your progress formally?

```
Read: plugins/skills/skills/skill-mastery/subskills/self-assessment.md
```
