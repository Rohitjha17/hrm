/**
 * AI analytics — DEFERRED (Future Version).
 *
 * The spec marks AI attendance/performance/appraisal/task/report/productivity/
 * workforce analytics as out of scope for this pass. This module is a clean
 * extension boundary so those features can be added later without touching
 * feature code: implement provider calls here, gate them behind `AI_ENABLED`,
 * and expose typed functions the features consume.
 *
 * Recommended approach when enabling: use the latest Claude models via a
 * server-side Edge Function (never call an LLM with secrets from the browser).
 */

/** Feature flag — AI features are off until explicitly enabled + implemented. */
export const AI_ENABLED = false

export interface AiInsight {
  title: string
  detail: string
}

/**
 * Placeholder. Returns no insights until AI is implemented behind `AI_ENABLED`
 * (which would gate a server-side Edge Function call).
 */
export async function getWorkforceInsights(): Promise<AiInsight[]> {
  return []
}
