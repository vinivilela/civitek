import { listProjects } from '@/db/repository';
import { getTenantScope } from '@/lib/tenant';

export async function GET() {
  const scope = await getTenantScope();
  if (!scope) {
    return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const projects = await listProjects(scope);
    return Response.json({ projects });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Falha ao listar obras.',
      },
      { status: 500 },
    );
  }
}
