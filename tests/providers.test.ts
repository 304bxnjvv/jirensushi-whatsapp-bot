import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  verifySignature,
  parseWebhook,
  sendWhatsApp,
  interpretIntent,
} from "../src/providers/index.ts";
import type { Conversation, Env, Message, Reply } from "../src/types.ts";

const env = {
  META_ACCESS_TOKEN: "secret-token",
  META_PHONE_NUMBER_ID: "123456",
  META_GRAPH_VERSION: "v23.0",
} as Env;
const now = new Date("2026-09-09T15:00:00Z");
const phone = "56912345678";
const recent = "2026-09-09T14:00:00Z";
const conversation: Conversation = {
  phone,
  stage: "menu",
  mode: "bot",
  draft: { items: [], deliveryFee: 0, total: 0 },
  data: { allowedProducts: [{ id: "roll-1", name: "California" }] },
  updatedAt: recent,
  lastCustomerAt: recent,
  version: 1,
};

function capture(
  response: unknown = {
    messaging_product: "whatsapp",
    contacts: [{ input: phone, wa_id: phone }],
    messages: [{ id: "wamid.ok" }],
  },
  status = 200,
) {
  const requests: { url: string; options: RequestInit; body: any }[] = [];
  const fetcher: typeof fetch = async (input, options) => {
    requests.push({
      url: String(input),
      options: options!,
      body: JSON.parse(String(options?.body)),
    });
    return Response.json(response, { status });
  };
  return { requests, fetcher };
}

function errorShape(code: string, retryable: boolean, uncertain = false) {
  return (error: any) => {
    assert.equal(error.name, "ProviderError");
    assert.equal(error.code, code);
    assert.equal(error.retryable, retryable);
    assert.equal(error.uncertain, uncertain);
    assert.ok(!JSON.stringify(error).includes("secret-token"));
    assert.ok(!String(error.message).includes("secret-token"));
    return true;
  };
}

test("verifies HMAC over exact raw UTF-8 bytes and rejects tampering", async () => {
  const raw = '{ "texto": "salmón 🍣" }';
  const signature =
    "sha256=" + createHmac("sha256", "app-secret").update(raw).digest("hex");
  assert.equal(await verifySignature(raw, signature, "app-secret"), true);
  assert.equal(
    await verifySignature(raw.trim() + " ", signature, "app-secret"),
    false,
  );
  assert.equal(await verifySignature(raw, signature, "wrong"), false);
  for (const invalid of [
    null,
    "",
    "sha256=bad",
    signature.replace("sha256=", "sha1="),
  ]) {
    assert.equal(await verifySignature(raw, invalid, "app-secret"), false);
  }
  assert.equal(await verifySignature(raw, signature, ""), false);
});

test("parses all message batches, interactive IDs and location with source timestamps", () => {
  const message = (id: string, more: any) => ({
    id,
    from: phone,
    timestamp: "1788962400",
    ...more,
  });
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              messages: [
                message("a", { type: "text", text: { body: "Hola" } }),
                message("b", {
                  type: "interactive",
                  interactive: {
                    type: "button_reply",
                    button_reply: { id: "mode:retiro", title: "Retiro" },
                  },
                }),
              ],
            },
          },
        ],
      },
      {
        changes: [
          {
            field: "messages",
            value: {
              messages: [
                message("c", {
                  type: "interactive",
                  interactive: {
                    type: "list_reply",
                    list_reply: { id: "roll-1", title: "California" },
                  },
                }),
                message("d", {
                  type: "location",
                  location: {
                    latitude: -33.4,
                    longitude: -70.6,
                    address: "Mi dirección",
                  },
                }),
              ],
            },
          },
        ],
      },
    ],
  };
  const parsed = parseWebhook(payload);
  assert.equal(parsed.length, 4);
  assert.deepEqual(
    parsed.slice(0, 3).map((x) => x.text),
    ["Hola", "mode:retiro", "roll-1"],
  );
  assert.deepEqual(parsed[3].location, { latitude: -33.4, longitude: -70.6 });
  assert.equal(parsed[0].timestamp, new Date(1788962400000).toISOString());
  assert.equal(parsed[0].simulated, undefined);
});

