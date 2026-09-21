/**
 * Multimodal Intelligence Pipeline Engine
 *
 * Unifies Text, Voice, Vision, and Accessibility inputs into a single
 * coherent semantic intent, synthesizes modality-aware responses with
 * clean speech narration, visual cards, and sensory cues, and guarantees
 * graceful degradation when sensors are blocked or offline.
 */

import { cleanForSpeech } from './tts.js';
import type {
  MultimodalInput,
  FusedMultimodalIntent,
  ModalityAwareResponse,
  VisualCard,
  SensoryCues,
  InputModality,
  SensorAvailability,
  DegradationResult,
} from '../types/multimodal.js';

// Technical term translations dictionary for natural trilingual generation
const TRANSLATION_MAP: Record<string, { ar: string; fr: string }> = {
  'binary search tree': { ar: 'شجرة البحث الثنائية', fr: 'arbre binaire de recherche' },
  'binary search tree node insertion': { ar: 'إدراج عقدة في شجرة البحث الثنائية', fr: "l'insertion d'un nœud dans un arbre binaire de recherche" },
  'binary search tree root node insertion': { ar: 'إدراج عقدة الجذر في شجرة البحث الثنائية', fr: "l'insertion du nœud racine dans un arbre binaire de recherche" },
  'root node': { ar: 'عقدة الجذر', fr: 'nœud racine' },
  'node insertion': { ar: 'إدراج عقدة', fr: "l'insertion d'un nœud" },
  'state machine diagram': { ar: 'مخطط آلة الحالة', fr: 'diagramme de machine à états' },
  'sorting algorithm': { ar: 'خوارزمية الترتيب', fr: 'algorithme de tri' },
  'linked list': { ar: 'القائمة المتصلة', fr: 'liste chaînée' },
  'graph traversal': { ar: 'اجتياز الرسم البياني', fr: 'parcours de graphe' },
};

/**
 * Normalizes and qualifies visual description with accessibility target element.
 * E.g. "Binary Search Tree node insertion" + target "root node" => "Binary Search Tree root node insertion".
 */
function fuseSubjectWithA11y(visionDesc?: string, targetElement?: string, detectedObjects?: string[], ocrText?: string): string {
  const cleanTarget = targetElement ? targetElement.replace(/[_]/g, ' ').trim() : '';
  const cleanVision = visionDesc ? visionDesc.trim() : '';

  if (cleanVision && cleanTarget) {
    const lowerVision = cleanVision.toLowerCase();
    const lowerTarget = cleanTarget.toLowerCase();

    // If target is already fully present in the vision description
    if (lowerVision.includes(lowerTarget)) {
      return cleanVision;
    }

    // Check if target qualifies a specific word in vision description (e.g. "root node" qualifies "node")
    const targetWords = cleanTarget.split(/\s+/);
    const lastWord = targetWords[targetWords.length - 1];
    const wordRegex = new RegExp(`\\b${lastWord}\\b`, 'i');

    if (wordRegex.test(cleanVision)) {
      return cleanVision.replace(wordRegex, cleanTarget);
    }

    // If target is "root" and vision has "node"
    if (lowerTarget === 'root' && /\bnode\b/i.test(cleanVision)) {
      return cleanVision.replace(/\bnode\b/i, 'root node');
    }

    return `${cleanVision} (${cleanTarget})`;
  }

  if (cleanVision) return cleanVision;
  if (cleanTarget) return cleanTarget;

  if (detectedObjects && detectedObjects.length > 0) {
    return detectedObjects.join(', ');
  }

  if (ocrText && ocrText.trim().length > 0) {
    return `text content "${ocrText.trim().slice(0, 35)}"`;
  }

  return '';
}

/**
 * Fuses prompt action with the resolved multimodal subject.
 */
