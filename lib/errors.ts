/** Turns provider errors into something a business owner can act on. */
export function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/401|invalid x-api-key|authentication/i.test(msg)) return "The AI service rejected the API key. Check ANTHROPIC_API_KEY or GEMINI_API_KEY in .env.local.";
  if (/429|503|rate limit|overloaded|high demand|unavailable/i.test(msg)) return "The AI service is busy right now. Try again in a minute.";
  if (/No LLM configured/i.test(msg)) return "No AI service is set up. Add ANTHROPIC_API_KEY or GEMINI_API_KEY to .env.local.";
  return msg;
}
