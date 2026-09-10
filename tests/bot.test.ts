import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import type { Conversation, BotContext, Order } from "../src/types.ts";

const settings = {
  branch: "Sucursal Viña del Mar",
  address: "5 Norte 615, Viña del Mar",
  manualClosed: false,
  reopenAt: null,
  zones: [
    {
      id: "centro",
      name: "Centro",
      price: 3500,
      description: "Centro",
      enabled: true,
    },
  ],
  asapMinutes: 30,
  retentionDays: 90,
};
const ctx: BotContext = {
  now: new Date("2026-09-09T17:00:00Z"),
  settings,
  orders: [],
  history: [],
};
async function domain() {
  assert.ok(
    existsSync(new URL("../src/domain/bot.ts", import.meta.url)),
    "bot domain is implemented",
  );
  return import("../src/domain/bot.ts");
}
async function flow(
  messages: string[],
  start: Conversation | null = null,
  context = ctx,
) {
  const { processMessage } = await domain();
  let conversation = start;
  let result: any;
  for (const [i, text] of messages.entries()) {
    result = await processMessage(
      conversation,
      { id: `test-${i}`, phone: "56911111111", text },
      context,
    );
    conversation = result.conversation;
  }
  return result as Awaited<ReturnType<typeof processMessage>>;
}
const oneItem = [
  "retiro",
  "Avo Furay",
  "Elegir cantidad",
  "1",
  "No",
  "Confirmar unidad",
];
test("welcome preserves original message and known candidates then opens only Vina", async () => {
  const r = await flow(["Hola quiero retirar 2 Avo Furay, soy Juan Pérez"]);
  assert.equal(r.conversation.draft.mode, "retiro");
  assert.match(r.replies[0].text, /Bienvenido/);
  assert.match(r.conversation.data.firstMessage, /2 Avo Furay/);
  assert.ok(r.conversation.data.candidates);
  assert.equal(r.conversation.draft.items.length, 0);
  const again = await flow(["menú"], r.conversation);
  assert.doesNotMatch(again.replies.map((x) => x.text).join(""), /Bienvenido/);
  assert.equal(again.replies.at(-1)!.choices!.length, 8);
});
test("detail and invalid quantity never add food; two units require individual confirmation", async () => {
  let r = await flow(["retiro", "Avo Furay"]);
  assert.equal(r.conversation.stage, "detail");
  assert.equal(r.conversation.draft.items.length, 0);
  r = await flow(["Elegir cantidad", "0", "-1", "1.5"], r.conversation);
  assert.equal(r.conversation.stage, "quantity");
  r = await flow(["2", "No", "Confirmar unidad"], r.conversation);
  assert.equal(r.conversation.draft.items.length, 0);
  r = await flow(["Igual a la anterior", "Confirmar unidad"], r.conversation);
  assert.equal(r.conversation.draft.items.length, 2);
  assert.equal(r.conversation.draft.total, 23800);
});
test("mandatory choices precede changes and second unit can cancel without deleting first", async () => {
  const r = await flow([
    "retiro",
    "Rainbow Rolls",
    "Elegir cantidad",
    "2",
    "Pollo Teriyaki",
    "Salmón",
    "No",
    "Confirmar unidad",
    "Cancelar unidad",
  ]);
  assert.equal(r.conversation.draft.items.length, 1);
  assert.deepEqual(r.conversation.draft.items[0].options, {
    proteina: "Pollo Teriyaki",
    exterior: "Salmón",
  });
});
test("modifications are atomic, require approval and calculate full modifier charges", async () => {
  let r = await flow([
    "retiro",
    "Avo Furay",
    "Elegir cantidad",
    "1",
    "Sí",
    "sin queso crema y agregar unicornio",
  ]);
  assert.equal(r.conversation.stage, "modifications");
  assert.equal(r.conversation.draft.items.length, 0);
  r = await flow(
    ["sin queso crema y agregar camarón", "Confirmar unidad"],
    r.conversation,
  );
  assert.equal(r.conversation.draft.items[0].subtotal, 13400);
  assert.deepEqual(
    r.conversation.draft.items[0].modifications.map((x) => x.price),
    [0, 1500],
  );
});
test("table composition cannot be swapped", async () => {
  const r = await flow([
    "retiro",
    "tabla-mixta-15000",
    "Elegir cantidad",
    "1",
    "Sí",
    "cambiar California Camarón por Panko Teriyaki",
  ]);
  assert.equal(r.conversation.stage, "modifications");
  assert.match(r.replies[0].text, /fija/);
  assert.equal(r.conversation.draft.items.length, 0);
});
test("checkout requires schedule payment full name and final confirmation before submit effect", async () => {
  let r = await flow([
    ...oneItem,
    "carrito",
    "finalizar",
    "lo antes posible",
    "tarjeta",
    "Juan Pérez",
  ]);
  assert.equal(r.conversation.stage, "confirm");
  assert.equal(r.submit, undefined);
  assert.match(r.replies[0].text, /Juan Pérez/);
  r = await flow(["confirmar pedido"], r.conversation);
  assert.equal(r.submit?.total, 11900);
  assert.equal(r.submit?.payment, "Tarjeta");
});
test("delivery captures chosen configured zone and text address without geovalidation", async () => {
  const r = await flow([
    "despacho",
    "Centro",
    "Calle Inventada 123, depto 4",
    "sin referencia",
    ...oneItem.slice(1),
    "finalizar",
    "lo antes posible",
    "efectivo",
    "María Soto",
    "confirmar pedido",
  ]);
  assert.equal(r.submit?.deliveryFee, 3500);
  assert.equal(r.submit?.total, 15400);
  assert.equal(r.submit?.address, "Calle Inventada 123, depto 4");
});
test("cart deletion and editing affect one unit and keep recalculated totals", async () => {
  let r = await flow([
    "retiro",
    "Avo Furay",
    "Elegir cantidad",
    "2",
    "No",
    "Confirmar unidad",
    "Igual a la anterior",
    "Confirmar unidad",
    "carrito",
    "eliminar 1",
  ]);
  assert.equal(r.conversation.draft.items.length, 1);
  assert.equal(r.conversation.draft.total, 11900);
  r = await flow(
    ["editar 1", "Sí", "agregar atún", "Confirmar unidad"],
    r.conversation,
  );
  assert.equal(r.conversation.draft.items.length, 1);
  assert.equal(r.conversation.draft.total, 13900);
});
test("active pending or accepted orders block a second order and human request still has priority", async () => {
  for (const status of ["Pendiente", "Aceptado"] as const) {
    const order = {
      id: "o1",
      status,
      phone: "56911111111",
      number: "J-1",
      createdAt: ctx.now.toISOString(),
    } as Order;
    const r = await flow(["retiro"], null, { ...ctx, orders: [order] });
    assert.match(r.replies[0].text, /J-1/);
    assert.equal(r.conversation.draft.items.length, 0);
    const human = await flow(["persona"], r.conversation, {
      ...ctx,
      orders: [order],
    });
    assert.equal(human.conversation.stage, "human_branch");
  }
});
test("human wait and control produce no automatic reply; return confirms provided context", async () => {
  let r = await flow(["retiro", "hablar con una persona"]);
  assert.equal(r.conversation.mode, "waiting");
  assert.ok(r.conversation.waitingSince);
  r = await flow(["sigo esperando"], r.conversation);
  assert.equal(r.replies.length, 0);
  r.conversation.mode = "human";
  r = await flow(["hola"], r.conversation);
  assert.equal(r.replies.length, 0);
  r.conversation.mode = "bot";
  r.conversation.stage = "human_confirm";
  r.conversation.data.humanSummary =
    "Cliente acordó retirar con Juan; revisar alergia.";
  r.conversation.data.resumeStage = "menu";
  r = await flow(["hola"], r.conversation);
  assert.match(r.replies[0].text, /acordó retirar/);
  assert.equal(r.conversation.stage, "human_confirm");
  r = await flow(["confirmar resumen"], r.conversation);
  assert.equal(r.conversation.stage, "menu");
});
test("ingredients rejection reopens only most recent eligible order and copies unaffected items", async () => {
  const base = await flow(oneItem);
  const item = base.conversation.draft.items[0];
  const order = {
    ...base.conversation.draft,
    id: "rejected",
    number: "J-7",
    phone: "56911111111",
    status: "Rechazado",
    reason: "ingredients",
    missing: [{ productId: item.productId, ingredient: "Salmón" }],
    createdAt: ctx.now.toISOString(),
    updatedAt: ctx.now.toISOString(),
    version: 1,
    locked: false,
  } as Order;
  const r = await flow(["reabrir"], base.conversation, {
    ...ctx,
    orders: [order],
  });
  assert.equal(r.reopenOrderId, "rejected");
  assert.equal(r.conversation.draft.items.length, 0);
  assert.equal(r.conversation.stage, "menu");
  const hidden = await flow(["Avo Furay"], r.conversation, {
    ...ctx,
    orders: [{ ...order, locked: true }],
  });
  assert.notEqual(hidden.conversation.stage, "detail");
  const fresh = await flow(
    ["nuevo pedido", "retiro", "Avo Furay"],
    r.conversation,
    { ...ctx, orders: [{ ...order, locked: true }] },
  );
  assert.equal(fresh.conversation.stage, "detail");
});
test("hours apply Chile DST, exact closing and same-day 30-minute 15-minute scheduling", async () => {
  assert.ok(
    existsSync(new URL("../src/domain/hours.ts", import.meta.url)),
    "hours domain is implemented",
  );
  const { branchAvailability, scheduledTime } =
    await import("../src/domain/hours.ts");
  assert.equal(
    branchAvailability(new Date("2026-09-09T14:00:00Z"), settings).open,
    true,
  );
  assert.equal(
    branchAvailability(new Date("2026-09-10T02:30:00Z"), settings)
      .canScheduleToday,
    false,
  );
  assert.equal(
    branchAvailability(new Date("2026-07-08T15:00:00Z"), settings).open,
    true,
  );
  assert.equal(
    branchAvailability(new Date("2026-09-13T14:00:00Z"), settings).open,
    false,
  );
  assert.equal(scheduledTime("14:15", ctx.now, settings).ok, false);
  assert.equal(scheduledTime("14:40", ctx.now, settings).ok, false);
  assert.equal(scheduledTime("14:30", ctx.now, settings).ok, true);
  assert.equal(scheduledTime("mañana 14:30", ctx.now, settings).ok, false);
});
