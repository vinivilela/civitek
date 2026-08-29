import { getChatGPTUser } from '@/app/chatgpt-auth';
import { updateProjectBaseline } from '@/db/repository';

const allowedStages = new Set([
  'Planejamento',
  'Fundação',
  'Estrutura',
  'Vedações',
  'Instalações',
  'Acabamentos',
  'Entrega',
]);

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
      pilotStartedAt?: string;
      currentStage?: string;
      summary?: string;
      responsibleEngineer?: string;
    };
    const pilotStartedAt = body.pilotStartedAt?.trim() ?? '';
    const currentStage = body.currentStage?.trim() ?? '';
    const summary = body.summary?.trim() ?? '';
    const responsibleEngineer = body.responsibleEngineer?.trim() || null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(pilotStartedAt)) {
      throw new Error('Informe a data de início do piloto.');
    }
    if (!allowedStages.has(currentStage)) {
      throw new Error('Selecione uma etapa válida da obra.');
    }
    if (summary.length < 12 || summary.length > 500) {
      throw new Error('O contexto inicial deve ter entre 12 e 500 caracteres.');
    }
    if (responsibleEngineer && responsibleEngineer.length > 80) {
      throw new Error('O nome do responsável deve ter até 80 caracteres.');
    }

    await updateProjectBaseline(id, {
      pilotStartedAt,
      currentStage,
      summary,
      responsibleEngineer,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Falha ao atualizar o marco zero.',
      },
      { status: 400 },
    );
  }
}
