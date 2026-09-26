/**
 * Sanitizes visual descriptions for both on-screen display and spoken output:
 * - Strips robotic labels like "**Hazards:** None", "**Visible Text:** None", "**Scene Description:**"
 * - Converts "Hazards: None" to "No hazards around you." / "مفيش أخطار حواليك."
 * - Strips all markdown formatting (asterisks, bullet dashes, backticks)
 * - Removes spoken symbol words (asterisk, star, استريك, نجمة)
 */
export function cleanVisionDescription(raw: string, lang: 'ar' | 'en' | 'fr' = 'en'): string {
  if (!raw) return '';
  return raw
    .replace(/\[Signs:.*?\]/g, '')
    // English robotic boilerplate
    .replace(/\*\*Hazards:\*\*\s*(None detected[^\n.]*|None[^\n.]*)[.]?/gi, 'No hazards around you.')
    .replace(/Hazards:\s*(None detected[^\n.]*|None[^\n.]*)[.]?/gi, 'No hazards around you.')
    .replace(/\*\*Visible Text:\*\*\s*(None[^\n.]*|N\/A[^\n.]*)[.]?/gi, '')
    .replace(/Visible Text:\s*(None[^\n.]*|N\/A[^\n.]*)[.]?/gi, '')
    .replace(/\*\*(Scene Description|Description):\*\*/gi, '')
    .replace(/(Scene Description|Description):/gi, '')
    .replace(/\*\*(Lecture Summary|Summary|Key Points):\*\*/gi, '')
    .replace(/(Lecture Summary|Summary|Key Points):/gi, '')
    // Arabic robotic boilerplate
    .replace(/\*\*المخاطر:\*\*\s*(لا توجد[^\n.]*|لا يوجد[^\n.]*)[.]?/gi, 'مفيش أخطار حواليك.')
    .replace(/المخاطر:\s*(لا توجد[^\n.]*|لا يوجد[^\n.]*)[.]?/gi, 'مفيش أخطار حواليك.')
    .replace(/\*\*النصوص( المكتوبة)?:\*\*\s*(لا توجد[^\n.]*|لا يوجد[^\n.]*)[.]?/gi, '')
    .replace(/النصوص( المكتوبة)?:\s*(لا توجد[^\n.]*|لا يوجد[^\n.]*)[.]?/gi, '')
    .replace(/\*\*(وصف المشهد|الوصف):\*\*/gi, '')
    .replace(/(وصف المشهد|الوصف):/gi, '')
    .replace(/\*\*(ملخص المحاضرة|الملخص|النقاط الرئيسية):\*\*/gi, '')
    .replace(/(ملخص المحاضرة|الملخص|النقاط الرئيسية):/gi, '')
    // French robotic boilerplate
    .replace(/\*\*Dangers?:\*\*\s*(Aucun[^\n.]*)[.]?/gi, 'Aucun danger autour de vous.')
    .replace(/Dangers?:\s*(Aucun[^\n.]*)[.]?/gi, 'Aucun danger autour de vous.')
    .replace(/\*\*Textes?( visibles?)?:\*\*\s*(Aucun[^\n.]*)[.]?/gi, '')
    .replace(/Textes?( visibles?)?:\s*(Aucun[^\n.]*)[.]?/gi, '')
    .replace(/\*\*(Description de la scène|Description):\*\*/gi, '')
    .replace(/(Description de la scène|Description):/gi, '')
    .replace(/\*\*(Résumé du cours|Résumé|Points clés):\*\*/gi, '')
    .replace(/(Résumé du cours|Résumé|Points clés):/gi, '')
    // Spoken symbol artifacts
    .replace(/(?:^|\s+)(asterisk|استريك|نجمة|بوليت)(?=\s+|$)/giu, ' ')
    // Markdown formatting (*, #, _, `, ~, [], (), <>)
    .replace(/[*+#_`~\[\]()<>]/g, '')
    // Bullet dashes
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s+-\s+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
