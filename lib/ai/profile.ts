import { eq } from 'drizzle-orm';
import { ensureDatabase } from '@/db/bootstrap';
import { getDb } from '@/db/index';
import {
  auditEvents,
  complianceChecks,
  evidences,
  occurrences,
  projectBaselines,
  projects,
  tenantProfiles,
  whatsappMessages,
} from '@/db/schema';
import type { TenantScope } from '@/lib/tenant';

/**
 * Layer L2: aggregates over the company's own history.
 *
 * This is the half of personalization that must not come from a language
 * model. Every number here is computed, reproducible and citable, which is
 * what makes the premium insight defensible to an engineer.
 */
export type TenantProfile = {
  companyId: string;
  computedAt: string;
  projectCount: number;
  occurrenceCount: number;
  messageCount: number;
  openCount: number;
  categories: CategoryStat[];
  recurrences: RecurrenceStat[];
  standards: StandardStat[];
  avgDaysToClose: number | null;
  closedWithoutEvidence: number;
  stages: { stage: string; projectCount: number }[];
  busiestReporters: { name: string; occurrenceCount: number }[];
};

export type CategoryStat = {
  category: string;
  total: number;
  open: number;
  highSeverity: number;
  shareOfTotal: number;
};

export type RecurrenceStat = {
  category: string;
  location: string;
  occurrences: number;
  projectName: string | null;
};

