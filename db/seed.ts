/**
 * The tenant every demo row belongs to. Local development claims it on the
 * first sign-in so the dashboard opens with data. Set `CIVITEK_DEMO_TENANT` to
 * `off` in production so real customers are provisioned a clean company.
 */
export const DEMO_COMPANY_ID = 'company-demo';

/**
 * Demo dataset for the seeded tenant.
 *
 * Deterministic on purpose: the generator runs off a fixed seed and a fixed
 * date anchor, so the counters in the memory panel and the numbers inside each
 * insight are the same on every machine. A demo whose figures move between runs
 * is useless for judging whether an insight reads well.
 *
 * The shape is chosen to exercise the product, not just to fill tables:
 * fifteen projects so the free quota lands exactly on the conversion moment,
 * repeated defects in the same place so the recurrence insight fires, closures
 * without evidence so the compliance gap is not zero, and closure events spread
 * over time so the average cycle time is a real average.
 */

const ANCHOR = Date.parse('2026-08-28T19:30:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const SEED = 20260828;
const OCCURRENCE_COUNT = 210;
const HISTORY_DAYS = 180;

/** Statements per D1 batch. Keeps a single call well inside the platform limit. */
const BATCH_SIZE = 50;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)] as T;
}

function iso(ms: number) {
  return new Date(ms).toISOString();
}

type ProjectSeed = {
  id: string;
  code: string;
  name: string;
  address: string;
  stage: string;
  engineer: string;
  pilotStartedAt: string;
  summary: string;
  /** Small pool on purpose: repeats are what create recurrence. */
  blocks: string[];
  /** Relative share of the occurrence volume. */
  weight: number;
};

