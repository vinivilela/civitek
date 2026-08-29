// Add Drizzle tables here when the site needs a database.
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const companies = sqliteTable(
  'companies',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [uniqueIndex('companies_slug_unique').on(table.slug)],
);

export const memberships = sqliteTable(
  'memberships',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id),
    userId: text('user_id').notNull(),
    email: text('email').notNull(),
    role: text('role').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('memberships_company_user_unique').on(
      table.companyId,
      table.userId,
    ),
    index('memberships_user_idx').on(table.userId),
  ],
);

// One row per company. `plan` gates which context layers the assembler is
// allowed to load, so the freemium boundary is a data-access decision.
export const subscriptions = sqliteTable('subscriptions', {
  companyId: text('company_id')
    .primaryKey()
    .references(() => companies.id),
  plan: text('plan').notNull(),
  status: text('status').notNull(),
  projectQuota: integer('project_quota').notNull(),
  monthlyMessageQuota: integer('monthly_message_quota').notNull(),
  memoryTrialEndsAt: text('memory_trial_ends_at'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Materialized aggregates over the company's own history. Recomputed out of the
// request path so the premium insight never rescans the full history live.
export const tenantProfiles = sqliteTable('tenant_profiles', {
  companyId: text('company_id')
    .primaryKey()
    .references(() => companies.id),
  projectCount: integer('project_count').notNull(),
  occurrenceCount: integer('occurrence_count').notNull(),
  messageCount: integer('message_count').notNull(),
  payload: text('payload').notNull(),
  computedAt: text('computed_at').notNull(),
});

// Every model call is logged with its tenant and token cost. Without this the
// freemium tier has no accounting.
export const aiInteractions = sqliteTable(
  'ai_interactions',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull(),
    projectId: text('project_id'),
    occurrenceId: text('occurrence_id'),
    kind: text('kind').notNull(),
    tier: text('tier').notNull(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull(),
    cachedInputTokens: integer('cached_input_tokens').notNull(),
    outputTokens: integer('output_tokens').notNull(),
    costMicros: integer('cost_micros').notNull(),
    accepted: integer('accepted', { mode: 'boolean' }),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('ai_interactions_company_idx').on(table.companyId, table.createdAt),
    index('ai_interactions_kind_idx').on(table.companyId, table.kind),
  ],
);

export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    address: text('address'),
    status: text('status').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('projects_company_code_unique').on(table.companyId, table.code),
  ],
);

export const projectBaselines = sqliteTable(
  'project_baselines',
  {
    projectId: text('project_id')
      .primaryKey()
      .references(() => projects.id),
    companyId: text('company_id').notNull(),
    pilotStartedAt: text('pilot_started_at').notNull(),
    currentStage: text('current_stage').notNull(),
    summary: text('summary').notNull(),
    responsibleEngineer: text('responsible_engineer'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('project_baselines_company_idx').on(table.companyId)],
);

export const projectEvents = sqliteTable(
  'project_events',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    actor: text('actor').notNull(),
    action: text('action').notNull(),
    detail: text('detail'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('project_events_project_idx').on(table.companyId, table.projectId),
  ],
);

export const phoneAssignments = sqliteTable(
  'phone_assignments',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull(),
    phoneE164: text('phone_e164').notNull(),
    workerName: text('worker_name').notNull(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    active: integer('active', { mode: 'boolean' }).notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    // Scoped to the company: the same foreman may work for two customers.
    uniqueIndex('phone_assignments_company_phone_unique').on(
      table.companyId,
      table.phoneE164,
    ),
    index('phone_assignments_phone_idx').on(table.phoneE164),
  ],
);

export const occurrences = sqliteTable(
  'occurrences',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull(),
    companyId: text('company_id').notNull(),
    projectId: text('project_id').references(() => projects.id),
    reporterPhone: text('reporter_phone').notNull(),
    reporterName: text('reporter_name').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    location: text('location'),
    category: text('category').notNull(),
    severity: text('severity').notNull(),
    status: text('status').notNull(),
    source: text('source').notNull(),
    sourceMessageId: text('source_message_id'),
    automaticSummary: text('automatic_summary'),
    normativeReference: text('normative_reference'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('occurrences_code_unique').on(table.code),
    uniqueIndex('occurrences_source_message_unique').on(table.sourceMessageId),
    index('occurrences_project_idx').on(table.companyId, table.projectId),
    index('occurrences_status_idx').on(table.companyId, table.status),
    index('occurrences_created_idx').on(table.companyId, table.createdAt),
  ],
);

export const evidences = sqliteTable(
  'evidences',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull(),
    occurrenceId: text('occurrence_id')
      .notNull()
      .references(() => occurrences.id),
    type: text('type').notNull(),
    objectKey: text('object_key'),
    providerMediaId: text('provider_media_id'),
    mimeType: text('mime_type'),
    sha256: text('sha256'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('evidences_occurrence_idx').on(table.companyId, table.occurrenceId),
  ],
);

export const complianceChecks = sqliteTable(
  'compliance_checks',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull(),
    occurrenceId: text('occurrence_id')
      .notNull()
      .references(() => occurrences.id),
    standardCode: text('standard_code').notNull(),
    requirement: text('requirement').notNull(),
    status: text('status').notNull(),
    engineerNote: text('engineer_note'),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('compliance_checks_occurrence_idx').on(
      table.companyId,
      table.occurrenceId,
    ),
    index('compliance_checks_standard_idx').on(
      table.companyId,
      table.standardCode,
    ),
    index('compliance_checks_status_idx').on(table.companyId, table.status),
  ],
);

export const whatsappMessages = sqliteTable(
  'whatsapp_messages',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull(),
    occurrenceId: text('occurrence_id').references(() => occurrences.id),
    phoneE164: text('phone_e164').notNull(),
    direction: text('direction').notNull(),
    messageType: text('message_type').notNull(),
    body: text('body'),
    payload: text('payload'),
    deliveryStatus: text('delivery_status').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('whatsapp_messages_occurrence_idx').on(
      table.companyId,
      table.occurrenceId,
    ),
    index('whatsapp_messages_created_idx').on(table.companyId, table.createdAt),
  ],
);

export const auditEvents = sqliteTable(
  'audit_events',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull(),
    occurrenceId: text('occurrence_id')
      .notNull()
      .references(() => occurrences.id),
    actor: text('actor').notNull(),
    action: text('action').notNull(),
    detail: text('detail'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('audit_events_occurrence_idx').on(
      table.companyId,
      table.occurrenceId,
    ),
  ],
);
