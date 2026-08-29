import { and, desc, eq } from 'drizzle-orm';
import type { TenantScope } from '@/lib/tenant';
import { DEMO_COMPANY_ID, ensureDatabase } from './bootstrap';
import { getDb } from './index';
import {
  auditEvents,
  complianceChecks,
  evidences,
  occurrences,
  phoneAssignments,
  projectBaselines,
  projectEvents,
  projects,
  whatsappMessages,
} from './schema';

/**
 * Every read and write in this file is scoped by `TenantScope.companyId`. The
 * scope is derived from the authenticated user in `lib/tenant.ts` and is never
 * taken from a request. Do not add a query here that does not filter on it: the
 * child tables carry `company_id` precisely so isolation never depends on a
 * join being written correctly.
 */

/**
 * Inbound WhatsApp traffic whose phone number matches no company. It is parked
 * here instead of being attributed to a guess, so an unknown number can never
 * write into a real customer's history.
 */
export const UNASSIGNED_COMPANY_ID = 'company-unassigned';

export type ComplianceCheckView = {
  id: string;
  standardCode: string;
  requirement: string;
  status: string;
  engineerNote: string | null;
  updatedAt: string;
};

export type OccurrenceView = {
  id: string;
  code: string;
  title: string;
  description: string;
  location: string | null;
  category: string;
  severity: string;
  status: string;
  source: string;
  reporterName: string;
  reporterPhone: string;
  projectId: string | null;
  projectName: string | null;
  automaticSummary: string | null;
  normativeReference: string | null;
  createdAt: string;
  evidenceCount: number;
  evidenceUrl: string | null;
  complianceChecks: ComplianceCheckView[];
};

export type ProjectView = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  status: string;
  occurrenceCount: number;
  openCount: number;
  highSeverityCount: number;
  pilotStartedAt: string | null;
  currentStage: string | null;
  baselineSummary: string | null;
  responsibleEngineer: string | null;
  baselineUpdatedAt: string | null;
};

export type ProjectHistoryItemView = {
  id: string;
  type: 'baseline' | 'occurrence' | 'status' | 'compliance';
  title: string;
  description: string | null;
  actor: string;
  projectId: string | null;
  projectName: string | null;
  occurrenceId: string | null;
  occurrenceCode: string | null;
  createdAt: string;
};

export type ProjectUpdateView = {
  id: string;
  occurrenceId: string | null;
  occurrenceCode: string | null;
  occurrenceTitle: string | null;
  projectId: string | null;
  projectName: string | null;
  senderName: string;
  direction: string;
  messageType: string;
  body: string | null;
  deliveryStatus: string;
  createdAt: string;
  evidenceUrl: string | null;
};

export type InboundOccurrence = {
  messageId: string;
  phoneE164: string;
  contactName: string | null;
  messageType: string;
  text: string;
  rawPayload: string;
};

export async function listOccurrences(
  scope: TenantScope,
): Promise<OccurrenceView[]> {
  await ensureDatabase();
  const db = getDb();
  const rows = await db
    .select({
      id: occurrences.id,
      code: occurrences.code,
      title: occurrences.title,
      description: occurrences.description,
      location: occurrences.location,
      category: occurrences.category,
      severity: occurrences.severity,
      status: occurrences.status,
      source: occurrences.source,
      reporterName: occurrences.reporterName,
      reporterPhone: occurrences.reporterPhone,
      projectId: occurrences.projectId,
      projectName: projects.name,
      automaticSummary: occurrences.automaticSummary,
      normativeReference: occurrences.normativeReference,
      createdAt: occurrences.createdAt,
    })
    .from(occurrences)
    .leftJoin(projects, eq(occurrences.projectId, projects.id))
    .where(eq(occurrences.companyId, scope.companyId))
    .orderBy(desc(occurrences.createdAt));

  const evidenceRows = await db
    .select({
      id: evidences.id,
      occurrenceId: evidences.occurrenceId,
      objectKey: evidences.objectKey,
    })
    .from(evidences)
    .where(eq(evidences.companyId, scope.companyId));

  const complianceRows = await db
    .select({
      id: complianceChecks.id,
      occurrenceId: complianceChecks.occurrenceId,
      standardCode: complianceChecks.standardCode,
      requirement: complianceChecks.requirement,
      status: complianceChecks.status,
      engineerNote: complianceChecks.engineerNote,
      updatedAt: complianceChecks.updatedAt,
    })
    .from(complianceChecks)
    .where(eq(complianceChecks.companyId, scope.companyId));

  return rows.map((row) => {
    const matchingEvidence = evidenceRows.filter(
      (evidence) => evidence.occurrenceId === row.id,
    );
    const storedEvidence = matchingEvidence.find(
      (evidence) => evidence.objectKey,
    );
    return {
      ...row,
      evidenceCount: matchingEvidence.length,
      evidenceUrl: storedEvidence ? `/api/evidence/${storedEvidence.id}` : null,
      complianceChecks: complianceRows
        .filter((check) => check.occurrenceId === row.id)
        .map(({ occurrenceId: _, ...check }) => check),
    };
  });
}

