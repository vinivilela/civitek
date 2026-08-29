import { env } from 'cloudflare:workers';

let initialization: Promise<void> | undefined;

export function ensureDatabase() {
  initialization ??= initializeDatabase();
  return initialization;
}

async function initializeDatabase() {
  const database = env.DB;

  if (!database) {
    throw new Error('Cloudflare D1 binding DB is unavailable.');
  }

  await database.batch([
    database.prepare(`CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      company_id TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`),
    database.prepare(
      'CREATE UNIQUE INDEX IF NOT EXISTS projects_company_code_unique ON projects (company_id, code)',
    ),
    database.prepare(`CREATE TABLE IF NOT EXISTS phone_assignments (
      id TEXT PRIMARY KEY NOT NULL,
      phone_e164 TEXT NOT NULL,
      worker_name TEXT NOT NULL,
      project_id TEXT NOT NULL REFERENCES projects(id),
      active INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )`),
    database.prepare(
      'CREATE UNIQUE INDEX IF NOT EXISTS phone_assignments_phone_unique ON phone_assignments (phone_e164)',
    ),
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
    database.prepare(
      'CREATE UNIQUE INDEX IF NOT EXISTS occurrences_code_unique ON occurrences (code)',
    ),
    database.prepare(
      'CREATE UNIQUE INDEX IF NOT EXISTS occurrences_source_message_unique ON occurrences (source_message_id)',
    ),
    database.prepare(
      'CREATE INDEX IF NOT EXISTS occurrences_project_idx ON occurrences (project_id)',
    ),
    database.prepare(
      'CREATE INDEX IF NOT EXISTS occurrences_status_idx ON occurrences (status)',
    ),
    database.prepare(`CREATE TABLE IF NOT EXISTS evidences (
      id TEXT PRIMARY KEY NOT NULL,
      occurrence_id TEXT NOT NULL REFERENCES occurrences(id),
      type TEXT NOT NULL,
      object_key TEXT,
      provider_media_id TEXT,
      mime_type TEXT,
      sha256 TEXT,
      created_at TEXT NOT NULL
    )`),
    database.prepare(
      'CREATE INDEX IF NOT EXISTS evidences_occurrence_idx ON evidences (occurrence_id)',
    ),
    database.prepare(`CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id TEXT PRIMARY KEY NOT NULL,
      occurrence_id TEXT REFERENCES occurrences(id),
      phone_e164 TEXT NOT NULL,
      direction TEXT NOT NULL,
      message_type TEXT NOT NULL,
      body TEXT,
      payload TEXT,
      delivery_status TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`),
    database.prepare(
      'CREATE INDEX IF NOT EXISTS whatsapp_messages_occurrence_idx ON whatsapp_messages (occurrence_id)',
    ),
    database.prepare(`CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY NOT NULL,
      occurrence_id TEXT NOT NULL REFERENCES occurrences(id),
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL
    )`),
    database.prepare(
      'CREATE INDEX IF NOT EXISTS audit_events_occurrence_idx ON audit_events (occurrence_id)',
    ),
  ]);

  await seedDemoData(database);
}

