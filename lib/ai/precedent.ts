import { and, eq, ne } from 'drizzle-orm';
import { ensureDatabase } from '@/db/bootstrap';
import { getDb } from '@/db/index';
import {
  auditEvents,
  complianceChecks,
  occurrences,
  projects,
} from '@/db/schema';
import type { TenantScope } from '@/lib/tenant';
import { buildContext } from './context';
import { callModel } from './client';
import { knowledgeForCase } from './knowledge';

/**
 * Knowledge management for a single occurrence: has this happened before in
 * this company's own history, and what closed it last time.
 *
 * This is the portfolio memory pointed at one case, which is where it is worth
 * the most, because the engineer is deciding what to do right now.
 *
 * Similarity is scored on structured fields plus token overlap. That is the
 * seam layer L3 replaces: swapping the scorer for a vector query over the
 * tenant namespace changes this function and nothing above it.
 */

const DAY = 24 * 60 * 60 * 1000;
/** Content words a candidate must share to count as the same defect. */
const MIN_SHARED_TOKENS = 2;
const MAX_PRECEDENTS = 5;

const STOPWORDS = new Set([
  'a',
  'o',
  'as',
  'os',
  'de',
  'da',
  'do',
  'das',
  'dos',
  'em',
  'no',
  'na',
  'nos',
  'nas',
  'um',
  'uma',
  'com',
  'sem',
  'por',
  'para',
  'que',
  'e',
  'ou',
  'ao',
  'aos',
  'se',
  'foi',
  'esta',
  'está',
  'mais',
  'muito',
  'ainda',
]);

