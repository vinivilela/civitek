// Add Drizzle tables here when the site needs a database.
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

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

export const phoneAssignments = sqliteTable(
  'phone_assignments',
  {
    id: text('id').primaryKey(),
    phoneE164: text('phone_e164').notNull(),
    workerName: text('worker_name').notNull(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    active: integer('active', { mode: 'boolean' }).notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('phone_assignments_phone_unique').on(table.phoneE164),
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
    index('occurrences_project_idx').on(table.projectId),
    index('occurrences_status_idx').on(table.status),
  ],
);

export const evidences = sqliteTable(
  'evidences',
  {
    id: text('id').primaryKey(),
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
  (table) => [index('evidences_occurrence_idx').on(table.occurrenceId)],
);

export const complianceChecks = sqliteTable(
  'compliance_checks',
  {
    id: text('id').primaryKey(),
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
    index('compliance_checks_occurrence_idx').on(table.occurrenceId),
    index('compliance_checks_standard_idx').on(table.standardCode),
    index('compliance_checks_status_idx').on(table.status),
  ],
);

export const whatsappMessages = sqliteTable(
  'whatsapp_messages',
  {
    id: text('id').primaryKey(),
    occurrenceId: text('occurrence_id').references(() => occurrences.id),
    phoneE164: text('phone_e164').notNull(),
    direction: text('direction').notNull(),
    messageType: text('message_type').notNull(),
    body: text('body'),
    payload: text('payload'),
    deliveryStatus: text('delivery_status').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('whatsapp_messages_occurrence_idx').on(table.occurrenceId)],
);

export const auditEvents = sqliteTable(
  'audit_events',
  {
    id: text('id').primaryKey(),
    occurrenceId: text('occurrence_id')
      .notNull()
      .references(() => occurrences.id),
    actor: text('actor').notNull(),
    action: text('action').notNull(),
    detail: text('detail'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('audit_events_occurrence_idx').on(table.occurrenceId)],
);