function buildPrimaryIntent(spokenPrompt: string, textPrompt: string, fusedSubject: string): string {
  const activePrompt = (spokenPrompt || textPrompt || '').trim();

  if (!activePrompt) {
    return fusedSubject ? `Inspect and explain ${fusedSubject}` : 'General inquiry';
  }

  if (!fusedSubject) {
    return activePrompt;
  }

  // Deictic / referential question patterns
  const deicticMatches = [
    {
      regex: /^(?:can you\s+)?explain\s+(?:how\s+)?(?:this|that)\s+works[?!.]*$/i,
      formatter: (s: string) => `Explain ${s}`,
    },
    {
      regex: /^what\s+is\s+(?:this|that)[?!.]*$/i,
      formatter: (s: string) => `Explain ${s}`,
    },
    {
      regex: /^what\s+does\s+(?:this|that)\s+do[?!.]*$/i,
      formatter: (s: string) => `Explain operation of ${s}`,
    },
    {
      regex: /^(?:inspect|examine)\s+(?:this|that)[?!.]*$/i,
      formatter: (s: string) => `Inspect ${s}`,
    },
    {
      regex: /^(?:how\s+does\s+)?(?:this|that)\s+work[?!.]*$/i,
      formatter: (s: string) => `Explain ${s}`,
    },
    {
      regex: /^(?:help\s+me\s+with\s+)?(?:this|that)[?!.]*$/i,
      formatter: (s: string) => `Explain ${s}`,
    },
  ];

  for (const deictic of deicticMatches) {
    if (deictic.regex.test(activePrompt)) {
      return deictic.formatter(fusedSubject);
    }
  }

  // If prompt contains deictic pronoun "this" or "that" inline
  if (/\b(this|that|here)\b/i.test(activePrompt)) {
    return activePrompt.replace(/\b(this|that|here)\b/gi, fusedSubject).replace(/\s{2,}/g, ' ');
  }

  // If active prompt already contains words from subject, prefer active prompt
  if (activePrompt.toLowerCase().includes(fusedSubject.toLowerCase())) {
    return activePrompt;
  }

  return `${activePrompt} regarding ${fusedSubject}`;
}

/**
 * Translates known concepts or constructs bilingual representation.
 */
function translateConcept(subject: string): { ar: string; fr: string } {
  const normalized = subject.toLowerCase().trim();
  if (TRANSLATION_MAP[normalized]) {
    return TRANSLATION_MAP[normalized];
  }

  // Partial phrase lookup
  for (const [key, value] of Object.entries(TRANSLATION_MAP)) {
    if (normalized.includes(key)) {
      return value;
    }
  }

  // Fallback transliteration / descriptive wrapper
  return {
    ar: subject,
    fr: subject,
  };
}

/**
 * Builds trilingual descriptions (English, Arabic, French) capturing the fused intent,
 * input modalities, and focal accessibility targets.
 */
