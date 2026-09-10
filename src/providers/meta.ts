import type { Env, Incoming, Reply } from "../types.ts";
import { ProviderError } from "./errors.ts";
import { list, providerJson, record } from "./http.ts";

const encoder = new TextEncoder();

export async function verifySignature(
  raw: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!secret || !signature || !/^sha256=[a-fA-F0-9]{64}$/.test(signature))
    return false;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const bytes = Uint8Array.from(signature.slice(7).match(/../g)!, (hex) =>
    parseInt(hex, 16),
  );
  // Web Crypto's HMAC verification avoids a JavaScript early-return comparison.
  return crypto.subtle.verify("HMAC", key, bytes, encoder.encode(raw));
}

export function parseWebhook(payload: unknown): Incoming[] {
  const incoming: Incoming[] = [];
  for (const entry of list(record(payload)?.entry)) {
    for (const change of list(record(entry)?.changes)) {
      const event = record(change);
      if (event?.field && event.field !== "messages") continue;
      for (const value of list(record(event?.value)?.messages)) {
        const message = record(value);
        if (
          !message ||
          typeof message.id !== "string" ||
          !message.id ||
          message.id.length > 250 ||
          typeof message.from !== "string" ||
          !/^\d{7,15}$/.test(message.from)
        )
          continue;
        const parsed: Incoming = {
          id: message.id,
          phone: message.from,
          text: "",
        };
        if (
          typeof message.timestamp === "string" &&
          /^\d{1,12}$/.test(message.timestamp)
        ) {
          const at = Number(message.timestamp) * 1000;
          if (Number.isFinite(at))
            parsed.timestamp = new Date(at).toISOString();
        }
        if (message.type === "text") {
          const body = record(message.text)?.body;
          parsed.text =
            typeof body === "string"
              ? body.slice(0, 4096)
              : "[Mensaje de texto vacío]";
        } else if (message.type === "interactive") {
          const interactive = record(message.interactive);
          const reply = record(
            interactive?.type === "button_reply"
              ? interactive.button_reply
              : interactive?.type === "list_reply"
                ? interactive.list_reply
                : null,
          );
          parsed.text =
            typeof reply?.id === "string" && reply.id
              ? reply.id.slice(0, 256)
              : "[Respuesta interactiva no reconocida; escribe tu opción]";
        } else if (message.type === "button") {
          const button = record(message.button);
          parsed.text =
            typeof button?.payload === "string" && button.payload
              ? button.payload.slice(0, 256)
              : typeof button?.text === "string"
                ? button.text.slice(0, 256)
                : "[Botón no reconocido]";
        } else if (message.type === "location") {
          const location = record(message.location);
          if (
            typeof location?.latitude === "number" &&
            Number.isFinite(location.latitude) &&
            Math.abs(location.latitude) <= 90 &&
            typeof location.longitude === "number" &&
            Number.isFinite(location.longitude) &&
            Math.abs(location.longitude) <= 180
          ) {
            parsed.location = {
              latitude: location.latitude,
              longitude: location.longitude,
            };
            parsed.text =
              typeof location.address === "string"
                ? location.address.slice(0, 512)
                : "[Ubicación compartida]";
          } else parsed.text = "[Ubicación no válida; vuelve a compartirla]";
        } else {
          const names: Record<string, string> = {
            audio: "audio",
            image: "imagen",
            video: "video",
            document: "documento",
            sticker: "sticker",
            contacts: "contacto",
          };
          const type =
            typeof message.type === "string" &&
            Object.hasOwn(names, message.type)
              ? names[message.type]
              : "formato no compatible";
          parsed.text = `[Mensaje de ${type}; escribe tu consulta en texto]`;
        }
        incoming.push(parsed);
      }
    }
  }
  return incoming;
}

const characters = (text: string, max: number) =>
  Array.from(text).slice(0, max).join("");
const length = (text: string) => Array.from(text).length;

