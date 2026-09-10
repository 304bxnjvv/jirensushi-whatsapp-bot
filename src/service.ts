import type {
  Env,
  Settings,
  User,
  Order,
  Conversation,
  Incoming,
  Message,
  Statement,
  Reply,
  Audit,
  Draft,
} from "./types.ts";
import {
  HttpError,
  object,
  saveConversation,
  saveOrder,
  outgoing,
  audit,
  locked,
} from "./db.ts";
import { processMessage } from "./domain/bot.ts";
import { catalog, products } from "./domain/catalog.ts";
import { nextOpening } from "./domain/hours.ts";
import { validateDraft } from "./domain/pricing.ts";
import { interpretIntent, sendWhatsApp } from "./providers/index.ts";

export const defaults: Settings = {
  branch: "Sucursal Viña del Mar",
  address: "5 Norte 615, Viña del Mar",
  manualClosed: false,
  reopenAt: null,
  asapMinutes: 30,
  retentionDays: 90,
  zones: [
    {
      id: "poniente",
      name: "Poniente hasta Mall",
      price: 2500,
      description:
        "Zona poniente hasta el mall. Confirma cobertura con el local si tienes dudas.",
      enabled: true,
    },
    {
      id: "centro",
      name: "Centro",
      price: 3500,
      description: "Centro de Viña del Mar.",
      enabled: true,
    },
    {
      id: "otros",
      name: "Otros sectores cubiertos",
      price: 4500,
      description: "Cobertura específica a confirmar por el local.",
      enabled: true,
    },
  ],
};
type Change = {
  version: number;
  status: Order["status"];
  estimateMinutes?: number;
  estimatedTime?: string;
  reason?: "ingredients" | "closed";
  missing?: { productId: string; ingredient: string }[];
  comment?: string;
};
const iso = (date = new Date()) => date.toISOString();
const money = (value: number) => "$" + value.toLocaleString("es-CL");
export class Service {
  env: Env;
  constructor(env: Env) {
    this.env = env;
  }
  get db() {
    return this.env.DB;
  }
  async settings(): Promise<Settings> {
    return (
      object<Settings>(
        await this.db.prepare("SELECT data FROM settings WHERE id=1").first(),
      ) ?? structuredClone(defaults)
    );
  }
  async saveSettings(value: Settings, user: User) {
    if (
      !value ||
      value.branch !== defaults.branch ||
      typeof value.address !== "string" ||
      !value.address.trim() ||
      value.address.length > 300 ||
      !Array.isArray(value.zones) ||
      value.zones.length < 1 ||
      value.zones.length > 8
    )
      throw new HttpError(400, "Configuración del local inválida.");
    if (
      typeof value.manualClosed !== "boolean" ||
      !Number.isSafeInteger(value.asapMinutes) ||
      value.asapMinutes < 1 ||
      value.asapMinutes > 480
    )
      throw new HttpError(400, "Tiempo estimado inválido.");
    if (
      value.manualClosed &&
      (!value.reopenAt ||
        !Number.isFinite(Date.parse(value.reopenAt)) ||
        Date.parse(value.reopenAt) <= Date.now())
    )
      throw new HttpError(400, "Indica fecha y hora futura de reapertura.");
    const ids = new Set<string>();
    for (const z of value.zones) {
      if (
        !z ||
        typeof z.id !== "string" ||
        !/^[a-z0-9-]{1,40}$/.test(z.id) ||
        ids.has(z.id) ||
        typeof z.name !== "string" ||
        !z.name.trim() ||
        z.name.length > 100 ||
        typeof z.description !== "string" ||
        z.description.length > 500 ||
        typeof z.enabled !== "boolean" ||
        !Number.isSafeInteger(z.price) ||
        z.price < 0 ||
        z.price > 100000
      )
        throw new HttpError(400, "Zona o precio inválido.");
      ids.add(z.id);
    }
    const s: Settings = {
      ...value,
      retentionDays: 90,
      reopenAt: value.manualClosed
        ? new Date(value.reopenAt!).toISOString()
        : null,
    };
    return locked(this.db, async () => {
      await this.db.batch([
        this.db
          .prepare(
            "INSERT INTO settings(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
          )
          .bind(JSON.stringify(s)),
        audit(this.db, user.username, "settings", "local", s, iso()),
      ]);
      return s;
    });
  }
  async orders(status = "", q = "") {
    // The short history window must never hide an order still requiring action.
    const cutoff = iso(new Date(Date.now() - 3 * 86400000));
    const visible = "(created_at >= ? OR status IN ('Pendiente','Aceptado'))";
    const values: unknown[] = [cutoff];
    let sql = "SELECT data FROM orders WHERE " + visible;
    if (status) {
      if (!["Pendiente", "Aceptado", "Rechazado", "Entregado"].includes(status))
        throw new HttpError(400, "Estado inválido.");
      sql += " AND status=?";
      values.push(status);
    }
    if (q) {
      sql +=
        " AND (json_extract(data,'$.number') LIKE ? ESCAPE '\\' OR json_extract(data,'$.customerName') LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\')";
      const escaped = "%" + q.replace(/[\\%_]/g, "\\$&") + "%";
      values.push(escaped, escaped, escaped);
    }
    sql +=
      " ORDER BY created_at " +
      (["Rechazado", "Entregado"].includes(status) ? "DESC" : "ASC") +
      " LIMIT 500";
    const rows = await this.db
      .prepare(sql)
      .bind(...values)
      .all<{ data: string }>();
    const counts = { Pendiente: 0, Aceptado: 0, Rechazado: 0, Entregado: 0 };
    const countRows = await this.db
      .prepare(
        "SELECT status,COUNT(*) n FROM orders WHERE " +
          visible +
          " GROUP BY status",
      )
      .bind(cutoff)
      .all<{ status: Order["status"]; n: number }>();
    for (const r of countRows.results) counts[r.status] = r.n;
    return {
      orders: rows.results.map((r) => JSON.parse(r.data) as Order),
      counts,
    };
  }
  async phoneOrders(phone: string) {
    const rows = await this.db
      .prepare("SELECT data FROM orders WHERE phone=? ORDER BY created_at DESC")
      .bind(phone)
      .all<{ data: string }>();
    return rows.results.map((r) => JSON.parse(r.data) as Order);
  }
  async order(id: string) {
    const o = object<Order>(
      await this.db
        .prepare("SELECT data FROM orders WHERE id=?")
        .bind(id)
        .first(),
    );
    if (!o) throw new HttpError(404, "Pedido no encontrado.");
    const rows = await this.db
      .prepare(
        "SELECT id,actor,action,target,detail,created_at AS createdAt FROM audit WHERE target=? ORDER BY id",
      )
      .bind(id)
      .all<Audit>();
    return { order: o, audit: rows.results };
  }
  async changeStatus(id: string, input: Change, user: User) {
    return locked(this.db, async () => {
      const { order: o } = await this.order(id);
      if (input.version !== o.version)
        throw new HttpError(
          409,
          "El pedido fue actualizado por otra sesión. Recarga y vuelve a revisar.",
        );
      if (o.locked)
        throw new HttpError(
          409,
          "Pedido original bloqueado porque fue reabierto.",
        );
      if (o.status === "Entregado")
        throw new HttpError(409, "Entregado es irreversible.");
      if (
        !["Aceptado", "Rechazado", "Entregado"].includes(input.status) ||
        o.status === input.status
      )
        throw new HttpError(400, "Cambio de estado inválido.");
      if (input.status === "Entregado" && o.status !== "Aceptado")
        throw new HttpError(
          400,
          "Solo un pedido aceptado puede marcarse entregado.",
        );
      if (
        input.status === "Aceptado" &&
        (await this.phoneOrders(o.phone)).some(
          (p) => p.id !== id && ["Pendiente", "Aceptado"].includes(p.status),
        )
      )
        throw new HttpError(409, "El cliente ya tiene otro pedido activo.");
      const now = iso();
      const settings = await this.settings();
      const previous = o.status;
      if (input.status === "Rechazado") {
        if (!["ingredients", "closed"].includes(input.reason ?? ""))
          throw new HttpError(400, "Selecciona motivo de rechazo.");
        if (
          input.reason === "ingredients" &&
          (!Array.isArray(input.missing) ||
            input.missing.length === 0 ||
            input.missing.length > 100 ||
            input.missing.some(
              (m) =>
                !o.items.some((i) => i.productId === m.productId) ||
                typeof m.ingredient !== "string" ||
                !m.ingredient.trim() ||
                m.ingredient.length > 200,
            ))
        )
          throw new HttpError(
            400,
            "Indica producto del pedido e ingrediente faltante.",
          );
        o.reason = input.reason;
        o.missing =
          input.reason === "ingredients"
            ? input.missing!.map((m) => ({
                productId: m.productId,
                ingredient: m.ingredient.trim(),
              }))
            : [];
      } else {
        o.reason = undefined;
        o.missing = undefined;
      }
      if (
        input.comment !== undefined &&
        (typeof input.comment !== "string" || input.comment.length > 1000)
      )
        throw new HttpError(400, "Comentario inválido.");
      o.comment = input.comment?.trim();
      if (input.status === "Aceptado" && o.schedule?.kind === "asap") {
        const minutes = input.estimateMinutes ?? settings.asapMinutes;
        if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > 480)
          throw new HttpError(400, "Ingresa minutos entre 1 y 480.");
        if (input.estimatedTime) {
          if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.estimatedTime))
            throw new HttpError(400, "Hora inválida.");
          o.schedule = { kind: "asap", time: input.estimatedTime };
        } else o.schedule = { kind: "asap", estimateMinutes: minutes };
      }
      o.status = input.status;
      o.version++;
      o.updatedAt = now;
      let reply: Reply;
      if (o.status === "Aceptado") {
        const timing = o.schedule?.time
          ? "Hora: " + o.schedule.time
          : "Estimación: " + o.schedule?.estimateMinutes + " minutos";
        reply = {
          text: `Pedido ${o.number} aceptado 🍣\n${settings.branch}\n${o.mode === "despacho" ? "Despacho a " + o.address : "Retiro en " + settings.address}\n${timing}\nTotal: ${money(o.total)} · Pago: ${o.payment}`,
        };
      } else if (o.status === "Entregado")
        reply = {
          text: `Pedido ${o.number} entregado. ¡Gracias por elegir Jiren Sushi! 🍣 Puedes iniciar un nuevo pedido cuando quieras.`,
        };
      else if (o.reason === "closed")
        reply = {
          text: `Pedido ${o.number} rechazado porque el local está cerrado. Próxima apertura: ${nextOpening(new Date(), settings).toLocaleString("es-CL", { timeZone: "America/Santiago" })}.`,
        };
      else
        reply = {
          text: `Pedido ${o.number} no se puede aceptar: faltan ingredientes.\n${o.missing!.map((m) => (o.items.find((i) => i.productId === m.productId)?.name ?? m.productId) + ": falta " + m.ingredient).join("\n")}\nPuedes reabrirlo sin esos productos.`,
          choices: [{ id: "reopen", title: "Reabrir pedido" }],
        };
      const c = object<Conversation>(
        await this.db
          .prepare("SELECT data FROM conversations WHERE phone=?")
          .bind(o.phone)
          .first(),
      );
      await this.db.batch([
        saveOrder(this.db, o),
        audit(
          this.db,
          user.username,
          "order.status",
          id,
          {
            from: previous,
            to: o.status,
            reason: o.reason,
            missing: o.missing,
            comment: o.comment,
          },
          now,
        ),
        ...outgoing(
          this.db,
          o.phone,
          reply,
          now,
          c?.simulated ?? this.env.APP_ENV === "development",
          "notice",
        ),
      ]);
      return o;
    });
  }
  async chats() {
    const rows = await this.db
      .prepare(
        "SELECT data FROM conversations ORDER BY CASE mode WHEN 'waiting' THEN 0 WHEN 'human' THEN 1 ELSE 2 END,CASE WHEN mode='waiting' THEN json_extract(data,'$.waitingSince') ELSE updated_at END ASC LIMIT 500",
      )
      .all<{ data: string }>();
    return {
      chats: rows.results.map((r) => JSON.parse(r.data) as Conversation),
    };
  }
  async chat(phone: string) {
    const conversation = object<Conversation>(
      await this.db
        .prepare("SELECT data FROM conversations WHERE phone=?")
        .bind(phone)
        .first(),
    );
    if (!conversation) throw new HttpError(404, "Conversación no encontrada.");
    const rows = await this.db
      .prepare(
        "SELECT m.id,m.phone,m.role,m.text,m.created_at AS createdAt,o.state AS delivery FROM messages m LEFT JOIN outbox o ON o.id=m.id WHERE m.phone=? ORDER BY m.created_at,m.rowid",
      )
      .bind(phone)
      .all<Message>();
    return {
      conversation,
      messages: rows.results,
      orders: await this.phoneOrders(phone),
    };
  }
  async chatMutation(
    phone: string,
    version: number,
    user: User,
    action: string,
    update: (c: Conversation) => Reply | null,
  ) {
    return locked(this.db, async () => {
      const { conversation: c } = await this.chat(phone);
      if (c.version !== version)
        throw new HttpError(
          409,
          "El chat fue actualizado. Revisa los mensajes más recientes.",
        );
      const reply = update(c);
      c.version++;
      c.updatedAt = iso();
      const ops = [
        saveConversation(this.db, c),
        audit(
          this.db,
          user.username,
          action,
          phone,
          { mode: c.mode },
          c.updatedAt,
        ),
      ];
      if (action === "chat.take")
        ops.push(
          this.db
            .prepare(
              "UPDATE outbox SET state='cancelled',error='Bot pausado por atención humana' WHERE phone=? AND kind='bot' AND state IN ('pending','failed','blocked')",
            )
            .bind(phone),
        );
      if (reply)
        ops.push(
          ...outgoing(
            this.db,
            phone,
            reply,
            c.updatedAt,
            !!c.simulated,
            action === "chat.message" ? "human" : "notice",
          ),
        );
      await this.db.batch(ops);
      return c;
    });
  }
  async takeChat(phone: string, version: number, user: User) {
    return this.chatMutation(phone, version, user, "chat.take", (c) => {
      if (c.mode === "human")
        throw new HttpError(409, "La atención humana ya está activa.");
      c.data.resumeStage = c.stage;
      c.mode = "human";
      delete c.waitingSince;
      return {
        text: "Te derivamos con una persona. Te responderemos por este chat.",
      };
    });
  }
  async humanMessage(phone: string, version: number, text: string, user: User) {
    if (typeof text !== "string" || !text.trim() || text.length > 3500)
      throw new HttpError(400, "Escribe un mensaje de hasta 3500 caracteres.");
    return this.chatMutation(phone, version, user, "chat.message", (c) => {
      if (c.mode !== "human")
        throw new HttpError(409, "Primero toma el chat para pausar el bot.");
      return { text: "Equipo Jiren: " + text.trim() };
    });
  }
  async releaseChat(
    phone: string,
    version: number,
    summary: string,
    user: User,
  ) {
    if (typeof summary !== "string" || !summary.trim() || summary.length > 2500)
      throw new HttpError(400, "Resume lo acordado antes de devolver al bot.");
    return this.chatMutation(phone, version, user, "chat.release", (c) => {
      if (c.mode !== "human")
        throw new HttpError(409, "La atención humana no está activa.");
      c.mode = "bot";
      c.data.humanSummary = summary.trim();
      c.stage = "human_confirm";
      return {
        text:
          "Vuelves a ser atendido por el bot de Jiren Sushi.\nLo acordado con el equipo: " +
          summary.trim() +
          "\n¿Es correcto?",
        choices: [
          { id: "confirm", title: "Sí, continuar" },
          { id: "human", title: "Volver a una persona" },
        ],
      };
    });
  }
  async incoming(input: Incoming, now = new Date()) {
    if (
      !/^\d{7,16}$/.test(input.phone) ||
      !input.id ||
      input.id.length > 250 ||
      typeof input.text !== "string" ||
      input.text.length > 10000
    )
      throw new HttpError(400, "Mensaje inválido.");
    await this.db
      .prepare(
        "INSERT OR IGNORE INTO inbox(id,phone,data,state,created_at) VALUES(?,?,?,?,?)",
      )
      .bind(input.id, input.phone, JSON.stringify(input), "pending", iso(now))
      .run();
    return this.processInbox(input.id, now);
  }
  async processInbox(id: string, now = new Date()) {
    return locked(this.db, async () => {
      const inbox = await this.db
        .prepare("SELECT * FROM inbox WHERE id=?")
        .bind(id)
        .first<{ state: string; data: string; phone: string }>();
      if (!inbox) throw new HttpError(404, "Mensaje no encontrado.");
      if (inbox.state === "done")
        return { ...(await this.chat(inbox.phone)), replies: [] as Reply[] };
      const input = JSON.parse(inbox.data) as Incoming;
      const prior = object<Conversation>(
        await this.db
          .prepare("SELECT data FROM conversations WHERE phone=?")
          .bind(input.phone)
          .first(),
      );
      const history = prior ? (await this.chat(input.phone)).messages : [];
      const orders = await this.phoneOrders(input.phone);
      const settings = await this.settings();
      const result = await processMessage(prior, input, {
        now,
        settings,
        orders,
        history,
        interpret: async (text, c) =>
          interpretIntent(
            this.env,
            text,
            {
              ...c,
              data: {
                ...c.data,
                allowedProducts: products.map((p) => ({
                  id: p.id,
                  name: p.name,
                })),
                allowedCategories: catalog.categories.map((p) => ({
                  id: p.id,
                  name: p.name,
                })),
                allowedIngredients: [
                  ...new Set(products.flatMap((p) => p.ingredients)),
                ],
              },
            },
            history,
          ),
      });
      const c = result.conversation;
      c.version = (prior?.version ?? 0) + 1;
      c.updatedAt = iso(now);
      const sourceTime =
        input.timestamp && Number.isFinite(Date.parse(input.timestamp))
          ? Math.min(Date.parse(input.timestamp), now.getTime())
          : now.getTime();
      c.lastCustomerAt = iso(
        new Date(
          Math.max(
            sourceTime,
            Math.min(
              Date.parse(prior?.lastCustomerAt ?? "") || 0,
              now.getTime(),
            ),
          ),
        ),
      );
      c.simulated = prior?.simulated ?? !!input.simulated;
      let order: Order | undefined;
      const ops: Statement[] = [];
      if (
        prior?.mode === "bot" &&
        prior.stage !== "human_confirm" &&
        c.data.abandoned &&
        !orders.some((o) => ["Pendiente", "Aceptado"].includes(o.status)) &&
        now.getTime() - Date.parse(prior.updatedAt) >= 60 * 60000
      ) {
        ops.push(
          audit(
            this.db,
            "system",
            "conversation.abandon",
            input.phone,
            {
              stage: prior.stage,
              draft: prior.draft,
              lastActivityAt: prior.updatedAt,
              version: prior.version,
            },
            iso(now),
          ),
        );
      }
      if (result.reopenOrderId) {
        const original = orders.find((o) => o.id === result.reopenOrderId);
        if (
          !original ||
          original.status !== "Rechazado" ||
          original.reason !== "ingredients" ||
          original.locked
        )
          throw new HttpError(409, "Ese pedido no se puede reabrir.");
        original.locked = true;
        original.version++;
        original.updatedAt = iso(now);
        ops.push(
          saveOrder(this.db, original),
          audit(
            this.db,
            "customer",
            "order.reopen",
            original.id,
            { phone: input.phone },
            iso(now),
          ),
        );
      }
      if (result.submit) {
        const validated = validateDraft(result.submit, settings, now);
        if (!validated.valid) throw new HttpError(400, validated.error!);
        result.submit = validated.draft!;
        if (orders.some((o) => ["Pendiente", "Aceptado"].includes(o.status)))
          throw new HttpError(409, "Ya existe un pedido activo.");
        const count = await this.db
          .prepare("SELECT COUNT(*) AS n FROM orders")
          .first<{ n: number }>();
        const orderId = crypto.randomUUID();
        order = {
          ...result.submit,
          id: orderId,
          number:
            "J-" +
            String((count?.n ?? 0) + 1).padStart(5, "0") +
            "-" +
            orderId.slice(0, 4).toUpperCase(),
          phone: input.phone,
          status: "Pendiente",
          createdAt: iso(now),
          updatedAt: iso(now),
          version: 1,
          locked: false,
        };
        c.orderId = orderId;
        ops.push(
          saveOrder(this.db, order, true),
          audit(
            this.db,
            "customer",
            "order.submit",
            order.id,
            { number: order.number, total: order.total },
            iso(now),
          ),
        );
        result.replies.push({
          text:
            "Tu número de pedido es " +
            order.number +
            ". Estamos validando tu pedido con el local.",
        });
      }
      ops.push(
        saveConversation(this.db, c),
        this.db
          .prepare(
            "INSERT INTO messages(id,phone,role,text,created_at) VALUES(?,?,?,?,?)",
          )
          .bind(
            "in:" + id,
            input.phone,
            "customer",
            input.location
              ? input.text +
                  " [Ubicación: " +
                  input.location.latitude +
                  ", " +
                  input.location.longitude +
                  "]"
              : input.text,
            iso(new Date(sourceTime)),
          ),
      );
      for (const r of result.replies)
        ops.push(...outgoing(this.db, input.phone, r, iso(now), !!c.simulated));
      ops.push(
        this.db
          .prepare("UPDATE inbox SET state='done',error=NULL WHERE id=?")
          .bind(id),
      );
      await this.db.batch(ops);
      return { conversation: c, replies: result.replies, order };
    });
  }
  async outbox() {
    const rows = await this.db
      .prepare(
        "SELECT id,phone,text,state,error,created_at AS createdAt,attempts,provider_id AS providerId FROM outbox ORDER BY created_at DESC LIMIT 200",
      )
      .all();
    return { messages: rows.results };
  }
  async retryOutbox(id: string) {
    return locked(this.db, async () => {
      const row = await this.db
        .prepare("SELECT state FROM outbox WHERE id=?")
        .bind(id)
        .first<{ state: string }>();
      if (!row) throw new HttpError(404, "Mensaje no encontrado.");
      if (row.state === "uncertain")
        throw new HttpError(
          409,
          "Resultado de entrega incierto: revisa la entrega antes de reenviar.",
        );
      if (!["blocked", "failed"].includes(row.state))
        throw new HttpError(409, "Este estado no permite reenviar el mensaje.");
      // An explicit operator retry starts a new budget, without trusting stale receipts from the previous attempt.
      await this.db
        .prepare(
          "UPDATE outbox SET state='pending',attempts=0,next_attempt=?,error=NULL,provider_id=NULL WHERE id=? AND state IN ('blocked','failed')",
        )
        .bind(iso(), id)
        .run();
    });
  }
  async flush(now = new Date()) {
    const rows = await this.db
      .prepare(
        "SELECT id FROM outbox WHERE state IN ('pending','failed') AND next_attempt <= ? AND attempts < 8 ORDER BY created_at,rowid LIMIT 12",
      )
      .bind(iso(now))
      .all<{ id: string }>();
    for (const row of rows.results) {
      await locked(this.db, async () => {
        const out = await this.db
          .prepare(
            "SELECT * FROM outbox WHERE id=? AND state IN ('pending','failed')",
          )
          .bind(row.id)
          .first<Record<string, any>>();
        if (!out) return;
        const c = object<Conversation>(
          await this.db
            .prepare("SELECT data FROM conversations WHERE phone=?")
            .bind(out.phone)
            .first(),
        );
        if (out.kind === "bot" && c?.mode === "human") {
          await this.db
            .prepare("UPDATE outbox SET state='cancelled' WHERE id=?")
            .bind(out.id)
            .run();
          return;
        }
        if (!this.env.META_ACCESS_TOKEN || !this.env.META_PHONE_NUMBER_ID) {
          await this.db
            .prepare(
              "UPDATE outbox SET state='blocked',error='Faltan credenciales de WhatsApp' WHERE id=?",
            )
            .bind(out.id)
            .run();
          return;
        }
        await this.db
          .prepare(
            "UPDATE outbox SET state='sending',attempts=attempts+1,next_attempt=? WHERE id=?",
          )
          .bind(iso(now), out.id)
          .run();
        try {
          const response = await sendWhatsApp(
            this.env,
            out.phone,
            JSON.parse(out.reply),
            c?.lastCustomerAt ?? "1970-01-01T00:00:00Z",
            now,
          );
          await this.db
            .prepare(
              "UPDATE outbox SET state='sent',provider_id=?,error=NULL WHERE id=?",
            )
            .bind(response.id, out.id)
            .run();
        } catch (error: any) {
          const state = error.uncertain
            ? "uncertain"
            : error.retryable
              ? "failed"
              : "blocked";
          await this.db
            .prepare(
              "UPDATE outbox SET state=?,error=?,next_attempt=? WHERE id=?",
            )
            .bind(
              state,
              error.code ?? "No se pudo enviar el mensaje",
              iso(
                new Date(
                  now.getTime() + Math.min(3600000, 30000 * 2 ** out.attempts),
                ),
              ),
              out.id,
            )
            .run();
        }
      });
    }
  }
  async tick(now = new Date()) {
    const isoNow = iso(now);
    await locked(this.db, async () => {
      const ops: Statement[] = [];
      const orders = await this.db
        .prepare(
          "SELECT data FROM orders WHERE status='Pendiente' AND created_at <= ?",
        )
        .bind(iso(new Date(now.getTime() - 10 * 60000)))
        .all<{ data: string }>();
      for (const row of orders.results) {
        const o = JSON.parse(row.data) as Order;
        if (o.delayNotified) continue;
        o.delayNotified = true;
        o.version++;
        o.updatedAt = isoNow;
        const c = object<Conversation>(
          await this.db
            .prepare("SELECT data FROM conversations WHERE phone=?")
            .bind(o.phone)
            .first(),
        );
        ops.push(
          saveOrder(this.db, o),
          ...outgoing(
            this.db,
            o.phone,
            {
              text: `Pedido ${o.number}: el local está demorando en responder. Tu pedido sigue pendiente; te avisaremos cuando lo revisen.`,
            },
            isoNow,
            c?.simulated ?? this.env.APP_ENV === "development",
            "notice",
          ),
        );
      }
      const waiting = await this.db
        .prepare("SELECT data FROM conversations WHERE mode='waiting'")
        .all<{ data: string }>();
      for (const row of waiting.results) {
        const c = JSON.parse(row.data) as Conversation;
        if (
          !c.waitingSince ||
          Date.parse(c.waitingSince) > now.getTime() - 15 * 60000
        )
          continue;
        c.mode = "bot";
        c.version++;
        c.updatedAt = isoNow;
        delete c.waitingSince;
        ops.push(
          saveConversation(this.db, c),
          ...outgoing(
            this.db,
            c.phone,
            {
              text: "No hay una persona disponible en este momento. Vuelves a ser atendido por el bot. Puedes continuar tu pedido o pedir atención más tarde.",
            },
            isoNow,
            !!c.simulated,
            "notice",
          ),
        );
      }
      // A sending row surviving beyond the transport timeout has an unknown delivery outcome.
      ops.push(
        this.db
          .prepare(
            "UPDATE outbox SET state='uncertain',error='Envío interrumpido: revisar entrega antes de reenviar' WHERE state='sending' AND next_attempt < ?",
          )
          .bind(iso(new Date(now.getTime() - 120000))),
      );
      const cutoff = iso(new Date(now.getTime() - 90 * 86400000));
      // Expire individual records, so a returning customer does not extend old PII forever.
      // Current orders and human handoffs keep the context needed to complete that work.
      const humanPhones =
        "SELECT phone FROM conversations WHERE mode IN ('waiting','human') OR json_extract(data,'$.stage')='human_confirm'";
      const protectedPhones =
        "SELECT phone FROM orders WHERE status IN ('Pendiente','Aceptado') UNION " +
        humanPhones;
      const terminal =
        "status IN ('Rechazado','Entregado') AND updated_at < ? AND phone NOT IN (" +
        humanPhones +
        ")";
      ops.push(
        this.db
          .prepare(
            "INSERT INTO daily_stats(day,delivered,revenue) SELECT substr(created_at,1,10),count(*),sum(json_extract(data,'$.total')) FROM orders WHERE status='Entregado' AND updated_at < ? AND phone NOT IN (" +
              humanPhones +
              ") GROUP BY substr(created_at,1,10) ON CONFLICT(day) DO UPDATE SET delivered=delivered+excluded.delivered,revenue=revenue+excluded.revenue",
          )
          .bind(cutoff),
      );
      ops.push(
        this.db
          .prepare(
            "DELETE FROM audit WHERE target IN (SELECT id FROM orders WHERE " +
              terminal +
              ")",
          )
          .bind(cutoff),
      );
      ops.push(
        this.db.prepare("DELETE FROM orders WHERE " + terminal).bind(cutoff),
      );
      ops.push(
        this.db
          .prepare(
            "DELETE FROM messages WHERE created_at < ? AND phone NOT IN (" +
              protectedPhones +
              ")",
          )
          .bind(cutoff),
      );
      ops.push(
        this.db
          .prepare(
            "DELETE FROM inbox WHERE created_at < ? AND state='done' AND phone NOT IN (" +
              protectedPhones +
              ")",
          )
          .bind(cutoff),
      );
      ops.push(
        this.db
          .prepare(
            "DELETE FROM outbox WHERE created_at < ? AND state NOT IN ('pending','sending','uncertain') AND phone NOT IN (" +
              protectedPhones +
              ")",
          )
          .bind(cutoff),
      );
      ops.push(
        this.db
          .prepare(
            "DELETE FROM audit WHERE created_at < ? AND target NOT IN (" +
              protectedPhones +
              ") AND target NOT IN (SELECT id FROM orders WHERE status IN ('Pendiente','Aceptado') OR phone IN (" +
              humanPhones +
              "))",
          )
          .bind(cutoff),
      );
      ops.push(
        this.db
          .prepare(
            "DELETE FROM conversations WHERE updated_at < ? AND mode='bot' AND phone NOT IN (SELECT phone FROM orders) AND phone NOT IN (SELECT phone FROM inbox WHERE state='pending') AND phone NOT IN (SELECT phone FROM outbox WHERE state IN ('pending','sending','uncertain'))",
          )
          .bind(cutoff),
      );
      if (ops.length) await this.db.batch(ops);
    });
    const pending = await this.db
      .prepare(
        "SELECT id FROM inbox WHERE state='pending' ORDER BY created_at,rowid LIMIT 20",
      )
      .all<{ id: string }>();
    for (const row of pending.results) {
      try {
        await this.processInbox(row.id, now);
      } catch (error) {
        await this.db
          .prepare("UPDATE inbox SET error=? WHERE id=?")
          .bind(
            error instanceof HttpError
              ? error.message
              : "No se pudo procesar; se reintentará",
            row.id,
          )
          .run();
      }
    }
    await this.flush(now);
  }
  async audit() {
    return {
      audit: (
        await this.db
          .prepare(
            "SELECT id,actor,action,target,detail,created_at AS createdAt FROM audit ORDER BY id DESC LIMIT 1000",
          )
          .all<Audit>()
      ).results,
    };
  }
}