export async function listProjects(scope: TenantScope): Promise<ProjectView[]> {
  await ensureDatabase();
  const db = getDb();
  const projectRows = await db
    .select({
      id: projects.id,
      code: projects.code,
      name: projects.name,
      address: projects.address,
      status: projects.status,
      pilotStartedAt: projectBaselines.pilotStartedAt,
      currentStage: projectBaselines.currentStage,
      baselineSummary: projectBaselines.summary,
      responsibleEngineer: projectBaselines.responsibleEngineer,
      baselineUpdatedAt: projectBaselines.updatedAt,
    })
    .from(projects)
    .leftJoin(projectBaselines, eq(projects.id, projectBaselines.projectId))
    .where(eq(projects.companyId, scope.companyId));
  const occurrenceRows = await db
    .select({
      projectId: occurrences.projectId,
      status: occurrences.status,
      severity: occurrences.severity,
    })
    .from(occurrences)
    .where(eq(occurrences.companyId, scope.companyId));

  return projectRows.map((project) => {
    const projectOccurrences = occurrenceRows.filter(
      (occurrence) => occurrence.projectId === project.id,
    );
    return {
      ...project,
      occurrenceCount: projectOccurrences.length,
      openCount: projectOccurrences.filter(
        (occurrence) => occurrence.status !== 'closed',
      ).length,
      highSeverityCount: projectOccurrences.filter(
        (occurrence) =>
          occurrence.severity === 'high' && occurrence.status !== 'closed',
      ).length,
    };
  });
}

export async function countProjects(scope: TenantScope): Promise<number> {
  await ensureDatabase();
  const db = getDb();
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.companyId, scope.companyId));
  return rows.length;
}

export async function updateProjectBaseline(
  scope: TenantScope,
  projectId: string,
  input: {
    pilotStartedAt: string;
    currentStage: string;
    summary: string;
    responsibleEngineer: string | null;
  },
) {
  await ensureDatabase();
  const db = getDb();
  const projectRows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(eq(projects.id, projectId), eq(projects.companyId, scope.companyId)),
    )
    .limit(1);

  if (!projectRows[0]) throw new Error('Obra não encontrada.');

  const now = new Date().toISOString();
  await db
    .insert(projectBaselines)
    .values({
      projectId,
      companyId: scope.companyId,
      pilotStartedAt: input.pilotStartedAt,
      currentStage: input.currentStage,
      summary: input.summary,
      responsibleEngineer: input.responsibleEngineer,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: projectBaselines.projectId,
      set: {
        pilotStartedAt: input.pilotStartedAt,
        currentStage: input.currentStage,
        summary: input.summary,
        responsibleEngineer: input.responsibleEngineer,
        updatedAt: now,
      },
    });

  await db.insert(projectEvents).values({
    id: crypto.randomUUID(),
    companyId: scope.companyId,
    projectId,
    actor: 'Equipe de engenharia',
    action: 'project.baseline.updated',
    detail: `Etapa: ${input.currentStage}. ${input.summary}`,
    createdAt: now,
  });
}