test("malformed payloads and status callbacks produce no fabricated incoming messages", () => {
  for (const payload of [
    null,
    [],
    "text",
    { entry: {} },
    {
      entry: [
        null,
        { changes: [null, { value: { statuses: [{ id: "wamid.ok" }] } }] },
      ],
    },
  ]) {
    assert.deepEqual(parseWebhook(payload), []);
  }
  const parsed = parseWebhook({
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                null,
                { id: "x" },
                {
                  id: "y",
                  from: phone,
                  type: "location",
                  location: { latitude: 200, longitude: 0 },
                },
                { id: "z", from: phone, type: "audio", audio: { id: "media" } },
              ],
            },
          },
        ],
      },
    ],
  });
  assert.equal(parsed.length, 2);
  assert.match(parsed[0].text, /ubicación.*válida/i);
  assert.match(parsed[1].text, /audio/i);
  assert.ok(parsed.every((x) => x.location === undefined));
});

test("WhatsApp sends one text request and returns only validated provider ID", async () => {
  const c = capture();
  assert.deepEqual(
    await sendWhatsApp(env, phone, { text: "Hola" }, recent, now, c.fetcher),
    { id: "wamid.ok" },
  );
  assert.equal(c.requests.length, 1);
  assert.equal(
    c.requests[0].url,
    "https://graph.facebook.com/v23.0/123456/messages",
  );
  assert.equal(
    new Headers(c.requests[0].options.headers).get("authorization"),
    "Bearer secret-token",
  );
  assert.equal(c.requests[0].options.redirect, "error");
  assert.ok(c.requests[0].options.signal instanceof AbortSignal);
  assert.deepEqual(c.requests[0].body, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "text",
    text: { body: "Hola", preview_url: false },
  });
});

test("up to three choices use buttons with bounded titles and stable IDs", async () => {
  const c = capture();
  await sendWhatsApp(
    env,
    phone,
    {
      text: "Selecciona",
      choices: [
        {
          id: "stable-id",
          title: "Una opción de título extremadamente largo 🍣",
        },
      ],
    },
    recent,
    now,
    c.fetcher,
  );
  const interactive = c.requests[0].body.interactive;
  assert.equal(interactive.type, "button");
  assert.equal(interactive.action.buttons[0].reply.id, "stable-id");
  assert.ok(Array.from(interactive.action.buttons[0].reply.title).length <= 20);
});

test("four through ten choices use a list within Meta limits", async () => {
  const c = capture();
  const choices = Array.from({ length: 10 }, (_, i) => ({
    id: `product:${i}`,
    title: "🍣".repeat(40),
    description: "a".repeat(100),
  }));
  await sendWhatsApp(
    env,
    phone,
    { text: "Elige", choices },
    recent,
    now,
    c.fetcher,
  );
  const list = c.requests[0].body.interactive;
  assert.equal(list.type, "list");
  const rows = list.action.sections[0].rows;
  assert.equal(rows.length, 10);
  assert.deepEqual(
    rows.map((x: any) => x.id),
    choices.map((x) => x.id),
  );
  assert.ok(
    rows.every(
      (x: any) =>
        Array.from(x.title).length <= 24 && x.description.length <= 72,
    ),
  );
});

test("invalid replies reject before dispatch instead of truncating order information", async () => {
  const c = capture();
  const invalid: Reply[] = [
    { text: "" },
    { text: "a".repeat(4097) },
    {
      text: "Hola",
      choices: Array.from({ length: 11 }, (_, i) => ({
        id: String(i),
        title: "A",
      })),
    },
    {
      text: "Hola",
      choices: [
        { id: "x", title: "A" },
        { id: "x", title: "B" },
      ],
    },
    { text: "a".repeat(1025), choices: [{ id: "x", title: "A" }] },
  ];
  for (const reply of invalid)
    await assert.rejects(
      sendWhatsApp(env, phone, reply, recent, now, c.fetcher),
      errorShape("invalid_message", false),
    );
  assert.equal(c.requests.length, 0);
});

test("after 24h uses configured Spanish utility template with one text parameter", async () => {
  const c = capture();
  await sendWhatsApp(
    { ...env, META_STATUS_TEMPLATE: "actualizacion_pedido" },
    phone,
    { text: "Tu pedido está listo" },
    "2026-09-08T15:00:00Z",
    now,
    c.fetcher,
  );
  assert.equal(c.requests[0].body.type, "template");
  assert.deepEqual(c.requests[0].body.template, {
    name: "actualizacion_pedido",
    language: { code: "es" },
    components: [
      {
        type: "body",
        parameters: [{ type: "text", text: "Tu pedido está listo" }],
      },
    ],
  });
});

