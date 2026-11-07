/**
 * Gemini model ids in one place. Gemini 2.5 Flash / Flash-Lite retire on 1 Dec 2026; 3.8 Flash accepts
 * thinkingConfig {thinkingBudget: 0} (the 3.5-flash-lite auto-redirect does not), so it replaces both.
 * Override per environment with GEMINI_FLASH_MODEL / GEMINI_FLASH_LITE_MODEL / GEMINI_PRO_MODEL.
 * PRO: 3.1 Pro preview since 2026-11-07 (owner approved the side-by-side test copies, "3.1").
 * PRO_FALLBACK: what the newsletter tries when PRO errors (it is a preview model): 2.5 Pro until
 * it retires on 1 Dec 2026, Flash after that. Flash stays the last resort.
 */
export const FLASH = process.env.GEMINI_FLASH_MODEL ?? 'gemini-3.8-flash';
export const FLASH_LITE = process.env.GEMINI_FLASH_LITE_MODEL ?? FLASH;
export const PRO = process.env.GEMINI_PRO_MODEL ?? 'gemini-3.1-pro-preview';
export const PRO_FALLBACK = process.env.GEMINI_PRO_FALLBACK_MODEL
  ?? (Date.now() < Date.parse('2026-12-01T00:00:00Z') ? 'gemini-2.5-pro' : FLASH);

export function geminiEndpoint(model: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
}
