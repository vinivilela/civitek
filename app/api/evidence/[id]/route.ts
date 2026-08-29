import { env } from 'cloudflare:workers';
import { getEvidenceObjectKey } from '@/db/repository';
import { getTenantScope } from '@/lib/tenant';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const scope = await getTenantScope();
  if (!scope) {
    return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const { id } = await context.params;
  const objectKey = await getEvidenceObjectKey(scope, id);
  if (!objectKey) {
    return Response.json(
      { error: 'Evidência não encontrada.' },
      { status: 404 },
    );
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
