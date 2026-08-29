'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  HardHat,
  LayoutDashboard,
  LoaderCircle,
  MessageCircleMore,
  MoreHorizontal,
  Search,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type View = 'overview' | 'occurrences' | 'projects' | 'whatsapp';

type Occurrence = {
  id: string;
  code: string;
  title: string;
  description: string;
  location: string | null;
  category: string;
  severity: string;
  status: string;
  reporterName: string;
  projectId: string | null;
  projectName: string | null;
  automaticSummary: string | null;
  normativeReference: string | null;
  createdAt: string;
  evidenceCount: number;
  evidenceUrl: string | null;
};

type Project = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  occurrenceCount: number;
  openCount: number;
  highSeverityCount: number;
};

type IntegrationStatus = {
  provider: string;
  configured: boolean;
  webhookPath: string;
};

const statusLabels: Record<string, string> = {
  new: 'Nova',
  in_progress: 'Em tratamento',
  validation: 'Aguardando validação',
  closed: 'Encerrada',
  needs_context: 'Sem obra vinculada',
};

const viewContent: Record<View, { title: string; eyebrow: string }> = {
  overview: { title: 'Visão geral', eyebrow: 'Portfólio da construtora' },
  occurrences: { title: 'Ocorrências', eyebrow: 'Qualidade em campo' },
  projects: { title: 'Obras', eyebrow: 'Acompanhamento por projeto' },
  whatsapp: { title: 'Canal WhatsApp', eyebrow: 'Entrada de campo' },
};

