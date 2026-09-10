import test from "node:test";
import assert from "node:assert/strict";
import { createDatabase } from "../scripts/sqlite.ts";
import { readFileSync } from "node:fs";
import { Service, defaults } from "../src/service.ts";
import type { Order, User, Conversation } from "../src/types.ts";
const user: User = { id: "worker", username: "local", role: "local" };
function setup() {
  const db = createDatabase(":memory:");
  db.exec(
    readFileSync(
      new URL("../migrations/0001_initial.sql", import.meta.url),
      "utf8",
    ),
  );
  return { db, service: new Service({ DB: db, APP_ENV: "development" }) };
}
function order(id = "one"): Order {
  return {
    id,
    number: "J-0001",
    phone: "56911111111",
    status: "Pendiente",
    items: [
      {
        id: "u1",
        productId: "avo-furay",
        name: "Avo Furay",
        basePrice: 11900,
        subtotal: 11900,
        options: {},
        modifications: [],
      },
    ],
    mode: "retiro",
    customerName: "Ana Soto",
    deliveryFee: 0,
    total: 11900,
    payment: "Tarjeta",
    schedule: { kind: "asap", estimateMinutes: 30 },
    createdAt: "2026-09-09T19:00:00.000Z",
    updatedAt: "2026-09-09T19:00:00.000Z",
    version: 1,
    locked: false,
  };
}
async function seed(db: any, o = order()) {
  await db
    .prepare(
      "INSERT INTO orders(id,phone,status,created_at,updated_at,version,data) VALUES(?,?,?,?,?,?,?)",
    )
    .bind(
      o.id,
      o.phone,
      o.status,
      o.createdAt,
      o.updatedAt,
      o.version,
      JSON.stringify(o),
    )
    .run();
}
test("only accepted order can become delivered and delivery is irreversible", async () => {
  const { db, service } = setup();
  await seed(db);
  await assert.rejects(() =>
    service.changeStatus("one", { version: 1, status: "Entregado" }, user),
  );
  const a = await service.changeStatus(
    "one",
    { version: 1, status: "Aceptado", estimateMinutes: 40 },
    user,
  );
  assert.equal(a.schedule?.estimateMinutes, 40);
  const d = await service.changeStatus(
    "one",
    { version: 2, status: "Entregado" },
    user,
  );
  assert.equal(d.status, "Entregado");
  await assert.rejects(() =>
    service.changeStatus(
      "one",
      { version: 3, status: "Rechazado", reason: "closed" },
      user,
    ),
  );
});
test("stale simultaneous decision does not overwrite first decision", async () => {
  const { db, service } = setup();
  await seed(db);
  await service.changeStatus("one", { version: 1, status: "Aceptado" }, user);
  await assert.rejects(
    () =>
      service.changeStatus(
        "one",
        { version: 1, status: "Rechazado", reason: "closed" },
        user,
      ),
    /actualizado|conflicto/i,
  );
  assert.equal((await service.order("one")).order.status, "Aceptado");
});
test("ingredient rejection requires products that exist in the order", async () => {
  const { db, service } = setup();
  await seed(db);
  await assert.rejects(() =>
    service.changeStatus(
      "one",
      {
        version: 1,
        status: "Rechazado",
        reason: "ingredients",
        missing: [{ productId: "fake", ingredient: "queso" }],
      },
      user,
    ),
  );
  const r = await service.changeStatus(
    "one",
    {
      version: 1,
      status: "Rechazado",
      reason: "ingredients",
      missing: [{ productId: "avo-furay", ingredient: "salmón" }],
      comment: "private",
    },
    user,
  );
  assert.equal(r.reason, "ingredients");
  const messages = await service.outbox();
  assert.equal(
    messages.messages.some((m: any) => m.text.includes("private")),
    false,
  );
});
test("locked reopened order cannot be accepted", async () => {
  const { db, service } = setup();
  const o = order();
  o.status = "Rechazado";
  o.locked = true;
  await seed(db, o);
  await assert.rejects(
    () => service.changeStatus("one", { version: 1, status: "Aceptado" }, user),
    /reabierto|bloqueado/i,
  );
});
test("manual closure requires future reopening and preserves pending orders", async () => {
  const { db, service } = setup();
  await seed(db);
  await assert.rejects(() =>
    service.saveSettings(
      { ...defaults, manualClosed: true, reopenAt: null },
      user,
    ),
  );
  await service.saveSettings(
    {
      ...defaults,
      manualClosed: true,
      reopenAt: new Date(Date.now() + 3600000).toISOString(),
    },
    user,
  );
  assert.equal((await service.order("one")).order.status, "Pendiente");
});
test("ten minute pending notice is emitted once without auto rejection", async () => {
  const { db, service } = setup();
  await seed(db);
  await service.tick(new Date("2026-09-09T19:11:00Z"));
  await service.tick(new Date("2026-09-09T19:12:00Z"));
  const after = (await service.order("one")).order;
  assert.equal(after.status, "Pendiente");
  assert.equal(after.delayNotified, true);
  const q = await service.outbox();
  assert.equal(
    q.messages.filter((m: any) => m.text.includes("demorando")).length,
    1,
  );
});
test("human takeover prevents bot processing and release preserves transcript", async () => {
  const { service } = setup();
  await service.incoming(
    { id: "hello", phone: "56922222222", text: "hola", simulated: true },
    new Date("2026-09-09T19:00:00Z"),
  );
  let { conversation } = await service.chat("56922222222");
  conversation = await service.takeChat(
    conversation.phone,
    conversation.version,
    user,
  );
  await service.incoming({
    id: "after",
    phone: conversation.phone,
    text: "Necesito cambiar mi pedido",
    simulated: true,
  });
  let chat = await service.chat(conversation.phone);
  assert.equal(chat.messages.at(-1)?.role, "customer");
  conversation = await service.humanMessage(
    conversation.phone,
    chat.conversation.version,
    "Acordamos retiro a las 20:30",
    user,
  );
  conversation = await service.releaseChat(
    conversation.phone,
    conversation.version,
    "Retiro a las 20:30",
    user,
  );
  assert.equal(conversation.stage, "human_confirm");
  chat = await service.chat(conversation.phone);
  assert.ok(chat.messages.some((m) => m.role === "human"));
  assert.match(chat.messages.at(-1)?.text ?? "", /bot|autom/i);
});
test("duplicate incoming event is not applied twice", async () => {
  const { service } = setup();
  const msg = {
    id: "same-id",
    phone: "56933333333",
    text: "hola",
    simulated: true,
  };
  await service.incoming(msg, new Date("2026-09-09T19:00:00Z"));
  await service.incoming(msg, new Date("2026-09-09T19:00:00Z"));
  const chat = await service.chat(msg.phone);
  assert.equal(chat.messages.filter((m) => m.role === "customer").length, 1);
});

