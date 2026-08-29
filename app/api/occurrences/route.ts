import { getChatGPTUser } from '@/app/chatgpt-auth';
import { listOccurrences } from '@/db/repository';

export async function GET() {
  if (!(await getChatGPTUser())) {
    return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const occurrences = await listOccurrences();
    return Response.json({ occurrences });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Falha ao listar ocorrências.' },
      { status: 500 },
    );
  }
}
