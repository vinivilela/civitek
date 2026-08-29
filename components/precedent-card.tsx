'use client';

import { useEffect, useState } from 'react';
import { History, Lightbulb, Lock, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type Precedent = {
  id: string;
  code: string;
  title: string;
  location: string | null;
  projectName: string | null;
  status: string;
  createdAt: string;
  daysToClose: number | null;
  resolution: string | null;
};

type PrecedentReport = {
  occurrenceId: string;
  hasHistory: boolean;
  timesSeen: number | null;
  resolvedCount: number | null;
  avgDaysToClose: number | null;
  samePlaceCount: number | null;
  precedents: Precedent[];
  proposedSolution: string | null;
  suggestedTreatment: string[];
  guidance: { standardCode: string; title: string; text: string };
  unlocked: boolean;
  headline: string;
};

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

export default function PrecedentCard({
  occurrenceId,
}: {
  occurrenceId: string;
}) {
  const [report, setReport] = useState<PrecedentReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      fetch(`/api/occurrences/${occurrenceId}/insight`, { cache: 'no-store' })
        .then(async (response) => {
          const data = (await response.json()) as {
            report?: PrecedentReport | null;
          };
          if (active) setReport(data.report ?? null);
        })
        .catch(() => {
          if (active) setReport(null);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [occurrenceId]);

  if (loading) {
    return (
      <div className="rounded-lg border border-dashed p-3">
        <p className="text-xs font-semibold text-muted-foreground">
          MEMÓRIA DA OBRA
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Procurando casos parecidos no seu histórico...
        </p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="rounded-lg border border-dashed p-3">
        <p className="text-xs font-semibold text-muted-foreground">
          MEMÓRIA DA OBRA
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Não foi possível consultar o histórico agora.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/40">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-sky-800 dark:text-sky-300">
          <History className="size-3.5" />
          MEMÓRIA DA OBRA
        </p>
        {!report.unlocked && report.hasHistory && (
          <Badge className="gap-1" variant="secondary">
            <Lock className="size-3" />
            Bloqueado
          </Badge>
        )}
      </div>

      <p className="text-sm font-medium leading-relaxed text-sky-950 dark:text-sky-100">
        {report.headline}
      </p>

      {report.unlocked && report.avgDaysToClose !== null && (
        <p className="text-xs text-sky-900/80 dark:text-sky-200/80">
          {report.resolvedCount} já foram encerradas, em média em{' '}
          {report.avgDaysToClose} dias.
        </p>
      )}

      {report.proposedSolution && (
        <div className="rounded-md border border-sky-200 bg-white p-2.5 dark:border-sky-900 dark:bg-sky-950">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-sky-800 dark:text-sky-300">
            <Sparkles className="size-3.5" />
            O QUE RESOLVEU DAS OUTRAS VEZES
          </p>
          <p className="mt-1 text-sm leading-relaxed text-sky-950 dark:text-sky-100">
            {report.proposedSolution}
          </p>
        </div>
      )}

      {report.suggestedTreatment.length > 0 && (
        <div className="rounded-md border border-sky-200 bg-white p-2.5 dark:border-sky-900 dark:bg-sky-950">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-sky-800 dark:text-sky-300">
            <Lightbulb className="size-3.5" />
            {report.hasHistory ? 'O QUE A NORMA PEDE' : 'POSSÍVEL SOLUÇÃO'}
          </p>
          <ol className="mt-1.5 space-y-1.5">
            {report.suggestedTreatment.map((step, index) => (
              <li
                className="flex gap-2 text-sm leading-relaxed text-sky-950 dark:text-sky-100"
                key={step}
              >
                <span className="shrink-0 font-semibold tabular-nums text-sky-700 dark:text-sky-400">
                  {index + 1}.
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          {!report.hasHistory && (
            <p className="mt-2 text-xs leading-relaxed text-sky-900/70 dark:text-sky-200/70">
              Sem histórico para comparar, esta sugestão vem das boas práticas
              da norma. Quando um caso parecido for encerrado, o CiviTek passa a
              propor o que a sua própria equipe aplicou.
            </p>
          )}
        </div>
      )}

      {report.precedents.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-sky-800 dark:text-sky-300">
            CASOS PARECIDOS
          </p>
          {report.precedents.map((precedent) => (
            <div
              className="flex items-baseline justify-between gap-3 text-xs"
              key={precedent.id}
            >
              <span className="min-w-0 flex-1 truncate text-sky-950 dark:text-sky-100">
                <span className="font-medium">{precedent.code}</span>{' '}
                {precedent.location ?? precedent.title}
              </span>
              <span className="shrink-0 tabular-nums text-sky-900/70 dark:text-sky-200/70">
                {precedent.daysToClose === null
                  ? 'em aberto'
                  : `${precedent.daysToClose} d`}{' '}
                · {formatShortDate(precedent.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}

      {!report.unlocked && report.hasHistory && (
        <p className="text-xs leading-relaxed text-sky-900/80 dark:text-sky-200/80">
          O plano gratuito conta os casos, mas não abre o que resolveu cada um.
          Desbloqueie a memória para ver o tratamento aplicado e o prazo real.
        </p>
      )}

      <div className="border-t border-sky-200 pt-2 dark:border-sky-900">
        <p className="text-xs font-semibold text-sky-800 dark:text-sky-300">
          {report.guidance.standardCode} · {report.guidance.title}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-sky-900/80 dark:text-sky-200/80">
          {report.guidance.text}
        </p>
      </div>
    </div>
  );
}
