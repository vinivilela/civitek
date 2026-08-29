import { buildPrecedentReport } from '@/lib/ai/precedent';
import { getTenantScope } from '@/lib/tenant';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const scope = await getTenantScope();
  if (!scope) {
    return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const report = await buildPrecedentReport(scope, id);
    // No precedent is a valid answer, not an error: a first occurrence of its
    // kind should say so instead of showing an empty card.
    return Response.json({ report });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Falha ao consultar o histórico.',
      },
      { status: 500 },
    );
  }
}
