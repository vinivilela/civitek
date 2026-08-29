import { env } from 'cloudflare:workers';
import { getEvidenceObjectKey } from '@/db/repository';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const objectKey = await getEvidenceObjectKey(id);
  if (!objectKey) {
    return Response.json({ error: 'Evidência não encontrada.' }, { status: 404 });
  }

  const object = await env.FILES.get(objectKey);
  if (!object) {
    return Response.json({ error: 'Arquivo não encontrado.' }, { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'private, max-age=300');
  return new Response(object.body, { headers });
}
