import { env } from 'cloudflare:workers';
import { DEMO_COMPANY_ID, seedDemoData } from './seed';

export { DEMO_COMPANY_ID };

let initialization: Promise<void> | undefined;

export function ensureDatabase() {
  // A rejected promise must not stay memoized: caching the failure would make
  // every later request fail for the life of the isolate, long after the cause
  // was fixed. Clearing it lets the next request retry the migration.
  initialization ??= initializeDatabase().catch((error: unknown) => {
    initialization = undefined;
    throw error;
  });
  return initialization;
}

/**
 * Three phases, and the order matters.
 *
 * On a database that predates tenant isolation, `CREATE TABLE IF NOT EXISTS` is
 * a no-op, so the table is still missing `company_id`. Almost every index here
 * is composed on that column, so creating indexes before the columns exist
 * fails on exactly the databases that need the migration most.
 */
async function initializeDatabase() {
  const database = env.DB;

  if (!database) {
    throw new Error('Cloudflare D1 binding DB is unavailable.');
  }

  await createTables(database);
  await migrateTenantColumns(database);
  await createIndexes(database);
  await seedDemoData(database);
}

async function createTables(database: D1Database) {
  await database.batch([
    database.prepare(`CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS memberships (
      id TEXT PRIMARY KEY NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id),
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS subscriptions (
      company_id TEXT PRIMARY KEY NOT NULL REFERENCES companies(id),
      plan TEXT NOT NULL,
      status TEXT NOT NULL,
      project_quota INTEGER NOT NULL,
      monthly_message_quota INTEGER NOT NULL,
      memory_trial_ends_at TEXT,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS tenant_profiles (
      company_id TEXT PRIMARY KEY NOT NULL REFERENCES companies(id),
      project_count INTEGER NOT NULL,
      occurrence_count INTEGER NOT NULL,
      message_count INTEGER NOT NULL,
      payload TEXT NOT NULL,
      computed_at TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS ai_interactions (
      id TEXT PRIMARY KEY NOT NULL,
      company_id TEXT NOT NULL,
      project_id TEXT,
      occurrence_id TEXT,
      kind TEXT NOT NULL,
      tier TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      cached_input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      cost_micros INTEGER NOT NULL,
      accepted INTEGER,
      created_at TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      company_id TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS project_baselines (
      project_id TEXT PRIMARY KEY NOT NULL REFERENCES projects(id),
      company_id TEXT NOT NULL DEFAULT '${DEMO_COMPANY_ID}',
      pilot_started_at TEXT NOT NULL,
      current_stage TEXT NOT NULL,
      summary TEXT NOT NULL,
      responsible_engineer TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS project_events (
      id TEXT PRIMARY KEY NOT NULL,
      company_id TEXT NOT NULL DEFAULT '${DEMO_COMPANY_ID}',
      project_id TEXT NOT NULL REFERENCES projects(id),
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS phone_assignments (
      id TEXT PRIMARY KEY NOT NULL,
      company_id TEXT NOT NULL DEFAULT '${DEMO_COMPANY_ID}',
      phone_e164 TEXT NOT NULL,
      worker_name TEXT NOT NULL,
      project_id TEXT NOT NULL REFERENCES projects(id),
      active INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS occurrences (
      id TEXT PRIMARY KEY NOT NULL,
      code TEXT NOT NULL,
      company_id TEXT NOT NULL,
      project_id TEXT REFERENCES projects(id),
      reporter_phone TEXT NOT NULL,
      reporter_name TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      location TEXT,
      category TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      source TEXT NOT NULL,
      source_message_id TEXT,
      automatic_summary TEXT,
      normative_reference TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS evidences (
      id TEXT PRIMARY KEY NOT NULL,
      company_id TEXT NOT NULL DEFAULT '${DEMO_COMPANY_ID}',
      occurrence_id TEXT NOT NULL REFERENCES occurrences(id),
      type TEXT NOT NULL,
      object_key TEXT,
      provider_media_id TEXT,
      mime_type TEXT,
      sha256 TEXT,
      created_at TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS compliance_checks (
      id TEXT PRIMARY KEY NOT NULL,
      company_id TEXT NOT NULL DEFAULT '${DEMO_COMPANY_ID}',
      occurrence_id TEXT NOT NULL REFERENCES occurrences(id),
      standard_code TEXT NOT NULL,
      requirement TEXT NOT NULL,
      status TEXT NOT NULL,
      engineer_note TEXT,
      updated_at TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id TEXT PRIMARY KEY NOT NULL,
      company_id TEXT NOT NULL DEFAULT '${DEMO_COMPANY_ID}',
      occurrence_id TEXT REFERENCES occurrences(id),
      phone_e164 TEXT NOT NULL,
      direction TEXT NOT NULL,
      message_type TEXT NOT NULL,
      body TEXT,
      payload TEXT,
      delivery_status TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY NOT NULL,
      company_id TEXT NOT NULL DEFAULT '${DEMO_COMPANY_ID}',
      occurrence_id TEXT NOT NULL REFERENCES occurrences(id),
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL
    )`),
  ]);
}

