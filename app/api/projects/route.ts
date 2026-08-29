import { getChatGPTUser } from '@/app/chatgpt-auth';
import { listProjects } from '@/db/repository';

export async function GET() {
  if (!(await getChatGPTUser())) {
    return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const projects = await listProjects();
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