test("expired-window status choices become usable reply instructions inside the utility template", async () => {
  const c = capture();
  await sendWhatsApp(
    { ...env, META_STATUS_TEMPLATE: "actualizacion_pedido" },
    phone,
    {
      text: "No podemos preparar tu pedido.",
      choices: [{ id: "reopen", title: "Reabrir pedido" }],
    },
    "2026-09-08T14:00:00Z",
    now,
    c.fetcher,
  );
  assert.equal(c.requests[0].body.type, "template");
  assert.equal(
    c.requests[0].body.template.components[0].parameters[0].text,
    "No podemos preparar tu pedido. Responde: Reabrir pedido",
  );
});

test("expired, invalid or future customer timestamps require a template before sending", async () => {
  const c = capture();
  for (const at of [
    "2026-09-08T14:59:59Z",
    "invalid",
    "2026-09-10T15:00:00Z",
  ]) {
    await assert.rejects(
      sendWhatsApp(env, phone, { text: "Hola" }, at, now, c.fetcher),
      errorShape("template_required", false),
    );
  }
  assert.equal(c.requests.length, 0);
});

test("WhatsApp rejects missing configuration without making HTTP calls", async () => {
  const c = capture();
  await assert.rejects(
    sendWhatsApp({} as Env, phone, { text: "Hola" }, recent, now, c.fetcher),
    errorShape("configuration", false),
  );
  assert.equal(c.requests.length, 0);
});

test("WhatsApp HTTP errors are classified without leaking upstream content", async () => {
  for (const [status, retryable] of [
    [400, false],
    [401, false],
    [429, true],
    [503, true],
  ] as const) {
    const c = capture(
      { error: { message: "secret-token", code: status } },
      status,
    );
    await assert.rejects(
      sendWhatsApp(env, phone, { text: "Hola" }, recent, now, c.fetcher),
      errorShape(`http_${status}`, retryable),
    );
    assert.equal(c.requests.length, 1);
  }
});

test("Meta transient flag permits a bounded outbox retry even with HTTP 400", async () => {
  const c = capture(
    { error: { is_transient: true, code: 2, message: "secret-token" } },
    400,
  );
  await assert.rejects(
    sendWhatsApp(env, phone, { text: "Hola" }, recent, now, c.fetcher),
    errorShape("http_400", true),
  );
});

test("ambiguous gateway and HTTP timeout responses preserve send uncertainty", async () => {
  const gateway: typeof fetch = async () =>
    new Response("<h1>Gateway timeout secret-token</h1>", { status: 504 });
  await assert.rejects(
    sendWhatsApp(env, phone, { text: "Hola" }, recent, now, gateway),
    errorShape("http_504", false, true),
  );
  await assert.rejects(
    sendWhatsApp(
      env,
      phone,
      { text: "Hola" },
      recent,
      now,
      capture({ error: { code: 408 } }, 408).fetcher,
    ),
    errorShape("http_408", false, true),
  );
});

test("ambiguous transport failures must not be automatically resent", async () => {
  let attempts = 0;
  const fetcher: typeof fetch = async () => {
    attempts++;
    throw new TypeError("Network failed secret-token");
  };
  await assert.rejects(
    sendWhatsApp(env, phone, { text: "Hola" }, recent, now, fetcher),
    errorShape("transport", false, true),
  );
  assert.equal(attempts, 1);
});

test("invalid success response is uncertain because message may already have been accepted", async () => {
  for (const response of [
    { success: true },
    { messages: [] },
    { messages: [{ id: 5 }] },
    { messages: [{ id: "arbitrary-id" }] },
  ]) {
    const c = capture(response);
    await assert.rejects(
      sendWhatsApp(env, phone, { text: "Hola" }, recent, now, c.fetcher),
      errorShape("invalid_response", false, true),
    );
  }
});

test("incoming IDs beyond the application limit are ignored without breaking other messages", () => {
  const parsed = parseWebhook({
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  id: "a".repeat(251),
                  from: phone,
                  type: "text",
                  text: { body: "Too long" },
                },
                {
                  id: "wamid.valid",
                  from: phone,
                  type: "text",
                  text: { body: "Hola" },
                },
              ],
            },
          },
        ],
      },
    ],
  });
  assert.deepEqual(
    parsed.map((x) => x.id),
    ["wamid.valid"],
  );
});