test("active orders remain visible and counted after the three-day history window", async () => {
  const { db, service } = setup();
  const old = new Date(Date.now() - 10 * 86400000).toISOString();
  for (const [index, status] of [
    "Pendiente",
    "Aceptado",
    "Rechazado",
    "Entregado",
  ].entries()) {
    const o = order("old-" + status);
    o.phone = "5694444444" + index;
    o.status = status as Order["status"];
    o.createdAt = old;
    o.updatedAt = old;
    await seed(db, o);
  }
  const listing = await service.orders();
  assert.deepEqual(listing.orders.map((o) => o.status).sort(), [
    "Aceptado",
    "Pendiente",
  ]);
  assert.deepEqual(listing.counts, {
    Pendiente: 1,
    Aceptado: 1,
    Rechazado: 0,
    Entregado: 0,
  });
  assert.equal((await service.orders("Aceptado", "Ana")).orders.length, 1);
  assert.equal((await service.orders("Entregado")).orders.length, 0);
});

test("explicit outbox retry resets an exhausted budget but refuses uncertain sends", async () => {
  const { db, service } = setup();
  const now = new Date().toISOString();
  for (const state of ["failed", "blocked", "uncertain", "sent"]) {
    await db
      .prepare(
        "INSERT INTO outbox(id,phone,text,reply,kind,state,created_at,next_attempt,attempts,error,provider_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        state,
        "56911111111",
        "Hola",
        JSON.stringify({ text: "Hola" }),
        "notice",
        state,
        now,
        now,
        8,
        "previous error",
        "wamid." + state,
      )
      .run();
  }
  await service.retryOutbox("failed");
  await service.retryOutbox("blocked");
  for (const id of ["failed", "blocked"]) {
    const row = await db
      .prepare("SELECT state,attempts,error,provider_id FROM outbox WHERE id=?")
      .bind(id)
      .first();
    assert.deepEqual(
      { ...row },
      { state: "pending", attempts: 0, error: null, provider_id: null },
    );
  }
  await assert.rejects(
    () => service.retryOutbox("uncertain"),
    /incierto|entrega|revis/i,
  );
  await assert.rejects(
    () => service.retryOutbox("sent"),
    /reenvi|estado|enviado/i,
  );
  assert.equal(
    (
      await db
        .prepare("SELECT state FROM outbox WHERE id=?")
        .bind("uncertain")
        .first<{ state: string }>()
    )?.state,
    "uncertain",
  );
});