const PROJECTS: ProjectSeed[] = [
  {
    id: 'project-aurora',
    code: 'AURORA',
    name: 'Obra Aurora',
    address: 'São Paulo, SP',
    stage: 'Acabamentos',
    engineer: 'Marina Costa',
    pilotStartedAt: '2026-03-02',
    summary:
      'Piloto iniciado com foco no registro de impermeabilização, instalações e acabamento pelo WhatsApp.',
    blocks: ['Torre A', 'Torre B'],
    weight: 5,
  },
  {
    id: 'project-horizonte',
    code: 'HORIZONTE',
    name: 'Residencial Horizonte',
    address: 'Campinas, SP',
    stage: 'Instalações',
    engineer: 'Lucas Almeida',
    pilotStartedAt: '2026-03-16',
    summary:
      'Marco inicial do acompanhamento de segurança, instalações e inspeções de qualidade da obra.',
    blocks: ['Bloco A', 'Bloco B', 'Bloco C'],
    weight: 5,
  },
  {
    id: 'project-vertice',
    code: 'VERTICE',
    name: 'Edifício Vértice',
    address: 'São Paulo, SP',
    stage: 'Estrutura',
    engineer: 'Marina Costa',
    pilotStartedAt: '2026-04-06',
    summary:
      'Acompanhamento da estrutura com foco em fissuração e liberação de concretagem.',
    blocks: ['Torre Única'],
    weight: 4,
  },
  {
    id: 'project-parque',
    code: 'PARQUE',
    name: 'Parque das Águas',
    address: 'Sorocaba, SP',
    stage: 'Vedações',
    engineer: 'Renata Dias',
    pilotStartedAt: '2026-04-20',
    summary:
      'Controle de vedações e impermeabilização das áreas molhadas dos quatro blocos.',
    blocks: ['Bloco 1', 'Bloco 2'],
    weight: 4,
  },
  {
    id: 'project-mirante',
    code: 'MIRANTE',
    name: 'Condomínio Mirante',
    address: 'Santos, SP',
    stage: 'Acabamentos',
    engineer: 'Lucas Almeida',
    pilotStartedAt: '2026-05-04',
    summary:
      'Registro de acabamento e conferência de revestimento antes da vistoria de entrega.',
    blocks: ['Torre Mar', 'Torre Sol'],
    weight: 3,
  },
  {
    id: 'project-atlantica',
    code: 'ATLANTICA',
    name: 'Residencial Atlântica',
    address: 'Guarujá, SP',
    stage: 'Entrega',
    engineer: 'Renata Dias',
    pilotStartedAt: '2026-03-09',
    summary:
      'Fase de entrega com vistoria assistida e registro fotográfico obrigatório.',
    blocks: ['Bloco Praia'],
    weight: 3,
  },
  {
    id: 'project-central',
    code: 'CENTRAL',
    name: 'Torre Central',
    address: 'São Paulo, SP',
    stage: 'Fundação',
    engineer: 'Paulo Menezes',
    pilotStartedAt: '2026-06-01',
    summary:
      'Início do piloto na fundação, com foco em segurança e trabalho em altura.',
    blocks: ['Subsolo', 'Térreo'],
    weight: 3,
  },
  {
    id: 'project-jardins',
    code: 'JARDINS',
    name: 'Villa Jardins',
    address: 'Ribeirão Preto, SP',
    stage: 'Instalações',
    engineer: 'Marina Costa',
    pilotStartedAt: '2026-05-18',
    summary:
      'Compatibilização entre projeto executivo e instalações elétricas e hidráulicas.',
    blocks: ['Casa 1', 'Casa 2'],
    weight: 3,
  },
  {
    id: 'project-portal',
    code: 'PORTAL',
    name: 'Portal do Sol',
    address: 'Bauru, SP',
    stage: 'Estrutura',
    engineer: 'Paulo Menezes',
    pilotStartedAt: '2026-06-15',
    summary: 'Estrutura em andamento com inspeção semanal de formas e armação.',
    blocks: ['Torre Norte'],
    weight: 2,
  },
  {
    id: 'project-serra',
    code: 'SERRA',
    name: 'Alto da Serra',
    address: 'Campos do Jordão, SP',
    stage: 'Vedações',
    engineer: 'Renata Dias',
    pilotStartedAt: '2026-06-29',
    summary:
      'Vedações e impermeabilização em região de alta umidade e variação térmica.',
    blocks: ['Chalé A', 'Chalé B'],
    weight: 2,
  },
  {
    id: 'project-marina',
    code: 'MARINA',
    name: 'Marina Clube',
    address: 'Ilhabela, SP',
    stage: 'Acabamentos',
    engineer: 'Lucas Almeida',
    pilotStartedAt: '2026-07-06',
    summary: 'Acabamento da área comum e do deque, com foco em acessibilidade.',
    blocks: ['Área Comum'],
    weight: 2,
  },
  {
    id: 'project-nova',
    code: 'NOVA',
    name: 'Nova Estação',
    address: 'Jundiaí, SP',
    stage: 'Planejamento',
    engineer: 'Paulo Menezes',
    pilotStartedAt: '2026-08-03',
    summary: 'Obra recém-cadastrada, ainda em planejamento e mobilização.',
    blocks: ['Canteiro'],
    weight: 1,
  },
  {
    id: 'project-lagoa',
    code: 'LAGOA',
    name: 'Residencial Lagoa',
    address: 'Piracicaba, SP',
    stage: 'Instalações',
    engineer: 'Marina Costa',
    pilotStartedAt: '2026-07-20',
    summary: 'Instalações hidráulicas e identificação de prumadas técnicas.',
    blocks: ['Bloco Lago'],
    weight: 2,
  },
  {
    id: 'project-primavera',
    code: 'PRIMAVERA',
    name: 'Jardim Primavera',
    address: 'Limeira, SP',
    stage: 'Acabamentos',
    engineer: 'Renata Dias',
    pilotStartedAt: '2026-07-13',
    summary: 'Acabamento e rejunte das unidades do primeiro bloco entregue.',
    blocks: ['Bloco Flor'],
    weight: 2,
  },
  {
    id: 'project-orion',
    code: 'ORION',
    name: 'Business Orion',
    address: 'São Paulo, SP',
    stage: 'Estrutura',
    engineer: 'Paulo Menezes',
    pilotStartedAt: '2026-08-10',
    summary:
      'Torre corporativa em estrutura, com controle de trabalho em altura.',
    blocks: ['Torre Corporativa'],
    weight: 1,
  },
];

type WorkerSeed = {
  id: string;
  name: string;
  phone: string;
  projectId: string;
};

const WORKERS: WorkerSeed[] = [
  {
    id: 'phone-carlos',
    name: 'Carlos Santos',
    phone: '5511999999999',
    projectId: 'project-aurora',
  },
  {
    id: 'phone-joao',
    name: 'João Lima',
    phone: '5511988888888',
    projectId: 'project-aurora',
  },
  {
    id: 'phone-marcio',
    name: 'Márcio Alves',
    phone: '5511977777777',
    projectId: 'project-aurora',
  },
  {
    id: 'phone-ana',
    name: 'Ana Paula',
    phone: '5511966666666',
    projectId: 'project-horizonte',
  },
  {
    id: 'phone-rafael',
    name: 'Rafael Souza',
    phone: '5511955555555',
    projectId: 'project-horizonte',
  },
  {
    id: 'phone-diego',
    name: 'Diego Ferreira',
    phone: '5511944444444',
    projectId: 'project-vertice',
  },
  {
    id: 'phone-simone',
    name: 'Simone Rocha',
    phone: '5511933333333',
    projectId: 'project-parque',
  },
  {
    id: 'phone-edson',
    name: 'Edson Barbosa',
    phone: '5511922222222',
    projectId: 'project-mirante',
  },
  {
    id: 'phone-luciana',
    name: 'Luciana Prado',
    phone: '5511911111111',
    projectId: 'project-atlantica',
  },
  {
    id: 'phone-tiago',
    name: 'Tiago Moraes',
    phone: '5511900000001',
    projectId: 'project-central',
  },
  {
    id: 'phone-vera',
    name: 'Vera Nogueira',
    phone: '5511900000002',
    projectId: 'project-jardins',
  },
  {
    id: 'phone-bruno',
    name: 'Bruno Carvalho',
    phone: '5511900000003',
    projectId: 'project-portal',
  },
  {
    id: 'phone-heloisa',
    name: 'Heloísa Martins',
    phone: '5511900000004',
    projectId: 'project-serra',
  },
  {
    id: 'phone-samuel',
    name: 'Samuel Ribeiro',
    phone: '5511900000005',
    projectId: 'project-marina',
  },
  {
    id: 'phone-katia',
    name: 'Kátia Fonseca',
    phone: '5511900000006',
    projectId: 'project-nova',
  },
  {
    id: 'phone-otavio',
    name: 'Otávio Pinto',
    phone: '5511900000007',
    projectId: 'project-lagoa',
  },
  {
    id: 'phone-cintia',
    name: 'Cíntia Braga',
    phone: '5511900000008',
    projectId: 'project-primavera',
  },
  {
    id: 'phone-gustavo',
    name: 'Gustavo Teles',
    phone: '5511900000009',
    projectId: 'project-orion',
  },
];