/**
 * Brings a database created before tenant isolation up to the current shape.
 * Each ALTER runs on its own because a batch aborts on the first duplicate
 * column, and re-running the whole step has to stay harmless.
 */
async function migrateTenantColumns(database: D1Database) {
  const tenantColumns = [
    'project_baselines',
    'project_events',
    'phone_assignments',
    'evidences',
    'compliance_checks',
    'whatsapp_messages',
    'audit_events',
  ];

  for (const table of tenantColumns) {
    await runIgnoringDuplicate(
      database,
      `ALTER TABLE ${table} ADD COLUMN company_id TEXT NOT NULL DEFAULT '${DEMO_COMPANY_ID}'`,
    );
  }

  // The old unique index was global, which blocked the same phone number from
  // serving two companies.
  await runIgnoringDuplicate(
    database,
    'DROP INDEX IF EXISTS phone_assignments_phone_unique',
  );

  // Backfill from the parent row so tenancy stops depending on the join.
  await database.batch([
    database.prepare(
      'UPDATE project_baselines SET company_id = (SELECT company_id FROM projects WHERE projects.id = project_baselines.project_id) WHERE EXISTS (SELECT 1 FROM projects WHERE projects.id = project_baselines.project_id)',
    ),
    database.prepare(
      'UPDATE project_events SET company_id = (SELECT company_id FROM projects WHERE projects.id = project_events.project_id) WHERE EXISTS (SELECT 1 FROM projects WHERE projects.id = project_events.project_id)',
    ),
    database.prepare(
      'UPDATE phone_assignments SET company_id = (SELECT company_id FROM projects WHERE projects.id = phone_assignments.project_id) WHERE EXISTS (SELECT 1 FROM projects WHERE projects.id = phone_assignments.project_id)',
    ),
    database.prepare(
      'UPDATE evidences SET company_id = (SELECT company_id FROM occurrences WHERE occurrences.id = evidences.occurrence_id) WHERE EXISTS (SELECT 1 FROM occurrences WHERE occurrences.id = evidences.occurrence_id)',
    ),
    database.prepare(
      'UPDATE compliance_checks SET company_id = (SELECT company_id FROM occurrences WHERE occurrences.id = compliance_checks.occurrence_id) WHERE EXISTS (SELECT 1 FROM occurrences WHERE occurrences.id = compliance_checks.occurrence_id)',
    ),
    database.prepare(
      'UPDATE whatsapp_messages SET company_id = (SELECT company_id FROM occurrences WHERE occurrences.id = whatsapp_messages.occurrence_id) WHERE EXISTS (SELECT 1 FROM occurrences WHERE occurrences.id = whatsapp_messages.occurrence_id)',
    ),
    database.prepare(
      'UPDATE audit_events SET company_id = (SELECT company_id FROM occurrences WHERE occurrences.id = audit_events.occurrence_id) WHERE EXISTS (SELECT 1 FROM occurrences WHERE occurrences.id = audit_events.occurrence_id)',
    ),
  ]);
}