test("delayed customer messages preserve source time and cannot reopen the 24-hour window", async () => {
  const { db } = setup();
  const service = new Service({
    DB: db,
    APP_ENV: "production",
    META_ACCESS_TOKEN: "test-only",
    META_PHONE_NUMBER_ID: "123",
  });
  const now = new Date("2026-09-09T19:00:00Z"),
    old = "2026-09-07T19:00:00.000Z",
    phone = "56955555555";
  const result = await service.incoming(
    { id: "delayed", phone, text: "hola", timestamp: old },
    now,
  );
  assert.equal(result.conversation.lastCustomerAt, old);
  assert.equal(
    (await service.chat(phone)).messages.find((m) => m.role === "customer")
      ?.createdAt,
    old,
  );
  await service.flush(now);
  const outbox = await service.outbox();
  assert.ok(outbox.messages.length > 0);
  assert.ok(
    outbox.messages.every(
      (m: any) => m.state === "blocked" && m.error === "template_required",
    ),
  );
  await service.incoming(
    {
      id: "fresh",
      phone,
      text: "hola",
      timestamp: "2026-09-09T18:59:00Z",
      simulated: true,
    },
    now,
  );
  await service.incoming(
    { id: "older-again", phone, text: "hola", timestamp: old, simulated: true },
    now,
  );
  assert.equal(
    (await service.chat(phone)).conversation.lastCustomerAt,
    "2026-09-09T18:59:00.000Z",
  );
});

