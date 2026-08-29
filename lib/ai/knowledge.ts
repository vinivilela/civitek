/**
 * Layer L1: the shared knowledge corpus.
 *
 * Identical for every tenant and free of customer data, which is what makes it
 * safe to serve on the free plan and what makes the prompt prefix byte-stable
 * across tenants so the provider cache is reused between companies.
 *
 * Retrieval is keyword scored today. `retrieveGlobalKnowledge` is the seam a
 * vector index plugs into later without touching the assembler.
 */

export type KnowledgeEntry = {
  id: string;
  standardCode: string;
  title: string;
  requirement: string;
  guidance: string;
  stages: string[];
  keywords: string[];
  /**
   * Cold start treatment: what to do when the company has no history of this
   * defect yet. Steps, not prose, because the engineer acts on them.
   */
  treatment: string[];
};

export const KNOWLEDGE_CORPUS: KnowledgeEntry[] = [
  {
    id: 'nr18-protecao-periferica',
    standardCode: 'NR 18',
    title: 'Proteção contra quedas em periferia e aberturas',
    requirement:
      'Aberturas no piso e periferia da edificação exigem fechamento provisório resistente ou sistema de guarda-corpo e rodapé.',
    guidance:
      'Registre a foto do dispositivo instalado, não apenas do risco. O encerramento da ocorrência precisa da evidência da correção.',
    stages: ['Estrutura', 'Vedações', 'Acabamentos'],
    keywords: [
      'guarda-corpo',
      'guarda corpo',
      'periferia',
      'abertura',
      'queda',
      'vão',
      'rodapé',
      'andaime',
      'proteção',
    ],
    treatment: [
      'Isole o trecho e instale fechamento provisório resistente antes de qualquer outro serviço no local.',
      'Confira a fixação do guarda-corpo e do rodapé em toda a periferia do pavimento, não só no ponto relatado.',
      'Fotografe o dispositivo já instalado e anexe à ocorrência, porque o encerramento exige a evidência da correção.',
    ],
  },
  {
    id: 'nr18-andaimes',
    standardCode: 'NR 18',
    title: 'Montagem e uso de andaimes',
    requirement:
      'Andaimes exigem piso completo, travamento, e supervisão de profissional legalmente habilitado na montagem e desmontagem.',
    guidance:
      'Relatos de andaime devem identificar o trecho e a altura. Sem essa informação a engenharia não consegue priorizar.',
    stages: ['Estrutura', 'Vedações', 'Acabamentos'],
    keywords: ['andaime', 'plataforma', 'montagem', 'altura', 'escada'],
    treatment: [
      'Interrompa o uso do andaime e sinalize o trecho até a inspeção.',
      'Complete o piso e o travamento com acompanhamento de profissional legalmente habilitado.',
      'Registre a altura e o trecho na ocorrência, para que a engenharia consiga priorizar.',
    ],
  },
  {
    id: 'nr06-epi',
    standardCode: 'NR 06',
    title: 'Fornecimento e uso de EPI',
    requirement:
      'O empregador fornece o EPI adequado ao risco, em perfeito estado, e registra a entrega.',
    guidance:
      'Ocorrência de EPI vira não conformidade documental se não houver registro de entrega e treinamento associado.',
    stages: ['Planejamento', 'Fundação', 'Estrutura', 'Acabamentos'],
    keywords: [
      'epi',
      'capacete',
      'cinto',
      'luva',
      'bota',
      'óculos',
      'protetor',
    ],
    treatment: [
      'Verifique se há registro de entrega do EPI para o trabalhador e se o equipamento está dentro da validade.',
      'Substitua o equipamento danificado antes de liberar a atividade.',
      'Anexe a ficha de entrega, porque sem ela a ocorrência vira não conformidade documental.',
    ],
  },
  {
    id: 'nr35-altura',
    standardCode: 'NR 35',
    title: 'Trabalho em altura',
    requirement:
      'Atividade acima de dois metros exige análise de risco, permissão de trabalho e sistema de ancoragem.',
    guidance:
      'Vincule a ocorrência à permissão de trabalho vigente. A ausência dela é o achado mais comum em auditoria.',
    stages: ['Estrutura', 'Vedações'],
    keywords: [
      'altura',
      'ancoragem',
      'talabarte',
      'cinto',
      'telhado',
      'fachada',
    ],
    treatment: [
      'Suspenda a atividade até confirmar a permissão de trabalho vigente e a análise de risco.',
      'Verifique o ponto de ancoragem e o estado do talabarte antes de retomar.',
      'Vincule a permissão de trabalho à ocorrência, que é o achado mais cobrado em auditoria.',
    ],
  },
  {
    id: 'nbr15575-estanqueidade',
    standardCode: 'NBR 15575',
    title: 'Estanqueidade à água',
    requirement:
      'Vedações e pisos de áreas molhadas devem impedir a penetração de água, com sistema de impermeabilização compatível com o uso.',
    guidance:
      'Falha de manta em área molhada costuma reaparecer no mesmo pavimento. Verifique o histórico da obra antes de tratar como caso isolado.',
    stages: ['Vedações', 'Acabamentos'],
    keywords: [
      'manta',
      'impermeabiliza',
      'infiltra',
      'vazamento',
      'umidade',
      'box',
      'estanqueidade',
      'ralo',
    ],
    treatment: [
      'Identifique a origem da água antes de tratar o sintoma, porque refazer o acabamento sem isso traz o problema de volta.',
      'Remova a impermeabilização do trecho afetado, refaça o primer e reaplique com transpasse, subindo pela parede na altura de projeto.',
      'Faça o teste de estanqueidade com lâmina d’água por 72 h antes de liberar o revestimento.',
      'Confira o mesmo detalhe nas unidades do pavimento, já que falha de manta raramente é isolada.',
    ],
  },
  {
    id: 'nbr15575-estrutural',
    standardCode: 'NBR 15575',
    title: 'Desempenho estrutural',
    requirement:
      'A estrutura deve atender aos estados limites de serviço, sem fissuras que comprometam a estanqueidade ou o desempenho.',
    guidance:
      'Fissura próxima a abertura pede mapeamento com data e abertura medida, para separar acomodação de evolução ativa.',
    stages: ['Fundação', 'Estrutura', 'Vedações'],
    keywords: [
      'fissura',
      'trinca',
      'rachadura',
      'recalque',
      'estrutura',
      'viga',
      'laje',
      'pilar',
    ],
    treatment: [
      'Mapeie a fissura com data, extensão e abertura medida, e instale selo testemunho.',
      'Acompanhe por 30 dias para separar acomodação de evolução ativa antes de decidir o tratamento.',
      'Sem evolução, trate com tela e massa elástica. Com evolução, acione o projetista estrutural.',
    ],
  },
  {
    id: 'nbr5410-instalacoes',
    standardCode: 'NBR 5410',
    title: 'Instalações elétricas de baixa tensão',
    requirement:
      'Circuitos, seções de condutor e dispositivos de proteção devem seguir o projeto executivo e permitir inspeção.',
    guidance:
      'Divergência entre executado e projeto exige registro do ponto e da revisão do projeto usada na conferência.',
    stages: ['Instalações', 'Acabamentos'],
    keywords: [
      'elétric',
      'tomada',
      'quadro',
      'circuito',
      'fio',
      'cabo',
      'disjuntor',
      'eletroduto',
    ],
    treatment: [
      'Confirme qual revisão do projeto executivo está valendo antes de julgar o que foi executado.',
      'Registre o ponto divergente com foto e medida, referenciando o eixo do ambiente.',
      'Reposicione conforme o projeto ou formalize a revisão, e registre quem aprovou a mudança.',
    ],
  },
  {
    id: 'pbqph-rastreabilidade',
    standardCode: 'PBQP-H',
    title: 'Rastreabilidade da inspeção e da correção',
    requirement:
      'Serviços controlados exigem registro de inspeção, identificação do responsável e evidência da liberação.',
    guidance:
      'Ocorrência encerrada sem evidência anexada não sustenta auditoria. Bloqueie o encerramento nesse caso.',
    stages: [
      'Planejamento',
      'Fundação',
      'Estrutura',
      'Vedações',
      'Instalações',
      'Acabamentos',
      'Entrega',
    ],
    keywords: [
      'inspeção',
      'registro',
      'evidência',
      'foto',
      'rastreabilidade',
      'liberação',
      'checklist',
    ],
    treatment: [
      'Anexe a evidência da inspeção antes de mudar o status da ocorrência.',
      'Identifique o responsável técnico pela liberação do serviço.',
      'Não encerre sem a foto da correção, porque encerramento sem evidência não sustenta auditoria.',
    ],
  },
  {
    id: 'pbqph-materiais',
    standardCode: 'PBQP-H',
    title: 'Controle de materiais e fornecedores',
    requirement:
      'Materiais controlados exigem identificação, conferência no recebimento e registro do fornecedor.',
    guidance:
      'Reincidência do mesmo defeito com o mesmo fornecedor é sinal de causa sistêmica, não de execução.',
    stages: ['Fundação', 'Estrutura', 'Vedações', 'Instalações', 'Acabamentos'],
    keywords: [
      'fornecedor',
      'material',
      'lote',
      'recebimento',
      'entrega',
      'nota fiscal',
    ],
    treatment: [
      'Identifique o lote e o fornecedor do material envolvido.',
      'Verifique se o mesmo lote foi aplicado em outras frentes da obra.',
      'Se o defeito se repetir com o mesmo fornecedor, trate como causa sistêmica e não como erro de execução.',
    ],
  },
  {
    id: 'nr18-escavacoes',
    standardCode: 'NR 18',
    title: 'Escavações, esgotamento e estabilidade do talude',
    requirement:
      'Escavações exigem esgotamento da água acumulada, proteção do talude e inspeção da frente antes de cada turno.',
    guidance:
      'Água parada na cava compromete a estabilidade do talude e a capacidade de suporte do fundo. Trate o esgotamento antes de liberar a frente, não depois.',
    stages: ['Planejamento', 'Fundação', 'Estrutura'],
    keywords: [
      'cava',
      'escava',
      'talude',
      'esgotamento',
      'drenagem',
      'empoç',
      'empoc',
      'bomba',
      'chuva',
      'canteiro',
    ],
    treatment: [
      'Esgote a água acumulada antes de qualquer serviço na frente, porque o fundo perde capacidade de suporte encharcado.',
      'Verifique a estabilidade do talude depois da chuva, que é quando o desmoronamento acontece.',
      'Corrija a drenagem provisória do canteiro para o ponto baixo real, e não para onde o projeto de obra pronta prevê.',
      'Registre a data da chuva e o tempo de escoamento, para separar evento pontual de drenagem subdimensionada.',
    ],
  },
  {
    id: 'nbr9050-acessibilidade',
    standardCode: 'NBR 9050',
    title: 'Acessibilidade em áreas comuns',
    requirement:
      'Rotas acessíveis, desníveis e larguras de passagem devem atender às dimensões mínimas da norma.',
    guidance:
      'Desvio de acessibilidade detectado tarde vira retrabalho caro. Priorize a verificação ainda na etapa de vedações.',
    stages: ['Vedações', 'Acabamentos', 'Entrega'],
    keywords: [
      'acessibilidade',
      'rampa',
      'desnível',
      'corrimão',
      'largura',
      'porta',
      'soleira',
    ],
    treatment: [
      'Meça a inclinação, a largura e o desnível no local e compare com o previsto em projeto.',
      'Verifique a rota acessível inteira, não só o ponto relatado, porque o desvio costuma se repetir no percurso.',
      'Corrija ainda na etapa de vedações, já que acessibilidade detectada na entrega vira retrabalho caro.',
    ],
  },
];