function generateTrilingualDescriptions(
  intent: string,
  subject: string,
  modalities: InputModality[],
  a11yTarget?: string,
  a11yModality?: string
): { en: string; ar: string; fr: string } {
  const translated = translateConcept(subject || intent);

  // Modality descriptions
  const modLabelsEn: string[] = [];
  const modLabelsAr: string[] = [];
  const modLabelsFr: string[] = [];

  if (modalities.includes('speech')) {
    modLabelsEn.push('spoken voice');
    modLabelsAr.push('الأوامر الصوتية');
    modLabelsFr.push('la voix');
  }
  if (modalities.includes('vision')) {
    modLabelsEn.push('camera vision');
    modLabelsAr.push('الرؤية بالكاميرا');
    modLabelsFr.push('la vision par caméra');
  }
  if (modalities.includes('a11y')) {
    const a11yNameEn = a11yModality ? a11yModality.replace(/[_]/g, ' ') : 'accessibility focus';
    modLabelsEn.push(a11yNameEn);
    modLabelsAr.push(a11yModality === 'eye_gaze' ? 'تتبع حركة العين' : 'إمكانية الوصول');
    modLabelsFr.push(a11yModality === 'eye_gaze' ? 'le regard oculaire' : "l'accessibilité");
  }
  if (modalities.includes('text')) {
    modLabelsEn.push('text input');
    modLabelsAr.push('الإدخال النصي');
    modLabelsFr.push('la saisie textuelle');
  }

  const enMods = modLabelsEn.length > 0 ? modLabelsEn.join(' and ') : 'text interface';
  const arMods = modLabelsAr.length > 0 ? modLabelsAr.join(' و') : 'الواجهة النصية';
  const frMods = modLabelsFr.length > 0 ? modLabelsFr.join(' et ') : 'interface textuelle';

  const targetLabelEn = a11yTarget ? ` targeting "${a11yTarget}"` : '';
  const targetLabelAr = a11yTarget ? ` مع التركيز على "${a11yTarget}"` : '';
  const targetLabelFr = a11yTarget ? ` ciblant "${a11yTarget}"` : '';

  const fusedDescriptionEn = `User is requesting explanation of ${subject || intent} via ${enMods}${targetLabelEn}.`;
  const fusedDescriptionAr = `المستخدم يطلب شرح ${translated.ar} عبر ${arMods}${targetLabelAr}.`;
  const fusedDescriptionFr = `L'utilisateur demande l'explication de ${translated.fr} via ${frMods}${targetLabelFr}.`;

  return {
    en: fusedDescriptionEn,
    ar: fusedDescriptionAr,
    fr: fusedDescriptionFr,
  };
}

/**
 * Evaluates suggested pedagogy based on context, cognitive stage, and multimodal payload.
 */
function deriveSuggestedPedagogy(
  context: MultimodalInput['context'],
  requiresVisual: boolean
): string {
  if (context?.pedagogy) {
    return context.pedagogy;
  }

  if (context?.cognitiveStage) {
    switch (context.cognitiveStage) {
      case 'Sensorimotor':
      case 'Preoperational':
        return 'analogies';
      case 'Concrete':
        return 'worked_example';
      case 'Formal':
        return 'advanced_rigor';
      default:
        break;
    }
  }

  if (requiresVisual) {
    return 'worked_example';
  }

  return 'scaffolded';
}

/**
 * Fuses text prompt, spoken audio transcript, vision scene description,
 * and accessibility switch/gaze target into a coherent semantic intent.
 */
export function fuseMultimodalInput(input: MultimodalInput): FusedMultimodalIntent {
  const inputModalities: InputModality[] = [];

  const text = input.text?.trim() || '';
  const speech = input.speechTranscript?.trim() || '';
  const vision = input.visionFrame;
  const a11y = input.a11yInput;
  const context = input.context || { currentView: 'chat', language: 'en' };

  if (text.length > 0) inputModalities.push('text');
  if (speech.length > 0) inputModalities.push('speech');

  const hasVision = Boolean(
    vision && (vision.description || (vision.detectedObjects && vision.detectedObjects.length > 0) || vision.ocrText)
  );
  if (hasVision) inputModalities.push('vision');

  const hasA11y = Boolean(a11y && (a11y.modality || a11y.targetElement));
  if (hasA11y) inputModalities.push('a11y');

  // Fallback to text modality if none was actively set
  if (inputModalities.length === 0) {
    inputModalities.push('text');
  }

  // Synthesize multimodal subject
  const fusedSubject = fuseSubjectWithA11y(
    vision?.description,
    a11y?.targetElement,
    vision?.detectedObjects,
    vision?.ocrText
  );

  // Formulate primary intent
  const primaryIntent = buildPrimaryIntent(speech, text, fusedSubject);

  // Determine requirement flags
  const visualKeywords = /\b(this|look|see|diagram|show|visual|chart|tree|node|graph|ui|image|picture|screen|view|insertion)\b/i;
  const requiresVisualAid = Boolean(
    hasVision ||
    (a11y && a11y.targetElement) ||
    visualKeywords.test(speech) ||
    visualKeywords.test(text) ||
    (context.activeConceptId && /tree|graph|sort|diagram/i.test(context.activeConceptId))
  );

  const audioKeywords = /\b(speak|narrate|listen|aloud|read|voice)\b/i;
  const requiresAudioNarration = Boolean(
    inputModalities.includes('speech') ||
    a11y?.modality === 'voice_command' ||
    a11y?.modality === 'switch' ||
    audioKeywords.test(text) ||
    audioKeywords.test(speech)
  );

  // Generate trilingual natural descriptions
  const trilingual = generateTrilingualDescriptions(
    primaryIntent,
    fusedSubject,
    inputModalities,
    a11y?.targetElement,
    a11y?.modality
  );

  // Compute confidence score
  let confidence = 0.50;
  if (speech.length > 0) confidence += 0.20;
  if (text.length > 0) confidence += 0.15;
  if (hasVision) confidence += 0.20;
  if (hasA11y) confidence += 0.15;
  if (context.activeConceptId) confidence += 0.05;
  confidence = Math.min(0.98, Math.max(0.35, parseFloat(confidence.toFixed(2))));

  const suggestedPedagogy = deriveSuggestedPedagogy(context, requiresVisualAid);

  return {
    primaryIntent,
    fusedDescriptionEn: trilingual.en,
    fusedDescriptionAr: trilingual.ar,
    fusedDescriptionFr: trilingual.fr,
    inputModalities,
    confidence,
    requiresVisualAid,
    requiresAudioNarration,
    suggestedPedagogy,
  };
}