type CategorySeed = {
  category: string;
  severity: string;
  weight: number;
  rooms: string[];
  reports: { title: string; description: string }[];
  summary: string;
  norm: string | null;
  checks: { standardCode: string; requirement: string }[];
  /** O que a engenharia registrou ao encerrar. Vira a solução proposta. */
  resolutions: string[];
};

const CATEGORIES: CategorySeed[] = [
  {
    category: 'Impermeabilização',
    severity: 'high',
    weight: 5,
    rooms: ['Banheiro', 'Área de serviço', 'Sacada', 'Cobertura'],
    reports: [
      {
        title: 'Manta descolando no box',
        description: 'A manta descolou no canto do box.',
      },
      {
        title: 'Infiltração no teto da unidade',
        description: 'Mancha de umidade crescendo no teto perto da viga.',
      },
      {
        title: 'Ralo sem caimento adequado',
        description: 'A água está empoçando longe do ralo.',
      },
      {
        title: 'Rodapé com umidade ascendente',
        description: 'Rodapé descolando com sinal de umidade vindo do piso.',
      },
    ],
    summary:
      'Possível falha de impermeabilização identificada no relato de campo.',
    norm: 'NBR 15575 · Estanqueidade. Validar o requisito aplicável com o responsável técnico.',
    checks: [
      {
        standardCode: 'NBR 15575',
        requirement: 'Estanqueidade à água e proteção contra infiltrações',
      },
      {
        standardCode: 'PBQP-H',
        requirement: 'Rastreabilidade da inspeção e da correção',
      },
    ],
    resolutions: [
      'Removida a manta no trecho afetado, refeito o primer e reaplicada com transpasse de 10 cm. Teste de estanqueidade por 72 h antes de liberar.',
      'Regularizado o caimento com argamassa e refeita a impermeabilização até 30 cm na parede. Liberado após lâmina d’água.',
      'Reforçado o rodapé de impermeabilização e refeito o rejunte. Ralo reassentado no ponto baixo.',
    ],
  },
  {
    category: 'Estrutura e vedação',
    severity: 'high',
    weight: 4,
    rooms: ['Quarto', 'Sala', 'Fachada', 'Escada'],
    reports: [
      {
        title: 'Fissura próxima ao vão da janela',
        description: 'Fissura visível ao lado do vão da janela do quarto.',
      },
      {
        title: 'Trinca horizontal na alvenaria',
        description: 'Trinca acompanhando a fiada de blocos na parede da sala.',
      },
      {
        title: 'Destacamento entre alvenaria e pilar',
        description: 'Abertura na junta entre a alvenaria e o pilar.',
      },
      {
        title: 'Fissura mapeada no reboco',
        description: 'Reboco com fissuras finas em toda a superfície.',
      },
    ],
    summary: 'Relato estrutural ou de vedação que requer inspeção técnica.',
    norm: 'NBR 15575 · Desempenho estrutural. Validar o requisito aplicável em inspeção.',
    checks: [
      {
        standardCode: 'NBR 15575',
        requirement: 'Desempenho estrutural e estabilidade',
      },
    ],
    resolutions: [
      'Fissura mapeada com selo testemunho por 30 dias. Sem evolução, tratada com tela e massa elástica.',
      'Aberta a fissura em V, aplicada tela de poliéster e reforço no encontro alvenaria e pilar antes do reboco.',
      'Executada junta de movimentação no encontro dos materiais e refeito o revestimento do trecho.',
    ],
  },
  {
    category: 'Instalações',
    severity: 'medium',
    weight: 5,
    rooms: ['Cozinha', 'Hall técnico', 'Banheiro', 'Sala'],
    reports: [
      {
        title: 'Ponto elétrico divergente do projeto',
        description:
          'Tomada instalada fora da posição indicada no projeto executivo.',
      },
      {
        title: 'Tubulação sem identificação',
        description:
          'Tubulação do hall técnico está sem etiqueta de identificação.',
      },
      {
        title: 'Quadro de distribuição sem diagrama',
        description: 'Quadro fechado sem o diagrama unifilar afixado.',
      },
      {
        title: 'Eletroduto amassado na laje',
        description: 'Eletroduto danificado antes da concretagem.',
      },
    ],
    summary:
      'Irregularidade de instalação classificada para triagem da engenharia.',
    norm: 'NBR 5410 · Instalações de baixa tensão. Confirmar a disciplina aplicável.',
    checks: [
      {
        standardCode: 'NBR 5410',
        requirement: 'Conformidade da instalação com o projeto executivo',
      },
      {
        standardCode: 'PBQP-H',
        requirement: 'Compatibilização entre projeto e serviço executado',
      },
    ],
    resolutions: [
      'Ponto reposicionado conforme a revisão vigente do projeto executivo e registrada a conferência com o projetista.',
      'Instalada identificação nas prumadas e afixado o diagrama unifilar no quadro. Conferido contra o as built.',
      'Trecho de eletroduto substituído antes da concretagem e refeita a passagem do condutor.',
    ],
  },
  {
    category: 'Segurança',
    severity: 'high',
    weight: 4,
    rooms: ['Corredor', 'Periferia', 'Andaime', 'Poço do elevador'],
    reports: [
      {
        title: 'Guarda-corpo com fixação pendente',
        description: 'Fixação do guarda-corpo está solta no corredor.',
      },
      {
        title: 'Abertura de laje sem fechamento',
        description: 'Vão da laje sem tampa e sem sinalização.',
      },
      {
        title: 'Andaime sem piso completo',
        description: 'Plataforma do andaime com tábua faltando.',
      },
      {
        title: 'Equipe sem cinto em trabalho na fachada',
        description: 'Serviço na fachada sem ancoragem visível.',
      },
    ],
    summary:
      'Possível risco de segurança; priorizar avaliação da equipe responsável.',
    norm: 'NR 18 · Proteção contra quedas. Validar com o técnico de segurança.',
    checks: [
      {
        standardCode: 'NR 18',
        requirement: 'Proteção coletiva em periferia e aberturas',
      },
      {
        standardCode: 'PBQP-H',
        requirement: 'Controle da execução e registro da inspeção',
      },
    ],
    resolutions: [
      'Guarda-corpo refixado com chumbador químico e conferida a resistência. Registro fotográfico do dispositivo instalado.',
      'Instalado fechamento provisório na abertura, com sinalização e travamento. Incluído na inspeção diária.',
      'Andaime remontado com piso completo sob supervisão do profissional habilitado, e liberada a permissão de trabalho.',
    ],
  },
  {
    category: 'Acabamento',
    severity: 'low',
    weight: 4,
    rooms: ['Banheiro', 'Cozinha', 'Quarto', 'Hall'],
    reports: [
      {
        title: 'Rejunte com falha no boxe',
        description: 'Rejunte falhado na junta vertical do boxe.',
      },
      {
        title: 'Revestimento com peça oca',
        description: 'Som cavo ao percutir duas peças do revestimento.',
      },
      {
        title: 'Pintura com diferença de tonalidade',
        description: 'Emenda de pintura visível na parede do quarto.',
      },
      {
        title: 'Soleira com desnível acima do previsto',
        description: 'Desnível da soleira maior que o tolerado.',
      },
    ],
    summary: 'Desvio de acabamento registrado para conferência da qualidade.',
    norm: null,
    checks: [
      {
        standardCode: 'PBQP-H',
        requirement: 'Registro da inspeção e liberação do serviço',
      },
    ],
    resolutions: [
      'Refeito o rejunte com material adequado à área molhada, após limpeza completa da junta.',
      'Peças ocas removidas e reassentadas com dupla colagem. Percussão refeita no trecho inteiro.',
      'Corrigida a soleira para o desnível tolerado e refeito o arremate do piso.',
    ],
  },
  {
    category: 'Acessibilidade',
    severity: 'medium',
    weight: 1,
    rooms: ['Hall', 'Rampa', 'Área Comum'],
    reports: [
      {
        title: 'Rampa com inclinação acima do limite',
        description: 'Rampa de acesso mais íngreme que o previsto em projeto.',
      },
      {
        title: 'Corrimão interrompido no patamar',
        description: 'Corrimão não acompanha todo o percurso da escada.',
      },
    ],
    summary: 'Desvio de acessibilidade identificado em área comum.',
    norm: 'NBR 9050 · Acessibilidade. Validar as dimensões em projeto.',
    checks: [
      {
        standardCode: 'NBR 9050',
        requirement: 'Rota acessível com dimensões mínimas atendidas',
      },
    ],
    resolutions: [
      'Rampa reexecutada dentro da inclinação de projeto e conferida com nível a laser.',
      'Corrimão prolongado por todo o percurso, com as extensões nos patamares.',
    ],
  },
];

