import { buildContext } from './context';
import { callModel } from './client';
import { getTenantProfile, type TenantProfile } from './profile';
import { retrieveGlobalKnowledge } from './knowledge';
import type { TenantScope } from '@/lib/tenant';

/**
 * The memory report.
 *
 * Two rules shape this file.
 *
 * The numbers come from SQL and the prose comes from the model. An engineer
 * acts on a figure only if it is reproducible, so nothing numeric here is
 * generated.
 *
 * The insight is computed for every plan and only its numbers are withheld on
 * the free one. A paywall whose teaser is specific converts; one that promises
 * "unlock insights" does not. It also means the free tenant's history never
 * enters a model prompt at all, because the teaser is built locally.
 */

export type InsightLayer = 'knowledge' | 'memory';

export type Insight = {
  id: string;
  layer: InsightLayer;
  headline: string;
  /** Populated only when the plan allows reading the history. */
  detail: string | null;
  /** Same sentence with the figures withheld. Drives the upsell teaser. */
  maskedDetail: string;
  standardCode: string | null;
  locked: boolean;
};

export type MemoryReport = {
  plan: 'free' | 'premium';
  memoryUnlocked: boolean;
  memoryTrial: boolean;
  memoryTrialEndsAt: string | null;
  /** True once the company reached the project count that triggers the offer. */
  atConversionMoment: boolean;
  learned: {
    projectCount: number;
    occurrenceCount: number;
    messageCount: number;
    patternCount: number;
    projectQuota: number;
  };
  insights: Insight[];
  costMicros: number;
  computedAt: string;
};

/** Stands in for a withheld figure. */
export const MASK = '••';

/**
 * Writes the sentence twice from one template: once with the figures and once
 * with them withheld. Masking a finished sentence by regex would also blank a
 * digit inside a place name like "Casa 1", and the place is exactly the part
 * that has to stay specific for the teaser to be worth anything.
 */
function phrase(
  template: (figure: (value: string | number) => string) => string,
): { detail: string; maskedDetail: string } {
  return {
    detail: template((value) => String(value)),
    maskedDetail: template(() => MASK),
  };
}

function buildMemoryInsights(profile: TenantProfile): Insight[] {
  const insights: Insight[] = [];

  for (const recurrence of profile.recurrences.slice(0, 2)) {
    insights.push({
      id: `recurrence-${recurrence.category}-${recurrence.location}`
        .toLocaleLowerCase('pt-BR')
        .replace(/[^a-z0-9]+/g, '-'),
      layer: 'memory',
      headline: 'Reincidência detectada no mesmo local',
      ...phrase(
        (n) =>
          `"${recurrence.category}" apareceu ${n(recurrence.occurrences)} vezes em ${recurrence.location}${recurrence.projectName ? `, na obra ${recurrence.projectName}` : ''}. Reincidência no mesmo local costuma indicar causa sistêmica, não erro de execução isolado.`,
      ),
      standardCode: null,
      locked: false,
    });
  }

  const leadingCategory = profile.categories[0];
  if (leadingCategory && profile.occurrenceCount > 0) {
    insights.push({
      id: 'leading-category',
      layer: 'memory',
      headline: 'Concentração por categoria',
      ...phrase(
        (n) =>
          `${n(leadingCategory.shareOfTotal)}% das suas ocorrências são de "${leadingCategory.category}" (${n(leadingCategory.total)} de ${n(profile.occurrenceCount)}), e ${n(leadingCategory.open)} seguem em aberto. É a categoria que mais consome a atenção da sua engenharia.`,
      ),
      standardCode: null,
      locked: false,
    });
  }

  if (profile.avgDaysToClose !== null) {
    const avgDaysToClose = profile.avgDaysToClose;
    insights.push({
      id: 'cycle-time',
      layer: 'memory',
      headline: 'Tempo médio de tratamento',
      ...phrase(
        (n) =>
          `Suas ocorrências levam em média ${n(avgDaysToClose)} dias entre o registro e o encerramento. Esse é o número que a sua obra compara quando você promete prazo de resposta ao cliente final.`,
      ),
      standardCode: null,
      locked: false,
    });
  }

  if (profile.closedWithoutEvidence > 0) {
    insights.push({
      id: 'evidence-gap',
      layer: 'memory',
      headline: 'Lacuna de evidência no encerramento',
      ...phrase(
        (n) =>
          `${n(profile.closedWithoutEvidence)} ocorrências foram encerradas sem evidência anexada. Em auditoria, encerramento sem evidência não sustenta a liberação do serviço.`,
      ),
      standardCode: 'PBQP-H',
      locked: false,
    });
  }

  const worstStandard = profile.standards.find((stat) => stat.nonCompliant > 0);
  if (worstStandard) {
    insights.push({
      id: `standard-${worstStandard.standardCode}`
        .toLocaleLowerCase('pt-BR')
        .replace(/[^a-z0-9]+/g, '-'),
      layer: 'memory',
      headline: 'Norma com maior reprovação',
      ...phrase(
        (n) =>
          `${worstStandard.standardCode} concentra ${n(worstStandard.nonCompliant)} não conformidades em ${n(worstStandard.total)} verificações. É o requisito com maior taxa de reprovação na sua carteira.`,
      ),
      standardCode: worstStandard.standardCode,
      locked: false,
    });
  }

  return insights;
}

function buildKnowledgeInsights(query: string): Insight[] {
  return retrieveGlobalKnowledge(query, 3).map((entry) => {
    const detail = `${entry.requirement} ${entry.guidance}`;
    return {
      id: entry.id,
      layer: 'knowledge' as const,
      headline: entry.title,
      detail,
      maskedDetail: detail,
      standardCode: entry.standardCode,
      locked: false,
    };
  });
}

export async function buildMemoryReport(
  scope: TenantScope,
  options: { query?: string; forceRefresh?: boolean } = {},
): Promise<MemoryReport> {
  const query = options.query ?? '';

  // Computed on every plan. Only the display of the figures is gated.
  const profile = await getTenantProfile(scope, {
    forceRefresh: options.forceRefresh,
  });

  // The model sees the gated context and nothing else: on the free plan the
  // company's history is never sent to a provider.
  const context = await buildContext(scope, { query });
  const knowledge = await callModel({
    scope,
    kind: 'memory_report',
    context,
    generate: () => buildKnowledgeInsights(query),
  });

  const unlocked = scope.entitlements.memory;
  const memoryInsights = buildMemoryInsights(profile).map((insight) => ({
    ...insight,
    detail: unlocked ? insight.detail : null,
    locked: !unlocked,
  }));

  return {
    plan: scope.entitlements.plan,
    memoryUnlocked: unlocked,
    memoryTrial: scope.entitlements.memoryTrial,
    memoryTrialEndsAt: scope.entitlements.memoryTrialEndsAt,
    atConversionMoment:
      profile.projectCount >= scope.entitlements.projectQuota &&
      scope.entitlements.plan === 'free',
    learned: {
      projectCount: profile.projectCount,
      occurrenceCount: profile.occurrenceCount,
      messageCount: profile.messageCount,
      patternCount: profile.recurrences.length + profile.categories.length,
      projectQuota: scope.entitlements.projectQuota,
    },
    insights: [...memoryInsights, ...knowledge.output],
    costMicros: knowledge.usage.costMicros,
    computedAt: profile.computedAt,
  };
}
