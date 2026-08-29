import {
  processWhatsAppPayload,
  verifyWebhookSignature,
} from '@/lib/whatsapp';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (
    mode === 'subscribe' &&
    verifyToken &&
    token === verifyToken &&
    challenge
  ) {
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return Response.json({ error: 'Webhook não verificado.' }, { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');
  const valid = await verifyWebhookSignature(rawBody, signature);

  if (!valid) {
    return Response.json({ error: 'Assinatura inválida.' }, { status: 401 });
  }

  try {
    const result = await processWhatsAppPayload(JSON.parse(rawBody));
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Falha ao processar webhook.' },
      { status: 500 },
    );
  }
}