async function createIndexes(database: D1Database) {
  await database.batch([
    database.prepare(
      'CREATE UNIQUE INDEX IF NOT EXISTS companies_slug_unique ON companies (slug)',
    ),
    database.prepare(
      'CREATE UNIQUE INDEX IF NOT EXISTS memberships_company_user_unique ON memberships (company_id, user_id)',
    ),
    database.prepare(
      'CREATE INDEX IF NOT EXISTS memberships_user_idx ON memberships (user_id)',
    ),
    database.prepare(
      'CREATE INDEX IF NOT EXISTS ai_interactions_company_idx ON ai_interactions (company_id, created_at)',
    ),
    database.prepare(
      'CREATE INDEX IF NOT EXISTS ai_interactions_kind_idx ON ai_interactions (company_id, kind)',
    ),
    database.prepare(
      'CREATE UNIQUE INDEX IF NOT EXISTS projects_company_code_unique ON projects (company_id, code)',
    ),
    database.prepare(
      'CREATE INDEX IF NOT EXISTS project_baselines_company_idx ON project_baselines (company_id)',
    ),
    database.prepare(
      'CREATE INDEX IF NOT EXISTS project_events_project_idx ON project_events (company_id, project_id)',
    ),
    database.prepare(
      'CREATE UNIQUE INDEX IF NOT EXISTS phone_assignments_company_phone_unique ON phone_assignments (company_id, phone_e164)',
    ),
    database.prepare(
      'CREATE INDEX IF NOT EXISTS phone_assignments_phone_idx ON phone_assignments (phone_e164)',
    ),
    database.prepare(
      'CREATE UNIQUE INDEX IF NOT EXISTS occurrences_code_unique ON occurrences (code)',
    ),
    database.prepare(
      'CREATE UNIQUE INDEX IF NOT EXISTS occurrences_source_message_unique ON occurrences (source_message_id)',
    ),
    database.prepare(
      'CREATE INDEX IF NOT EXISTS occurrences_project_idx ON occurrences (company_id, project_id)',
    ),
    database.prepare(
      'CREATE INDEX IF NOT EXISTS occurrences_status_idx ON occurrences (company_id, status)',
    ),
    database.prepare(
      'CREATE INDEX IF NOT EXISTS occurrences_created_idx ON occurrences (company_id, created_at)',
    ),
    database.prepare(
      'CREATE INDEX IF NOT EXISTS evidences_occurrence_idx ON evidences (company_id, occurrence_id)',
    ),
    database.prepare(
      'CREATE INDEX IF NOT EXISTS compliance_checks_occurrence_idx ON compliance_checks (company_id, occurrence_id)',
    ),
    database.prepare(
      'CREATE INDEX IF NOT EXISTS compliance_checks_standard_idx ON compliance_checks (company_id, standard_code)',
    ),
    database.prepare(
      'CREATE INDEX IF NOT EXISTS compliance_checks_status_idx ON compliance_checks (company_id, status)',
    ),
    database.prepare(
      'CREATE INDEX IF NOT EXISTS whatsapp_messages_occurrence_idx ON whatsapp_messages (company_id, occurrence_id)',
    ),
    database.prepare(
      'CREATE INDEX IF NOT EXISTS whatsapp_messages_created_idx ON whatsapp_messages (company_id, created_at)',
    ),
    database.prepare(
      'CREATE INDEX IF NOT EXISTS audit_events_occurrence_idx ON audit_events (company_id, occurrence_id)',
    ),
  ]);
}

async function runIgnoringDuplicate(database: D1Database, sql: string) {
  try {
    await database.prepare(sql).run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/duplicate column name|already exists/i.test(message)) throw error;
  }
}
