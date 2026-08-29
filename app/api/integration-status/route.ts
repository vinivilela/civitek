import { getChatGPTUser } from '@/app/chatgpt-auth';

const requiredVariables = [
  'WHATSAPP_VERIFY_TOKEN',
  'WHATSAPP_APP_SECRET',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_API_VERSION',
];

export async function GET() {
  if (!(await getChatGPTUser())) {
    return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const configured = requiredVariables.every((key) =>
    Boolean(process.env[key]),
  );
  return Response.json({
    provider: 'WhatsApp Cloud API',
    configured,
    webhookPath: '/api/whatsapp/webhook',
  });
}
