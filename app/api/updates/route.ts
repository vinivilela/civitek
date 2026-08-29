import { listProjectHistory, listProjectUpdates } from '@/db/repository';
import { getTenantScope } from '@/lib/tenant';

export async function GET() {
  const scope = await getTenantScope();
  if (!scope) {
    return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const [updates, history] = await Promise.all([
      listProjectUpdates(scope),
      listProjectHistory(scope),
    ]);
    return Response.json({ updates, history });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Falha ao listar atualizações.',
      },
      { status: 500 },
    );
  }
}
