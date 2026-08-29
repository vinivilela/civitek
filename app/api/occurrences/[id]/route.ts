import { updateComplianceCheck, updateOccurrenceStatus } from '@/db/repository';
import { getTenantScope } from '@/lib/tenant';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const scope = await getTenantScope();
  if (!scope) {
    return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      status?: string;
      complianceCheckId?: string;
      complianceStatus?: string;
      engineerNote?: string;
    };

    if (body.complianceCheckId) {
      await updateComplianceCheck(
        scope,
        body.complianceCheckId,
        body.complianceStatus ?? '',
        body.engineerNote,
      );
    } else {
      await updateOccurrenceStatus(scope, id, body.status ?? '');
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Falha ao atualizar ocorrência.',
      },
      { status: 400 },
    );
  }
}