async function seedDemoData(database: D1Database) {
  const createdAt = '2026-08-28T19:30:00.000Z';

  await database.batch([
    database
      .prepare(
        `INSERT OR IGNORE INTO projects
          (id, company_id, code, name, address, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        'project-aurora',
        'company-demo',
        'AURORA',
        'Obra Aurora',
        'São Paulo, SP',
        'active',
        createdAt,
      ),
    database
      .prepare(
        `INSERT OR IGNORE INTO projects
          (id, company_id, code, name, address, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        'project-horizonte',
        'company-demo',
        'HORIZONTE',
        'Residencial Horizonte',
        'Campinas, SP',
        'active',
        createdAt,
      ),
    database
      .prepare(
        `INSERT OR IGNORE INTO phone_assignments
          (id, phone_e164, worker_name, project_id, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        'phone-carlos',
        '5511999999999',
        'Carlos Santos',
        'project-aurora',
        1,
        createdAt,
      ),
    database
      .prepare(
        `INSERT OR IGNORE INTO phone_assignments
          (id, phone_e164, worker_name, project_id, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        'phone-ana',
        '5511966666666',
        'Ana Paula',
        'project-horizonte',
        1,
        createdAt,
      ),
    seedOccurrence(database, {
      id: 'occurrence-045',
      code: 'OC-045',
      projectId: 'project-horizonte',
      reporter: 'Ana Paula',
      phone: '5511966666666',
      title: 'Guarda-corpo com fixação pendente',
      description:
        'Fixação do guarda-corpo está solta no corredor do quarto andar.',
      location: 'Bloco C · 4º andar · Corredor',
      category: 'Segurança',
      severity: 'high',
      status: 'new',
      summary:
        'Possível risco de segurança identificado em elemento de proteção coletiva.',
      norm: 'Referência técnica candidata: proteção coletiva. Validar com o técnico de segurança.',
      createdAt: '2026-08-28T23:05:00.000Z',
    }),
    seedOccurrence(database, {
      id: 'occurrence-044',
      code: 'OC-044',
      projectId: 'project-horizonte',
      reporter: 'Rafael Souza',
      phone: '5511955555555',
      title: 'Ponto elétrico divergente do projeto',
      description:
        'Tomada instalada fora da posição indicada no projeto executivo.',
      location: 'Bloco B · Apto 108 · Cozinha',
      category: 'Instalações',
      severity: 'medium',
      status: 'in_progress',
      summary:
        'Divergência entre instalação elétrica executada e projeto de referência.',
      norm: 'Referência técnica candidata: instalações elétricas. Confirmar no projeto executivo.',
      createdAt: '2026-08-28T21:18:00.000Z',
    }),
    seedOccurrence(database, {
      id: 'occurrence-043',
      code: 'OC-043',
      projectId: 'project-horizonte',
      reporter: 'Ana Paula',
      phone: '5511966666666',
      title: 'Rejunte revisado após inspeção',
      description: 'Rejunte corrigido e conferido pela equipe de qualidade.',
      location: 'Bloco A · Apto 205 · Banheiro',
      category: 'Acabamento',
      severity: 'low',
      status: 'closed',
      summary: 'Correção concluída e validada pela equipe responsável.',
      norm: null,
      createdAt: '2026-08-27T18:22:00.000Z',
    }),
    seedOccurrence(database, {
      id: 'occurrence-042',
      code: 'OC-042',
      reporter: 'Carlos Santos',
      phone: '5511999999999',
      title: 'Manta descolando no box',
      description: 'A manta descolou no canto do box.',
      location: 'Torre A · Apto 302 · Banheiro',
      category: 'Impermeabilização',
      severity: 'high',
      status: 'new',
      summary:
        'Possível falha de impermeabilização. Local e disciplina foram extraídos do relato.',
      norm: 'Referência técnica candidata: impermeabilização. Validar com o responsável técnico.',
      createdAt: '2026-08-28T22:41:00.000Z',
    }),
    seedOccurrence(database, {
      id: 'occurrence-041',
      code: 'OC-041',
      reporter: 'João Lima',
      phone: '5511988888888',
      title: 'Fissura próxima ao vão da janela',
      description: 'Fissura visível ao lado do vão da janela do quarto.',
      location: 'Torre B · Apto 507 · Quarto',
      category: 'Estrutura e vedação',
      severity: 'medium',
      status: 'in_progress',
      summary: 'Fissura próxima a uma abertura; requer inspeção do engenheiro.',
      norm: 'Referência técnica candidata: vedação e fissuração. Validar em inspeção.',
      createdAt: '2026-08-28T22:07:00.000Z',
    }),
    seedOccurrence(database, {
      id: 'occurrence-040',
      code: 'OC-040',
      reporter: 'Márcio Alves',
      phone: '5511977777777',
      title: 'Tubulação sem identificação',
      description:
        'Tubulação do hall técnico está sem etiqueta de identificação.',
      location: 'Torre A · 2º subsolo · Hall técnico',
      category: 'Instalações',
      severity: 'medium',
      status: 'validation',
      summary: 'Ausência de identificação visual em instalação hidráulica.',
      norm: 'Referência técnica candidata: identificação de instalações. Validar em projeto.',
      createdAt: '2026-08-28T20:45:00.000Z',
    }),
    seedOccurrence(database, {
      id: 'occurrence-039',
      code: 'OC-039',
      reporter: 'Carlos Santos',
      phone: '5511999999999',
      title: 'Revestimento corrigido e fotografado',
      description: 'Correção do revestimento concluída e registrada em foto.',
      location: 'Torre A · Apto 201 · Cozinha',
      category: 'Acabamento',
      severity: 'low',
      status: 'closed',
      summary:
        'Evidência de correção recebida para encerramento da ocorrência.',
      norm: null,
      createdAt: '2026-08-27T19:48:00.000Z',
    }),
    database
      .prepare(
        `INSERT OR IGNORE INTO evidences
          (id, occurrence_id, type, object_key, provider_media_id, mime_type, sha256, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        'evidence-042',
        'occurrence-042',
        'image',
        null,
        'demo-image-042',
        'image/jpeg',
        null,
        '2026-08-28T22:41:00.000Z',
      ),
  ]);
}

function seedOccurrence(
  database: D1Database,
  data: {
    id: string;
    code: string;
    projectId?: string;
    reporter: string;
    phone: string;
    title: string;
    description: string;
    location: string;
    category: string;
    severity: string;
    status: string;
    summary: string;
    norm: string | null;
    createdAt: string;
  },
) {
  return database
    .prepare(
      `INSERT OR IGNORE INTO occurrences
        (id, code, company_id, project_id, reporter_phone, reporter_name,
         title, description, location, category, severity, status, source,
         source_message_id, automatic_summary, normative_reference, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      data.id,
      data.code,
      'company-demo',
      data.projectId ?? 'project-aurora',
      data.phone,
      data.reporter,
      data.title,
      data.description,
      data.location,
      data.category,
      data.severity,
      data.status,
      'whatsapp',
      null,
      data.summary,
      data.norm,
      data.createdAt,
      data.createdAt,
    );
}
