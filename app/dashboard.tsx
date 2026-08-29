'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Activity,
  AudioLines,
  BookOpenCheck,
  BriefcaseBusiness,
  Building2,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  FileText,
  HardHat,
  ImageIcon,
  LayoutDashboard,
  LoaderCircle,
  MessageCircleMore,
  MessagesSquare,
  Search,
  ShieldCheck,
  SlidersHorizontal,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

type Role = 'manager' | 'engineer';
type View =
  | 'dashboard'
  | 'occurrences'
  | 'projects'
  | 'compliance'
  | 'updates'
  | 'whatsapp';
type ComplianceFilter = 'action' | 'critical' | 'pbqph' | 'nbr' | 'all';
type UpdateType = 'all' | 'image' | 'audio' | 'text';

type ComplianceCheck = {
  id: string;
  standardCode: string;
  requirement: string;
  status: string;
  engineerNote: string | null;
  updatedAt: string;
};

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
  complianceChecks: ComplianceCheck[];
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

type ProjectUpdate = {
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

type ComplianceItem = ComplianceCheck & {
  occurrenceId: string;
  occurrenceCode: string;
  occurrenceTitle: string;
  projectId: string | null;
  projectName: string | null;
  severity: string;
  location: string | null;
};

type IntegrationStatus = {
  provider: string;
  configured: boolean;
  webhookPath: string;
};

const occurrenceStatusLabels: Record<string, string> = {
  new: 'Nova',
  in_progress: 'Em tratamento',
  validation: 'Aguardando validação',
  closed: 'Encerrada',
  needs_context: 'Sem obra vinculada',
};

const complianceStatusLabels: Record<string, string> = {
  pending: 'Pendente',
  compliant: 'Conforme',
  non_compliant: 'Não conforme',
  not_applicable: 'Não aplicável',
};

export default function Dashboard() {
  const [role, setRole] = useState<Role>('manager');
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [integration, setIntegration] = useState<IntegrationStatus | null>(
    null,
  );
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [updatesProjectId, setUpdatesProjectId] = useState('all');
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState<
    string | null
  >(null);
  const [query, setQuery] = useState('');
  const [complianceFilter, setComplianceFilter] =
    useState<ComplianceFilter>('action');
  const [updateType, setUpdateType] = useState<UpdateType>('all');
  const [loading, setLoading] = useState(true);
  const [updatingOccurrence, setUpdatingOccurrence] = useState(false);
  const [updatingCheckId, setUpdatingCheckId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadOccurrences(preferredId?: string) {
    const response = await fetch('/api/occurrences', { cache: 'no-store' });
    if (!response.ok)
      throw new Error('Não foi possível carregar as ocorrências.');
    const data = (await response.json()) as { occurrences: Occurrence[] };
    setOccurrences(data.occurrences);
    setSelectedOccurrenceId((current) => {
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

  async function loadUpdates() {
    const response = await fetch('/api/updates', { cache: 'no-store' });
    if (!response.ok)
      throw new Error('Não foi possível carregar as atualizações da obra.');
    const data = (await response.json()) as { updates: ProjectUpdate[] };
    setUpdates(data.updates);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      Promise.all([
        loadOccurrences(),
        loadUpdates(),
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

  useEffect(() => {
    if (role === 'engineer' && selectedProjectId === 'all' && projects[0]) {
      setSelectedProjectId(projects[0].id);
      setUpdatesProjectId(projects[0].id);
    }
  }, [projects, role, selectedProjectId]);

  const complianceItems = useMemo<ComplianceItem[]>(
    () =>
      occurrences.flatMap((occurrence) =>
        occurrence.complianceChecks.map((check) => ({
          ...check,
          occurrenceId: occurrence.id,
          occurrenceCode: occurrence.code,
          occurrenceTitle: occurrence.title,
          projectId: occurrence.projectId,
          projectName: occurrence.projectName,
          severity: occurrence.severity,
          location: occurrence.location,
        })),
      ),
    [occurrences],
  );

  const roleOccurrences = occurrences.filter(
    (occurrence) =>
      selectedProjectId === 'all' || occurrence.projectId === selectedProjectId,
  );
  const roleComplianceItems = complianceItems.filter(
    (item) => role === 'manager' || item.projectId === selectedProjectId,
  );
  const roleUpdates = updates.filter(
    (item) => role === 'manager' || item.projectId === selectedProjectId,
  );
  const filteredCompliance = filterComplianceItems(
    roleComplianceItems,
    complianceFilter,
  );
  const filteredUpdates = updates.filter((item) => {
    const projectMatches =
      role === 'engineer'
        ? item.projectId === selectedProjectId
        : updatesProjectId === 'all' || item.projectId === updatesProjectId;
    return (
      projectMatches &&
      (updateType === 'all' || item.messageType === updateType)
    );
  });
  const filteredOccurrences = roleOccurrences.filter((occurrence) => {
    const normalized = query.toLocaleLowerCase('pt-BR').trim();
    if (!normalized) return true;
    return [
      occurrence.code,
      occurrence.title,
      occurrence.location,
      occurrence.reporterName,
      occurrence.projectName,
    ]
      .filter(Boolean)
      .some((value) => value?.toLocaleLowerCase('pt-BR').includes(normalized));
  });
  const selectedOccurrence =
    filteredOccurrences.find(
      (occurrence) => occurrence.id === selectedOccurrenceId,
    ) ??
    filteredOccurrences[0] ??
    null;
  async function moveToTreatment() {
    if (!selectedOccurrence) return;
    setUpdatingOccurrence(true);
    setNotice(null);
    try {
      const response = await fetch(
        '/api/occurrences/' + selectedOccurrence.id,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'in_progress' }),
        },
      );
      if (!response.ok)
        throw new Error('Não foi possível atualizar a ocorrência.');
      await loadOccurrences(selectedOccurrence.id);
      setNotice(`${selectedOccurrence.code} encaminhada para tratamento.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Falha ao atualizar.');
    } finally {
      setUpdatingOccurrence(false);
    }
  }

  async function validateCompliance(checkId: string, status: string) {
    const item = complianceItems.find((check) => check.id === checkId);
    if (!item) return;
    setUpdatingCheckId(checkId);
    setNotice(null);
    try {
      const response = await fetch('/api/occurrences/' + item.occurrenceId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          complianceCheckId: checkId,
          complianceStatus: status,
        }),
      });
      if (!response.ok)
        throw new Error('Não foi possível registrar a conformidade.');
      await loadOccurrences(item.occurrenceId);
      setNotice(
        `${item.standardCode} atualizado para ${complianceStatusLabels[status].toLocaleLowerCase('pt-BR')}.`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Falha ao atualizar.');
    } finally {
      setUpdatingCheckId(null);
    }
  }

  function changeRole(nextRole: Role) {
    setRole(nextRole);
    setActiveView('dashboard');
    setQuery('');
    setNotice(null);
    if (nextRole === 'engineer') {
      const projectId =
        selectedProjectId === 'all'
          ? (projects[0]?.id ?? 'all')
          : selectedProjectId;
      setSelectedProjectId(projectId);
      setUpdatesProjectId(projectId);
      return;
    }
    setSelectedProjectId('all');
    setUpdatesProjectId('all');
  }

  function openProject(projectId: string) {
    setSelectedProjectId(projectId);
    setUpdatesProjectId(projectId);
    setQuery('');
    setActiveView('occurrences');
  }

  function openOccurrence(id: string) {
    const occurrence = occurrences.find((item) => item.id === id);
    if (occurrence?.projectId) setSelectedProjectId(occurrence.projectId);
    setSelectedOccurrenceId(id);
    setActiveView('occurrences');
  }

  function openUpdates(projectId?: string | null) {
    setUpdatesProjectId(
      projectId ?? (role === 'manager' ? 'all' : selectedProjectId),
    );
    setActiveView('updates');
  }

  const navItems = getNavItems(role);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto min-h-screen max-w-[1580px]">
        <header className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <Brand />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {role === 'engineer' && (
              <NativeSelect
                className="w-full border-amber-900/15 bg-card/70 sm:w-52"
                value={selectedProjectId}
                onChange={(event) => {
                  setSelectedProjectId(event.target.value);
                  setUpdatesProjectId(event.target.value);
                }}
                aria-label="Obra do engenheiro"
              >
                {projects.map((project) => (
                  <NativeSelectOption key={project.id} value={project.id}>
                    {project.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
            <RoleSwitcher role={role} changeRole={changeRole} />
          </div>
        </header>

        <div className="border-y bg-card/55 px-4 py-2.5 backdrop-blur-sm sm:px-6 lg:px-8">
          <nav
            className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border border-amber-900/10 bg-background/60 p-1 shadow-sm"
            aria-label="Navegação principal"
          >
            {navItems.map((item) => (
              <SegmentedNavButton
                key={item.view}
                active={activeView === item.view}
                icon={item.icon}
                onClick={() => setActiveView(item.view)}
              >
                {item.label}
              </SegmentedNavButton>
            ))}
          </nav>
        </div>

        <section className="min-w-0 px-4 pb-8 sm:px-6 lg:px-8">
          {notice && (
            <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {notice}
            </div>
          )}

          {activeView === 'dashboard' && role === 'manager' && (
            <ManagerDashboard
              complianceItems={complianceItems}
              loading={loading}
              occurrences={occurrences}
              openOccurrence={openOccurrence}
              openProject={openProject}
              openUpdates={openUpdates}
              projects={projects}
              updates={updates}
            />
          )}
          {activeView === 'dashboard' && role === 'engineer' && (
            <EngineerDashboard
              complianceItems={roleComplianceItems}
              loading={loading}
              occurrences={roleOccurrences}
              openCompliance={() => setActiveView('compliance')}
              openOccurrence={openOccurrence}
              openUpdates={() => openUpdates(selectedProjectId)}
              updates={roleUpdates}
            />
          )}
          {activeView === 'occurrences' && (
            <OccurrencesView
              filtered={filteredOccurrences}
              loading={loading}
              moveToTreatment={moveToTreatment}
              query={query}
              role={role}
              selected={selectedOccurrence}
              setQuery={setQuery}
              setSelectedOccurrenceId={setSelectedOccurrenceId}
              updating={updatingOccurrence}
            />
          )}
          {activeView === 'projects' && (
            <ProjectsView
              complianceItems={complianceItems}
              loading={loading}
              openProject={openProject}
              openUpdates={openUpdates}
              projects={projects}
            />
          )}
          {activeView === 'compliance' && (
            <ComplianceView
              filter={complianceFilter}
              filteredItems={filteredCompliance}
              items={roleComplianceItems}
              loading={loading}
              projects={projects}
              role={role}
              setFilter={setComplianceFilter}
              updatingCheckId={updatingCheckId}
              validateCompliance={validateCompliance}
            />
          )}
          {activeView === 'updates' && (
            <UpdatesView
              integration={integration}
              loading={loading}
              openOccurrence={openOccurrence}
              projectId={
                role === 'engineer' ? selectedProjectId : updatesProjectId
              }
              projects={projects}
              role={role}
              setProjectId={setUpdatesProjectId}
              setUpdateType={setUpdateType}
              updateType={updateType}
              updates={filteredUpdates}
            />
          )}
          {activeView === 'whatsapp' && (
            <WhatsAppView
              integration={integration}
              loading={loading}
              openUpdates={() => setActiveView('updates')}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <HardHat className="size-5" />
      </div>
      <p className="font-heading text-xl font-semibold tracking-[-0.035em]">
        CiviTek
      </p>
    </div>
  );
}

function RoleSwitcher({
  changeRole,
  role,
}: {
  changeRole: (role: Role) => void;
  role: Role;
}) {
  const manager = role === 'manager';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-amber-500/40 bg-gradient-to-br from-amber-800 via-amber-700 to-yellow-700 px-4 text-sm font-semibold text-white shadow-[0_10px_28px_-12px_rgba(146,64,14,0.9)] outline-none transition hover:-translate-y-px hover:shadow-[0_14px_34px_-12px_rgba(146,64,14,0.95)] focus-visible:ring-2 focus-visible:ring-amber-500/60 sm:w-auto">
        {manager ? (
          <BriefcaseBusiness className="size-4" />
        ) : (
          <HardHat className="size-4" />
        )}
        Visão do {manager ? 'gestor' : 'engenheiro'}
        <ChevronDown className="size-4 opacity-75 transition group-data-popup-open:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel>Alternar visão</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="py-2"
          onClick={() => changeRole('manager')}
        >
          <BriefcaseBusiness />
          <div>
            <p className="font-medium">Gestor</p>
            <p className="text-xs text-muted-foreground">Visão multiobra</p>
          </div>
          {manager && <CheckCircle2 className="ml-auto text-amber-700" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="py-2"
          onClick={() => changeRole('engineer')}
        >
          <HardHat />
          <div>
            <p className="font-medium">Engenheiro</p>
            <p className="text-xs text-muted-foreground">Operação da obra</p>
          </div>
          {!manager && <CheckCircle2 className="ml-auto text-amber-700" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ManagerDashboard({
  complianceItems,
  loading,
  occurrences,
  openOccurrence,
  openProject,
  openUpdates,
  projects,
  updates,
}: {
  complianceItems: ComplianceItem[];
  loading: boolean;
  occurrences: Occurrence[];
  openOccurrence: (id: string) => void;
  openProject: (id: string) => void;
  openUpdates: (projectId?: string | null) => void;
  projects: Project[];
  updates: ProjectUpdate[];
}) {
  const openCount = occurrences.filter(
    (item) => item.status !== 'closed',
  ).length;
  const actionItems = complianceItems.filter((item) =>
    ['pending', 'non_compliant'].includes(item.status),
  );
  return (
    <>
      <div className="grid gap-3 py-5 sm:grid-cols-3">
        <SummaryCard
          icon={<Building2 className="size-4 text-amber-800" />}
          label="Obras ativas"
          value={loading ? '—' : projects.length}
          context="Portfólio acompanhado"
        />
        <SummaryCard
          icon={<Clock3 className="size-4 text-amber-700" />}
          label="Pendências abertas"
          value={loading ? '—' : openCount}
          context="Todas as obras"
        />
        <SummaryCard
          icon={<ShieldCheck className="size-4 text-emerald-700" />}
          label="Conformidade validada"
          value={
            loading ? '—' : `${getResolvedComplianceRate(complianceItems)}%`
          }
          context="PBQP-H e NBR 15575"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Saúde das obras</CardTitle>
            <CardDescription>
              Comparação direta para decidir onde agir primeiro.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Obra</TableHead>
                  <TableHead>Conformidade</TableHead>
                  <TableHead>Pendências</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Críticas
                  </TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => {
                  const projectItems = complianceItems.filter(
                    (item) => item.projectId === project.id,
                  );
                  return (
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
                      <TableCell className="font-semibold tabular-nums">
                        {getResolvedComplianceRate(projectItems)}%
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {project.openCount}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {project.highSeverityCount > 0 ? (
                          <Badge
                            variant="outline"
                            className="border-red-200 bg-red-50 text-red-800"
                          >
                            {project.highSeverityCount}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <ActionPanel
          items={actionItems.slice(0, 4)}
          onOpen={openOccurrence}
          title="Atenção agora"
        />
      </div>

      <RecentUpdates
        className="mt-5"
        openOccurrence={openOccurrence}
        openUpdates={openUpdates}
        updates={updates.slice(0, 4)}
      />
    </>
  );
}

function EngineerDashboard({
  complianceItems,
  loading,
  occurrences,
  openCompliance,
  openOccurrence,
  openUpdates,
  updates,
}: {
  complianceItems: ComplianceItem[];
  loading: boolean;
  occurrences: Occurrence[];
  openCompliance: () => void;
  openOccurrence: (id: string) => void;
  openUpdates: () => void;
  updates: ProjectUpdate[];
}) {
  const nonCompliant = complianceItems.filter(
    (item) => item.status === 'non_compliant',
  ).length;
  const pending = complianceItems.filter(
    (item) => item.status === 'pending',
  ).length;
  const actionItems = complianceItems.filter((item) =>
    ['pending', 'non_compliant'].includes(item.status),
  );
  return (
    <>
      <div className="grid gap-3 py-5 sm:grid-cols-3">
        <SummaryCard
          icon={<ShieldCheck className="size-4 text-emerald-700" />}
          label="Conformidade validada"
          value={
            loading ? '—' : `${getResolvedComplianceRate(complianceItems)}%`
          }
          context="Itens já avaliados"
        />
        <SummaryCard
          icon={<CircleAlert className="size-4 text-red-600" />}
          label="Não conformidades"
          value={loading ? '—' : nonCompliant}
          context="Precisam de correção"
        />
        <SummaryCard
          icon={<Clock3 className="size-4 text-amber-700" />}
          label="Aguardando validação"
          value={loading ? '—' : pending}
          context={`${occurrences.length} ocorrências na obra`}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3 border-b">
            <div>
              <CardTitle>Ação necessária</CardTitle>
              <CardDescription>
                Apenas itens pendentes ou fora da conformidade.
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className="border-red-200 bg-red-50 text-red-800"
            >
              {actionItems.length} itens
            </Badge>
          </CardHeader>
          <CardContent className="divide-y px-0 py-0">
            {actionItems.slice(0, 5).map((item) => (
              <ComplianceRow
                key={item.id}
                item={item}
                onOpen={() => openOccurrence(item.occurrenceId)}
              />
            ))}
            {!loading && actionItems.length === 0 && (
              <EmptyState text="Nenhuma ação de conformidade pendente." />
            )}
          </CardContent>
          {actionItems.length > 0 && (
            <CardContent className="border-t py-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={openCompliance}
              >
                Abrir fila de conformidade <ChevronRight />
              </Button>
            </CardContent>
          )}
        </Card>

        <RecentUpdates
          compact
          openOccurrence={openOccurrence}
          openUpdates={openUpdates}
          updates={updates.slice(0, 3)}
        />
      </div>
    </>
  );
}

function OccurrencesView({
  filtered,
  loading,
  moveToTreatment,
  query,
  role,
  selected,
  setQuery,
  setSelectedOccurrenceId,
  updating,
}: {
  filtered: Occurrence[];
  loading: boolean;
  moveToTreatment: () => void;
  query: string;
  role: Role;
  selected: Occurrence | null;
  setQuery: (value: string) => void;
  setSelectedOccurrenceId: (value: string) => void;
  updating: boolean;
}) {
  const open = filtered.filter((item) => item.status !== 'closed').length;
  const critical = filtered.filter(
    (item) => item.severity === 'high' && item.status !== 'closed',
  ).length;
  return (
    <>
      <div className="grid gap-3 py-5 sm:grid-cols-3">
        <SummaryCard
          icon={<ClipboardCheck className="size-4 text-sky-700" />}
          label="Ocorrências"
          value={loading ? '—' : filtered.length}
          context={role === 'manager' ? 'No portfólio' : 'Nesta obra'}
        />
        <SummaryCard
          icon={<Clock3 className="size-4 text-amber-700" />}
          label="Abertas"
          value={loading ? '—' : open}
          context="Em triagem ou tratamento"
        />
        <SummaryCard
          icon={<CircleAlert className="size-4 text-red-600" />}
          label="Alta prioridade"
          value={loading ? '—' : critical}
          context="Exigem atenção"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="min-w-0">
          <CardHeader className="border-b">
            <CardTitle>Fila de ocorrências</CardTitle>
            <CardDescription>
              Relatos organizados para triagem da engenharia.
            </CardDescription>
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
                    onClick={() => setSelectedOccurrenceId(occurrence.id)}
                  >
                    <TableCell className="max-w-[380px] pl-4">
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
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <OccurrenceStatusBadge status={occurrence.status} />
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                      <p>{occurrence.reporterName}</p>
                      <p>{formatDate(occurrence.createdAt)}</p>
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="size-4 text-muted-foreground" />
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
          moveToTreatment={moveToTreatment}
          selected={selected}
          updating={updating}
        />
      </div>
    </>
  );
}

function OccurrenceDetail({
  moveToTreatment,
  selected,
  updating,
}: {
  moveToTreatment: () => void;
  selected: Occurrence | null;
  updating: boolean;
}) {
  return (
    <Card className="self-start">
      {selected ? (
        <>
          <CardHeader className="border-b">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardDescription>{selected.code}</CardDescription>
                <CardTitle className="mt-1 text-lg">{selected.title}</CardTitle>
              </div>
              <OccurrenceStatusBadge status={selected.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {selected.evidenceUrl ? (
              <div className="overflow-hidden rounded-lg border bg-muted/40">
                <Image
                  src={selected.evidenceUrl}
                  alt={`Evidência da ocorrência ${selected.code}`}
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
              <div className="grid h-28 place-items-center rounded-lg border border-dashed bg-muted/30 text-center">
                <div>
                  <Camera className="mx-auto size-5 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium">Relato do WhatsApp</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(selected.createdAt)} · {selected.reporterName}
                  </p>
                </div>
              </div>
            )}

            <dl className="grid grid-cols-[76px_1fr] gap-x-3 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Obra</dt>
              <dd className="font-medium">
                {selected.projectName ?? 'A confirmar'}
              </dd>
              <dt className="text-muted-foreground">Local</dt>
              <dd className="font-medium">
                {selected.location ?? 'Não informado'}
              </dd>
              <dt className="text-muted-foreground">Relato</dt>
              <dd className="leading-relaxed">“{selected.description}”</dd>
            </dl>

            {selected.automaticSummary && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-800">TRIAGEM</p>
                <p className="mt-1 text-sm leading-relaxed text-amber-950">
                  {selected.automaticSummary}
                </p>
              </div>
            )}

            {selected.complianceChecks.length > 0 && (
              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-xs font-semibold text-muted-foreground">
                  CONFORMIDADE ASSOCIADA
                </p>
                {selected.complianceChecks.map((check) => (
                  <div
                    key={check.id}
                    className="flex items-start justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {check.standardCode}
                      </p>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {check.requirement}
                      </p>
                    </div>
                    <ComplianceStatusBadge status={check.status} />
                  </div>
                ))}
              </div>
            )}

            <Button
              size="lg"
              className="w-full"
              onClick={moveToTreatment}
              disabled={updating || selected.status === 'in_progress'}
            >
              {updating && <LoaderCircle className="animate-spin" />}
              {selected.status === 'in_progress'
                ? 'Em tratamento'
                : 'Encaminhar para tratamento'}
              {!updating && selected.status !== 'in_progress' && (
                <ChevronRight />
              )}
            </Button>
          </CardContent>
        </>
      ) : (
        <EmptyState text="Selecione uma ocorrência." />
      )}
    </Card>
  );
}

function ProjectsView({
  complianceItems,
  loading,
  openProject,
  openUpdates,
  projects,
}: {
  complianceItems: ComplianceItem[];
  loading: boolean;
  openProject: (id: string) => void;
  openUpdates: (projectId?: string | null) => void;
  projects: Project[];
}) {
  return (
    <div className="py-5">
      <p className="mb-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Visão compacta do portfólio. Abra uma obra para acessar ocorrências ou
        veja diretamente as atualizações recebidas do campo.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {projects.map((project) => {
          const projectItems = complianceItems.filter(
            (item) => item.projectId === project.id,
          );
          return (
            <Card key={project.id}>
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
                  <ProjectMetric
                    label="Conformidade"
                    value={`${getResolvedComplianceRate(projectItems)}%`}
                  />
                  <ProjectMetric label="Abertas" value={project.openCount} />
                  <ProjectMetric
                    alert={project.highSeverityCount > 0}
                    label="Críticas"
                    value={project.highSeverityCount}
                  />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => openProject(project.id)}
                  >
                    Ocorrências
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => openUpdates(project.id)}
                  >
                    Atualizações
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!loading && projects.length === 0 && (
          <Card>
            <EmptyState text="Nenhuma obra cadastrada." />
          </Card>
        )}
      </div>
    </div>
  );
}

function ComplianceView({
  filter,
  filteredItems,
  items,
  loading,
  projects,
  role,
  setFilter,
  updatingCheckId,
  validateCompliance,
}: {
  filter: ComplianceFilter;
  filteredItems: ComplianceItem[];
  items: ComplianceItem[];
  loading: boolean;
  projects: Project[];
  role: Role;
  setFilter: (filter: ComplianceFilter) => void;
  updatingCheckId: string | null;
  validateCompliance: (checkId: string, status: string) => void;
}) {
  const nonCompliant = items.filter(
    (item) => item.status === 'non_compliant',
  ).length;
  const pending = items.filter((item) => item.status === 'pending').length;
  return (
    <>
      <div className="flex flex-col gap-4 py-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm leading-relaxed text-muted-foreground">
            A equipe trabalha pela ação necessária. As normas aparecem como
            contexto, requisito e evidência esperada — sem abrir documento por
            documento.
          </p>
        </div>
        <ComplianceFilters filter={filter} setFilter={setFilter} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={<ShieldCheck className="size-4 text-emerald-700" />}
          label="Conformidade validada"
          value={loading ? '—' : `${getResolvedComplianceRate(items)}%`}
          context="Itens avaliados"
        />
        <SummaryCard
          icon={<CircleAlert className="size-4 text-red-600" />}
          label="Não conformes"
          value={loading ? '—' : nonCompliant}
          context="Exigem plano de correção"
        />
        <SummaryCard
          icon={<Clock3 className="size-4 text-amber-700" />}
          label="Pendentes"
          value={loading ? '—' : pending}
          context="Aguardando validação"
        />
      </div>

      {role === 'engineer' ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Fila de conformidade</CardTitle>
              <CardDescription>
                Valide o requisito diretamente a partir da ocorrência e da
                evidência.
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y px-0 py-0">
              {filteredItems.map((item) => (
                <ComplianceActionRow
                  key={item.id}
                  item={item}
                  updating={updatingCheckId === item.id}
                  validateCompliance={validateCompliance}
                />
              ))}
              {!loading && filteredItems.length === 0 && (
                <EmptyState text="Nenhum item encontrado neste filtro." />
              )}
            </CardContent>
          </Card>
          <NormScope items={items} />
        </div>
      ) : (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Conformidade por obra</CardTitle>
              <CardDescription>
                Comparação gerencial dos itens já avaliados.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Obra</TableHead>
                    <TableHead>Índice</TableHead>
                    <TableHead>Não conformes</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Pendentes
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => {
                    const projectItems = items.filter(
                      (item) => item.projectId === project.id,
                    );
                    return (
                      <TableRow key={project.id}>
                        <TableCell className="pl-4">
                          <p className="font-medium">{project.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {project.address}
                          </p>
                        </TableCell>
                        <TableCell className="font-semibold tabular-nums">
                          {getResolvedComplianceRate(projectItems)}%
                        </TableCell>
                        <TableCell>
                          {
                            projectItems.filter(
                              (item) => item.status === 'non_compliant',
                            ).length
                          }
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {
                            projectItems.filter(
                              (item) => item.status === 'pending',
                            ).length
                          }
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <ActionPanel
            items={filteredItems.slice(0, 5)}
            title="Alertas do portfólio"
          />
        </div>
      )}
    </>
  );
}

function ComplianceFilters({
  filter,
  setFilter,
}: {
  filter: ComplianceFilter;
  setFilter: (filter: ComplianceFilter) => void;
}) {
  const options: Array<{ value: ComplianceFilter; label: string }> = [
    { value: 'action', label: 'Exige ação' },
    { value: 'critical', label: 'Críticos' },
    { value: 'pbqph', label: 'PBQP-H' },
    { value: 'nbr', label: 'NBR 15575' },
    { value: 'all', label: 'Todos' },
  ];
  return (
    <div className="flex flex-wrap gap-2" aria-label="Filtros de conformidade">
      {options.map((option) => (
        <Button
          key={option.value}
          size="sm"
          variant={filter === option.value ? 'default' : 'outline'}
          onClick={() => setFilter(option.value)}
        >
          {option.value === 'action' && <SlidersHorizontal />}
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function ComplianceActionRow({
  item,
  updating,
  validateCompliance,
}: {
  item: ComplianceItem;
  updating: boolean;
  validateCompliance: (checkId: string, status: string) => void;
}) {
  return (
    <div className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_170px] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{item.standardCode}</Badge>
          <span className="text-xs text-muted-foreground">
            {item.occurrenceCode}
          </span>
          {item.severity === 'high' && (
            <span className="text-xs font-medium text-red-700">
              Alta prioridade
            </span>
          )}
        </div>
        <p className="mt-2 text-sm font-medium">{item.requirement}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {item.occurrenceTitle} · {item.location ?? 'Local a confirmar'}
        </p>
      </div>
      <NativeSelect
        value={item.status}
        disabled={updating}
        onChange={(event) => validateCompliance(item.id, event.target.value)}
        aria-label={`Conformidade de ${item.occurrenceCode}`}
      >
        <NativeSelectOption value="pending">Pendente</NativeSelectOption>
        <NativeSelectOption value="compliant">Conforme</NativeSelectOption>
        <NativeSelectOption value="non_compliant">
          Não conforme
        </NativeSelectOption>
        <NativeSelectOption value="not_applicable">
          Não aplicável
        </NativeSelectOption>
      </NativeSelect>
    </div>
  );
}

function NormScope({ items }: { items: ComplianceItem[] }) {
  return (
    <Card className="self-start">
      <CardHeader>
        <CardTitle className="text-lg">Escopo aplicado</CardTitle>
        <CardDescription>
          Referências associadas automaticamente aos relatos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <NormRow
          code="PBQP-H"
          description="Controle, inspeção e rastreabilidade."
          items={items}
        />
        <NormRow
          code="NBR 15575"
          description="Desempenho térmico, acústico, estanqueidade e estrutural."
          items={items}
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          A conclusão técnica continua sob responsabilidade do profissional
          habilitado e da versão contratual aplicável.
        </p>
      </CardContent>
    </Card>
  );
}

function NormRow({
  code,
  description,
  items,
}: {
  code: string;
  description: string;
  items: ComplianceItem[];
}) {
  const standardItems = items.filter((item) => item.standardCode === code);
  return (
    <div className="flex items-start justify-between gap-3 border-b pb-4 last:border-0 last:pb-0">
      <div>
        <p className="text-sm font-medium">{code}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <Badge variant="outline">{standardItems.length} itens</Badge>
    </div>
  );
}

function UpdatesView({
  integration,
  loading,
  openOccurrence,
  projectId,
  projects,
  role,
  setProjectId,
  setUpdateType,
  updateType,
  updates,
}: {
  integration: IntegrationStatus | null;
  loading: boolean;
  openOccurrence: (id: string) => void;
  projectId: string;
  projects: Project[];
  role: Role;
  setProjectId: (id: string) => void;
  setUpdateType: (type: UpdateType) => void;
  updateType: UpdateType;
  updates: ProjectUpdate[];
}) {
  return (
    <>
      <div className="flex flex-col gap-4 py-5 xl:flex-row xl:items-end xl:justify-between">
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Histórico único das mensagens recebidas e enviadas pelo WhatsApp,
          sempre vinculado à obra e à ocorrência correspondente.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {role === 'manager' && (
            <NativeSelect
              className="w-full sm:w-52"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              aria-label="Filtrar atualizações por obra"
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
          )}
          <NativeSelect
            className="w-full sm:w-44"
            value={updateType}
            onChange={(event) =>
              setUpdateType(event.target.value as UpdateType)
            }
            aria-label="Filtrar por tipo de mensagem"
          >
            <NativeSelectOption value="all">
              Todos os formatos
            </NativeSelectOption>
            <NativeSelectOption value="image">Fotos</NativeSelectOption>
            <NativeSelectOption value="audio">Áudios</NativeSelectOption>
            <NativeSelectOption value="text">Textos</NativeSelectOption>
          </NativeSelect>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Central da obra</CardTitle>
                <CardDescription>
                  Texto, fotos, áudios transcritos e respostas da equipe.
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className={
                  integration?.configured
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-amber-200 bg-amber-50 text-amber-800'
                }
              >
                {integration?.configured ? 'Conectado' : 'Webhook pronto'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="divide-y px-0 py-0">
            {updates.map((update) => (
              <UpdateFeedItem
                key={update.id}
                openOccurrence={openOccurrence}
                update={update}
              />
            ))}
            {!loading && updates.length === 0 && (
              <EmptyState text="Nenhuma atualização encontrada neste filtro." />
            )}
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-lg">Como o canal organiza</CardTitle>
            <CardDescription>
              O pedreiro continua usando somente o WhatsApp.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FlowStep
              icon={<MessageCircleMore />}
              title="Telefone identifica a obra"
              description="O número cadastrado direciona a mensagem ao projeto correto."
            />
            <FlowStep
              icon={<Activity />}
              title="Conteúdo vira histórico"
              description="Texto, foto e áudio ficam juntos na ocorrência."
            />
            <FlowStep
              icon={<ShieldCheck />}
              title="Engenharia responde"
              description="Protocolo ou pedido de complemento volta pelo WhatsApp."
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function UpdateFeedItem({
  openOccurrence,
  update,
}: {
  openOccurrence: (id: string) => void;
  update: ProjectUpdate;
}) {
  const outbound = update.direction === 'outbound';
  const icon = getMessageIcon(update.messageType);
  return (
    <article className="px-4 py-4">
      <div className="flex items-start gap-3">
        <div
          className={`grid size-10 shrink-0 place-items-center rounded-lg ${
            outbound
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-amber-50 text-amber-800'
          }`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{update.senderName}</p>
              <p className="text-xs text-muted-foreground">
                {update.projectName ?? 'Obra a confirmar'} ·{' '}
                {formatDate(update.createdAt)}
              </p>
            </div>
            <Badge variant="outline">
              {getMessageTypeLabel(update.messageType, outbound)}
            </Badge>
          </div>
          {update.messageType === 'audio' && (
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-amber-800">
              Transcrição do áudio
            </p>
          )}
          <p className="mt-2 text-sm leading-relaxed">
            {update.body ?? 'Mensagem recebida sem texto.'}
          </p>
          {update.messageType === 'image' &&
            (update.evidenceUrl ? (
              <Image
                src={update.evidenceUrl}
                alt={`Foto enviada em ${update.occurrenceCode ?? 'ocorrência'}`}
                width={640}
                height={320}
                unoptimized
                className="mt-3 h-40 w-full rounded-lg border object-cover"
              />
            ) : (
              <div className="mt-3 flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                <div className="grid size-10 place-items-center rounded-lg bg-amber-50 text-amber-800">
                  <ImageIcon className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">Foto recebida</p>
                  <p className="text-xs text-muted-foreground">
                    Evidência vinculada à ocorrência
                  </p>
                </div>
              </div>
            ))}
          {update.occurrenceId && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 -ml-3"
              onClick={() => openOccurrence(update.occurrenceId!)}
            >
              {update.occurrenceCode ?? 'Abrir ocorrência'} <ChevronRight />
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

function RecentUpdates({
  className = '',
  compact = false,
  openOccurrence,
  openUpdates,
  updates,
}: {
  className?: string;
  compact?: boolean;
  openOccurrence: (id: string) => void;
  openUpdates: (projectId?: string | null) => void;
  updates: ProjectUpdate[];
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-start justify-between gap-3 border-b">
        <div>
          <CardTitle>
            {compact ? 'Atualizações da obra' : 'Pulso do campo'}
          </CardTitle>
          <CardDescription>
            Mensagens recentes recebidas pelo WhatsApp.
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={() => openUpdates()}>
          Ver central <ChevronRight />
        </Button>
      </CardHeader>
      <CardContent className="divide-y px-0 py-0">
        {updates.map((update) => (
          <button
            key={update.id}
            className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/40"
            onClick={() =>
              update.occurrenceId && openOccurrence(update.occurrenceId)
            }
          >
            <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
              {getMessageIcon(update.messageType)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {update.body ?? update.occurrenceTitle ?? 'Nova mensagem'}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {update.senderName} · {update.projectName ?? 'Sem obra'}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatTime(update.createdAt)}
            </span>
          </button>
        ))}
        {updates.length === 0 && (
          <EmptyState text="Nenhuma mensagem recebida." />
        )}
      </CardContent>
    </Card>
  );
}

function WhatsAppView({
  integration,
  loading,
  openUpdates,
}: {
  integration: IntegrationStatus | null;
  loading: boolean;
  openUpdates: () => void;
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
                Canal usado pela equipe de campo, sem aplicativo adicional.
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
              description="Texto, foto ou áudio pelo WhatsApp."
            />
            <IntegrationStep
              number="2"
              title="CiviTek organiza"
              description="Telefone, obra e ocorrência são vinculados."
            />
            <IntegrationStep
              number="3"
              title="Equipe acompanha"
              description="Tudo aparece na central da obra."
            />
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium">Estado atual</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {configured
                ? 'As credenciais estão configuradas e as mensagens podem entrar automaticamente na central.'
                : 'O recebimento e a organização das mensagens estão implementados. Faltam a validação do telefone e as credenciais da Meta.'}
            </p>
          </div>
          <Button variant="outline" onClick={openUpdates}>
            Abrir central de atualizações <ChevronRight />
          </Button>
        </CardContent>
      </Card>
      <Card className="self-start">
        <CardHeader>
          <CardTitle className="text-lg">Contrato do canal</CardTitle>
          <CardDescription>O que a integração já considera.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <CheckRow text="Receber texto, foto e áudio" />
          <CheckRow text="Vincular telefone à obra" />
          <CheckRow text="Agrupar histórico por ocorrência" />
          <CheckRow text="Responder com protocolo" />
          <CheckRow text="Validar assinatura da Meta" />
        </CardContent>
      </Card>
    </div>
  );
}

function ActionPanel({
  items,
  onOpen,
  title,
}: {
  items: ComplianceItem[];
  onOpen?: (id: string) => void;
  title: string;
}) {
  return (
    <Card className="self-start">
      <CardHeader className="border-b">
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>
          Pendências e não conformidades prioritárias.
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y px-0 py-0">
        {items.map((item) => (
          <ComplianceRow
            key={item.id}
            item={item}
            onOpen={onOpen ? () => onOpen(item.occurrenceId) : undefined}
          />
        ))}
        {items.length === 0 && (
          <EmptyState text="Nenhum alerta neste recorte." />
        )}
      </CardContent>
    </Card>
  );
}

function ComplianceRow({
  item,
  onOpen,
}: {
  item: ComplianceItem;
  onOpen?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">
              {item.occurrenceCode}
            </span>
            <Badge variant="outline">{item.standardCode}</Badge>
          </div>
          <p className="mt-2 text-sm font-medium">{item.occurrenceTitle}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {item.projectName ?? 'Sem obra'} · {item.requirement}
          </p>
        </div>
        <ComplianceStatusBadge status={item.status} />
      </div>
    </>
  );
  return onOpen ? (
    <button
      className="w-full px-4 py-4 text-left hover:bg-muted/40"
      onClick={onOpen}
    >
      {content}
    </button>
  ) : (
    <div className="px-4 py-4">{content}</div>
  );
}

function FlowStep({
  description,
  icon,
  title,
}: {
  description: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-800 [&_svg]:size-4">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

function SummaryCard({
  context,
  icon,
  label,
  value,
}: {
  context: string;
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
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        <p className="text-xs text-muted-foreground">{context}</p>
      </CardHeader>
    </Card>
  );
}

function ProjectMetric({
  alert = false,
  label,
  value,
}: {
  alert?: boolean;
  label: string;
  value: string | number;
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
  description,
  number,
  title,
}: {
  description: string;
  number: string;
  title: string;
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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="grid min-h-28 place-items-center px-4 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function SegmentedNavButton({
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
    <button
      type="button"
      aria-pressed={active}
      className={
        active
          ? 'inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-amber-700/40 bg-amber-800 px-3.5 text-sm font-medium text-white shadow-sm'
          : 'inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-transparent bg-transparent px-3.5 text-sm font-medium text-muted-foreground transition hover:border-amber-900/10 hover:bg-amber-900/[0.05] hover:text-foreground'
      }
      onClick={onClick}
    >
      <span className="[&_svg]:size-3.5">{icon}</span>
      {children}
    </button>
  );
}

function OccurrenceStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    new: 'border-amber-200 bg-amber-50 text-amber-800',
    in_progress: 'border-sky-200 bg-sky-50 text-sky-800',
    validation: 'border-violet-200 bg-violet-50 text-violet-800',
    closed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    needs_context: 'border-rose-200 bg-rose-50 text-rose-800',
  };
  return (
    <Badge variant="outline" className={styles[status] ?? styles.new}>
      {occurrenceStatusLabels[status] ?? status}
    </Badge>
  );
}

function ComplianceStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'border-amber-200 bg-amber-50 text-amber-800',
    compliant: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    non_compliant: 'border-red-200 bg-red-50 text-red-800',
    not_applicable: 'border-slate-200 bg-slate-50 text-slate-700',
  };
  return (
    <Badge
      variant="outline"
      className={`shrink-0 ${styles[status] ?? styles.pending}`}
    >
      {complianceStatusLabels[status] ?? status}
    </Badge>
  );
}

function getNavItems(role: Role) {
  if (role === 'manager') {
    return [
      {
        view: 'dashboard' as View,
        label: 'Resumo',
        icon: <LayoutDashboard />,
      },
      {
        view: 'projects' as View,
        label: 'Obras',
        icon: <Building2 />,
      },
      {
        view: 'compliance' as View,
        label: 'Conformidade',
        icon: <BookOpenCheck />,
      },
      {
        view: 'updates' as View,
        label: 'Atualizações',
        icon: <MessagesSquare />,
      },
      {
        view: 'whatsapp' as View,
        label: 'Integração',
        icon: <MessageCircleMore />,
      },
    ];
  }
  return [
    {
      view: 'dashboard' as View,
      label: 'Resumo',
      icon: <LayoutDashboard />,
    },
    {
      view: 'occurrences' as View,
      label: 'Ocorrências',
      icon: <ClipboardCheck />,
    },
    {
      view: 'compliance' as View,
      label: 'Conformidade',
      icon: <BookOpenCheck />,
    },
    {
      view: 'updates' as View,
      label: 'Atualizações',
      icon: <MessagesSquare />,
    },
    {
      view: 'whatsapp' as View,
      label: 'Integração',
      icon: <MessageCircleMore />,
    },
  ];
}

function filterComplianceItems(
  items: ComplianceItem[],
  filter: ComplianceFilter,
) {
  if (filter === 'action')
    return items.filter((item) =>
      ['pending', 'non_compliant'].includes(item.status),
    );
  if (filter === 'critical')
    return items.filter(
      (item) =>
        item.severity === 'high' &&
        ['pending', 'non_compliant'].includes(item.status),
    );
  if (filter === 'pbqph')
    return items.filter((item) => item.standardCode === 'PBQP-H');
  if (filter === 'nbr')
    return items.filter((item) => item.standardCode === 'NBR 15575');
  return items;
}

function getResolvedComplianceRate(items: ComplianceItem[]) {
  const resolved = items.filter((item) =>
    ['compliant', 'non_compliant'].includes(item.status),
  );
  if (resolved.length === 0) return 0;
  return Math.round(
    (resolved.filter((item) => item.status === 'compliant').length /
      resolved.length) *
      100,
  );
}

function getMessageIcon(messageType: string) {
  if (messageType === 'image') return <ImageIcon className="size-4" />;
  if (messageType === 'audio') return <AudioLines className="size-4" />;
  return <FileText className="size-4" />;
}

function getMessageTypeLabel(messageType: string, outbound: boolean) {
  if (outbound) return 'Resposta enviada';
  if (messageType === 'image') return 'Foto';
  if (messageType === 'audio') return 'Áudio transcrito';
  return 'Texto';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
