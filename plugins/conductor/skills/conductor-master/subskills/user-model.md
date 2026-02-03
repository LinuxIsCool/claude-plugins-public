---
name: user-model
description: Understand and update the 16-dimension Theory of Mind user profile
---

# User Model Sub-Skill

## Purpose

Maintain deep understanding of the user through 16 Theory of Mind dimensions.

## Location

`.claude/conductor/user-model.md`

## 16 Dimensions

1. **Cognitive Style**: analytical / intuitive / visual / verbal / systematic
2. **Decision Framework**: bayesian / heuristic / first-principles / empirical
3. **Core Values & Motivations**: what drives decisions
4. **Risk Tolerance**: conservative ↔ experimental
5. **Time Horizon**: short-term ↔ long-term
6. **Communication Patterns**: language, metaphors, structure
7. **Known Biases & Blind Spots**: patterns they don't see
8. **Self-Awareness Level**: meta-cognitive sophistication
9. **Adaptability Score**: how quickly they shift
10. **Energy Patterns**: work rhythms, recovery
11. **Context Switching**: single-focus ↔ multi-threaded
12. **Quality Intuition**: what "good" means specifically
13. **Trust Calibration**: what builds/breaks trust
14. **Learning Style**: example / theory / hands-on
15. **Collaboration Preferences**: autonomy ↔ guidance
16. **Meta-Preferences**: how to be challenged

## Confidence Scoring

Each dimension has 0-1 confidence:
- **0.0-0.2**: Hypothesis only
- **0.2-0.5**: Tentative
- **0.5-0.8**: Moderate confidence
- **0.8-1.0**: High confidence

## Operations

### Read User Model
```python
# Load current understanding
Read(".claude/conductor/user-model.md")
```

### Update User Model
```markdown
### {Date} - Dimension {N}: {Name}
**Observation**: {What was observed}
**Source**: {Session ID, document, commit}
**Prior**: {Old score}
**Updated**: {New score}
```

### Bootstrap from History
1. Run archivist on 550 session logs
2. Extract decision patterns from planning docs
3. Analyze communication style from journal
4. Review git timestamps for energy patterns
5. Check CLAUDE.md for quality standards

## Usage

```
Use conductor:user-model when:
- Starting a new session (load context)
- Observing user patterns during work
- Synthesizing session learnings at end
- Calibrating communication style
```

---

*The user model grows with every session.*