export async function listProjectUpdates(
  scope: TenantScope,
): Promise<ProjectUpdateView[]> {
  await ensureDatabase();
  const db = getDb();
  const rows = await db
    .select({
      id: whatsappMessages.id,
      occurrenceId: whatsappMessages.occurrenceId,
      occurrenceCode: occurrences.code,
      occurrenceTitle: occurrences.title,
      projectId: occurrences.projectId,
      projectName: projects.name,
      reporterName: occurrences.reporterName,
      direction: whatsappMessages.direction,
      messageType: whatsappMessages.messageType,
      body: whatsappMessages.body,
      deliveryStatus: whatsappMessages.deliveryStatus,
      createdAt: whatsappMessages.createdAt,
    })
    .from(whatsappMessages)
    .leftJoin(occurrences, eq(whatsappMessages.occurrenceId, occurrences.id))
    .leftJoin(projects, eq(occurrences.projectId, projects.id))
    .where(eq(whatsappMessages.companyId, scope.companyId))
    .orderBy(desc(whatsappMessages.createdAt));

  const evidenceRows = await db
    .select({
      id: evidences.id,
      occurrenceId: evidences.occurrenceId,
      objectKey: evidences.objectKey,
    })
    .from(evidences)
    .where(eq(evidences.companyId, scope.companyId));

  return rows.map((row) => {
    const storedEvidence = evidenceRows.find(
      (evidence) =>
        evidence.occurrenceId === row.occurrenceId && evidence.objectKey,
    );
    return {
      id: row.id,
      occurrenceId: row.occurrenceId,
      occurrenceCode: row.occurrenceCode,
      occurrenceTitle: row.occurrenceTitle,
      projectId: row.projectId,
      projectName: row.projectName,
      senderName:
        row.direction === 'outbound'
          ? 'CiviTek'
          : (row.reporterName ?? 'Contato da obra'),
      direction: row.direction,
      messageType: row.messageType,
      body: row.body,
      deliveryStatus: row.deliveryStatus,
      createdAt: row.createdAt,
      evidenceUrl: storedEvidence ? `/api/evidence/${storedEvidence.id}` : null,
    };
  });
}