export type StandardStat = {
  standardCode: string;
  total: number;
  nonCompliant: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Recomputes the profile from scratch. Runs outside the request path (cron or
 * an explicit refresh) because it reads the company's full history.
 *
 * Rows are aggregated in memory: at pilot volumes this is one round trip per
 * table instead of several grouped queries. Move to SQL `GROUP BY` once a
 * single tenant passes a few tens of thousands of occurrences.
 */
export async function computeTenantProfile(
  scope: TenantScope,
): Promise<TenantProfile> {
  await ensureDatabase();
  const db = getDb();
  const companyId = scope.companyId;

  const [
    projectRows,
    occurrenceRows,
    messageRows,
    complianceRows,
    evidenceRows,
    closeEventRows,
    baselineRows,
  ] = await Promise.all([
    db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.companyId, companyId)),
    db
      .select({
        id: occurrences.id,
        projectId: occurrences.projectId,
        reporterName: occurrences.reporterName,
        category: occurrences.category,
        severity: occurrences.severity,
        status: occurrences.status,
        location: occurrences.location,
        createdAt: occurrences.createdAt,
      })
      .from(occurrences)
      .where(eq(occurrences.companyId, companyId)),
    db
      .select({ id: whatsappMessages.id })
      .from(whatsappMessages)
      .where(eq(whatsappMessages.companyId, companyId)),
    db
      .select({
        standardCode: complianceChecks.standardCode,
        status: complianceChecks.status,
      })
      .from(complianceChecks)
      .where(eq(complianceChecks.companyId, companyId)),
    db
      .select({ occurrenceId: evidences.occurrenceId })
      .from(evidences)
      .where(eq(evidences.companyId, companyId)),
    db
      .select({
        occurrenceId: auditEvents.occurrenceId,
        action: auditEvents.action,
        createdAt: auditEvents.createdAt,
      })
      .from(auditEvents)
      .where(eq(auditEvents.companyId, companyId)),
    db
      .select({
        projectId: projectBaselines.projectId,
        currentStage: projectBaselines.currentStage,
      })
      .from(projectBaselines)
      .where(eq(projectBaselines.companyId, companyId)),
  ]);

  const projectNames = new Map(projectRows.map((row) => [row.id, row.name]));
  const total = occurrenceRows.length;

  const categoryMap = new Map<string, CategoryStat>();
  for (const row of occurrenceRows) {
    const stat = categoryMap.get(row.category) ?? {
      category: row.category,
      total: 0,
      open: 0,
      highSeverity: 0,
      shareOfTotal: 0,
    };
    stat.total += 1;
    if (row.status !== 'closed') stat.open += 1;
    if (row.severity === 'high') stat.highSeverity += 1;
    categoryMap.set(row.category, stat);
  }
  const categories = [...categoryMap.values()]
    .map((stat) => ({
      ...stat,
      shareOfTotal: total > 0 ? Math.round((stat.total / total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // Same defect, same place, more than once: the signal that separates a
  // systemic cause from an isolated execution error.
  const recurrenceMap = new Map<string, RecurrenceStat>();
  for (const row of occurrenceRows) {
    if (!row.location) continue;
    const place = row.location.split('·')[0]?.trim() || row.location.trim();
    const key = `${row.category}::${place}`;
    const stat = recurrenceMap.get(key) ?? {
      category: row.category,
      location: place,
      occurrences: 0,
      projectName: row.projectId
        ? (projectNames.get(row.projectId) ?? null)
        : null,
    };
    stat.occurrences += 1;
    recurrenceMap.set(key, stat);
  }
  const recurrences = [...recurrenceMap.values()]
    .filter((stat) => stat.occurrences > 1)
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 5);

  const standardMap = new Map<string, StandardStat>();
  for (const row of complianceRows) {
    const stat = standardMap.get(row.standardCode) ?? {
      standardCode: row.standardCode,
      total: 0,
      nonCompliant: 0,
    };
    stat.total += 1;
    if (row.status === 'non_compliant') stat.nonCompliant += 1;
    standardMap.set(row.standardCode, stat);
  }
  const standards = [...standardMap.values()].sort(
    (a, b) => b.nonCompliant - a.nonCompliant || b.total - a.total,
  );

  const createdAtById = new Map(
    occurrenceRows.map((row) => [row.id, row.createdAt]),
  );
  const closureDurations: number[] = [];
  for (const event of closeEventRows) {
    if (event.action !== 'occurrence.status.closed') continue;
    const openedAt = createdAtById.get(event.occurrenceId);
    if (!openedAt) continue;
    const elapsed = Date.parse(event.createdAt) - Date.parse(openedAt);
    if (Number.isFinite(elapsed) && elapsed >= 0) {
      closureDurations.push(elapsed / DAY_MS);
    }
  }
  const avgDaysToClose =
    closureDurations.length > 0
      ? Math.round(
          (closureDurations.reduce((sum, value) => sum + value, 0) /
            closureDurations.length) *
            10,
        ) / 10
      : null;

  const withEvidence = new Set(evidenceRows.map((row) => row.occurrenceId));
  const closedWithoutEvidence = occurrenceRows.filter(
    (row) => row.status === 'closed' && !withEvidence.has(row.id),
  ).length;

  const stageMap = new Map<string, number>();
  for (const row of baselineRows) {
    stageMap.set(row.currentStage, (stageMap.get(row.currentStage) ?? 0) + 1);
  }
  const stages = [...stageMap.entries()]
    .map(([stage, projectCount]) => ({ stage, projectCount }))
    .sort((a, b) => b.projectCount - a.projectCount);

  const reporterMap = new Map<string, number>();
  for (const row of occurrenceRows) {
    reporterMap.set(
      row.reporterName,
      (reporterMap.get(row.reporterName) ?? 0) + 1,
    );
  }
  const busiestReporters = [...reporterMap.entries()]
    .map(([name, occurrenceCount]) => ({ name, occurrenceCount }))
    .sort((a, b) => b.occurrenceCount - a.occurrenceCount)
    .slice(0, 3);

  return {
    companyId,
    computedAt: new Date().toISOString(),
    projectCount: projectRows.length,
    occurrenceCount: total,
    messageCount: messageRows.length,
    openCount: occurrenceRows.filter((row) => row.status !== 'closed').length,
    categories,
    recurrences,
    standards,
    avgDaysToClose,
    closedWithoutEvidence,
    stages,
    busiestReporters,
  };
}

export async function saveTenantProfile(profile: TenantProfile) {
  const db = getDb();
  await db
    .insert(tenantProfiles)
    .values({
      companyId: profile.companyId,
      projectCount: profile.projectCount,
      occurrenceCount: profile.occurrenceCount,
      messageCount: profile.messageCount,
      payload: JSON.stringify(profile),
      computedAt: profile.computedAt,
    })
    .onConflictDoUpdate({
      target: tenantProfiles.companyId,
      set: {
        projectCount: profile.projectCount,
        occurrenceCount: profile.occurrenceCount,
        messageCount: profile.messageCount,
        payload: JSON.stringify(profile),
        computedAt: profile.computedAt,
      },
    });
}

const PROFILE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

/** Reads the materialized profile, recomputing it when stale or absent. */
export async function getTenantProfile(
  scope: TenantScope,
  options: { forceRefresh?: boolean } = {},
): Promise<TenantProfile> {
  await ensureDatabase();
  const db = getDb();

  if (!options.forceRefresh) {
    const rows = await db
      .select({
        payload: tenantProfiles.payload,
        computedAt: tenantProfiles.computedAt,
      })
      .from(tenantProfiles)
      .where(eq(tenantProfiles.companyId, scope.companyId))
      .limit(1);

    const cached = rows[0];
    if (
      cached &&
      Date.now() - Date.parse(cached.computedAt) < PROFILE_MAX_AGE_MS
    ) {
      const parsed = JSON.parse(cached.payload) as TenantProfile;
      // A payload written for another company can only be a bug, never a read.
      if (parsed.companyId === scope.companyId) return parsed;
    }
  }

  const profile = await computeTenantProfile(scope);
  await saveTenantProfile(profile);
  return profile;
}

export function renderProfileBlock(profile: TenantProfile) {
  const categories = profile.categories
    .slice(0, 5)
    .map(
      (stat) =>
        `  - ${stat.category}: ${stat.total} ocorrências (${stat.shareOfTotal}% do total), ${stat.open} em aberto, ${stat.highSeverity} de severidade alta`,
    )
    .join('\n');

  const recurrences =
    profile.recurrences.length > 0
      ? profile.recurrences
          .map(
            (stat) =>
              `  - ${stat.category} em "${stat.location}"${stat.projectName ? ` (${stat.projectName})` : ''}: ${stat.occurrences} vezes`,
          )
          .join('\n')
      : '  - nenhuma reincidência de local identificada até agora';

  const standards = profile.standards
    .slice(0, 5)
    .map(
      (stat) =>
        `  - ${stat.standardCode}: ${stat.total} verificações, ${stat.nonCompliant} não conformes`,
    )
    .join('\n');

  return [
    'HISTÓRICO DESTA CONSTRUTORA (dados proprietários do cliente)',
    `Obras cadastradas: ${profile.projectCount}`,
    `Ocorrências registradas: ${profile.occurrenceCount} (${profile.openCount} em aberto)`,
    `Mensagens processadas: ${profile.messageCount}`,
    profile.avgDaysToClose === null
      ? 'Tempo médio de encerramento: ainda sem ocorrência encerrada'
      : `Tempo médio de encerramento: ${profile.avgDaysToClose} dias`,
    `Ocorrências encerradas sem evidência anexada: ${profile.closedWithoutEvidence}`,
    'Distribuição por categoria:',
    categories,
    'Reincidências por local:',
    recurrences,
    'Conformidade por norma:',
    standards,
  ].join('\n');
}