const STATUSES = ['new', 'in_progress', 'validation', 'closed'] as const;

function weightedPool<T extends { weight: number }>(items: T[]): T[] {
  const pool: T[] = [];
  for (const item of items) {
    for (let i = 0; i < item.weight; i += 1) pool.push(item);
  }
  return pool;
}

type Row = { sql: string; values: unknown[] };

/**
 * Builds every row of the demo dataset. Pure: no database access, so the shape
 * can be reasoned about and, if it ever matters, asserted in a test.
 */
export function buildDemoDataset() {
  const rng = mulberry32(SEED);
  const projectPool = weightedPool(PROJECTS);
  const categoryPool = weightedPool(CATEGORIES);
  const workersByProject = new Map<string, WorkerSeed[]>();
  for (const worker of WORKERS) {
    const list = workersByProject.get(worker.projectId) ?? [];
    list.push(worker);
    workersByProject.set(worker.projectId, list);
  }

  const rows: Row[] = [];
  const push = (sql: string, values: unknown[]) => rows.push({ sql, values });

  push(
    `INSERT OR IGNORE INTO companies (id, name, slug, created_at) VALUES (?, ?, ?, ?)`,
    [DEMO_COMPANY_ID, 'Construtora Demo', 'demo', iso(ANCHOR)],
  );
  push(
    `INSERT OR IGNORE INTO subscriptions
      (company_id, plan, status, project_quota, monthly_message_quota,
       memory_trial_ends_at, stripe_customer_id, stripe_subscription_id,
       created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      DEMO_COMPANY_ID,
      'free',
      'active',
      15,
      400,
      null,
      null,
      null,
      iso(ANCHOR),
      iso(ANCHOR),
    ],
  );

  for (const project of PROJECTS) {
    const createdAt = `${project.pilotStartedAt}T12:00:00.000Z`;
    push(
      `INSERT OR IGNORE INTO projects
        (id, company_id, code, name, address, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        project.id,
        DEMO_COMPANY_ID,
        project.code,
        project.name,
        project.address,
        'active',
        createdAt,
      ],
    );
    push(
      `INSERT OR IGNORE INTO project_baselines
        (project_id, company_id, pilot_started_at, current_stage, summary,
         responsible_engineer, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        project.id,
        DEMO_COMPANY_ID,
        project.pilotStartedAt,
        project.stage,
        project.summary,
        project.engineer,
        createdAt,
        createdAt,
      ],
    );
    push(
      `INSERT OR IGNORE INTO project_events
        (id, company_id, project_id, actor, action, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        `event-baseline-${project.code.toLowerCase()}`,
        DEMO_COMPANY_ID,
        project.id,
        'Equipe CiviTek',
        'project.baseline.created',
        `Etapa: ${project.stage}. ${project.summary}`,
        createdAt,
      ],
    );
  }

  for (const worker of WORKERS) {
    push(
      `INSERT OR IGNORE INTO phone_assignments
        (id, company_id, phone_e164, worker_name, project_id, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        worker.id,
        DEMO_COMPANY_ID,
        worker.phone,
        worker.name,
        worker.projectId,
        1,
        iso(ANCHOR),
      ],
    );
  }

  for (let index = 0; index < OCCURRENCE_COUNT; index += 1) {
    const project = pick(rng, projectPool);
    const category = pick(rng, categoryPool);
    const workers = workersByProject.get(project.id) ?? WORKERS;
    const worker = pick(rng, workers);
    const report = pick(rng, category.reports);
    const block = pick(rng, project.blocks);
    const room = pick(rng, category.rooms);
    const unit = 100 + Math.floor(rng() * 8) * 100 + Math.floor(rng() * 8);
    const location = `${block} · Apto ${unit} · ${room}`;

    const ageDays = Math.floor(rng() * HISTORY_DAYS);
    const createdMs = ANCHOR - ageDays * DAY - Math.floor(rng() * DAY);
    const createdAt = iso(createdMs);

    // Older reports are far more likely to be finished already, which is what
    // makes the average cycle time meaningful instead of an artefact.
    const closedBias = Math.min(0.9, ageDays / HISTORY_DAYS + 0.15);
    const status =
      rng() < closedBias ? 'closed' : pick(rng, STATUSES.slice(0, 3));

    const id = `occurrence-demo-${String(index + 1).padStart(4, '0')}`;
    const code = `OC-${String(index + 1).padStart(4, '0')}`;
    const messageId = `wamid.demo.${String(index + 1).padStart(4, '0')}`;
    const severity =
      rng() < 0.2 ? pick(rng, ['low', 'medium', 'high']) : category.severity;

    push(
      `INSERT OR IGNORE INTO occurrences
        (id, code, company_id, project_id, reporter_phone, reporter_name,
         title, description, location, category, severity, status, source,
         source_message_id, automatic_summary, normative_reference,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        code,
        DEMO_COMPANY_ID,
        project.id,
        worker.phone,
        worker.name,
        report.title,
        report.description,
        location,
        category.category,
        severity,
        status,
        'whatsapp',
        messageId,
        category.summary,
        category.norm,
        createdAt,
        createdAt,
      ],
    );

    // Uma resolução por ocorrência encerrada, repetida nas suas verificações,
    // porque é o registro do que a engenharia de fato fez.
    const resolution =
      status === 'closed' ? pick(rng, category.resolutions) : null;

    for (const [checkIndex, check] of category.checks.entries()) {
      const checkStatus =
        status === 'closed'
          ? rng() < 0.78
            ? 'compliant'
            : 'non_compliant'
          : rng() < 0.3
            ? 'non_compliant'
            : 'pending';
      push(
        `INSERT OR IGNORE INTO compliance_checks
          (id, company_id, occurrence_id, standard_code, requirement, status,
           engineer_note, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `check-${id}-${checkIndex}`,
          DEMO_COMPANY_ID,
          id,
          check.standardCode,
          check.requirement,
          checkStatus,
          checkStatus === 'compliant' ? resolution : null,
          createdAt,
        ],
      );
    }

    const messageType =
      rng() < 0.45 ? 'image' : rng() < 0.75 ? 'text' : 'audio';
    push(
      `INSERT OR IGNORE INTO whatsapp_messages
        (id, company_id, occurrence_id, phone_e164, direction, message_type,
         body, payload, delivery_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        messageId,
        DEMO_COMPANY_ID,
        id,
        worker.phone,
        'inbound',
        messageType,
        report.description,
        null,
        'received',
        createdAt,
      ],
    );
    push(
      `INSERT OR IGNORE INTO whatsapp_messages
        (id, company_id, occurrence_id, phone_e164, direction, message_type,
         body, payload, delivery_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `${messageId}.ack`,
        DEMO_COMPANY_ID,
        id,
        worker.phone,
        'outbound',
        'text',
        `Recebi seu relato como ${code} na ${project.name}. A equipe de qualidade já pode acompanhar pelo painel.`,
        null,
        'delivered',
        iso(createdMs + 60_000),
      ],
    );

    // Photo evidence on most image reports, and deliberately absent on some
    // closed ones so the evidence gap insight has something real to report.
    if (messageType === 'image' && rng() < 0.8) {
      push(
        `INSERT OR IGNORE INTO evidences
          (id, company_id, occurrence_id, type, object_key, provider_media_id,
           mime_type, sha256, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `evidence-${id}`,
          DEMO_COMPANY_ID,
          id,
          'image',
          null,
          `demo-media-${index + 1}`,
          'image/jpeg',
          null,
          createdAt,
        ],
      );
    }

    push(
      `INSERT OR IGNORE INTO audit_events
        (id, company_id, occurrence_id, actor, action, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        `audit-${id}-created`,
        DEMO_COMPANY_ID,
        id,
        'whatsapp-webhook',
        'occurrence.created',
        'Telefone vinculado automaticamente à obra.',
        createdAt,
      ],
    );

    if (status !== 'new') {
      push(
        `INSERT OR IGNORE INTO audit_events
          (id, company_id, occurrence_id, actor, action, detail, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          `audit-${id}-progress`,
          DEMO_COMPANY_ID,
          id,
          'dashboard-user',
          'occurrence.status.in_progress',
          null,
          iso(createdMs + DAY),
        ],
      );
    }

    if (status === 'closed') {
      const cycleDays = 2 + Math.floor(rng() * 12);
      push(
        `INSERT OR IGNORE INTO audit_events
          (id, company_id, occurrence_id, actor, action, detail, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          `audit-${id}-closed`,
          DEMO_COMPANY_ID,
          id,
          'dashboard-engineer',
          'occurrence.status.closed',
          null,
          iso(createdMs + cycleDays * DAY),
        ],
      );
    }
  }

  return rows;
}

/**
 * Writes the dataset.
 *
 * A database seeded by an earlier version already holds the rows, so the parts
 * added since are applied as marked increments instead of a reseed. Every guard
 * is a single indexed read, so a cold start stays cheap.
 */
export async function seedDemoData(database: D1Database) {
  const seededProjects = await database
    .prepare('SELECT COUNT(*) AS total FROM projects WHERE company_id = ?')
    .bind(DEMO_COMPANY_ID)
    .first<{ total: number }>();

  if ((seededProjects?.total ?? 0) >= PROJECTS.length) {
    await backfillResolutions(database);
  } else {
    await writeRows(database, buildDemoDataset());
  }

  await applyOnce(database, SINGULAR_MARKER, buildSingularCases);
}

/**
 * Runs a set of rows exactly once per database, recorded by a marker event.
 * Lets the demo grow without reseeding what is already there.
 */
async function applyOnce(
  database: D1Database,
  marker: string,
  build: () => Row[],
) {
  const done = await database
    .prepare(
      'SELECT id FROM project_events WHERE company_id = ? AND action = ? LIMIT 1',
    )
    .bind(DEMO_COMPANY_ID, marker)
    .first<{ id: string }>();

  if (done) return;

  await writeRows(database, [...build(), markerRow(marker)]);
}

function markerRow(marker: string): Row {
  return {
    sql: `INSERT OR IGNORE INTO project_events
      (id, company_id, project_id, actor, action, detail, created_at)
     VALUES (?, ?, (SELECT id FROM projects WHERE company_id = ? LIMIT 1), ?, ?, ?, ?)`,
    values: [
      marker,
      DEMO_COMPANY_ID,
      DEMO_COMPANY_ID,
      'Equipe CiviTek',
      marker,
      'Incremento do conjunto de demonstração aplicado.',
      new Date().toISOString(),
    ],
  };
}

/** Marks the note repair as done, so it runs once per database. */
const RESOLUTION_MARKER = 'seed-resolutions-v2';

/**
 * Writes the engineering notes on a dataset seeded before they existed.
 *
 * The note is derived from the category stored on the row, never from a rerun
 * of the generator. Regenerating would look tempting because the seed is
 * deterministic, but that determinism only holds for one version of the
 * generator: adding a single draw shifts the whole stream, and the notes then
 * land on occurrences of a different category.
 */
async function backfillResolutions(database: D1Database) {
  const done = await database
    .prepare(
      'SELECT id FROM project_events WHERE company_id = ? AND action = ? LIMIT 1',
    )
    .bind(DEMO_COMPANY_ID, RESOLUTION_MARKER)
    .first<{ id: string }>();

  if (done) return;

  const closed = await database
    .prepare(
      `SELECT o.id AS occurrence_id, o.category AS category
       FROM occurrences o
       WHERE o.company_id = ? AND o.status = 'closed'`,
    )
    .bind(DEMO_COMPANY_ID)
    .all<{ occurrence_id: string; category: string }>();

  const byCategory = new Map(
    CATEGORIES.map((entry) => [entry.category, entry.resolutions]),
  );

  // Clean slate first. A partial repair leaves notes on rows the rewrite does
  // not target, and a note that survives on the wrong occurrence is worse than
  // no note at all.
  const updates: Row[] = [
    {
      sql: 'UPDATE compliance_checks SET engineer_note = NULL WHERE company_id = ?',
      values: [DEMO_COMPANY_ID],
    },
  ];

  for (const row of closed.results ?? []) {
    const options = byCategory.get(row.category);
    if (!options || options.length === 0) continue;
    // Stable choice per occurrence, so a rerun writes the same note.
    const note = options[hashToIndex(row.occurrence_id, options.length)];
    updates.push({
      sql: "UPDATE compliance_checks SET engineer_note = ? WHERE occurrence_id = ? AND company_id = ? AND status = 'compliant'",
      values: [note, row.occurrence_id, DEMO_COMPANY_ID],
    });
  }

  updates.push({
    sql: `INSERT OR IGNORE INTO project_events
      (id, company_id, project_id, actor, action, detail, created_at)
     VALUES (?, ?, (SELECT id FROM projects WHERE company_id = ? LIMIT 1), ?, ?, ?, ?)`,
    values: [
      RESOLUTION_MARKER,
      DEMO_COMPANY_ID,
      DEMO_COMPANY_ID,
      'Equipe CiviTek',
      RESOLUTION_MARKER,
      'Notas de resolução aplicadas ao conjunto de demonstração.',
      new Date().toISOString(),
    ],
  });

  await writeRows(database, updates);
}

function hashToIndex(value: string, size: number) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash % size;
}

async function writeRows(database: D1Database, rows: Row[]) {
  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    await database.batch(
      rows
        .slice(index, index + BATCH_SIZE)
        .map((row) => database.prepare(row.sql).bind(...row.values)),
    );
  }
}

/** Marks the first-of-a-kind cases as applied. */
const SINGULAR_MARKER = 'seed-singular-v1';

/**
 * Occurrences with no precedent in the portfolio, so the cold start card is
 * reachable in the demo.
 *
 * Each one carries a discipline that appears nowhere else in the dataset, which
 * is what guarantees it stays first of its kind: the precedent engine requires
 * the same category before it compares anything. Their wording is chosen to
 * match a specific entry of the knowledge corpus, so the suggestion that comes
 * back is the treatment for that defect and not a generic fallback.
 */
const SINGULAR_CASES = [
  {
    id: 'occurrence-unico-altura',
    code: 'OC-9001',
    projectId: 'project-orion',
    phone: '5511900000009',
    reporter: 'Gustavo Teles',
    category: 'Trabalho em altura',
    severity: 'high',
    title: 'Equipe na fachada sem ancoragem',
    description:
      'Dois trabalhadores na fachada do sétimo pavimento sem cinto travado no ponto de ancoragem. O talabarte está solto.',
    location: 'Torre Corporativa · 7º pavimento · Fachada',
    summary:
      'Trabalho em altura sem sistema de ancoragem visível. Nenhum caso semelhante registrado antes nesta construtora.',
    norm: 'NR 35 · Trabalho em altura. Confirmar a permissão de trabalho vigente.',
    checks: [
      {
        standardCode: 'NR 35',
        requirement: 'Permissão de trabalho e sistema de ancoragem',
      },
    ],
    createdAt: '2026-08-28T17:40:00.000Z',
  },
  {
    id: 'occurrence-unico-material',
    code: 'OC-9002',
    projectId: 'project-portal',
    phone: '5511900000003',
    reporter: 'Bruno Carvalho',
    category: 'Recebimento de materiais',
    severity: 'medium',
    title: 'Lote de blocos recebido sem identificação',
    description:
      'O fornecedor entregou o lote de blocos sem etiqueta e sem nota fiscal anexa. O recebimento ficou sem conferência.',
    location: 'Torre Norte · Térreo · Canteiro',
    summary:
      'Falha no recebimento de material controlado. Primeiro registro desse tipo na construtora.',
    norm: 'PBQP-H · Controle de materiais e fornecedores.',
    checks: [
      {
        standardCode: 'PBQP-H',
        requirement: 'Identificação e conferência no recebimento',
      },
    ],
    createdAt: '2026-08-28T15:20:00.000Z',
  },
  {
    id: 'occurrence-unico-drenagem',
    code: 'OC-9003',
    projectId: 'project-serra',
    phone: '5511900000004',
    reporter: 'Heloísa Martins',
    category: 'Drenagem',
    severity: 'medium',
    title: 'Água acumulada na cava após a chuva',
    description:
      'A cava não escoou depois da chuva de ontem. O ralo provisório está abaixo do nível e a água ficou parada.',
    location: 'Chalé A · Subsolo · Cava',
    summary:
      'Acúmulo de água por drenagem provisória insuficiente. Sem caso anterior parecido no histórico.',
    norm: 'NBR 15575 · Estanqueidade. Avaliar a drenagem provisória do canteiro.',
    checks: [
      {
        standardCode: 'NBR 15575',
        requirement: 'Escoamento e proteção contra acúmulo de água',
      },
    ],
    createdAt: '2026-08-28T13:05:00.000Z',
  },
];

function buildSingularCases(): Row[] {
  const rows: Row[] = [];

  for (const item of SINGULAR_CASES) {
    const messageId = `wamid.demo.${item.id}`;
    rows.push({
      sql: `INSERT OR IGNORE INTO occurrences
        (id, code, company_id, project_id, reporter_phone, reporter_name,
         title, description, location, category, severity, status, source,
         source_message_id, automatic_summary, normative_reference,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values: [
        item.id,
        item.code,
        DEMO_COMPANY_ID,
        item.projectId,
        item.phone,
        item.reporter,
        item.title,
        item.description,
        item.location,
        item.category,
        item.severity,
        'new',
        'whatsapp',
        messageId,
        item.summary,
        item.norm,
        item.createdAt,
        item.createdAt,
      ],
    });

    for (const [index, check] of item.checks.entries()) {
      rows.push({
        sql: `INSERT OR IGNORE INTO compliance_checks
          (id, company_id, occurrence_id, standard_code, requirement, status,
           engineer_note, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        values: [
          `check-${item.id}-${index}`,
          DEMO_COMPANY_ID,
          item.id,
          check.standardCode,
          check.requirement,
          'pending',
          null,
          item.createdAt,
        ],
      });
    }

    rows.push({
      sql: `INSERT OR IGNORE INTO whatsapp_messages
        (id, company_id, occurrence_id, phone_e164, direction, message_type,
         body, payload, delivery_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values: [
        messageId,
        DEMO_COMPANY_ID,
        item.id,
        item.phone,
        'inbound',
        'text',
        item.description,
        null,
        'received',
        item.createdAt,
      ],
    });

    rows.push({
      sql: `INSERT OR IGNORE INTO audit_events
        (id, company_id, occurrence_id, actor, action, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      values: [
        `audit-${item.id}-created`,
        DEMO_COMPANY_ID,
        item.id,
        'whatsapp-webhook',
        'occurrence.created',
        'Telefone vinculado automaticamente à obra.',
        item.createdAt,
      ],
    });
  }

  return rows;
}
