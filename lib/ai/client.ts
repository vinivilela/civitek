import { ensureDatabase } from '@/db/bootstrap';
import { getDb } from '@/db/index';
import { aiInteractions } from '@/db/schema';
import type { TenantScope } from '@/lib/tenant';
import type { AssembledContext } from './context';
import { renderPrompt } from './context';

/**
 * Model gateway.
 *
 * The generation itself is stubbed: `generate` receives the assembled context
 * and produces the answer locally, so the product runs end to end with no
 * provider credential. Everything around it is real, and that is the point:
 * context assembly, the plan gate, token accounting and the per tenant cost
 * ledger are exercised on every call.
 *
 * Swapping in the provider means replacing the body of `callModel` and nothing
 * else. Callers already hand it a rendered prompt and read back a typed result
 * plus usage.
 */

export const MODEL_ID = 'claude-opus-5';

/** USD per million tokens, used for the cost ledger. */
const PRICE_INPUT_PER_MTOK = 5;
const PRICE_OUTPUT_PER_MTOK = 25;
const CACHE_READ_MULTIPLIER = 0.1;

export type ModelUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  costMicros: number;
};

export type ModelCall<T> = {
  scope: TenantScope;
  kind: string;
  context: AssembledContext;
  projectId?: string | null;
  occurrenceId?: string | null;
  /** Produces the answer from the assembled context. Stubbed for now. */
  generate: (context: AssembledContext) => T;
};

export type ModelResult<T> = {
  output: T;
  model: string;
  usage: ModelUsage;
  tier: 'generic' | 'memory';
};

/** Rough token estimate. Replace with `messages.count_tokens` when the provider is wired. */
function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function priceUsage(
  inputTokens: number,
  cachedInputTokens: number,
  outputTokens: number,
): number {
  const usd =
    (inputTokens / 1_000_000) * PRICE_INPUT_PER_MTOK +
    (cachedInputTokens / 1_000_000) *
      PRICE_INPUT_PER_MTOK *
      CACHE_READ_MULTIPLIER +
    (outputTokens / 1_000_000) * PRICE_OUTPUT_PER_MTOK;
  return Math.round(usd * 1_000_000);
}

export async function callModel<T>(
  call: ModelCall<T>,
): Promise<ModelResult<T>> {
  const prompt = renderPrompt(call.context);

  // The cacheable prefix is billed at the cache read rate after the first call.
  const cachedInputTokens = call.context.blocks
    .filter((block) => block.cacheable)
    .reduce((sum, block) => sum + estimateTokens(block.text), 0);
  const inputTokens = estimateTokens(prompt) - cachedInputTokens;

  const output = call.generate(call.context);
  const outputTokens = estimateTokens(JSON.stringify(output));

  const usage: ModelUsage = {
    inputTokens,
    cachedInputTokens,
    outputTokens,
    costMicros: priceUsage(inputTokens, cachedInputTokens, outputTokens),
  };

  await recordInteraction(call, usage);

  return {
    output,
    model: MODEL_ID,
    usage,
    tier: call.context.memoryUsed ? 'memory' : 'generic',
  };
}

async function recordInteraction<T>(call: ModelCall<T>, usage: ModelUsage) {
  await ensureDatabase();
  const db = getDb();
  await db.insert(aiInteractions).values({
    id: crypto.randomUUID(),
    companyId: call.scope.companyId,
    projectId: call.projectId ?? null,
    occurrenceId: call.occurrenceId ?? null,
    kind: call.kind,
    tier: call.context.memoryUsed ? 'memory' : 'generic',
    model: MODEL_ID,
    inputTokens: usage.inputTokens,
    cachedInputTokens: usage.cachedInputTokens,
    outputTokens: usage.outputTokens,
    costMicros: usage.costMicros,
    accepted: null,
    createdAt: new Date().toISOString(),
  });
}