/**
 * Extracts or synthesizes relevant visual cards (diagrams, code, step flows)
 * based on the intent and raw response text.
 */
function buildVisualCards(rawText: string, intent: FusedMultimodalIntent): VisualCard[] {
  const cards: VisualCard[] = [];

  // Check for code blocks in rawText
  const codeBlockRegex = /```([a-zA-Z0-9_-]+)?\s*([\s\S]*?)```/g;
  let codeMatch: RegExpExecArray | null;
  while ((codeMatch = codeBlockRegex.exec(rawText)) !== null) {
    const lang = codeMatch[1]?.toLowerCase() || 'code';
    const codeContent = codeMatch[2].trim();
    if (lang === 'mermaid') {
      cards.push({
        type: 'diagram',
        title: 'Architectural / State Flow Diagram',
        content: codeContent,
      });
    } else {
      cards.push({
        type: 'code',
        title: `${lang.toUpperCase()} Implementation`,
        content: codeContent,
      });
    }
  }

  // Synthesize domain-specific visual cards if required and not already populated
  if (cards.length === 0 && intent.requiresVisualAid) {
    const lowerIntent = intent.primaryIntent.toLowerCase();

    if (lowerIntent.includes('binary search tree') || lowerIntent.includes('tree')) {
      cards.push({
        type: 'diagram',
        title: 'Binary Search Tree Root & Node Architecture',
        content: [
          '       [50 (Root Node)]',
          '         /          \\',
          '     [30]            [70]',
          '     /  \\            /  \\',
          '  [20]  [40]       [60]  [80]',
        ].join('\n'),
      });

      cards.push({
        type: 'code',
        title: 'BST Node Insertion Implementation',
        content: [
          'class TreeNode {',
          '  val: number;',
          '  left: TreeNode | null = null;',
          '  right: TreeNode | null = null;',
          '  constructor(val: number) { this.val = val; }',
          '}',
          '',
          'function insertNode(root: TreeNode | null, val: number): TreeNode {',
          '  if (!root) return new TreeNode(val);',
          '  if (val < root.val) root.left = insertNode(root.left, val);',
          '  else root.right = insertNode(root.right, val);',
          '  return root;',
          '}',
        ].join('\n'),
      });

      cards.push({
        type: 'step_flow',
        title: 'Step-by-Step Insertion Execution',
        content: [
          '1. Compare key against root node value.',
          '2. Traverse left subtree if key < root, or right subtree if key > root.',
          '3. Allocate new TreeNode at the discovered null leaf link.',
          '4. Maintain binary search invariant across ancestors.',
        ].join('\n'),
      });
    } else if (lowerIntent.includes('state machine')) {
      cards.push({
        type: 'diagram',
        title: 'State Machine Transition Diagram',
        content: 'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Active : Trigger\n  Active --> Suspended : Timeout\n  Suspended --> Active : Resume\n  Active --> [*] : Complete',
      });

      cards.push({
        type: 'step_flow',
        title: 'State Transition Flow',
        content: '1. Initialize in Idle\n2. Stimulus triggers transition to Active\n3. Lifecycle events process state transitions',
      });
    } else {
      cards.push({
        type: 'step_flow',
        title: 'Multimodal Action Breakdown',
        content: `1. Analyzed input: ${intent.primaryIntent}\n2. Structured concept breakdown\n3. Executed pedagogical walkthrough`,
      });
    }
  }

  return cards;
}

