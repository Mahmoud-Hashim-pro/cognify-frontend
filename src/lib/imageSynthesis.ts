/**
 * Client & Frontend Image Synthesis & Visual Fulfillment Utilities
 */

export interface GeneratedImageAttachment {
  name: string;
  type: string;
  url: string;
}

export function isImageGenerationRequest(userMessage: string, lastAssistantMessage?: string): boolean {
  const msg = (userMessage || '').trim();
  const directImageRequest = /(?:give me|show me|send me|generate|draw|create|paint|sketch|make|want|need)\s+(?:an?\s+)?(?:image|picture|photo|illustration|drawing|pic|render)\s+(?:of|about|for)?/i.test(msg)
    || /(?:صورة|ارسم|وريني صورة|عايز صورة|اعمل صورة|هات صورة|ارسم لي|ابعتلي صورة)/i.test(msg)
    || /^(?:where|where is it|where's the image|where is the image|فين|فين الصورة|وينها)\??$/i.test(msg);

  const assistantPromisedImage = lastAssistantMessage
    ? /(?:here is (?:an?|the) image|إليك الصورة|ها هي الصورة|i did generate an image|it seems the image didn't display)/i.test(lastAssistantMessage)
    : false;

  return directImageRequest || (assistantPromisedImage && /^(?:where|فين|show|show me|again|تاني)\??$/i.test(msg));
}

function cleanSubject(sub: string): string {
  return sub
    .replace(/[.?!,:;]+$/, '')
    .replace(/\b(?:for you|for|it|this|that|me|you|please|now|just|here|is|an?|the|لك|لكل)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractImageSubject(userMessage: string, lastAssistantMessage?: string, history: any[] = []): string {
  const msg = (userMessage || '').trim();

  // If user asks "where" or "where is it", inspect assistant promises or preceding user turns
  if (/^(?:where|where is it|where's the image|where is the image|فين|فين الصورة|وينها)\??$/i.test(msg)) {
    if (lastAssistantMessage) {
      const match = lastAssistantMessage.match(/(?:image of|صورة)\s+([^.:\n]+)/i);
      if (match && match[1]) {
        const cleaned = cleanSubject(match[1]);
        if (cleaned) return cleaned;
      }
    }
    // Search history backward for the user request
    const safeHistory = Array.isArray(history) ? history : [];
    for (let i = safeHistory.length - 1; i >= 0; i--) {
      const h = safeHistory[i];
      if (h?.role === 'user' && !/^(?:where|فين|وينها)\??$/i.test(h.content?.trim() || '')) {
        const found = extractImageSubject(h.content);
        if (found && found !== 'artistic illustration') return found;
      }
    }
  }

  // Common user phrasing: "yes naruto uzumaki just give me an image of it"
  const suffixMatch = msg.match(/(.+?)\s+(?:just give me an image|give me an image|show me an image|generate an image|give me a picture|show me a picture)/i);
  if (suffixMatch && suffixMatch[1]) {
    const cleaned = cleanSubject(suffixMatch[1].replace(/^(?:yes|yeah|sure|okay|ok)\b/i, ''));
    if (cleaned) return cleaned;
  }

  // Prefix phrasing: "give me an image of naruto uzumaki"
  const prefixPatterns = [
    /(?:give me|show me|send me|generate|draw|create|paint|want|need)\s+(?:an?\s+)?(?:image|picture|photo|illustration|drawing|pic)\s+(?:of|about|for)?\s*(.+)/i,
    /(?:صورة|ارسم|وريني صورة|عايز صورة|اعمل صورة|هات صورة|ارسم لي|ابعتلي صورة)\s+(?:لـ|عن|بتاعة)?\s*(.+)/i,
  ];

  for (const pat of prefixPatterns) {
    const m = msg.match(pat);
    if (m && m[1]) {
      const cleaned = cleanSubject(m[1]);
      if (cleaned) return cleaned;
    }
  }

  // Fallback: strip conversational noise
  const stripped = cleanSubject(
    msg.replace(/(?:yes|please|can you|just|give me|show me|an image of it|image of|picture of|صورة|ارسم)/gi, '')
  );

  return stripped || 'artistic illustration';
}

export function buildImageUrl(subject: string): string {
  const clean = subject.trim() || 'illustration';
  const prompt = `${clean} high quality detailed masterpiece sharp focus`;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true`;
}

export function hasMarkdownImage(text: string): boolean {
  return /!\[.*?\]\(.*?\)/.test(text || '');
}

/**
 * Ensures that if an image was requested by the user or promised by the AI model,
 * the response is guaranteed to include a valid markdown image and a matching attachment.
 */
export function ensureImageInResponse(
  userMessage: string,
  fullText: string,
  history: any[] = []
): { text: string; attachment?: GeneratedImageAttachment } {
  // If the model already produced a valid Markdown image tag, preserve it
  if (hasMarkdownImage(fullText)) {
    const match = fullText.match(/!\[(.*?)\]\((https?:\/\/[^\s)]+)\)/);
    if (match) {
      const alt = match[1] || 'generated-image';
      const url = match[2];
      return {
        text: fullText,
        attachment: {
          name: `${alt.replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_').slice(0, 30) || 'image'}.jpg`,
          type: 'image/jpeg',
          url,
        },
      };
    }
    return { text: fullText };
  }

  const lastAssistant = history?.filter((m: any) => m?.role === 'assistant' || m?.role === 'model').slice(-1)[0]?.content;
  const requestedInQuery = isImageGenerationRequest(userMessage, lastAssistant);
  const promisedInOutput = /(?:here is (?:an?|the) image|إليك الصورة|ها هي الصورة|i did generate an image|here it is:)/i.test(fullText);

  if (!requestedInQuery && !promisedInOutput) {
    return { text: fullText };
  }

  const subject = extractImageSubject(userMessage, fullText, history);
  const imageUrl = buildImageUrl(subject);
  const safeName = subject.replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_').slice(0, 30) || 'visual';

  const markdownTag = `\n\n![${subject}](${imageUrl})\n`;
  const enhancedText = `${fullText.trimEnd()}${markdownTag}`;

  return {
    text: enhancedText,
    attachment: {
      name: `${safeName}.jpg`,
      type: 'image/jpeg',
      url: imageUrl,
    },
  };
}
