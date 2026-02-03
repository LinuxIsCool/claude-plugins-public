# Voice Character System - Feature Development Prompt

**For use with**: `/feature-dev`
**Status**: Implementation Ready
**Priority**: High
**Estimated Complexity**: Multi-sprint

---

## Overview

Implement a comprehensive voice character system that transforms the voice plugin from a simple TTS wrapper into an awe-inspiring speech-to-speech development environment. This system curates personality, sound engineering, voice acting, and intuitive design for all voice characters in the ecosystem.

The goal is not to make AI agents sound human. The goal is to make AI agents sound **meaningful, emotionally resonant, and genuinely alive**.

---

## Vision

When a developer opens Claude Code with this voice plugin, they should experience:

1. **Distinct Agent Identities**: Each agent (Explore, Archivist, Mentor, Conductor) sounds like a unique character with consistent personality
2. **Emotional Resonance**: Voice feedback matches the emotional context (errors sound concerned, successes sound satisfied)
3. **Non-Verbal Communication**: R2D2-style beeps and chirps convey state changes without interrupting flow
4. **Flow State Protection**: Voice knows when to speak and when silence is the most honest expression
5. **Character Emergence**: Personalities evolve through interaction, learning user preferences over time
6. **Coherent Pluralism**: All voices feel like family while remaining distinct

---

## Core Components to Implement

### 1. Voice Personality Manager

**Location**: `plugins/voice/src/personality/`

**Features**:
- Load personality profiles from `config/personalities/*.json`
- Merge profiles with runtime context
- Apply personality to TTS parameters (stability, boost, speed)
- Text transformation based on personality (add fillers, greetings, emphasis)

**Reference Spec**: `specs/08-voice-personality/SPEC.md`

```typescript
interface VoicePersonality {
  id: string;
  agentId?: string;
  voice: { backend: string; voiceId: string; };
  style: { speed: number; pitch: number; variability: number; };
  ttsSettings: { stability?: number; similarityBoost?: number; };
  prosody: { questionRise: boolean; emphasisWords: string[]; pauses: number; };
  textTransforms: { addGreeting: boolean; addFillers: boolean; codeVerbosity: string; };
  emotion: { default: string; greetingEmotion: string; errorEmotion: string; };
}
```

### 2. Non-Verbal Sound Library

**Location**: `plugins/voice/sounds/`

**Sound Categories**:

| Category | Purpose | Examples |
|----------|---------|----------|
| `agents/{name}/` | Agent-specific signatures | greeting, thinking, complete |
| `states/success/` | Task completion tiers | minor, moderate, major |
| `states/error/` | Error severity levels | info, warning, error, critical |
| `states/thinking/` | Processing indicators | light, moderate, deep |
| `ambient/` | Background soundscapes | terminal-hum, processing-loop |
| `interface/` | UI feedback | typing, cursor, navigation |

**Design Principles**:
- Rising pitch = positive, questioning, curiosity
- Falling pitch = statement, completion, certainty
- Fast attack = urgency, importance
- Slow attack = gentleness, contemplation
- Each agent has distinct tonal center (130-330 Hz range)

### 3. Conversational Flow Controller

**Location**: `plugins/voice/src/flow/`

**Features**:
- End-of-utterance detection using semantic analysis (not just silence)
- Turn-taking intelligence respecting 1.6-second intonation unit rhythm
- Flow state protection (suppress verbose feedback during deep work)
- Queue management with priority and interrupt policies
- Silence as deliberate expression (not every state needs voice)

**Key Behaviors**:
- Wait for complete thought, not first pause
- 23-minute recovery time awareness (minimize interruptions)
- Context-aware verbosity (quiet mode during pair programming)
- Dialogue over monologue (invitation not declaration)

### 4. Character Emergence System

**Location**: `plugins/voice/src/emergence/`

**Features**:
- Preference learning from voice event logs
- Implicit feedback detection (cancellations = too verbose)
- Context detection (solo vs. pair programming)
- Session-level personality adaptation
- Long-term evolution through journal analysis

**Trust Building Phases**:
```
Evaluation → Exploration → Integration → Reliance → Partnership
```

### 5. Coherence Monitor

**Location**: `plugins/voice/src/coherence/`

**Features**:
- Detect coherence violations (same agent, different voice)
- Monitor evolution toward chaos or rigidity
- Trigger calibration when system drifts from optimal
- Generate journal entries about voice ecosystem health

---

## Agent Personality Profiles to Create

### Explorer Agent
```json
{
  "id": "explorer",
  "voice": { "backend": "elevenlabs", "voiceId": "EXAVITQu4vr4xnSDxMaL" },
  "style": { "speed": 1.1, "pitch": 3, "variability": 0.7 },
  "emotion": { "default": "enthusiastic", "greetingEmotion": "enthusiastic" }
}
```

