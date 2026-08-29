"use client";

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
  Settings2,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Occurrence = {
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
  projectName: string | null;
  automaticSummary: string | null;
  normativeReference: string | null;
  createdAt: string;
  evidenceCount: number;
  evidenceUrl: string | null;
};

const statusLabels: Record<string, string> = {
  new: 'Nova',
  in_progress: 'Em tratamento',
  validation: 'Aguardando validação',
  closed: 'Encerrada',
  needs_context: 'Sem obra vinculada',
};

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

export default function Home() {
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadOccurrences(preferredId?: string) {
    const response = await fetch('/api/occurrences', { cache: 'no-store' });
    if (!response.ok) throw new Error('Não foi possível carregar as ocorrências.');
    const data = (await response.json()) as { occurrences: Occurrence[] };
    setOccurrences(data.occurrences);
    setSelectedId((current) => {
      if (preferredId && data.occurrences.some((item) => item.id === preferredId)) {
        return preferredId;
      }
      if (current && data.occurrences.some((item) => item.id === current)) {
        return current;
      }
      return data.occurrences[0]?.id ?? null;
    });
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadOccurrences()
        .catch((error: unknown) =>
          setNotice(error instanceof Error ? error.message : 'Falha ao carregar dados.'),
        )
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const selected =
    occurrences.find((occurrence) => occurrence.id === selectedId) ?? null;
  const filtered = useMemo(() => {
    const normalized = query.toLocaleLowerCase('pt-BR').trim();
    if (!normalized) return occurrences;
    return occurrences.filter((occurrence) =>
      [
        occurrence.code,
        occurrence.title,
        occurrence.location,
        occurrence.reporterName,
        occurrence.projectName,
      ]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase('pt-BR').includes(normalized)),
    );
  }, [occurrences, query]);

  const stats = {
    new: occurrences.filter((item) => item.status === 'new').length,
    inProgress: occurrences.filter((item) => item.status === 'in_progress').length,
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
      if (!response.ok) throw new Error('Não foi possível atualizar a ocorrência.');
      await loadOccurrences(selected.id);
      setNotice(selected.code + ' encaminhada para tratamento.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Falha ao atualizar.');
    } finally {
      setUpdating(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-[224px_minmax(0,1fr)]">
        <aside className="hidden border-r border-sidebar-border bg-sidebar px-4 py-5 text-sidebar-foreground lg:flex lg:flex-col">
          <div className="flex items-center gap-3 px-2">
            <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <HardHat className="size-5" />
            </div>
            <div>
              <p className="font-heading text-[15px] font-semibold tracking-tight">Civitek</p>
              <p className="text-xs text-sidebar-foreground/65">Obra Aurora</p>
            </div>
          </div>

          <nav className="mt-9 space-y-1" aria-label="Navegação principal">
            <Button variant="ghost" className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <LayoutDashboard /> Visão geral
            </Button>
            <Button className="w-full justify-start bg-sidebar-primary text-sidebar-primary-foreground">
              <ClipboardCheck /> Ocorrências
            </Button>
            <Button variant="ghost" className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <Building2 /> Obras
            </Button>
            <Button variant="ghost" className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <MessageCircleMore /> Canal WhatsApp
            </Button>
          </nav>

          <div className="mt-auto rounded-xl border border-sidebar-border bg-white/[0.06] p-3">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-400" />
              <p className="text-xs font-semibold">Webhook preparado</p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-sidebar-foreground/65">
              Textos e fotos entram na mesma fila de ocorrências.
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
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Qualidade em campo</p>
                <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight">Ocorrências</h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="h-8 border-emerald-200 bg-emerald-50 px-3 text-emerald-800">
                <span className="size-1.5 rounded-full bg-emerald-500" /> Integração preparada
              </Badge>
              <Button variant="outline" size="icon" aria-label="Configurações">
                <Settings2 />
              </Button>
            </div>
          </header>

          {notice && (
            <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-950">
              {notice}
            </div>
          )}

          <div className="grid gap-3 py-5 sm:grid-cols-3">
            <SummaryCard icon={<CircleAlert className="size-4 text-amber-600" />} label="Novas" value={loading ? '—' : stats.new} />
            <SummaryCard icon={<Clock3 className="size-4 text-sky-700" />} label="Em tratamento" value={loading ? '—' : stats.inProgress} />
            <SummaryCard icon={<CheckCircle2 className="size-4 text-emerald-700" />} label="Encerradas" value={loading ? '—' : stats.closed} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Card className="min-w-0">
              <CardHeader className="border-b">
                <CardTitle>Caixa de entrada</CardTitle>
                <CardDescription>Relatos recebidos do canteiro e organizados para triagem.</CardDescription>
                <div className="mt-3 flex gap-2 sm:col-span-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      placeholder="Buscar ocorrência, local ou responsável"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </div>
                  <Button variant="outline"><Settings2 /> Filtros</Button>
                </div>
              </CardHeader>
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Ocorrência</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Recebida</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((occurrence) => (
                      <TableRow
                        key={occurrence.id}
                        className={selectedId === occurrence.id ? 'bg-primary/[0.04]' : 'cursor-pointer'}
                        onClick={() => setSelectedId(occurrence.id)}
                      >
                        <TableCell className="max-w-[360px] pl-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border bg-muted text-xs font-semibold text-muted-foreground">
                              {occurrence.code.slice(-2)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="truncate font-medium">{occurrence.title}</p>
                                {occurrence.severity === 'high' && <span className="size-1.5 shrink-0 rounded-full bg-red-500" />}
                              </div>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {occurrence.code} · {occurrence.location ?? occurrence.projectName ?? 'Local a confirmar'}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground md:hidden">
                                {occurrence.reporterName} · {formatDate(occurrence.createdAt)}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><StatusBadge status={occurrence.status} /></TableCell>
                        <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                          <p>{occurrence.reporterName}</p>
                          <p>{formatDate(occurrence.createdAt)}</p>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon-sm" aria-label={'Abrir ' + occurrence.code}>
                            {selectedId === occurrence.id ? <ChevronRight /> : <MoreHorizontal />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!loading && filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="h-28 text-center text-muted-foreground">
                          Nenhuma ocorrência encontrada.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="self-start">
              {selected ? (
                <>
                  <CardHeader className="border-b">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground">{selected.code}</p>
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
                            {selected.evidenceCount > 0 ? 'Foto registrada no relato' : 'Relato recebido pelo WhatsApp'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(selected.createdAt)} · {selected.reporterName}
                          </p>
                        </div>
                      </div>
                    )}

                    {selected.automaticSummary && (
                      <div className="rounded-lg border border-teal-200 bg-teal-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">Triagem assistida</p>
                        <p className="mt-1 text-sm leading-relaxed text-teal-950">
                          {selected.automaticSummary}
                        </p>
                      </div>
                    )}

                    <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-3 text-sm">
                      <dt className="text-muted-foreground">Obra</dt>
                      <dd className="font-medium">{selected.projectName ?? 'A confirmar'}</dd>
                      <dt className="text-muted-foreground">Local</dt>
                      <dd className="font-medium">{selected.location ?? 'Não informado'}</dd>
                      <dt className="text-muted-foreground">Categoria</dt>
                      <dd className="font-medium">{selected.category}</dd>
                      <dt className="text-muted-foreground">Relato</dt>
                      <dd className="leading-relaxed">“{selected.description}”</dd>
                    </dl>

                    {selected.normativeReference && (
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <p className="text-xs font-semibold text-muted-foreground">REFERÊNCIA TÉCNICA</p>
                        <p className="mt-1 text-sm leading-relaxed">{selected.normativeReference}</p>
                      </div>
                    )}

                    <Button
                      size="lg"
                      className="w-full"
                      onClick={moveToTreatment}
                      disabled={updating || selected.status === 'in_progress'}
                    >
                      {updating ? <LoaderCircle className="animate-spin" /> : null}
                      {selected.status === 'in_progress' ? 'Em tratamento' : 'Validar e encaminhar'}
                      {!updating && selected.status !== 'in_progress' ? <ChevronRight /> : null}
                    </Button>
                  </CardContent>
                </>
              ) : (
                <CardContent className="grid h-72 place-items-center text-sm text-muted-foreground">
                  {loading ? <LoaderCircle className="animate-spin" /> : 'Selecione uma ocorrência.'}
                </CardContent>
              )}
            </Card>
          </div>
        </section>
      </div>
    </main>
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