test("OpenAI is optional and no key produces no HTTP requests", async () => {
  const c = capture();
  assert.equal(
    await interpretIntent({} as Env, "Hola", conversation, [], c.fetcher),
    null,
  );
  assert.equal(c.requests.length, 0);
});

const aiEnv = {
  ...env,
  OPENAI_API_KEY: "secret-token",
  OPENAI_MODEL: "gpt-4.1-mini",
};
function aiResponse(intent: unknown) {
  return {
    id: "resp_123",
    object: "response",
    status: "completed",
    output: [
      {
        type: "message",
        role: "assistant",
        status: "completed",
        content: [
          {
            type: "output_text",
            text: JSON.stringify(intent),
            annotations: [],
          },
        ],
      },
    ],
  };
}
const baseIntent = {
  action: "product",
  text: null,
  productId: "roll-1",
  quantity: 2,
  modifications: [],
  allergy: null,
};

test("OpenAI returns validated intent through Responses structured output", async () => {
  const c = capture(aiResponse(baseIntent));
  assert.deepEqual(
    await interpretIntent(
      aiEnv,
      "Dame dos California",
      conversation,
      [],
      c.fetcher,
    ),
    { action: "product", productId: "roll-1", quantity: 2 },
  );
  assert.equal(c.requests[0].url, "https://api.openai.com/v1/responses");
  const body = c.requests[0].body;
  assert.equal(body.model, "gpt-4.1-mini");
  assert.equal(body.store, false);
  assert.equal(body.text.format.type, "json_schema");
  assert.equal(body.text.format.strict, true);
  assert.equal(body.text.format.schema.additionalProperties, false);
  assert.ok(
    body.text.format.schema.properties.productId.enum.includes("roll-1"),
  );
  assert.equal(body.tools, undefined);
  assert.ok(body.max_output_tokens <= 1500);
});

test("OpenAI context includes latest human messages and stays bounded without raw conversation metadata", async () => {
  const c = capture(aiResponse(baseIntent));
  const history: Message[] = Array.from({ length: 100 }, (_, i) => ({
    id: String(i),
    phone,
    role: i === 99 ? "human" : "customer",
    text:
      i === 99
        ? "Cambio confirmado con el local"
        : `mensaje-${i}:` + "A".repeat(3000),
    createdAt: recent,
  }));
  const original = {
    ...conversation,
    data: {
      ...conversation.data,
      unrelatedSecret: "DO_NOT_SEND_PRIVATE_METADATA",
    },
  };
  await interpretIntent(aiEnv, "B".repeat(5000), original, history, c.fetcher);
  const context = JSON.parse(c.requests[0].body.input[0].content);
  assert.equal(context.stage, "menu");
  assert.ok(context.history.length <= 12);
  assert.ok(
    context.history.some(
      (x: any) =>
        x.role === "human" && x.text === "Cambio confirmado con el local",
    ),
  );
  assert.ok(context.history.every((x: any) => x.text.length <= 1000));
  assert.ok(context.text.length <= 4000);
  assert.ok(
    !JSON.stringify(c.requests[0].body).includes(
      "DO_NOT_SEND_PRIVATE_METADATA",
    ),
  );
  assert.equal(original.stage, "menu");
});

test("untrusted AI output cannot invent IDs, actions, prices or invalid quantities", async () => {
  const invalid = [
    { ...baseIntent, productId: "invented" },
    { ...baseIntent, action: "submit_order" },
    { ...baseIntent, quantity: -1 },
    { ...baseIntent, quantity: Number.MAX_SAFE_INTEGER + 1 },
    { ...baseIntent, quantity: 1.5 },
    { ...baseIntent, price: 0 },
    {
      ...baseIntent,
      text: "Pedido aceptado. Entrega garantizada en 5 minutos.",
    },
    { ...baseIntent, action: "unknown" },
  ];
  for (const intent of invalid) {
    const c = capture(aiResponse(intent));
    assert.equal(
      await interpretIntent(aiEnv, "Hola", conversation, [], c.fetcher),
      null,
    );
  }
});