export async function listProjectHistory(
  scope: TenantScope,
): Promise<ProjectHistoryItemView[]> {
  await ensureDatabase();
  const db = getDb();
  const occurrenceRows = await db
    .select({
      id: occurrences.id,
      code: occurrences.code,
      title: occurrences.title,
      reporterName: occurrences.reporterName,
      projectId: occurrences.projectId,
      projectName: projects.name,
      createdAt: occurrences.createdAt,
    })
    .from(occurrences)
    .leftJoin(projects, eq(occurrences.projectId, projects.id))
    .where(eq(occurrences.companyId, scope.companyId));
  const auditRows = await db
    .select({
      id: auditEvents.id,
      action: auditEvents.action,
      detail: auditEvents.detail,
      actor: auditEvents.actor,
      createdAt: auditEvents.createdAt,
      occurrenceId: occurrences.id,
      occurrenceCode: occurrences.code,
      occurrenceTitle: occurrences.title,
      projectId: occurrences.projectId,
      projectName: projects.name,
    })
    .from(auditEvents)
    .innerJoin(occurrences, eq(auditEvents.occurrenceId, occurrences.id))
    .leftJoin(projects, eq(occurrences.projectId, projects.id))
    .where(eq(auditEvents.companyId, scope.companyId));
  const projectEventRows = await db
    .select({
      id: projectEvents.id,
      action: projectEvents.action,
      detail: projectEvents.detail,
      actor: projectEvents.actor,
      projectId: projectEvents.projectId,
      projectName: projects.name,
      createdAt: projectEvents.createdAt,
    })
    .from(projectEvents)
    .innerJoin(projects, eq(projectEvents.projectId, projects.id))
    .where(eq(projectEvents.companyId, scope.companyId));

  const occurrenceItems: ProjectHistoryItemView[] = occurrenceRows.map(
    (row) => ({
      id: `occurrence-${row.id}`,
      type: 'occurrence',
      title: `${row.code} registrada`,
      description: row.title,
      actor: row.reporterName,
      projectId: row.projectId,
      projectName: row.projectName,
      occurrenceId: row.id,
      occurrenceCode: row.code,
      createdAt: row.createdAt,
    }),
  );
  const auditItems: ProjectHistoryItemView[] = auditRows
    .filter((row) => row.action !== 'occurrence.created')
    .map((row) => {
      const copy = getAuditEventCopy(row.action);
      return {
        id: row.id,
        type: copy.type,
        title: copy.title,
        description: row.detail || row.occurrenceTitle,
        actor: getActorLabel(row.actor),
        projectId: row.projectId,
        projectName: row.projectName,
        occurrenceId: row.occurrenceId,
        occurrenceCode: row.occurrenceCode,
        createdAt: row.createdAt,
      };
    });
  const projectItems: ProjectHistoryItemView[] = projectEventRows.map(
    (row) => ({
      id: row.id,
      type: 'baseline',
      title:
        row.action === 'project.baseline.created'
          ? 'Marco zero registrado'
          : 'Marco zero atualizado',
      description: row.detail,
      actor: row.actor,
      projectId: row.projectId,
      projectName: row.projectName,
      occurrenceId: null,
      occurrenceCode: null,
      createdAt: row.createdAt,
    }),
  );

  return [...occurrenceItems, ...auditItems, ...projectItems].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export async function getEvidenceObjectKey(scope: TenantScope, id: string) {
  await ensureDatabase();
  const db = getDb();
  const rows = await db
    .select({ objectKey: evidences.objectKey })
    .from(evidences)
    .where(and(eq(evidences.id, id), eq(evidences.companyId, scope.companyId)))
    .limit(1);
  return rows[0]?.objectKey ?? null;
}

/**
 * The one write whose tenant is resolved from data instead of a session. The
 * sender's phone number decides the company, and an unmatched number lands in
 * the quarantine tenant rather than in someone's history.
 */
export async function createOccurrenceFromWhatsApp(input: InboundOccurrence) {
  await ensureDatabase();
  const db = getDb();
  const existing = await db
    .select({
      id: occurrences.id,
      code: occurrences.code,
      companyId: occurrences.companyId,
    })
    .from(occurrences)
    .where(eq(occurrences.sourceMessageId, input.messageId))
    .limit(1);

  if (existing[0]) {
    return {
      ...existing[0],
      created: false,
      projectName: null as string | null,
    };
  }

  const assignmentRows = await db
    .select({
      workerName: phoneAssignments.workerName,
      projectId: phoneAssignments.projectId,
      projectName: projects.name,
      companyId: projects.companyId,
    })
    .from(phoneAssignments)
    .innerJoin(projects, eq(phoneAssignments.projectId, projects.id))
    .where(
      and(
        eq(phoneAssignments.phoneE164, input.phoneE164),
        eq(phoneAssignments.active, true),
      ),
    )
    .limit(1);

  const assignment = assignmentRows[0];
  const companyId = assignment?.companyId ?? UNASSIGNED_COMPANY_ID;
  const classification = classifyOccurrence(input.text);
  const id = crypto.randomUUID();
  const code = createOccurrenceCode();
  const now = new Date().toISOString();
  const reporterName =
    assignment?.workerName ?? input.contactName ?? 'Contato não identificado';

  await db.insert(occurrences).values({
    id,
    code,
    companyId,
    projectId: assignment?.projectId ?? null,
    reporterPhone: input.phoneE164,
    reporterName,
    title: classification.title,
    description: input.text || 'Imagem recebida sem legenda.',
    location: classification.location,
    category: classification.category,
    severity: classification.severity,
    status: assignment ? 'new' : 'needs_context',
    source: 'whatsapp',
    sourceMessageId: input.messageId,
    automaticSummary: classification.summary,
    normativeReference: classification.normativeReference,
    createdAt: now,
    updatedAt: now,
  });

  if (classification.complianceChecks.length > 0) {
    await db.insert(complianceChecks).values(
      classification.complianceChecks.map((check) => ({
        id: crypto.randomUUID(),
        companyId,
        occurrenceId: id,
        standardCode: check.standardCode,
        requirement: check.requirement,
        status: 'pending',
        engineerNote: null,
        updatedAt: now,
      })),
    );
  }

  await db.insert(whatsappMessages).values({
    id: input.messageId,
    companyId,
    occurrenceId: id,
    phoneE164: input.phoneE164,
    direction: 'inbound',
    messageType: input.messageType,
    body: input.text,
    payload: input.rawPayload,
    deliveryStatus: 'received',
    createdAt: now,
  });

  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    companyId,
    occurrenceId: id,
    actor: 'whatsapp-webhook',
    action: 'occurrence.created',
    detail: assignment
      ? 'Telefone vinculado automaticamente à obra.'
      : 'Telefone sem vínculo de obra. Ocorrência retida fora dos dados de clientes.',
    createdAt: now,
  });

  return {
    id,
    code,
    created: true,
    companyId,
    projectName: assignment?.projectName ?? null,
  };
}

