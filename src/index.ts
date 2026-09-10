import type { Env, Incoming, Statement } from "./types.ts";
import { Service } from "./service.ts";
import { HttpError, locked } from "./db.ts";
import { currentUser, login, logout } from "./auth.ts";
import { parseWebhook, verifySignature } from "./providers/index.ts";
import { catalog } from "./domain/catalog.ts";
type Context = { waitUntil: (promise: Promise<unknown>) => void };
const json = (
  data: unknown,
  status = 200,
  extra: Record<string, string> = {},
) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extra,
    },
  });
function capabilities(env: Env) {
  return {
    whatsapp: !!(
      env.META_ACCESS_TOKEN &&
      env.META_PHONE_NUMBER_ID &&
      env.META_APP_SECRET &&
      env.META_VERIFY_TOKEN
    ),
    openai: !!env.OPENAI_API_KEY,
    simulator: env.APP_ENV === "development",
  };
}
async function body(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "Usa application/json.");
  if (Number(request.headers.get("content-length") ?? 0) > 256000)
    throw new HttpError(413, "Solicitud demasiado grande.");
  const raw = await request.text();
  if (raw.length > 256000)
    throw new HttpError(413, "Solicitud demasiado grande.");
  try {
    return { raw, value: JSON.parse(raw) };
  } catch {
    throw new HttpError(400, "JSON inválido.");
  }
}
function clock(value: unknown, env: Env): Date {
  if (value === undefined) return new Date();
  if (
    env.APP_ENV !== "development" ||
    typeof value !== "string" ||
    !Number.isFinite(Date.parse(value))
  )
    throw new HttpError(400, "Fecha inválida.");
  return new Date(value);
}
export default {
  async fetch(request: Request, env: Env, ctx?: Context): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;
      const s = new Service(env);
      if (path === "/api/health")
        return json({
          environment: env.APP_ENV ?? "production",
          capabilities: capabilities(env),
        });
      if (path === "/webhook") {
        if (method === "GET") {
          if (!env.META_VERIFY_TOKEN)
            return json(
              { error: "Integración pendiente de configuración." },
              503,
            );
          if (
            url.searchParams.get("hub.mode") === "subscribe" &&
            url.searchParams.get("hub.verify_token") === env.META_VERIFY_TOKEN
          )
            return new Response(url.searchParams.get("hub.challenge") ?? "");
          return json({ error: "Verificación inválida." }, 403);
        }
        if (method !== "POST")
          return json({ error: "Método no permitido." }, 405);
        const { raw, value } = await body(request);
        if (
          !env.META_APP_SECRET ||
          !(await verifySignature(
            raw,
            request.headers.get("x-hub-signature-256"),
            env.META_APP_SECRET,
          ))
        )
          return json({ error: "Firma inválida." }, 401);
        if (!env.META_PHONE_NUMBER_ID)
          return json({ error: "Número receptor sin configurar." }, 503);
        // One application may receive multiple WABA subscriptions. Accept only this store's number.
        const filtered = {
          ...value,
          entry: (Array.isArray(value.entry) ? value.entry : []).map(
            (entry: any) => ({
              ...entry,
              changes: (Array.isArray(entry.changes)
                ? entry.changes
                : []
              ).filter(
                (change: any) =>
                  change.value?.metadata?.phone_number_id ===
                  env.META_PHONE_NUMBER_ID,
              ),
            }),
          ),
        };
        const incoming = parseWebhook(filtered);
        for (const input of incoming)
          await env.DB.prepare(
            "INSERT OR IGNORE INTO inbox(id,phone,data,state,created_at) VALUES(?,?,?,?,?)",
          )
            .bind(
              input.id,
              input.phone,
              JSON.stringify(input),
              "pending",
              new Date().toISOString(),
            )
            .run();
        const receiptOps: Statement[] = [];
        for (const e of filtered.entry)
          for (const change of e.changes)
            for (const status of change.value?.statuses ?? []) {
              if (
                !["sent", "delivered", "read", "failed"].includes(
                  status.status,
                ) ||
                typeof status.id !== "string"
              )
                continue;
              // Receipts may arrive out of order or repeat. A confirmed delivery/read cannot move backwards.
              const eligible =
                status.status === "read"
                  ? "state != 'read'"
                  : status.status === "delivered"
                    ? "state NOT IN ('read','delivered')"
                    : "state IN ('sending','sent','uncertain')";
              receiptOps.push(
                env.DB.prepare(
                  "UPDATE outbox SET state=?,error=? WHERE provider_id=? AND " +
                    eligible,
                ).bind(
                  status.status,
                  status.status === "failed"
                    ? "WhatsApp informó fallo de entrega"
                    : null,
                  status.id,
                ),
              );
            }
        if (receiptOps.length)
          await locked(env.DB, async () => {
            await env.DB.batch(receiptOps);
          });
        const work = (async () => {
          for (const input of incoming) {
            try {
              await s.processInbox(input.id);
            } catch {
              /* Durable inbox is recovered by cron. */
            }
          }
          await s.flush();
        })();
        if (ctx) ctx.waitUntil(work);
        else await work;
        return json({ received: true });
      }
      if (!path.startsWith("/api/")) {
        if (env.ASSETS) {
          const asset = await env.ASSETS.fetch(request);
          const headers = new Headers(asset.headers);
          headers.set(
            "content-security-policy",
            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
          );
          headers.set("x-content-type-options", "nosniff");
          headers.set("referrer-policy", "same-origin");
          return new Response(asset.body, { status: asset.status, headers });
        }
        return json({ error: "Panel no disponible." }, 404);
      }
      if (!["GET", "HEAD"].includes(method)) {
        const origin = request.headers.get("origin");
        if (
          origin !== url.origin ||
          request.headers.get("sec-fetch-site") === "cross-site"
        )
          throw new HttpError(403, "Origen de solicitud inválido.");
      }
      if (path === "/api/login" && method === "POST") {
        const { value } = await body(request);
        if (
          typeof value.username !== "string" ||
          typeof value.password !== "string" ||
          value.username.length > 80 ||
          value.password.length > 256
        )
          throw new HttpError(400, "Credenciales inválidas.");
        const result = await login(
          env.DB,
          value.username,
          value.password,
          request.headers.get("cf-connecting-ip") ?? "local",
        );
        return json(
          {
            user: result.user,
            environment: env.APP_ENV,
            capabilities: capabilities(env),
          },
          200,
          {
            "set-cookie":
              "jiren_session=" +
              result.token +
              "; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000" +
              (env.APP_ENV === "development" ? "" : "; Secure"),
          },
        );
      }
      const user = await currentUser(env.DB, request);
      if (!user) throw new HttpError(401, "Inicia sesión.");
      if (path === "/api/me" && method === "GET")
        return json({
          user,
          environment: env.APP_ENV ?? "production",
          capabilities: capabilities(env),
        });
      if (path === "/api/logout" && method === "POST") {
        await body(request);
        await logout(env.DB, request);
        return json({ ok: true }, 200, {
          "set-cookie":
            "jiren_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0" +
            (env.APP_ENV === "development" ? "" : "; Secure"),
        });
      }
      if (path === "/api/catalog" && method === "GET") return json(catalog);
      if (path === "/api/orders" && method === "GET")
        return json(
          await s.orders(
            url.searchParams.get("status") ?? "",
            (url.searchParams.get("q") ?? "").slice(0, 120),
          ),
        );
      const orderMatch = path.match(/^\/api\/orders\/([^/]+)(\/status)?$/);
      if (orderMatch) {
        const id = decodeURIComponent(orderMatch[1]);
        if (method === "GET" && !orderMatch[2]) return json(await s.order(id));
        if (method === "POST" && orderMatch[2]) {
          const { value } = await body(request);
          const order = await s.changeStatus(id, value, user);
          if (ctx) ctx.waitUntil(s.flush());
          return json({ order });
        }
      }
      if (path === "/api/settings") {
        if (method === "GET") return json({ settings: await s.settings() });
        if (method === "PUT") {
          const { value } = await body(request);
          return json({ settings: await s.saveSettings(value.settings, user) });
        }
      }
      if (path === "/api/chats" && method === "GET")
        return json(await s.chats());
      const chatMatch = path.match(
        /^\/api\/chats\/(\d{7,16})(?:\/(take|release|messages))?$/,
      );
      if (chatMatch) {
        const phone = chatMatch[1],
          action = chatMatch[2];
        if (method === "GET" && !action) return json(await s.chat(phone));
        if (method === "POST" && action) {
          const { value } = await body(request);
          let conversation;
          if (action === "take")
            conversation = await s.takeChat(phone, value.version, user);
          else if (action === "release")
            conversation = await s.releaseChat(
              phone,
              value.version,
              value.summary,
              user,
            );
          else
            conversation = await s.humanMessage(
              phone,
              value.version,
              value.text,
              user,
            );
          if (ctx) ctx.waitUntil(s.flush());
          return json({ conversation });
        }
      }
      if (path === "/api/audit" && method === "GET") {
        if (user.role !== "ceo")
          throw new HttpError(403, "Esta vista corresponde a la cuenta CEO.");
        return json(await s.audit());
      }
      if (path === "/api/outbox" && method === "GET")
        return json(await s.outbox());
      const retry = path.match(/^\/api\/outbox\/([^/]+)\/retry$/);
      if (retry && method === "POST") {
        await body(request);
        await s.retryOutbox(retry[1]);
        if (ctx) ctx.waitUntil(s.flush());
        return json({ ok: true });
      }
      if (path.startsWith("/api/dev/") && env.APP_ENV !== "development")
        throw new HttpError(404, "No encontrado.");
      if (path === "/api/dev/message" && method === "POST") {
        const { value } = await body(request);
        return json(
          await s.incoming(
            {
              phone: value.phone,
              text: value.text,
              id: value.id ?? crypto.randomUUID(),
              simulated: true,
            },
            clock(value.now, env),
          ),
        );
      }
      if (path === "/api/dev/tick" && method === "POST") {
        const { value } = await body(request);
        await s.tick(clock(value.now, env));
        return json({ ok: true });
      }
      return json({ error: "No encontrado." }, 404);
    } catch (error) {
      if (
        error instanceof HttpError ||
        typeof (error as any)?.status === "number"
      )
        return json({ error: (error as Error).message }, (error as any).status);
      // Do not leak SQL, provider payloads or credentials into responses.
      return json(
        {
          error:
            "No se pudo completar la acción. Actualiza e intenta nuevamente.",
        },
        500,
      );
    }
  },
  async scheduled(_event: unknown, env: Env, ctx: Context) {
    ctx.waitUntil(new Service(env).tick());
  },
};
