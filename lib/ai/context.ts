import {
  renderKnowledgeBlock,
  retrieveGlobalKnowledge,
  type KnowledgeEntry,
} from './knowledge';
import {
  getTenantProfile,
  renderProfileBlock,
  type TenantProfile,
} from './profile';
import type { TenantScope } from '@/lib/tenant';

/**
 * The context assembler.
 *
 * Every prompt in the product is built here and nowhere else. The transition
 * from the generic assistant to the one trained on the customer's history is
 * the presence or absence of the tenant blocks, not a different model and not a
 * different prompt. That keeps the freemium boundary auditable and makes an
 * upgrade take effect on the next request.
 */

export type ContextBlockId = 'knowledge' | 'profile' | 'case';

export type ContextBlock = {
  id: ContextBlockId;
  /** Tenant blocks carry the company they were read for, checked before use. */
  companyId: string | null;
  /** Stable across requests and identical between tenants, so it is cacheable. */
  cacheable: boolean;
  text: string;
};

export type AssembledContext = {
  blocks: ContextBlock[];
  knowledge: KnowledgeEntry[];
  profile: TenantProfile | null;
  memoryUsed: boolean;
};

export class CrossTenantContextError extends Error {}

/**
 * Last line of defence before anything reaches a model. Namespace and metadata
 * filters fail for different reasons, so the assembled result is checked once
 * more against the scope that asked for it.
 */
export function assertNoCrossTenant(
  blocks: ContextBlock[],
  companyId: string,
): ContextBlock[] {
  for (const block of blocks) {
    if (block.companyId !== null && block.companyId !== companyId) {
      throw new CrossTenantContextError(
        `Bloco "${block.id}" pertence a outro tenant. Requisição interrompida.`,
      );
    }
  }
  return blocks;
}

export type ContextRequest = {
  /** Free text used to retrieve from the knowledge corpus. */
  query: string;
  /** Deterministic facts (layer L0) already computed by the caller. */
  caseFacts?: string;
  forceProfileRefresh?: boolean;
};

export async function buildContext(
  scope: TenantScope,
  request: ContextRequest,
): Promise<AssembledContext> {
  const blocks: ContextBlock[] = [];

  // L1 first, and byte-identical between tenants. Ordering it ahead of the
  // tenant blocks is what lets one cached prefix serve every company.
  const knowledge = retrieveGlobalKnowledge(request.query);
  blocks.push({
    id: 'knowledge',
    companyId: null,
    cacheable: true,
    text: renderKnowledgeBlock(knowledge),
  });

  // L2 to L4: only when the plan allows reading the company's own history.
  let profile: TenantProfile | null = null;
  if (scope.entitlements.memory) {
    profile = await getTenantProfile(scope, {
      forceRefresh: request.forceProfileRefresh,
    });
    blocks.push({
      id: 'profile',
      companyId: profile.companyId,
      cacheable: false,
      text: renderProfileBlock(profile),
    });
  }

  // L0 last: volatile, never cached.
  if (request.caseFacts) {
    blocks.push({
      id: 'case',
      companyId: scope.companyId,
      cacheable: false,
      text: request.caseFacts,
    });
  }

  return {
    blocks: assertNoCrossTenant(blocks, scope.companyId),
    knowledge,
    profile,
    memoryUsed: profile !== null,
  };
}

export function renderPrompt(context: AssembledContext) {
  return context.blocks.map((block) => block.text).join('\n\n');
}
