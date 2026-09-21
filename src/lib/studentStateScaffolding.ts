/**
 * Student State Scaffolding & Calibration
 * Pure TypeScript utilities for student cognitive stage resolution and
 * real-time pedagogical prompt formatting.
 *
 * Client-safe: has zero Node.js/crypto dependencies so it can be safely
 * bundled in the browser without leaking server-side provider code.
 */

export type CognitiveStage = 'foundational' | 'developing' | 'proficient' | 'advanced';

export interface StudentStatePayload {
  activePedagogy?: 'analogies' | 'scaffolded' | 'worked_example' | 'socratic' | 'advanced_rigor';
  learningStrain?: {
    possibleStruggle: number;
    confidence: number;
    signals: string[];
  };
  activeInterventions?: Record<string, {
    conceptId: string;
    strategy: string;
    action?: string;
    reason?: string;
    recommendedAction?: string;
    promptDirective?: string;
    explanationEn?: string;
    titleEn?: string;
  }>;
  conceptMastery?: Record<string, {
    conceptId: string;
    accuracy: number;
    attempts: number;
    confidence: number;
  }>;
  personalLearningModel?: any;
}

export function resolveCognitiveStage(level?: string): CognitiveStage {
  const norm = (level || '').trim().toLowerCase();
  if (norm === 'basic' || norm === 'foundational') return 'foundational';
  if (norm === 'intermediate' || norm === 'developing') return 'developing';
  if (norm === 'proficient') return 'proficient';
  if (norm === 'advanced' || norm === 'genius') return 'advanced';
  return 'developing';
}

export function formatStudentStateBlock(state?: StudentStatePayload): string {
  if (!state) return '';
  let block = '';

  const strain = state.learningStrain;
  const interventions = state.activeInterventions ? Object.values(state.activeInterventions) : [];
  const activeIntervention = interventions.length > 0 ? interventions[0] : null;

  block += '\n## REAL-TIME COGNITIVE & PEDAGOGICAL STATE (EVIDENCE-BASED LEARNING ENGINE)\n';
  if (state.activePedagogy) {
    block += `- Active Pedagogical Mode: ${state.activePedagogy.toUpperCase()}\n`;
  }

  if (strain) {
    const strugglePct = Math.round(strain.possibleStruggle * 100);
    const signalList = strain.signals && strain.signals.length > 0 ? strain.signals.join(', ') : 'none';
    block += `- Current Learning Strain: ${strugglePct}% struggle likelihood (Confidence: ${Math.round(strain.confidence * 100)}%, Signals: ${signalList})\n`;
    if (strain.possibleStruggle > 0.5) {
      block += `- INSTRUCTION FOR LEARNING STRAIN: The student is experiencing observable difficulty. Slow down pacing, lower cognitive load, avoid presenting multiple complex steps simultaneously, and offer warm encouragement.\n`;
    }
  }

  if (activeIntervention) {
    const act = activeIntervention.action || activeIntervention.recommendedAction;
    const rsn = activeIntervention.reason || activeIntervention.explanationEn || activeIntervention.promptDirective || 'Identified learning stumbling block';
    const strat = activeIntervention.strategy || 'worked_example';
    const conceptName = activeIntervention.conceptId || 'current topic';

    block += `\n## MANDATORY PEDAGOGICAL INTERVENTION (HIGHEST OVERRIDE PRIORITY)
### ACTIVE INTERVENTION DIRECTIVE:
- Strategy: ${strat}
- Target Concept: ${conceptName}
- Diagnosed Root Cause: ${rsn}
${activeIntervention.recommendedAction ? `- Specific Remediation Action: ${activeIntervention.recommendedAction}\n` : ''}${activeIntervention.promptDirective ? `- Direct Instruction: ${activeIntervention.promptDirective}\n` : ''}`;

    if (act === 'review_prerequisite') {
      block += `### OPERATIONAL DIRECTIVES FOR PREREQUISITE REMEDIATION:
1. FOUNDATION REPAIR FIRST: The student is struggling with "${conceptName}" because of an unmastered prerequisite. You MUST review and solidify this foundational prerequisite using intuitive everyday analogies before advancing to syntax.
2. STEP-BY-STEP BRIDGE: Once the foundation is clear, explain explicitly how it directly unlocks the student's original problem.
3. FORMATIVE MICRO-CHECK: Conclude with a 1-click micro-check block (:::micro-check\\n{...}\\n:::) to verify prerequisite understanding.\n`;
    } else if (activeIntervention.strategy === 'worked_example' || act === 'show_worked_example') {
      block += `### OPERATIONAL DIRECTIVES FOR WORKED EXAMPLE INTERVENTION:
1. PHYSICAL ANALOGY FIRST: Ground the concept in an everyday physical real-world metaphor (e.g. mailboxes with house addresses vs. letters inside, numbered lockers, or postal envelopes) BEFORE presenting any code, math, or abstract definitions.
2. NUMBERED STEP-BY-STEP WORKED EXAMPLE: Present a complete, explicit step-by-step worked example numbered sequentially (Step 1, Step 2, Step 3) demonstrating memory addresses, the address-of operator (&), and pointer dereferencing (*).
3. INLINE MEMORY REASONING: For each step, explicitly explain why this happens in RAM/memory layout (what is stored at address 0x1000 vs. value 42).
4. FORMATIVE MICRO-CHECK: Conclude with a 1-click micro-check block (:::micro-check\\n{...}\\n:::) testing immediate low-stakes comprehension.
5. STRICT PROHIBITIONS: Do NOT output abstract formal definitions or dry syntax alone without physical analogy grounding. Do NOT lecture or mention failure; keep tone warm, reassuring, and patient.\n`;
    } else if (activeIntervention.strategy === 'analogies' || act === 'show_analogy') {
      block += `### OPERATIONAL DIRECTIVES FOR PHYSICAL ANALOGIES:
1. ANCHOR IN EVERYDAY PHENOMENA: Use visual, tactile real-world metaphors (water pipes, road signs, library index cards) to build intuitive mental models before technical terms.
2. CONCLUDE WITH MICRO-CHECK: Include a 1-click micro-check block to verify intuitive understanding.\n`;
    } else if (activeIntervention.strategy === 'socratic' || act === 'advance_difficulty') {
      block += `### OPERATIONAL DIRECTIVES FOR ADVANCED MASTERY:
1. SOCRATIC INQUIRY: Guide the student by asking 1-2 targeted probing questions so they deduce the solution inductively. Challenge edge cases, Big-O complexity, and memory safety implications.
2. REAL-WORLD SCALE: Connect the concept to production distributed systems or high-performance engineering.\n`;
    }
  }

  return block;
}
