import { listOccurrences } from '@/db/repository';
import { getTenantScope } from '@/lib/tenant';

export async function GET() {
  const scope = await getTenantScope();
  if (!scope) {
    return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const occurrences = await listOccurrences(scope);
    return Response.json({ occurrences });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Falha ao listar ocorrências.',
      },
      { status: 500 },
    );
  }
}
