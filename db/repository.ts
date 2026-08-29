import { and, desc, eq } from 'drizzle-orm';
import { ensureDatabase } from './bootstrap';
import { getDb } from './index';
import {
  auditEvents,
  complianceChecks,
  evidences,
  occurrences,
  phoneAssignments,
  projects,
  whatsappMessages,
} from './schema';

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

export async function listOccurrences(): Promise<OccurrenceView[]> {
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
    .orderBy(desc(occurrences.createdAt));

  const evidenceRows = await db
    .select({
      id: evidences.id,
      occurrenceId: evidences.occurrenceId,
      objectKey: evidences.objectKey,
    })
    .from(evidences);

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
    .from(complianceChecks);

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

export async function listProjects(): Promise<ProjectView[]> {
  await ensureDatabase();
  const db = getDb();
  const projectRows = await db
    .select({
      id: projects.id,
      code: projects.code,
      name: projects.name,
      address: projects.address,
      status: projects.status,
    })
    .from(projects);
  const occurrenceRows = await db
    .select({
      projectId: occurrences.projectId,
      status: occurrences.status,
      severity: occurrences.severity,
    })
    .from(occurrences);

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

export async function listProjectUpdates(): Promise<ProjectUpdateView[]> {
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
    .orderBy(desc(whatsappMessages.createdAt));

  const evidenceRows = await db
    .select({
      id: evidences.id,
      occurrenceId: evidences.occurrenceId,
      objectKey: evidences.objectKey,
    })
    .from(evidences);

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

export async function getEvidenceObjectKey(id: string) {
  await ensureDatabase();
  const db = getDb();
  const rows = await db
    .select({ objectKey: evidences.objectKey })
    .from(evidences)
    .where(eq(evidences.id, id))
    .limit(1);
  return rows[0]?.objectKey ?? null;
}

export async function createOccurrenceFromWhatsApp(input: InboundOccurrence) {
  await ensureDatabase();
  const db = getDb();
  const existing = await db
    .select({ id: occurrences.id, code: occurrences.code })
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
  const classification = classifyOccurrence(input.text);
  const id = crypto.randomUUID();
  const code = createOccurrenceCode();
  const now = new Date().toISOString();
  const reporterName =
    assignment?.workerName ?? input.contactName ?? 'Contato não identificado';

  await db.insert(occurrences).values({
    id,
    code,
    companyId: assignment?.companyId ?? 'company-demo',
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
    occurrenceId: id,
    actor: 'whatsapp-webhook',
    action: 'occurrence.created',
    detail: assignment
      ? 'Telefone vinculado automaticamente à obra.'
      : 'Telefone sem vínculo de obra.',
    createdAt: now,
  });

  return {
    id,
    code,
    created: true,
    projectName: assignment?.projectName ?? null,
  };
}

export async function addEvidence(input: {
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

export async function updateOccurrenceStatus(id: string, status: string) {
  await ensureDatabase();
  const db = getDb();
  const allowed = new Set(['new', 'in_progress', 'validation', 'closed']);

  if (!allowed.has(status)) {
    throw new Error('Status inválido.');
  }

  await db
    .update(occurrences)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(occurrences.id, id));

  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    occurrenceId: id,
    actor: 'dashboard-user',
    action: `occurrence.status.${status}`,
    detail: null,
    createdAt: new Date().toISOString(),
  });
}

export async function updateComplianceCheck(
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
    .where(eq(complianceChecks.id, id))
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
    .where(eq(complianceChecks.id, id));

  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    occurrenceId: check.occurrenceId,
    actor: 'dashboard-engineer',
    action: `compliance.${status}`,
    detail: engineerNote?.trim() || null,
    createdAt: now,
  });
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