test("90-day retention removes old records even when a customer returns, preserving active context", async () => {
  const { db, service } = setup();
  const now = new Date("2026-09-09T19:00:00Z"),
    old = "2026-05-01T19:00:00.000Z",
    fresh = "2026-09-09T18:00:00.000Z";
  for (const [phone, mode] of [
    ["56960000001", "bot"],
    ["56960000002", "bot"],
    ["56960000003", "human"],
  ] as const) {
    const c: Conversation = {
      phone,
      mode,
      stage: "menu",
      draft: { items: [], total: 0, deliveryFee: 0 },
      data: {},
      version: 1,
      updatedAt: fresh,
      lastCustomerAt: fresh,
      simulated: true,
    };
    await db
      .prepare(
        "INSERT INTO conversations(phone,mode,updated_at,version,data) VALUES(?,?,?,?,?)",
      )
      .bind(phone, mode, fresh, 1, JSON.stringify(c))
      .run();
    for (const at of [old, fresh])
      await db
        .prepare("INSERT INTO messages VALUES(?,?,?,?,?)")
        .bind(phone + at, phone, "customer", "private message", at)
        .run();
  }
  const delivered = order("old-delivered");
  delivered.phone = "56960000001";
  delivered.status = "Entregado";
  delivered.createdAt = old;
  delivered.updatedAt = old;
  await seed(db, delivered);
  const active = order("old-active");
  active.phone = "56960000002";
  active.createdAt = old;
  active.updatedAt = old;
  await seed(db, active);
  for (const target of [delivered.id, active.id, delivered.phone])
    await db
      .prepare(
        "INSERT INTO audit(actor,action,target,detail,created_at) VALUES(?,?,?,?,?)",
      )
      .bind("worker", "old.action", target, '{"private":"value"}', old)
      .run();
  await db
    .prepare(
      "INSERT INTO inbox(id,phone,data,state,created_at) VALUES(?,?,?,?,?)",
    )
    .bind("old-in", delivered.phone, "{}", "done", old)
    .run();
  await db
    .prepare(
      "INSERT INTO outbox(id,phone,text,reply,kind,state,created_at,next_attempt) VALUES(?,?,?,?,?,?,?,?)",
    )
    .bind(
      "old-out",
      delivered.phone,
      "private",
      "{}",
      "notice",
      "sent",
      old,
      old,
    )
    .run();
  await service.tick(now);
  await service.tick(now);
  await assert.rejects(() => service.order(delivered.id), /no encontrado/i);
  assert.equal((await service.order(active.id)).order.status, "Pendiente");
  assert.equal(
    (
      await db
        .prepare(
          "SELECT COUNT(*) n FROM messages WHERE phone=? AND created_at < ?",
        )
        .bind(delivered.phone, fresh)
        .first<{ n: number }>()
    )?.n,
    0,
  );
  for (const phone of [active.phone, "56960000003"])
    assert.equal(
      (
        await db
          .prepare(
            "SELECT COUNT(*) n FROM messages WHERE phone=? AND created_at=?",
          )
          .bind(phone, old)
          .first<{ n: number }>()
      )?.n,
      1,
    );
  assert.equal(
    (
      await db
        .prepare("SELECT COUNT(*) n FROM audit WHERE target IN (?,?)")
        .bind(delivered.id, delivered.phone)
        .first<{ n: number }>()
    )?.n,
    0,
  );
  assert.equal(
    (
      await db
        .prepare("SELECT COUNT(*) n FROM audit WHERE target=?")
        .bind(active.id)
        .first<{ n: number }>()
    )?.n,
    1,
  );
  assert.equal(
    (
      await db
        .prepare("SELECT COUNT(*) n FROM inbox WHERE id=?")
        .bind("old-in")
        .first<{ n: number }>()
    )?.n,
    0,
  );
  assert.equal(
    (
      await db
        .prepare("SELECT COUNT(*) n FROM outbox WHERE id=?")
        .bind("old-out")
        .first<{ n: number }>()
    )?.n,
    0,
  );
  assert.deepEqual(
    {
      ...(await db
        .prepare("SELECT delivered,revenue FROM daily_stats WHERE day=?")
        .bind("2026-05-01")
        .first()),
    },
    { delivered: 1, revenue: 11900 },
  );
});

test("abandoned draft is audited once before a new conversation discards it", async () => {
  const { db, service } = setup();
  const phone = "56970000001",
    start = new Date("2026-09-09T17:00:00Z");
  const first = await service.incoming(
    { id: "draft-start", phone, text: "hola", simulated: true },
    start,
  );
  first.conversation.stage = "cart";
  first.conversation.draft = { ...order(), customerName: "Ana Soto" };
  await db
    .prepare("UPDATE conversations SET data=? WHERE phone=?")
    .bind(JSON.stringify(first.conversation), phone)
    .run();
  const input = { id: "draft-resume", phone, text: "hola", simulated: true };
  await service.incoming(input, new Date("2026-09-09T18:01:00Z"));
  await service.incoming(input, new Date("2026-09-09T18:01:00Z"));
  await service.incoming(
    { id: "draft-followup", phone, text: "retiro", simulated: true },
    new Date("2026-09-09T18:02:00Z"),
  );
  const entries = await db
    .prepare(
      "SELECT detail FROM audit WHERE target=? AND action='conversation.abandon'",
    )
    .bind(phone)
    .all<{ detail: string }>();
  assert.equal(entries.results.length, 1);
  const saved = JSON.parse(entries.results[0].detail);
  assert.equal(saved.draft.customerName, "Ana Soto");
  assert.equal(saved.draft.items[0].productId, "avo-furay");
  assert.equal(saved.stage, "cart");
});