export default function Dashboard() {
  const [activeView, setActiveView] = useState<View>('overview');
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [integration, setIntegration] = useState<IntegrationStatus | null>(
    null,
  );
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadOccurrences(preferredId?: string) {
    const response = await fetch('/api/occurrences', { cache: 'no-store' });
    if (!response.ok)
      throw new Error('Não foi possível carregar as ocorrências.');
    const data = (await response.json()) as { occurrences: Occurrence[] };
    setOccurrences(data.occurrences);
    setSelectedId((current) => {
      if (
        preferredId &&
        data.occurrences.some((item) => item.id === preferredId)
      )
        return preferredId;
      if (current && data.occurrences.some((item) => item.id === current))
        return current;
      return data.occurrences[0]?.id ?? null;
    });
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      Promise.all([
        loadOccurrences(),
        fetch('/api/projects', { cache: 'no-store' }).then(async (response) => {
          if (!response.ok)
            throw new Error('Não foi possível carregar as obras.');
          const data = (await response.json()) as { projects: Project[] };
          setProjects(data.projects);
        }),
        fetch('/api/integration-status', { cache: 'no-store' }).then(
          async (response) => {
            if (!response.ok)
              throw new Error('Não foi possível verificar a integração.');
            setIntegration((await response.json()) as IntegrationStatus);
          },
        ),
      ])
        .catch((error: unknown) =>
          setNotice(
            error instanceof Error ? error.message : 'Falha ao carregar dados.',
          ),
        )
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.toLocaleLowerCase('pt-BR').trim();
    return occurrences.filter((occurrence) => {
      if (
        selectedProjectId !== 'all' &&
        occurrence.projectId !== selectedProjectId
      )
        return false;
      if (!normalized) return true;
      return [
        occurrence.code,
        occurrence.title,
        occurrence.location,
        occurrence.reporterName,
        occurrence.projectName,
      ]
        .filter(Boolean)
        .some((value) =>
          value?.toLocaleLowerCase('pt-BR').includes(normalized),
        );
    });
  }, [occurrences, query, selectedProjectId]);

  const selected =
    filtered.find((occurrence) => occurrence.id === selectedId) ??
    filtered[0] ??
    null;
  const scopedOccurrences = occurrences.filter(
    (occurrence) =>
      selectedProjectId === 'all' || occurrence.projectId === selectedProjectId,
  );
  const scopedStats = {
    new: scopedOccurrences.filter((item) => item.status === 'new').length,
    inProgress: scopedOccurrences.filter(
      (item) => item.status === 'in_progress',
    ).length,
    closed: scopedOccurrences.filter((item) => item.status === 'closed').length,
  };
  const portfolioStats = {
    open: occurrences.filter((item) => item.status !== 'closed').length,
    high: occurrences.filter(
      (item) => item.severity === 'high' && item.status !== 'closed',
    ).length,
    closed: occurrences.filter((item) => item.status === 'closed').length,
  };

  async function moveToTreatment() {
    if (!selected) return;
    setUpdating(true);
    setNotice(null);
    try {
      const response = await fetch('/api/occurrences/' + selected.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' }),
      });
      if (!response.ok)
        throw new Error('Não foi possível atualizar a ocorrência.');
      await loadOccurrences(selected.id);
      setNotice(selected.code + ' encaminhada para tratamento.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Falha ao atualizar.');
    } finally {
      setUpdating(false);
    }
  }

  function openProject(projectId: string) {
    setSelectedProjectId(projectId);
    setQuery('');
    setActiveView('occurrences');
  }

  const header = viewContent[activeView];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-[224px_minmax(0,1fr)]">
        <aside className="hidden border-r border-sidebar-border bg-sidebar px-4 py-5 text-sidebar-foreground lg:flex lg:flex-col">
          <div className="flex items-center gap-3 px-2">
            <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <HardHat className="size-5" />
            </div>
            <div>
              <p className="font-heading text-[15px] font-semibold tracking-tight">
                Civitek
              </p>
              <p className="text-xs text-sidebar-foreground/65">
                {loading
                  ? 'Carregando obras'
                  : `${projects.length} obras ativas`}
              </p>
            </div>
          </div>

          <nav className="mt-9 space-y-1" aria-label="Navegação principal">
            <NavButton
              active={activeView === 'overview'}
              onClick={() => setActiveView('overview')}
              icon={<LayoutDashboard />}
            >
              Visão geral
            </NavButton>
            <NavButton
              active={activeView === 'occurrences'}
              onClick={() => setActiveView('occurrences')}
              icon={<ClipboardCheck />}
            >
              Ocorrências
            </NavButton>
            <NavButton
              active={activeView === 'projects'}
              onClick={() => setActiveView('projects')}
              icon={<Building2 />}
            >
              Obras
            </NavButton>
            <NavButton
              active={activeView === 'whatsapp'}
              onClick={() => setActiveView('whatsapp')}
              icon={<MessageCircleMore />}
            >
              Canal WhatsApp
            </NavButton>
          </nav>

          <div className="mt-auto rounded-xl border border-sidebar-border bg-white/[0.06] p-3">
            <div className="flex items-center gap-2">
              <span
                className={`size-2 rounded-full ${integration?.configured ? 'bg-emerald-400' : 'bg-amber-400'}`}
              />
              <p className="text-xs font-semibold">
                {integration?.configured
                  ? 'WhatsApp conectado'
                  : 'Webhook implementado'}
              </p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-sidebar-foreground/65">
              {integration?.configured
                ? 'Textos e fotos entram automaticamente na triagem.'
                : 'Aguardando as credenciais e a validação da Meta.'}
            </p>
          </div>
        </aside>

        <section className="min-w-0 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
          <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground lg:hidden">
                <HardHat className="size-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {header.eyebrow}
                </p>
                <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight">
                  {header.title}
                </h1>
              </div>
            </div>
            <Badge variant="outline" className="h-8 w-fit px-3">
              <ShieldCheck className="size-3.5" /> Ambiente autenticado
            </Badge>
          </header>

          <nav
            className="-mx-1 mt-3 flex gap-1 overflow-x-auto pb-1 lg:hidden"
            aria-label="Navegação principal"
          >
            <MobileNavButton
              active={activeView === 'overview'}
              onClick={() => setActiveView('overview')}
            >
              Geral
            </MobileNavButton>
            <MobileNavButton
              active={activeView === 'occurrences'}
              onClick={() => setActiveView('occurrences')}
            >
              Ocorrências
            </MobileNavButton>
            <MobileNavButton
              active={activeView === 'projects'}
              onClick={() => setActiveView('projects')}
            >
              Obras
            </MobileNavButton>
            <MobileNavButton
              active={activeView === 'whatsapp'}
              onClick={() => setActiveView('whatsapp')}
            >
              WhatsApp
            </MobileNavButton>
          </nav>

          {notice && (
            <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-950">
              {notice}
            </div>
          )}

          {activeView === 'overview' && (
            <Overview
              loading={loading}
              occurrences={occurrences}
              projects={projects}
              stats={portfolioStats}
              openProject={openProject}
              openOccurrences={() => {
                setSelectedProjectId('all');
                setActiveView('occurrences');
              }}
            />
          )}
          {activeView === 'occurrences' && (
            <OccurrencesView
              filtered={filtered}
              loading={loading}
              moveToTreatment={moveToTreatment}
              projects={projects}
              query={query}
              scopedStats={scopedStats}
              selected={selected}
              selectedProjectId={selectedProjectId}
              setQuery={setQuery}
              setSelectedId={setSelectedId}
              setSelectedProjectId={setSelectedProjectId}
              updating={updating}
            />
          )}
          {activeView === 'projects' && (
            <ProjectsView
              loading={loading}
              projects={projects}
              openProject={openProject}
            />
          )}
          {activeView === 'whatsapp' && (
            <WhatsAppView integration={integration} loading={loading} />
          )}
        </section>
      </div>
    </main>
  );
}