export async function addEvidence(input: {
  companyId: string;
  occurrenceId: string;
  objectKey: string | null;
  providerMediaId: string;
  mimeType: string | null;
  sha256: string | null;
}) {
  await ensureDatabase();
  const db = getDb();
  await db.insert(evidences).values({
    id: crypto.randomUUID(),
    companyId: input.companyId,
    occurrenceId: input.occurrenceId,
    type: 'image',
    objectKey: input.objectKey,
    providerMediaId: input.providerMediaId,
    mimeType: input.mimeType,
    sha256: input.sha256,
    createdAt: new Date().toISOString(),
  });
}

export async function recordOutboundMessage(input: {
  companyId: string;
  phoneE164: string;
  occurrenceId: string;
  body: string;
  providerMessageId: string | null;
  deliveryStatus: string;
}) {
  await ensureDatabase();
  const db = getDb();
  await db.insert(whatsappMessages).values({
    id: input.providerMessageId ?? crypto.randomUUID(),
    companyId: input.companyId,
    occurrenceId: input.occurrenceId,
    phoneE164: input.phoneE164,
    direction: 'outbound',
    messageType: 'text',
    body: input.body,
    payload: null,
    deliveryStatus: input.deliveryStatus,
    createdAt: new Date().toISOString(),
  });
}

export async function updateOccurrenceStatus(
  scope: TenantScope,
  id: string,
  status: string,
) {
  await ensureDatabase();
  const db = getDb();
  const allowed = new Set(['new', 'in_progress', 'validation', 'closed']);

  if (!allowed.has(status)) {
    throw new Error('Status inválido.');
  }

  const rows = await db
    .select({ id: occurrences.id })
    .from(occurrences)
    .where(
      and(eq(occurrences.id, id), eq(occurrences.companyId, scope.companyId)),
    )
    .limit(1);

  if (!rows[0]) throw new Error('Ocorrência não encontrada.');

  const now = new Date().toISOString();
  await db
    .update(occurrences)
    .set({ status, updatedAt: now })
    .where(
      and(eq(occurrences.id, id), eq(occurrences.companyId, scope.companyId)),
    );

  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    companyId: scope.companyId,
    occurrenceId: id,
    actor: 'dashboard-user',
    action: `occurrence.status.${status}`,
    detail: null,
    createdAt: now,
  });
}

export async function updateComplianceCheck(
  scope: TenantScope,
  id: string,
  status: string,
  engineerNote?: string,
) {
  await ensureDatabase();
  const db = getDb();
  const allowed = new Set([
    'pending',
    'compliant',
    'non_compliant',
    'not_applicable',
  ]);

  if (!allowed.has(status)) {
    throw new Error('Situação de conformidade inválida.');
  }

  const rows = await db
    .select({ occurrenceId: complianceChecks.occurrenceId })
    .from(complianceChecks)
    .where(
      and(
        eq(complianceChecks.id, id),
        eq(complianceChecks.companyId, scope.companyId),
      ),
    )
    .limit(1);
  const check = rows[0];

  if (!check) {
    throw new Error('Item de conformidade não encontrado.');
  }

  const now = new Date().toISOString();
  await db
    .update(complianceChecks)
    .set({
      status,
      engineerNote: engineerNote?.trim() || null,
      updatedAt: now,
    })
    .where(
      and(
        eq(complianceChecks.id, id),
        eq(complianceChecks.companyId, scope.companyId),
      ),
    );

  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    companyId: scope.companyId,
    occurrenceId: check.occurrenceId,
    actor: 'dashboard-engineer',
    action: `compliance.${status}`,
    detail: engineerNote?.trim() || null,
    createdAt: now,
  });
}

/** Claims the seeded demo tenant. Local development only. */
export function isDemoCompany(companyId: string) {
  return companyId === DEMO_COMPANY_ID;
}

function getAuditEventCopy(action: string): {
  type: 'status' | 'compliance';
  title: string;
} {
  const titles: Record<string, string> = {
    'occurrence.status.new': 'Ocorrência reaberta',
    'occurrence.status.in_progress': 'Tratamento iniciado',
    'occurrence.status.validation': 'Enviada para validação',
    'occurrence.status.closed': 'Ocorrência encerrada',
    'compliance.pending': 'Conformidade marcada como pendente',
    'compliance.compliant': 'Conformidade validada',
    'compliance.non_compliant': 'Não conformidade confirmada',
    'compliance.not_applicable': 'Requisito marcado como não aplicável',
  };
  return {
    type: action.startsWith('compliance.') ? 'compliance' : 'status',
    title: titles[action] ?? 'Histórico atualizado',
  };
}

