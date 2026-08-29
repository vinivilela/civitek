import { getChatGPTUser } from '@/app/chatgpt-auth';
import { listProjectHistory, listProjectUpdates } from '@/db/repository';

export async function GET() {
  if (!(await getChatGPTUser())) {
    return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const [updates, history] = await Promise.all([
      listProjectUpdates(),
      listProjectHistory(),
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
