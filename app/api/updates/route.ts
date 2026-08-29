import { getChatGPTUser } from '@/app/chatgpt-auth';
import { listProjectUpdates } from '@/db/repository';

export async function GET() {
  if (!(await getChatGPTUser())) {
    return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const updates = await listProjectUpdates();
    return Response.json({ updates });
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
