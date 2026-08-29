import { getChatGPTUser } from '@/app/chatgpt-auth';
import { updateComplianceCheck, updateOccurrenceStatus } from '@/db/repository';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await getChatGPTUser())) {
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
        body.complianceCheckId,
        body.complianceStatus ?? '',
        body.engineerNote,
      );
    } else {
      await updateOccurrenceStatus(id, body.status ?? '');
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