### Archivist Agent
```json
{
  "id": "archivist",
  "voice": { "backend": "elevenlabs", "voiceId": "pNInz6obpgDQGcFmaJgB" },
  "style": { "speed": 0.9, "pitch": -3, "variability": 0.2 },
  "emotion": { "default": "serious", "greetingEmotion": "neutral" }
}
```

### Mentor Agent
```json
{
  "id": "mentor",
  "voice": { "backend": "elevenlabs", "voiceId": "TxGEqnHWrfWFTfGW9XjX" },
  "style": { "speed": 0.95, "pitch": -2, "variability": 0.4 },
  "emotion": { "default": "thoughtful", "greetingEmotion": "calm" }
}
```

---

## Integration Requirements

### With Existing Voice Plugin

- Extend `voice-hook.ts` to use personality manager
- Integrate non-verbal sounds into event handlers
- Add flow controller to manage utterance timing
- Connect coherence monitor to logging

### With AgentNet Plugin

- Read agent profiles for voice personality extension
- Contribute voice profiles to agent social network
- Enable multi-agent voice conversations

### With Logging Plugin

- Write voice events for preference analysis
- Read patterns for emergence system
- Correlate voice feedback with productivity

### With Journal Plugin

- Generate reflections on character evolution
- Document design decisions as atomic notes
- Link character patterns in temporal graph

---

## Success Criteria

### Quantitative

- [ ] Same agent uses same voice 95%+ of sessions
- [ ] Queue wait time < 500ms average
- [ ] User override frequency decreasing over time (learning working)
- [ ] Non-verbal sounds trigger in <20ms

### Qualitative

- [ ] Users form expectations about agent voices (stability)
- [ ] Users notice context adaptations (flexibility)
- [ ] Voice feels like companion, not tool
- [ ] Characters are distinct yet familial

---

## Research Foundation

Before implementing, deeply study:

1. **Philosophy of Authentic Voice** (`specs/tonality/01-philosophy-of-authentic-voice.md`)
   - Character through constraint
   - Presence over performance
   - Right speech principles

2. **Sonic Architecture** (`specs/tonality/02-sonic-architecture.md`)
   - Frequency-emotion mapping
   - Layer hierarchy (foundation → notification)
   - Attack/decay envelopes

3. **Character Emergence** (`specs/tonality/03-character-emergence.md`)
   - Function-personality alignment
   - Trust building phases
   - Memory-informed adaptation

4. **Systems Coherence** (`specs/tonality/04-systems-coherence.md`)
   - Coherent pluralism theory
   - Stigmergic coordination
   - Edge of chaos optimization

5. **Conversational Flow** (`specs/tonality/05-conversational-flow.md`)
   - Turn-taking intelligence
   - Flow state protection
   - Dialogue over monologue

---

## Implementation Phases

### Phase 1: Personality Foundation (Week 1)
- [ ] Implement VoicePersonality type and manager
- [ ] Create personality profiles for Explore, Archivist, Mentor
- [ ] Integrate with voice-hook.ts for TTS parameter application
- [ ] Add text transformer for personality-based modifications

### Phase 2: Non-Verbal Vocabulary (Week 2)
- [ ] Design and source/generate non-verbal sound files
- [ ] Create sound player with mixing support
- [ ] Map states to non-verbal sounds
- [ ] Integrate with hook events (thinking, success, error)

### Phase 3: Conversational Intelligence (Week 3)
- [ ] Implement flow controller with queue management
- [ ] Add context detection (solo vs. pair)
- [ ] Create quiet mode triggered by statusline
- [ ] Implement semantic end-of-utterance detection

### Phase 4: Emergence and Coherence (Week 4)
- [ ] Implement preference learning from event logs
- [ ] Create coherence monitor
- [ ] Add journal integration for reflection
- [ ] Test long-term evolution patterns

---

## Voice Character Curator Agent

The `voice:voice-character-curator` agent is the creative director for this system. Invoke it for:

- Character development and design review
- Voice direction and quality assessment
- Sonic branding decisions
- Coherence analysis and calibration
- Preference learning strategy

**See**: `plugins/voice/agents/voice-character-curator.md`

---

## Philosophical Anchor

Throughout implementation, remember:

> *"Sound is not decoration. Sound is meaning."*

> *"Character is not configuration. Character is relationship."*

> *"The goal is not to make AI agents sound human. The goal is to make AI agents sound meaningful, emotionally resonant, and genuinely alive."*

The constraint is the foundation. The silence is the meaning. The character emerges from the relationship.

---

## Getting Started

```bash
# Invoke the feature-dev skill with this prompt
/feature-dev

# When asked about what to implement, reference this document:
# plugins/voice/specs/tonality/FEATURE-DEV-PROMPT.md

# For creative direction, invoke:
# Task with subagent_type="voice:voice-character-curator"
```

---

*Created by the Voice Character Curator, synthesizing five research agents exploring philosophy, sound design, character emergence, systems coherence, and conversational flow.*