function Overview({
  loading,
  occurrences,
  projects,
  stats,
  openProject,
  openOccurrences,
}: {
  loading: boolean;
  occurrences: Occurrence[];
  projects: Project[];
  stats: { open: number; high: number; closed: number };
  openProject: (projectId: string) => void;
  openOccurrences: () => void;
}) {
  return (
    <>
      <div className="grid gap-3 py-5 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<Building2 className="size-4 text-teal-700" />}
          label="Obras ativas"
          value={loading ? '—' : projects.length}
        />
        <SummaryCard
          icon={<Clock3 className="size-4 text-sky-700" />}
          label="Pendências abertas"
          value={loading ? '—' : stats.open}
        />
        <SummaryCard
          icon={<CircleAlert className="size-4 text-red-600" />}
          label="Alta prioridade"
          value={loading ? '—' : stats.high}
        />
        <SummaryCard
          icon={<CheckCircle2 className="size-4 text-emerald-700" />}
          label="Encerradas"
          value={loading ? '—' : stats.closed}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Saúde das obras</CardTitle>
            <CardDescription>
              Visão consolidada para priorização da gestão.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Obra</TableHead>
                  <TableHead>Pendências</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Alta prioridade
                  </TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow
                    key={project.id}
                    className="cursor-pointer"
                    onClick={() => openProject(project.id)}
                  >
                    <TableCell className="pl-4">
                      <p className="font-medium">{project.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {project.address}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold tabular-nums">
                        {project.openCount}
                      </span>{' '}
                      de {project.occurrenceCount}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {project.highSeverityCount > 0 ? (
                        <Badge
                          variant="outline"
                          className="border-red-200 bg-red-50 text-red-800"
                        >
                          {project.highSeverityCount} crítica
                          {project.highSeverityCount > 1 ? 's' : ''}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Sem críticas
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Experiência por perfil</CardTitle>
            <CardDescription>
              Uma base única, apresentada conforme a responsabilidade.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ProfileRow
              icon={<MessageCircleMore />}
              title="Equipe de campo"
              description="Relata por texto e foto no WhatsApp."
            />
            <ProfileRow
              icon={<ClipboardCheck />}
              title="Engenharia"
              description="Tria e acompanha as ocorrências da obra."
            />
            <ProfileRow
              icon={<UsersRound />}
              title="Gestão"
              description="Compara obras e prioriza riscos do portfólio."
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={openOccurrences}
            >
              Ver todas as ocorrências <ChevronRight />
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader className="border-b">
          <CardTitle>Atividade recente</CardTitle>
          <CardDescription>
            Últimos relatos recebidos em todas as obras.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y px-0 py-0">
          {occurrences.slice(0, 4).map((occurrence) => (
            <button
              key={occurrence.id}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
              onClick={() =>
                occurrence.projectId && openProject(occurrence.projectId)
              }
            >
              <div className="grid size-9 shrink-0 place-items-center rounded-lg border bg-muted text-xs font-semibold text-muted-foreground">
                {occurrence.code.slice(-2)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {occurrence.title}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {occurrence.projectName ?? 'Sem obra'} ·{' '}
                  {formatDate(occurrence.createdAt)}
                </p>
              </div>
              <StatusBadge status={occurrence.status} />
            </button>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

function OccurrencesView({
  filtered,
  loading,
  moveToTreatment,
  projects,
  query,
  scopedStats,
  selected,
  selectedProjectId,
  setQuery,
  setSelectedId,
  setSelectedProjectId,
  updating,
}: {
  filtered: Occurrence[];
  loading: boolean;
  moveToTreatment: () => void;
  projects: Project[];
  query: string;
  scopedStats: { new: number; inProgress: number; closed: number };
  selected: Occurrence | null;
  selectedProjectId: string;
  setQuery: (value: string) => void;
  setSelectedId: (value: string) => void;
  setSelectedProjectId: (value: string) => void;
  updating: boolean;
}) {
  return (
    <>
      <div className="grid gap-3 py-5 sm:grid-cols-3">
        <SummaryCard
          icon={<CircleAlert className="size-4 text-amber-600" />}
          label="Novas"
          value={loading ? '—' : scopedStats.new}
        />
        <SummaryCard
          icon={<Clock3 className="size-4 text-sky-700" />}
          label="Em tratamento"
          value={loading ? '—' : scopedStats.inProgress}
        />
        <SummaryCard
          icon={<CheckCircle2 className="size-4 text-emerald-700" />}
          label="Encerradas"
          value={loading ? '—' : scopedStats.closed}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="min-w-0">
          <CardHeader className="border-b">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Caixa de entrada</CardTitle>
                <CardDescription>
                  Relatos organizados para triagem da engenharia.
                </CardDescription>
              </div>
              <NativeSelect
                className="w-full sm:w-56"
                value={selectedProjectId}
                onChange={(event) => setSelectedProjectId(event.target.value)}
                aria-label="Filtrar por obra"
              >
                <NativeSelectOption value="all">
                  Todas as obras
                </NativeSelectOption>
                {projects.map((project) => (
                  <NativeSelectOption key={project.id} value={project.id}>
                    {project.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="relative mt-3">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar ocorrência, local ou responsável"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Ocorrência</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Recebida
                  </TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((occurrence) => (
                  <TableRow
                    key={occurrence.id}
                    className={
                      selected?.id === occurrence.id
                        ? 'cursor-pointer bg-primary/[0.04]'
                        : 'cursor-pointer'
                    }
                    onClick={() => setSelectedId(occurrence.id)}
                  >
                    <TableCell className="max-w-[360px] pl-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border bg-muted text-xs font-semibold text-muted-foreground">
                          {occurrence.code.slice(-2)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-medium">
                              {occurrence.title}
                            </p>
                            {occurrence.severity === 'high' && (
                              <span className="size-1.5 shrink-0 rounded-full bg-red-500" />
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {occurrence.projectName ?? 'Sem obra'} ·{' '}
                            {occurrence.location ?? 'Local a confirmar'}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground md:hidden">
                            {occurrence.reporterName} ·{' '}
                            {formatDate(occurrence.createdAt)}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={occurrence.status} />
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                      <p>{occurrence.reporterName}</p>
                      <p>{formatDate(occurrence.createdAt)}</p>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={'Abrir ' + occurrence.code}
                      >
                        {selected?.id === occurrence.id ? (
                          <ChevronRight />
                        ) : (
                          <MoreHorizontal />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-28 text-center text-muted-foreground"
                    >
                      Nenhuma ocorrência encontrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <OccurrenceDetail
          selected={selected}
          updating={updating}
          moveToTreatment={moveToTreatment}
        />
      </div>
    </>
  );
}

function OccurrenceDetail({
  selected,
  updating,
  moveToTreatment,
}: {
  selected: Occurrence | null;
  updating: boolean;
  moveToTreatment: () => void;
}) {
  return (
    <Card className="self-start">
      {selected ? (
        <>
          <CardHeader className="border-b">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  {selected.code}
                </p>
                <CardTitle className="mt-1 text-lg">{selected.title}</CardTitle>
              </div>
              <StatusBadge status={selected.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {selected.evidenceUrl ? (
              <div className="overflow-hidden rounded-lg border bg-muted/40">
                <Image
                  src={selected.evidenceUrl}
                  alt={'Evidência da ocorrência ' + selected.code}
                  width={640}
                  height={352}
                  unoptimized
                  className="h-44 w-full object-cover"
                />
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  Foto recebida pelo WhatsApp · {formatDate(selected.createdAt)}
                </p>
              </div>
            ) : (
              <div className="grid h-36 place-items-center rounded-lg border border-dashed bg-muted/40 text-center">
                <div>
                  <ClipboardCheck className="mx-auto size-5 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium">
                    {selected.evidenceCount > 0
                      ? 'Foto registrada no relato'
                      : 'Relato recebido pelo WhatsApp'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(selected.createdAt)} · {selected.reporterName}
                  </p>
                </div>
              </div>
            )}
            {selected.automaticSummary && (
              <div className="rounded-lg border border-teal-200 bg-teal-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
                  Triagem assistida
                </p>
                <p className="mt-1 text-sm leading-relaxed text-teal-950">
                  {selected.automaticSummary}
                </p>
              </div>
            )}
            <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Obra</dt>
              <dd className="font-medium">
                {selected.projectName ?? 'A confirmar'}
              </dd>
              <dt className="text-muted-foreground">Local</dt>
              <dd className="font-medium">
                {selected.location ?? 'Não informado'}
              </dd>
              <dt className="text-muted-foreground">Categoria</dt>
              <dd className="font-medium">{selected.category}</dd>
              <dt className="text-muted-foreground">Relato</dt>
              <dd className="leading-relaxed">“{selected.description}”</dd>
            </dl>
            {selected.normativeReference && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs font-semibold text-muted-foreground">
                  REFERÊNCIA TÉCNICA
                </p>
                <p className="mt-1 text-sm leading-relaxed">
                  {selected.normativeReference}
                </p>
              </div>
            )}
            <Button
              size="lg"
              className="w-full"
              onClick={moveToTreatment}
              disabled={updating || selected.status === 'in_progress'}
            >
              {updating ? <LoaderCircle className="animate-spin" /> : null}
              {selected.status === 'in_progress'
                ? 'Em tratamento'
                : 'Validar e encaminhar'}
              {!updating && selected.status !== 'in_progress' ? (
                <ChevronRight />
              ) : null}
            </Button>
          </CardContent>
        </>
      ) : (
        <CardContent className="grid h-72 place-items-center text-sm text-muted-foreground">
          Selecione uma ocorrência.
        </CardContent>
      )}
    </Card>
  );
}

function ProjectsView({
  loading,
  projects,
  openProject,
}: {
  loading: boolean;
  projects: Project[];
  openProject: (projectId: string) => void;
}) {
  return (
    <div className="py-5">
      <div className="mb-5 max-w-2xl">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Cada obra mantém seus relatos, responsáveis e prioridades. A gestão
          acompanha o conjunto; a engenharia entra no recorte de cada projeto.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {projects.map((project) => (
          <Card
            key={project.id}
            className="transition-colors hover:border-primary/30"
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardDescription>{project.code}</CardDescription>
                  <CardTitle className="mt-1">{project.name}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {project.address}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="border-emerald-200 bg-emerald-50 text-emerald-800"
                >
                  Ativa
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 divide-x rounded-lg border bg-muted/20 py-3 text-center">
                <ProjectMetric label="Total" value={project.occurrenceCount} />
                <ProjectMetric label="Abertas" value={project.openCount} />
                <ProjectMetric
                  label="Críticas"
                  value={project.highSeverityCount}
                  alert={project.highSeverityCount > 0}
                />
              </div>
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => openProject(project.id)}
              >
                Abrir ocorrências <ChevronRight />
              </Button>
            </CardContent>
          </Card>
        ))}
        {!loading && projects.length === 0 && (
          <Card>
            <CardContent className="grid h-40 place-items-center text-sm text-muted-foreground">
              Nenhuma obra cadastrada.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function WhatsAppView({
  integration,
  loading,
}: {
  integration: IntegrationStatus | null;
  loading: boolean;
}) {
  const configured = integration?.configured ?? false;
  return (
    <div className="grid gap-5 py-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>WhatsApp Cloud API</CardTitle>
              <CardDescription>
                Canal de entrada usado pela equipe de campo.
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className={
                configured
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              }
            >
              {loading
                ? 'Verificando'
                : configured
                  ? 'Conectado'
                  : 'Aguardando Meta'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <IntegrationStep
              number="1"
              title="Campo relata"
              description="Texto ou foto pelo WhatsApp."
            />
            <IntegrationStep
              number="2"
              title="Civitek organiza"
              description="Telefone, obra e relato são vinculados."
            />
            <IntegrationStep
              number="3"
              title="Equipe acompanha"
              description="A ocorrência entra na fila da engenharia."
            />
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium">Estado atual</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {configured
                ? 'As credenciais de produção estão configuradas e o backend pode receber eventos da Meta.'
                : 'O endpoint e o processamento estão implementados. Faltam somente a validação do telefone e as credenciais da Meta no ambiente de produção.'}
            </p>
          </div>
        </CardContent>
      </Card>
      <Card className="self-start">
        <CardHeader>
          <CardTitle className="text-lg">Contrato do canal</CardTitle>
          <CardDescription>O que já está definido no produto.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <CheckRow text="Receber texto e foto com legenda" />
          <CheckRow text="Vincular telefone à obra correspondente" />
          <CheckRow text="Evitar duplicidade de mensagens" />
          <CheckRow text="Responder com protocolo da ocorrência" />
          <CheckRow text="Validar a assinatura enviada pela Meta" />
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
            Nenhuma tentativa adicional será feita na Meta até o bloqueio de SMS
            esfriar.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function NavButton({
  active,
  children,
  icon,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      variant={active ? 'default' : 'ghost'}
      className={
        active
          ? 'w-full justify-start bg-sidebar-primary text-sidebar-primary-foreground'
          : 'w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
      }
      onClick={onClick}
    >
      {icon}
      {children}
    </Button>
  );
}

function MobileNavButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      size="sm"
      variant={active ? 'default' : 'ghost'}
      className="shrink-0"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    new: 'border-amber-200 bg-amber-50 text-amber-800',
    in_progress: 'border-sky-200 bg-sky-50 text-sky-800',
    validation: 'border-violet-200 bg-violet-50 text-violet-800',
    closed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    needs_context: 'border-rose-200 bg-rose-50 text-rose-800',
  };
  return (
    <Badge variant="outline" className={styles[status] ?? styles.new}>
      {statusLabels[status] ?? status}
    </Badge>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          {icon} {label}
        </CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function ProfileRow({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

function ProjectMetric({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: number;
  alert?: boolean;
}) {
  return (
    <div>
      <p
        className={`text-xl font-semibold tabular-nums ${alert ? 'text-red-700' : ''}`}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function IntegrationStep({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <span className="grid size-6 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
        {number}
      </span>
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function CheckRow({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2">
      <CheckCircle2 className="size-4 text-emerald-700" />
      <span>{text}</span>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
