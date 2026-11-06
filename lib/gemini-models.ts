/**
 * Gemini model ids in one place. Gemini 2.5 Flash / Flash-Lite retire on 1 Dec 2026; 3.8 Flash accepts
 * thinkingConfig {thinkingBudget: 0} (the 3.5-flash-lite auto-redirect does not), so it replaces both.
 * Override per environment with GEMINI_FLASH_MODEL / GEMINI_FLASH_LITE_MODEL / GEMINI_PRO_MODEL.
 * PRO stays on 2.5 Pro until a sample newsletter on the new model has been approved (send path).
 */
export const FLASH = process.env.GEMINI_FLASH_MODEL ?? 'gemini-3.8-flash';
export const FLASH_LITE = process.env.GEMINI_FLASH_LITE_MODEL ?? FLASH;
export const PRO = process.env.GEMINI_PRO_MODEL ?? 'gemini-2.5-pro';

export function geminiEndpoint(model: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
}