function normalize(value: string) {
  return value
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function scoreEntry(entry: KnowledgeEntry, query: string) {
  const haystack = normalize(query);
  let score = 0;

  for (const keyword of entry.keywords) {
    if (haystack.includes(normalize(keyword))) score += 3;
  }
  for (const token of normalize(entry.title).split(/\s+/)) {
    if (token.length > 4 && haystack.includes(token)) score += 1;
  }
  if (haystack.includes(normalize(entry.standardCode))) score += 4;

  return score;
}

/**
 * Returns the corpus entries relevant to a query. With an empty query it
 * returns the baseline set every new company should see on its first project.
 */
export function retrieveGlobalKnowledge(
  query: string,
  limit = 4,
): KnowledgeEntry[] {
  if (!query.trim()) {
    return KNOWLEDGE_CORPUS.filter((entry) =>
      [
        'pbqph-rastreabilidade',
        'nr18-protecao-periferica',
        'nr06-epi',
      ].includes(entry.id),
    );
  }

  return KNOWLEDGE_CORPUS.map((entry) => ({
    entry,
    score: scoreEntry(entry, query),
  }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.entry);
}

export function renderKnowledgeBlock(entries: KnowledgeEntry[]) {
  const lines = entries.map(
    (entry) =>
      `- [${entry.standardCode}] ${entry.title}\n  Requisito: ${entry.requirement}\n  Prática: ${entry.guidance}`,
  );

  return `BASE NORMATIVA (conhecimento geral, igual para todos os clientes)\n${lines.join('\n')}`;
}

/**
 * Fallback entry per occurrence category, so a case always has guidance even
 * when the keyword scorer finds nothing in the report text. A first occurrence
 * with no advice at all is the worst answer the product can give.
 */
const CATEGORY_DEFAULTS: Record<string, string> = {
  Impermeabilização: 'nbr15575-estanqueidade',
  'Estrutura e vedação': 'nbr15575-estrutural',
  Instalações: 'nbr5410-instalacoes',
  Segurança: 'nr18-protecao-periferica',
  Acabamento: 'pbqph-rastreabilidade',
  Acessibilidade: 'nbr9050-acessibilidade',
};

const FALLBACK_ENTRY_ID = 'pbqph-rastreabilidade';

/** Best entry for a case: the report text first, the category as the backstop. */
export function knowledgeForCase(
  category: string,
  query: string,
): KnowledgeEntry {
  const [best] = retrieveGlobalKnowledge(query, 1);
  if (best) return best;

  const id = CATEGORY_DEFAULTS[category] ?? FALLBACK_ENTRY_ID;
  return (
    KNOWLEDGE_CORPUS.find((entry) => entry.id === id) ??
    (KNOWLEDGE_CORPUS.find(
      (entry) => entry.id === FALLBACK_ENTRY_ID,
    ) as KnowledgeEntry)
  );
}