test("AI accepts positive integer quantities beyond twenty as required by HU-06", async () => {
  const c = capture(aiResponse({ ...baseIntent, quantity: 21 }));
  assert.equal(
    (
      await interpretIntent(
        aiEnv,
        "Quiero 21 unidades",
        conversation,
        [],
        c.fetcher,
      )
    )?.quantity,
    21,
  );
});

test("AI can infer only trusted ingredient modifications with prices discarded", async () => {
  const enriched = {
    ...conversation,
    data: { ...conversation.data, allowedIngredients: ["palta", "salmón"] },
  };
  const intent = {
    ...baseIntent,
    action: "modifications",
    productId: null,
    quantity: null,
    modifications: [
      {
        action: "replace",
        ingredient: "salmón",
        from: "palta",
        kind: "ingredient",
      },
    ],
  };
  const c = capture(aiResponse(intent));
  assert.deepEqual(
    await interpretIntent(
      aiEnv,
      "Cambia palta por salmón",
      enriched,
      [],
      c.fetcher,
    ),
    {
      action: "modifications",
      modifications: [
        {
          action: "replace",
          ingredient: "salmón",
          from: "palta",
          kind: "ingredient",
          price: 0,
        },
      ],
    },
  );
  for (const modification of [
    { ...intent.modifications[0], ingredient: "caviar" },
    { ...intent.modifications[0], price: -5000 },
  ]) {
    assert.equal(
      await interpretIntent(
        aiEnv,
        "Cambia",
        enriched,
        [],
        capture(aiResponse({ ...intent, modifications: [modification] }))
          .fetcher,
      ),
      null,
    );
  }
});

test("AI canonical text is restricted to mode or trusted category IDs", async () => {
  const enriched = {
    ...conversation,
    data: {
      ...conversation.data,
      allowedCategories: [{ id: "rolls", name: "Rolls" }],
    },
  };
  const mode = {
    ...baseIntent,
    action: "mode",
    productId: null,
    quantity: null,
    text: "retiro",
  };
  assert.deepEqual(
    await interpretIntent(
      aiEnv,
      "Lo voy a buscar",
      enriched,
      [],
      capture(aiResponse(mode)).fetcher,
    ),
    { action: "mode", text: "retiro" },
  );
  const category = { ...mode, action: "category", text: "rolls" };
  assert.deepEqual(
    await interpretIntent(
      aiEnv,
      "Quiero rolls",
      enriched,
      [],
      capture(aiResponse(category)).fetcher,
    ),
    { action: "category", text: "rolls" },
  );
  assert.equal(
    await interpretIntent(
      aiEnv,
      "Quiero rolls",
      enriched,
      [],
      capture(aiResponse({ ...category, text: "admin:delete" })).fetcher,
    ),
    null,
  );
});

test("AI refuses incomplete, refused, malformed or conflicting output", async () => {
  const invalid = [
    { ...aiResponse(baseIntent), status: "incomplete" },
    {
      output: [
        { type: "message", content: [{ type: "refusal", refusal: "No" }] },
      ],
    },
    {
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: "{broken" }],
        },
      ],
    },
    aiResponse({ ...baseIntent, action: "quantity", productId: "roll-1" }),
    aiResponse({ ...baseIntent, action: "product", allergy: "salmón" }),
    aiResponse(null),
  ];
  for (const response of invalid)
    assert.equal(
      await interpretIntent(
        aiEnv,
        "Hola",
        conversation,
        [],
        capture(response).fetcher,
      ),
      null,
    );
});

test("OpenAI upstream failure is typed and sanitized", async () => {
  await assert.rejects(
    interpretIntent(
      aiEnv,
      "Hola",
      conversation,
      [],
      capture({ error: { message: "secret-token" } }, 429).fetcher,
    ),
    errorShape("http_429", true),
  );
});

test("WhatsApp timeout aborts single request and preserves uncertainty", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let aborted = false;
  const fetcher: typeof fetch = (_input, options) =>
    new Promise((_resolve, reject) => {
      options?.signal?.addEventListener(
        "abort",
        () => {
          aborted = true;
          reject(new Error("aborted"));
        },
        { once: true },
      );
    });
  const pending = sendWhatsApp(
    env,
    phone,
    { text: "Hola" },
    recent,
    now,
    fetcher,
  );
  const checked = assert.rejects(pending, errorShape("timeout", false, true));
  t.mock.timers.tick(12_000);
  await checked;
  assert.equal(aborted, true);
});
