import { env } from 'cloudflare:workers';
import {
  addEvidence,
  createOccurrenceFromWhatsApp,
  recordOutboundMessage,
} from '@/db/repository';

type WebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        contacts?: Array<{
          wa_id?: string;
          profile?: { name?: string };
        }>;
        messages?: Array<{
          id?: string;
          from?: string;
          type?: string;
          text?: { body?: string };
          image?: {
            id?: string;
            caption?: string;
            mime_type?: string;
            sha256?: string;
          };
        }>;
      };
    }>;
  }>;
};

type ParsedMessage = {
  id: string;
  from: string;
  contactName: string | null;
  type: string;
  text: string;
  image: {
    id: string;
    mimeType: string | null;
    sha256: string | null;
  } | null;
};

export async function verifyWebhookSignature(
  body: string,
  signature: string | null,
) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !signature?.startsWith('sha256=')) return false;

  const supplied = hexToBytes(signature.slice(7));
  if (!supplied) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  return crypto.subtle.verify(
    'HMAC',
    key,
    supplied,
    new TextEncoder().encode(body),
  );
}

export async function processWhatsAppPayload(payload: unknown) {
  const messages = parseMessages(payload);
  const results = [];

  for (const message of messages) {
    const occurrence = await createOccurrenceFromWhatsApp({
      messageId: message.id,
      phoneE164: message.from,
      contactName: message.contactName,
      messageType: message.type,
      text: message.text,
      rawPayload: JSON.stringify(payload),
    });

    if (!occurrence.created) {
      results.push({ code: occurrence.code, duplicate: true });
      continue;
    }

    if (message.image) {
      const stored = await storeWhatsAppImage(
        occurrence.companyId,
        occurrence.id,
        message.image,
      );
      await addEvidence({
        companyId: occurrence.companyId,
        occurrenceId: occurrence.id,
        objectKey: stored.objectKey,
        providerMediaId: message.image.id,
        mimeType: stored.mimeType ?? message.image.mimeType,
        sha256: message.image.sha256,
      });
    }

    const acknowledgement = occurrence.projectName
      ? `Recebi seu relato como ${occurrence.code} na ${occurrence.projectName}. A equipe de qualidade já pode acompanhar pelo painel.`
      : `Recebi seu relato como ${occurrence.code}. Ainda não encontrei seu telefone vinculado a uma obra; a equipe fará a triagem.`;
    const delivery = await sendTextMessage(message.from, acknowledgement);

    await recordOutboundMessage({
      companyId: occurrence.companyId,
      phoneE164: message.from,
      occurrenceId: occurrence.id,
      body: acknowledgement,
      providerMessageId: delivery.messageId,
      deliveryStatus: delivery.status,
    });

    results.push({
      code: occurrence.code,
      duplicate: false,
      acknowledgement: delivery.status,
    });
  }

  return { received: messages.length, results };
}

function parseMessages(payload: unknown): ParsedMessage[] {
  const data = payload as WebhookPayload;
  const messages: ParsedMessage[] = [];

  for (const entry of data.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const contacts = new Map(
        (value?.contacts ?? [])
          .filter((contact) => contact.wa_id)
          .map((contact) => [
            contact.wa_id as string,
            contact.profile?.name ?? null,
          ]),
      );

      for (const message of value?.messages ?? []) {
        if (!message.id || !message.from) continue;
        const imageId = message.image?.id;
        messages.push({
          id: message.id,
          from: normalizePhone(message.from),
          contactName: contacts.get(message.from) ?? null,
          type: message.type ?? 'unknown',
          text: message.text?.body ?? message.image?.caption ?? '',
          image: imageId
            ? {
                id: imageId,
                mimeType: message.image?.mime_type ?? null,
                sha256: message.image?.sha256 ?? null,
              }
            : null,
        });
      }
    }
  }

  return messages;
}

async function storeWhatsAppImage(
  companyId: string,
  occurrenceId: string,
  image: NonNullable<ParsedMessage['image']>,
) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const apiVersion = process.env.WHATSAPP_API_VERSION;

  if (!accessToken || !apiVersion || !env.FILES) {
    return { objectKey: null, mimeType: image.mimeType };
  }

  try {
    const metadataResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/${image.id}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!metadataResponse.ok) {
      return { objectKey: null, mimeType: image.mimeType };
    }

    const metadata = (await metadataResponse.json()) as {
      url?: string;
      mime_type?: string;
    };
    if (!metadata.url) {
      return {
        objectKey: null,
        mimeType: metadata.mime_type ?? image.mimeType,
      };
    }

    const mediaResponse = await fetch(metadata.url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!mediaResponse.ok || !mediaResponse.body) {
      return {
        objectKey: null,
        mimeType: metadata.mime_type ?? image.mimeType,
      };
    }

    const mimeType =
      metadata.mime_type ?? image.mimeType ?? 'application/octet-stream';
    // Tenant first in the key so an object can never be reached by guessing an
    // id from another company.
    const objectKey = `${companyId}/occurrences/${occurrenceId}/${image.id}.${extensionFor(mimeType)}`;
    await env.FILES.put(objectKey, mediaResponse.body, {
      httpMetadata: { contentType: mimeType },
    });

    return { objectKey, mimeType };
  } catch {
    return { objectKey: null, mimeType: image.mimeType };
  }
}

async function sendTextMessage(phoneE164: string, body: string) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = process.env.WHATSAPP_API_VERSION;

  if (!accessToken || !phoneNumberId || !apiVersion) {
    return { messageId: null, status: 'skipped_missing_credentials' };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phoneE164,
          type: 'text',
          text: { body },
        }),
      },
    );
    const result = (await response.json()) as {
      messages?: Array<{ id?: string }>;
    };
    return {
      messageId: result.messages?.[0]?.id ?? null,
      status: response.ok ? 'accepted' : `failed_${response.status}`,
    };
  } catch {
    return { messageId: null, status: 'failed_network' };
  }
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
}

function hexToBytes(value: string) {
  if (!/^[a-f\d]{64}$/i.test(value)) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes;
}

function extensionFor(mimeType: string) {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('heic')) return 'heic';
  return 'jpg';
}