function validateReply(reply: Reply): void {
  if (
    typeof reply.text !== "string" ||
    !reply.text.trim() ||
    length(reply.text) > 4096
  )
    throw new ProviderError("meta", "invalid_message");
  if (!reply.choices?.length) return;
  if (
    reply.choices.length > 10 ||
    length(reply.text) > 1024 ||
    new Set(reply.choices.map((x) => x.id)).size !== reply.choices.length
  )
    throw new ProviderError("meta", "invalid_message");
  const idLimit = reply.choices.length <= 3 ? 256 : 200;
  if (
    reply.choices.some(
      (x) =>
        typeof x.id !== "string" ||
        !x.id.trim() ||
        x.id !== x.id.trim() ||
        length(x.id) > idLimit ||
        typeof x.title !== "string" ||
        !x.title.trim(),
    )
  )
    throw new ProviderError("meta", "invalid_message");
}

export async function sendWhatsApp(
  env: Env,
  phone: string,
  reply: Reply,
  lastCustomerAt: string,
  now = new Date(),
  fetcher: typeof fetch = fetch,
): Promise<{ id: string }> {
  const version = env.META_GRAPH_VERSION || "v23.0";
  if (
    !env.META_ACCESS_TOKEN?.trim() ||
    !/^\d+$/.test(env.META_PHONE_NUMBER_ID || "") ||
    !/^v\d+\.\d+$/.test(version)
  )
    throw new ProviderError("meta", "configuration");
  if (!/^\d{7,15}$/.test(phone))
    throw new ProviderError("meta", "invalid_recipient");
  validateReply(reply);
  const age = now.getTime() - new Date(lastCustomerAt).getTime();
  const freeformAllowed = Number.isFinite(age) && age >= 0 && age < 86_400_000;
  let content: Record<string, unknown>;
  if (!freeformAllowed) {
    if (
      !env.META_STATUS_TEMPLATE ||
      !/^[a-z0-9_]{1,512}$/.test(env.META_STATUS_TEMPLATE)
    )
      throw new ProviderError("meta", "template_required");
    // Contract: an approved Spanish (es) utility template with one positional body parameter.
    const instruction = reply.choices?.length
      ? ` Responde: ${reply.choices.map((x) => x.title).join(" / ")}`
      : "";
    const templateText = `${reply.text}${instruction}`
      .replace(/\s+/g, " ")
      .trim();
    if (length(templateText) > 1024)
      throw new ProviderError("meta", "template_content_unsupported");
    content = {
      type: "template",
      template: {
        name: env.META_STATUS_TEMPLATE,
        language: { code: "es" },
        components: [
          { type: "body", parameters: [{ type: "text", text: templateText }] },
        ],
      },
    };
  } else if (!reply.choices?.length) {
    content = { type: "text", text: { body: reply.text, preview_url: false } };
  } else if (reply.choices.length <= 3) {
    content = {
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: reply.text },
        action: {
          buttons: reply.choices.map((x) => ({
            type: "reply",
            reply: { id: x.id, title: characters(x.title, 20) },
          })),
        },
      },
    };
  } else {
    content = {
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: reply.text },
        action: {
          button: "Ver opciones",
          sections: [
            {
              title: "Opciones",
              rows: reply.choices.map((x) => ({
                id: x.id,
                title: characters(x.title, 24),
                ...(x.description
                  ? { description: characters(x.description, 72) }
                  : {}),
              })),
            },
          ],
        },
      },
    };
  }
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    ...content,
  };
  const result = record(
    await providerJson(
      "meta",
      `https://graph.facebook.com/${version}/${env.META_PHONE_NUMBER_ID}/messages`,
      env.META_ACCESS_TOKEN,
      payload,
      fetcher,
    ),
  );
  const id = record(list(result?.messages)[0])?.id;
  if (
    typeof id !== "string" ||
    !id.startsWith("wamid.") ||
    id.length <= 6 ||
    /\s/.test(id) ||
    id.length > 512
  )
    throw new ProviderError("meta", "invalid_response", false, true);
  return { id };
}