/**
 * Synthesizes a modality-aware response encompassing structured text,
 * speech narration sanitized for natural voice output, visual cards,
 * and accessibility sensory cues.
 */
export function synthesizeModalityAwareResponse(
  rawText: string,
  intent: FusedMultimodalIntent,
  studentState?: any,
  a11yProfile?: any
): ModalityAwareResponse {
  // Format clean text response
  const textResponse = rawText.trim();

  // Generate visual cards when visual aid is required
  let visualCards: VisualCard[] | undefined = undefined;
  if (intent.requiresVisualAid) {
    visualCards = buildVisualCards(rawText, intent);
  }

  // Audio narration with clean natural voice formatting
  let speechNarration: string | undefined = undefined;
  const isAudioUser = intent.requiresAudioNarration ||
    a11yProfile?.accessibilityMode === 'Speech' ||
    a11yProfile?.accessibilityMode === 'Visual';

  if (isAudioUser) {
    speechNarration = cleanForSpeech(rawText);
  }

  // Emits sensory cues for accessibility
  let sensoryCues: SensoryCues | undefined = undefined;
  const hasA11yModality = intent.inputModalities.includes('a11y');
  const hasA11yProfile = a11yProfile?.accessibilityMode && a11yProfile.accessibilityMode !== 'None';

  if (hasA11yModality || hasA11yProfile) {
    sensoryCues = {
      hapticPattern: 'confirm',
      highContrastBadge: `[A11Y ACTIVE: ${intent.primaryIntent.toUpperCase().slice(0, 40)}]`,
    };
  }

  return {
    textResponse,
    speechNarration,
    visualCards: visualCards && visualCards.length > 0 ? visualCards : undefined,
    sensoryCues,
  };
}

/**
 * Evaluates sensor availability and guarantees clean degradation without runtime exceptions.
 */
export function handleGracefulDegradation(
  availableSensors: SensorAvailability
): DegradationResult {
  const camera = Boolean(availableSensors?.camera);
  const mic = Boolean(availableSensors?.mic);

  if (camera && mic) {
    return {
      fallbackModality: 'full_multimodal',
      message: 'All sensors online (Camera & Microphone). Full multimodal intelligence active.',
      degraded: false,
    };
  }

  if (!camera && mic) {
    return {
      fallbackModality: 'voice_and_text',
      message: 'Camera sensor unavailable or permission denied. Seamlessly operating via voice and text input.',
      degraded: true,
    };
  }

  if (camera && !mic) {
    return {
      fallbackModality: 'vision_and_text',
      message: 'Microphone sensor unavailable or permission denied. Seamlessly operating via camera vision and keyboard input.',
      degraded: true,
    };
  }

  return {
    fallbackModality: 'text_and_keyboard',
    message: 'Camera and Microphone unavailable or blocked. Cleanly degraded to standard text and keyboard interface.',
    degraded: true,
  };
}
