'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Brain,
  Check,
  Lock,
  RefreshCw,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Timer,
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
import { Progress } from '@/components/ui/progress';

type Insight = {
  id: string;
  layer: 'knowledge' | 'memory';
  headline: string;
  detail: string | null;
  maskedDetail: string;
  standardCode: string | null;
  locked: boolean;
};

type MemoryReport = {
  plan: 'free' | 'premium';
  memoryUnlocked: boolean;
  memoryTrial: boolean;
  memoryTrialEndsAt: string | null;
  atConversionMoment: boolean;
  learned: {
    projectCount: number;
    occurrenceCount: number;
    messageCount: number;
    patternCount: number;
    projectQuota: number;
  };
  insights: Insight[];
  costMicros: number;
  computedAt: string;
};

function formatRemaining(endsAt: string) {
  const ms = Date.parse(endsAt) - Date.now();
  if (ms <= 0) return 'encerrada';
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours >= 1) return `${hours} h restantes`;
  return `${Math.max(1, Math.floor(ms / (60 * 1000)))} min restantes`;
}

export default function MemoryPanel() {
  const [report, setReport] = useState<MemoryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rated, setRated] = useState<Record<string, boolean>>({});

  const load = useCallback(async (refresh = false) => {
    try {
      const response = await fetch(
        `/api/ai/memory${refresh ? '?refresh=1' : ''}`,
        { cache: 'no-store' },
      );
      const data = (await response.json()) as {
        report?: MemoryReport;
        error?: string;
      };
      if (!response.ok || !data.report) {
        throw new Error(data.error ?? 'Falha ao carregar a memória.');
      }
      setReport(data.report);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao carregar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function startTrial() {
    setWorking(true);
    try {
      const response = await fetch('/api/ai/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start-trial' }),
      });
      const data = (await response.json()) as {
        report?: MemoryReport;
        error?: string;
      };
      if (!response.ok || !data.report) {
        throw new Error(data.error ?? 'Falha ao liberar o relatório.');
      }
      setReport(data.report);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao liberar.');
    } finally {
      setWorking(false);
    }
  }

  async function rate(insightId: string, accepted: boolean) {
    setRated((current) => ({ ...current, [insightId]: accepted }));
    await fetch('/api/ai/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'feedback', insightId, accepted }),
    });
  }

  if (loading) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Memória da construtora</CardTitle>
          <CardDescription>Lendo o histórico das suas obras...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error || !report) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Memória da construtora</CardTitle>
          <CardDescription>{error ?? 'Nada para mostrar.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => void load()} variant="outline">
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  const memoryInsights = report.insights.filter(
    (insight) => insight.layer === 'memory',
  );
  const knowledgeInsights = report.insights.filter(
    (insight) => insight.layer === 'knowledge',
  );
  const quotaUsed = Math.min(
    100,
    Math.round(
      (report.learned.projectCount / Math.max(1, report.learned.projectQuota)) *
        100,
    ),
  );

  return (
    <div className="mt-4 flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="size-5" />
                Memória da construtora
              </CardTitle>
              <CardDescription>
                O que o CiviTek já aprendeu com as suas obras.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {report.memoryTrial && report.memoryTrialEndsAt && (
                <Badge className="gap-1" variant="secondary">
                  <Timer className="size-3" />
                  Relatório aberto, {formatRemaining(report.memoryTrialEndsAt)}
                </Badge>
              )}
              <Badge variant={report.memoryUnlocked ? 'default' : 'outline'}>
                {report.plan === 'premium' ? 'Premium' : 'Gratuito'}
              </Badge>
              <Button
                onClick={() => void load(true)}
                size="sm"
                variant="ghost"
                aria-label="Recalcular a memória"
              >
                <RefreshCw className="size-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Counter label="Obras" value={report.learned.projectCount} />
            <Counter
              label="Ocorrências analisadas"
              value={report.learned.occurrenceCount}
            />
            <Counter
              label="Mensagens processadas"
              value={report.learned.messageCount}
            />
            <Counter
              label="Padrões identificados"
              value={report.learned.patternCount}
            />
          </div>

          {report.plan === 'free' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {report.learned.projectCount} de {report.learned.projectQuota}{' '}
                  obras no plano gratuito
                </span>
                <span>{quotaUsed}%</span>
              </div>
              <Progress value={quotaUsed} />
              <p className="text-xs text-muted-foreground">
                O registro das obras e das ocorrências continua liberado depois
                do limite. O que o plano gratuito não abre é a leitura do seu
                próprio histórico.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {report.atConversionMoment && !report.memoryUnlocked && (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          <CardHeader>
            <CardTitle>Seu histórico já tem o que responder</CardTitle>
            <CardDescription>
              São {report.learned.occurrenceCount} ocorrências em{' '}
              {report.learned.projectCount} obras. Abra o relatório completo por
              72 horas e confira os números antes de decidir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled={working} onClick={() => void startTrial()}>
              {working ? 'Abrindo...' : 'Abrir o relatório por 72 horas'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Insights do seu histórico</CardTitle>
          <CardDescription>
            Números calculados sobre as suas obras, não gerados por modelo.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {memoryInsights.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Ainda não há histórico suficiente. Os primeiros padrões aparecem
              por volta da quarta obra registrada.
            </p>
          )}
          {memoryInsights.map((insight) => (
            <div
              className="rounded-lg border border-border bg-card p-3"
              key={insight.id}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{insight.headline}</span>
                {insight.standardCode && (
                  <Badge variant="outline">{insight.standardCode}</Badge>
                )}
                {insight.locked && (
                  <Badge className="gap-1" variant="secondary">
                    <Lock className="size-3" />
                    Bloqueado
                  </Badge>
                )}
              </div>
              <p
                className={`mt-1 text-sm ${
                  insight.locked
                    ? 'text-muted-foreground'
                    : 'text-foreground/90'
                }`}
              >
                {insight.detail ?? insight.maskedDetail}
              </p>
              {!insight.locked && (
                <div className="mt-2 flex items-center gap-1">
                  {rated[insight.id] === undefined ? (
                    <>
                      <Button
                        onClick={() => void rate(insight.id, true)}
                        size="sm"
                        variant="ghost"
                      >
                        <ThumbsUp className="size-4" />
                        Útil
                      </Button>
                      <Button
                        onClick={() => void rate(insight.id, false)}
                        size="sm"
                        variant="ghost"
                      >
                        <ThumbsDown className="size-4" />
                        Não se aplica
                      </Button>
                    </>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Check className="size-3" />
                      Resposta registrada
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5" />
            Base normativa
          </CardTitle>
          <CardDescription>
            Orientação geral, disponível em todos os planos.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {knowledgeInsights.map((insight) => (
            <div
              className="rounded-lg border border-border bg-card p-3"
              key={insight.id}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{insight.headline}</span>
                {insight.standardCode && (
                  <Badge variant="outline">{insight.standardCode}</Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-foreground/90">
                {insight.detail}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