function tokenize(value: string) {
  return new Set(
    value
      .toLocaleLowerCase('pt-BR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 3 && !STOPWORDS.has(token)),
  );
}

function overlap(a: Set<string>, b: Set<string>) {
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared;
}

/** First segment of the location, which is the block or tower. */
function placeOf(location: string | null) {
  if (!location) return null;
  return location.split('·')[0]?.trim() || location.trim();
}

export type Precedent = {
  id: string;
  code: string;
  title: string;
  location: string | null;
  projectName: string | null;
  status: string;
  createdAt: string;
  daysToClose: number | null;
  resolution: string | null;
};

/**
 * What the plan allows, and nothing more.
 *
 * The withheld figures are stripped from the payload rather than hidden by the
 * client: a paywall that ships the real numbers to the browser and only hides
 * them in the markup is not a paywall.
 */
export type PrecedentReport = {
  occurrenceId: string;
  /** False on a first occurrence of its kind. The report still carries advice. */
  hasHistory: boolean;
  /** Similar cases found in this company's history. Null while locked. */
  timesSeen: number | null;
  resolvedCount: number | null;
  avgDaysToClose: number | null;
  /** Same place as the current case, the strongest signal of a systemic cause. */
  samePlaceCount: number | null;
  precedents: Precedent[];
  /** What closed the majority of the resolved precedents. Premium. */
  proposedSolution: string | null;
  /** Layer L1 cold start: recommended steps, on every plan. */
  suggestedTreatment: string[];
  /** Layer L1, always available: what the standard requires. */
  guidance: { standardCode: string; title: string; text: string };
  /** False on the free plan: the history half is withheld. */
  unlocked: boolean;
  /** Already respects the plan, so the client renders it as it comes. */
  headline: string;
};

export async function buildPrecedentReport(
  scope: TenantScope,
  occurrenceId: string,
): Promise<PrecedentReport | null> {
  await ensureDatabase();
  const db = getDb();

  const targetRows = await db
    .select({
      id: occurrences.id,
      title: occurrences.title,
      description: occurrences.description,
      category: occurrences.category,
      location: occurrences.location,
      projectId: occurrences.projectId,
    })
    .from(occurrences)
    .where(
      and(
        eq(occurrences.id, occurrenceId),
        eq(occurrences.companyId, scope.companyId),
      ),
    )
    .limit(1);

  const target = targetRows[0];
  if (!target) return null;

  const candidates = await db
    .select({
      id: occurrences.id,
      code: occurrences.code,
      title: occurrences.title,
      description: occurrences.description,
      category: occurrences.category,
      location: occurrences.location,
      status: occurrences.status,
      createdAt: occurrences.createdAt,
      projectId: occurrences.projectId,
      projectName: projects.name,
    })
    .from(occurrences)
    .leftJoin(projects, eq(occurrences.projectId, projects.id))
    .where(
      and(
        eq(occurrences.companyId, scope.companyId),
        ne(occurrences.id, target.id),
      ),
    );

  const targetTokens = tokenize(`${target.title} ${target.description}`);
  const targetPlace = placeOf(target.location);

  const scored = candidates
    .map((row) => {
      const sharedTokens = overlap(
        targetTokens,
        tokenize(`${row.title} ${row.description}`),
      );
      const sameCategory = row.category === target.category;
      const samePlace =
        targetPlace !== null && placeOf(row.location) === targetPlace;

      // Eligibility is the same defect, not the same category. The engineer
      // reads "já aconteceu" as "esse problema", and every safety report in the
      // portfolio is not this problem.
      const relevant = sameCategory && sharedTokens >= MIN_SHARED_TOKENS;

      // Place and project only rank what is already relevant.
      const score =
        sharedTokens * 2 +
        (samePlace ? 3 : 0) +
        (row.projectId && row.projectId === target.projectId ? 2 : 0);

      return { row, score, relevant };
    })
    .filter((entry) => entry.relevant)
    .sort(
      (a, b) =>
        b.score - a.score || b.row.createdAt.localeCompare(a.row.createdAt),
    );

  // No precedent is not "nothing to say": that is the cold start, and layer L1
  // answers it with the recommended treatment for this kind of defect.
  const similarIds = new Set(scored.map((entry) => entry.row.id));

  const closures = await db
    .select({
      occurrenceId: auditEvents.occurrenceId,
      action: auditEvents.action,
      createdAt: auditEvents.createdAt,
    })
    .from(auditEvents)
    .where(eq(auditEvents.companyId, scope.companyId));

  const closedAt = new Map<string, string>();
  for (const event of closures) {
    if (event.action !== 'occurrence.status.closed') continue;
    if (!similarIds.has(event.occurrenceId)) continue;
    closedAt.set(event.occurrenceId, event.createdAt);
  }

  const notes = await db
    .select({
      occurrenceId: complianceChecks.occurrenceId,
      engineerNote: complianceChecks.engineerNote,
    })
    .from(complianceChecks)
    .where(eq(complianceChecks.companyId, scope.companyId));

  const noteByOccurrence = new Map<string, string>();
  for (const note of notes) {
    if (!note.engineerNote || !similarIds.has(note.occurrenceId)) continue;
    if (!noteByOccurrence.has(note.occurrenceId)) {
      noteByOccurrence.set(note.occurrenceId, note.engineerNote);
    }
  }

  const precedents: Precedent[] = scored
    .slice(0, MAX_PRECEDENTS)
    .map(({ row }) => {
      const closed = closedAt.get(row.id);
      return {
        id: row.id,
        code: row.code,
        title: row.title,
        location: row.location,
        projectName: row.projectName,
        status: row.status,
        createdAt: row.createdAt,
        daysToClose: closed
          ? Math.max(
              0,
              Math.round(
                ((Date.parse(closed) - Date.parse(row.createdAt)) / DAY) * 10,
              ) / 10,
            )
          : null,
        resolution: noteByOccurrence.get(row.id) ?? null,
      };
    });

  const durations = scored
    .map(({ row }) => {
      const closed = closedAt.get(row.id);
      if (!closed) return null;
      return (Date.parse(closed) - Date.parse(row.createdAt)) / DAY;
    })
    .filter((value): value is number => value !== null && value >= 0);

  const avgDaysToClose =
    durations.length > 0
      ? Math.round(
          (durations.reduce((sum, value) => sum + value, 0) /
            durations.length) *
            10,
        ) / 10
      : null;

  // The proposal is the resolution that closed the most similar cases, not a
  // sentence a model wrote. It is quotable back to the engineer who authored it.
  const tally = new Map<string, number>();
  for (const id of similarIds) {
    const note = noteByOccurrence.get(id);
    if (!note) continue;
    tally.set(note, (tally.get(note) ?? 0) + 1);
  }
  const proposedSolution =
    [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const samePlaceCount = targetPlace
    ? scored.filter(({ row }) => placeOf(row.location) === targetPlace).length
    : 0;

  const knowledge = knowledgeForCase(
    target.category,
    `${target.category} ${target.title} ${target.description}`,
  );

  // Only the shared corpus reaches the model, and only to keep the accounting
  // and the plan gate on the same path as every other call.
  const context = await buildContext(scope, {
    query: `${target.category} ${target.title}`,
  });
  await callModel({
    scope,
    kind: 'precedent_report',
    context,
    occurrenceId: target.id,
    generate: () => ({ precedents: precedents.length }),
  });

  const unlocked = scope.entitlements.memory;
  const figure = (value: string | number) => (unlocked ? String(value) : '••');

  const hasHistory = scored.length > 0;
  const headlineFor = (n: (value: string | number) => string) => {
    if (!hasHistory) {
      return 'Sua empresa ainda não registrou um caso como este.';
    }
    return samePlaceCount > 0
      ? `Já aconteceu ${n(scored.length)} vezes na sua carteira, ${n(samePlaceCount)} delas no mesmo local.`
      : `Já aconteceu ${n(scored.length)} vezes na sua carteira.`;
  };

  return {
    occurrenceId: target.id,
    hasHistory,
    timesSeen: unlocked && hasHistory ? scored.length : null,
    resolvedCount: unlocked && hasHistory ? durations.length : null,
    avgDaysToClose: unlocked ? avgDaysToClose : null,
    samePlaceCount: unlocked && hasHistory ? samePlaceCount : null,
    precedents: unlocked ? precedents : [],
    proposedSolution: unlocked ? proposedSolution : null,
    // Cold start advice, on every plan. It is the product's first answer to a
    // customer with no data, and it stays available as the norm-based reading
    // even once the history has one.
    suggestedTreatment: knowledge.treatment,
    guidance: {
      standardCode: knowledge.standardCode,
      title: knowledge.title,
      text: `${knowledge.requirement} ${knowledge.guidance}`,
    },
    unlocked,
    headline: headlineFor(figure),
  };
}
