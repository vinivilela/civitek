import { getDb } from '@/db/index';
import { aiInteractions } from '@/db/schema';
import { buildMemoryReport } from '@/lib/ai/insights';
import { getTenantScope, startMemoryTrial } from '@/lib/tenant';

export async function GET(request: Request) {
  const scope = await getTenantScope();
  if (!scope) {
    return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const report = await buildMemoryReport(scope, {
      query: url.searchParams.get('q') ?? '',
      forceRefresh: url.searchParams.get('refresh') === '1',
    });
    return Response.json({ report, company: scope.companyName });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Falha ao montar o relatório de memória.',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const scope = await getTenantScope();
  if (!scope) {
    return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      action?: string;
      insightId?: string;
      accepted?: boolean;
    };

    if (body.action === 'start-trial') {
      // Opens the window where the report is readable on the free plan. The
      // customer sees the real thing before deciding, and a second call never
      // extends it.
      await startMemoryTrial(scope);
      const refreshed = await getTenantScope();
      const report = await buildMemoryReport(refreshed ?? scope);
      return Response.json({ report });
    }

    if (body.action === 'feedback') {
      if (!body.insightId || typeof body.accepted !== 'boolean') {
        throw new Error('Informe o insight e se ele foi aceito.');
      }
      // Layer L4: the accept and reject signal that reorders later insights.
      await getDb()
        .insert(aiInteractions)
        .values({
          id: crypto.randomUUID(),
          companyId: scope.companyId,
          projectId: null,
          occurrenceId: null,
          kind: `insight_feedback:${body.insightId}`,
          tier: scope.entitlements.memory ? 'memory' : 'generic',
          model: 'n/a',
          inputTokens: 0,
          cachedInputTokens: 0,
          outputTokens: 0,
          costMicros: 0,
          accepted: body.accepted,
          createdAt: new Date().toISOString(),
        });
      return Response.json({ ok: true });
    }

    throw new Error('Ação não reconhecida.');
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Falha ao processar a ação.',
      },
      { status: 400 },
    );
  }
}
