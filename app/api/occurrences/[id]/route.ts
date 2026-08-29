import { updateOccurrenceStatus } from '@/db/repository';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { status?: string };
    await updateOccurrenceStatus(id, body.status ?? '');
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Falha ao atualizar ocorrência.' },
      { status: 400 },
    );
  }
}