function getActorLabel(actor: string) {
  if (actor === 'dashboard-engineer') return 'Engenharia';
  if (actor === 'dashboard-user') return 'Equipe CiviTek';
  if (actor === 'whatsapp-webhook') return 'WhatsApp';
  return actor;
}

function classifyOccurrence(text: string) {
  const normalized = text.toLocaleLowerCase('pt-BR');
  const location = extractLocation(text);

  if (/manta|impermeabili|infiltra|vazamento/.test(normalized)) {
    return {
      title: conciseTitle(text, 'Possível falha de impermeabilização'),
      location,
      category: 'Impermeabilização',
      severity: 'high',
      summary:
        'Possível falha de impermeabilização identificada no relato de campo.',
      normativeReference:
        'NBR 15575 · Estanqueidade. Validar o requisito aplicável com o responsável técnico.',
      complianceChecks: [
        {
          standardCode: 'NBR 15575',
          requirement: 'Estanqueidade à água e proteção contra infiltrações',
        },
        {
          standardCode: 'PBQP-H',
          requirement: 'Rastreabilidade da inspeção e da correção',
        },
      ],
    };
  }

  if (/fissura|trinca|rachadura|estrutura/.test(normalized)) {
    return {
      title: conciseTitle(text, 'Fissura ou trinca reportada'),
      location,
      category: 'Estrutura e vedação',
      severity: 'high',
      summary: 'Relato estrutural ou de vedação que requer inspeção técnica.',
      normativeReference:
        'NBR 15575 · Desempenho estrutural. Validar o requisito aplicável em inspeção.',
      complianceChecks: [
        {
          standardCode: 'NBR 15575',
          requirement: 'Desempenho estrutural e estabilidade',
        },
      ],
    };
  }

  if (/fio|elétric|tomada|quadro|tubula|encanamento/.test(normalized)) {
    return {
      title: conciseTitle(text, 'Irregularidade em instalação'),
      location,
      category: 'Instalações',
      severity: 'medium',
      summary:
        'Irregularidade de instalação classificada para triagem da engenharia.',
      normativeReference:
        'PBQP-H · Controle de projeto e execução. Confirmar a disciplina aplicável.',
      complianceChecks: [
        {
          standardCode: 'PBQP-H',
          requirement: 'Compatibilização entre projeto e serviço executado',
        },
      ],
    };
  }

  if (/capacete|epi|risco|andaime|proteção|segurança/.test(normalized)) {
    return {
      title: conciseTitle(text, 'Risco de segurança reportado'),
      location,
      category: 'Segurança',
      severity: 'high',
      summary:
        'Possível risco de segurança; priorizar avaliação da equipe responsável.',
      normativeReference:
        'PBQP-H · Controle da execução. Validar com o responsável técnico.',
      complianceChecks: [
        {
          standardCode: 'PBQP-H',
          requirement: 'Controle da execução e registro da inspeção',
        },
      ],
    };
  }

  return {
    title: conciseTitle(text, 'Novo relato de campo'),
    location,
    category: 'A classificar',
    severity: 'medium',
    summary: 'Relato recebido e normalizado para triagem da equipe técnica.',
    normativeReference: null,
    complianceChecks: [
      {
        standardCode: 'PBQP-H',
        requirement: 'Triagem, registro e rastreabilidade da ocorrência',
      },
    ],
  };
}

function conciseTitle(text: string, fallback: string) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return fallback;
  return clean.length > 64 ? `${clean.slice(0, 61)}...` : clean;
}

function extractLocation(text: string) {
  const match = text.match(
    /(?:torre|bloco|apto|apartamento|andar|pavimento|subsolo|sala|banheiro|cozinha)[^,.!?]*/i,
  );
  return match?.[0]?.trim() ?? null;
}

function createOccurrenceCode() {
  const date = new Date();
  const day = date.toISOString().slice(0, 10).replaceAll('-', '');
  const suffix = crypto.randomUUID().slice(0, 4).toUpperCase();
  return `OC-${day}-${suffix}`;
}
