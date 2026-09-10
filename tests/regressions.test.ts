import test from "node:test";
import assert from "node:assert/strict";
import { processMessage } from "../src/domain/bot.ts";
import {
  parseModifications,
  repriceItem,
  validateDraft,
} from "../src/domain/pricing.ts";
import { findProduct } from "../src/domain/catalog.ts";
import { defaults } from "../src/service.ts";
import type { BotContext, Conversation } from "../src/types.ts";
import { scheduledTime } from "../src/domain/hours.ts";
const ctx: BotContext = {
  now: new Date("2026-09-10T17:00:00Z"),
  settings: defaults,
  orders: [],
  history: [],
};
async function flow(
  texts: string[],
  prior: Conversation | null = null,
  context = ctx,
) {
  let r;
  for (const text of texts) {
    r = await processMessage(
      prior,
      { id: crypto.randomUUID(), phone: "56955555555", text },
      context,
    );
    prior = r.conversation;
  }
  return r!;
}
const item = [
  "retiro",
  "Avo Furay",
  "Elegir cantidad",
  "1",
  "No",
  "Confirmar unidad",
];
test("unknown ingredient suffix does not partially remove valid ingredients", () => {
  const r = parseModifications(
    "sin queso crema y agregar pollo inexistente",
    findProduct("avo-furay")!,
    {},
  );
  assert.equal(r.modifications, undefined);
});
test("every table replacement spelling is rejected and injected table replacements fail pricing", () => {
  const p = findProduct("tabla-mixta-15000")!;
  for (const verb of ["cambia", "cambiar", "reemplaza", "reemplazar"])
    assert.equal(
      parseModifications(verb + " California Camarón por Panko Teriyaki", p, {})
        .modifications,
      undefined,
    );
  assert.equal(
    repriceItem({
      id: "x",
      productId: p.id,
      name: p.name,
      basePrice: p.price,
      options: {},
      modifications: [
        { action: "replace", from: "Camarón", ingredient: "Pollo", price: 0 },
      ],
      subtotal: 1,
    }),
    null,
  );
});
test("ASAP cannot submit during exceptional closure even if reopening is today", async () => {
  const r = await flow([
    ...item,
    "finalizar",
    "lo antes posible",
    "tarjeta",
    "Ana Soto",
  ]);
  assert.equal(
    validateDraft(
      r.conversation.draft,
      { ...defaults, manualClosed: true, reopenAt: "2026-09-10T20:00:00Z" },
      ctx.now,
    ).valid,
    false,
  );
});
test("exact deterministic product and modality work when AI is unavailable", async () => {
  const r = await flow(["retiro en local", "Avo Furay"], null, {
    ...ctx,
    interpret: async () => {
      throw Error("network");
    },
  });
  assert.equal(r.conversation.stage, "detail");
});
test("old product button cannot discard pending personalized unit", async () => {
  const r = await flow([
    "retiro",
    "Avo Furay",
    "Elegir cantidad",
    "1",
    "No",
    "product:hot-rolls",
  ]);
  assert.equal(r.conversation.stage, "unit_confirm");
  assert.equal(r.conversation.data.productId, "avo-furay");
});
test("old confirm-unit choice cannot confirm a later unit", async () => {
  let r = await flow(["retiro", "Avo Furay", "Elegir cantidad", "2", "No"]);
  const id = r.replies[0].choices!.find(
    (c) => c.title === "Confirmar unidad",
  )!.id;
  r = await flow([id, "No", id], r.conversation);
  assert.equal(r.conversation.draft.items.length, 0);
  assert.equal(r.conversation.stage, "unit_confirm");
});
test("modifying mandatory option permits changing protein before confirming", async () => {
  let r = await flow([
    "retiro",
    "Rainbow Rolls",
    "Elegir cantidad",
    "1",
    "Pollo Teriyaki",
    "Salmón",
    "No",
  ]);
  r = await flow(
    ["Modificar", "Atún", "Camarón", "No", "Confirmar unidad"],
    r.conversation,
  );
  assert.equal(r.conversation.draft.items[0].options.proteina, "Atún");
});
test("confirmed human agreement changes validated order schedule and one-unit modification", async () => {
  let r = await flow(item);
  r.conversation.stage = "human_confirm";
  r.conversation.data.resumeStage = "menu";
  r.conversation.data.humanSummary = "Retiro a las 20:30; sin queso crema";
  r = await flow(["confirmar resumen"], r.conversation);
  assert.equal(r.conversation.draft.schedule?.time, "2026-09-10T23:30:00.000Z");
  assert.equal(
    r.conversation.draft.items[0].modifications[0].ingredient,
    "Queso Crema",
  );
});

test("stale modality choice cannot abandon the current unit", async () => {
  const r = await flow([
    "retiro",
    "Avo Furay",
    "Elegir cantidad",
    "1",
    "No",
    "mode:despacho",
  ]);
  assert.equal(r.conversation.stage, "unit_confirm");
  assert.equal(r.conversation.draft.mode, "retiro");
});
test("editing cart mandatory options preserves original until unit approval", async () => {
  let r = await flow([
    "retiro",
    "Rainbow Rolls",
    "Elegir cantidad",
    "1",
    "Pollo Teriyaki",
    "Salmón",
    "No",
    "Confirmar unidad",
    "carrito",
    "editar 1",
  ]);
  assert.equal(r.conversation.stage, "option");
  assert.equal(
    r.conversation.draft.items[0].options.proteina,
    "Pollo Teriyaki",
  );
  r = await flow(["Atún", "Camarón", "No", "Confirmar unidad"], r.conversation);
  assert.equal(r.conversation.draft.items.length, 1);
  assert.equal(r.conversation.draft.items[0].options.proteina, "Atún");
});
test("scheduled order can use the published closing time exactly", () => {
  assert.equal(scheduledTime("23:30", ctx.now, defaults).ok, true);
});
test("ASAP before opening is refused at selection instead of after checkout", async () => {
  const early = { ...ctx, now: new Date("2026-09-10T12:00:00Z") };
  const r = await flow([...item, "finalizar", "lo antes posible"], null, early);
  assert.equal(r.conversation.stage, "schedule");
  assert.equal(r.conversation.draft.schedule, undefined);
  assert.match(r.replies[0].text, /apertura/);
});
test("ambiguous eight uses next future time inside opening hours", async () => {
  const early = { ...ctx, now: new Date("2026-09-10T09:00:00Z") };
  const r = await flow(
    [...item, "finalizar", "program", "a las 8"],
    null,
    early,
  );
  assert.equal(r.conversation.draft.schedule?.time, "2026-09-10T23:00:00.000Z");
});
test("zone price change requires a new visible summary and explicit confirmation", async () => {
  let r = await flow([
    "despacho",
    "Centro",
    "Calle Uno 123",
    "sin referencia",
    ...item.slice(1),
    "finalizar",
    "lo antes posible",
    "tarjeta",
    "Ana Soto",
  ]);
  const updated = {
    ...ctx,
    settings: {
      ...defaults,
      zones: defaults.zones.map((z) => ({ ...z, price: z.price + 1000 })),
    },
  };
  r = await flow(["submit"], r.conversation, updated);
  assert.equal(r.submit, undefined);
  assert.equal(r.conversation.draft.deliveryFee, 4500);
  assert.match(r.replies[0].text, /actualiz/);
  r = await flow(["submit"], r.conversation, updated);
  assert.equal(r.submit?.total, 16400);
});

test("confirmed human context is carried to order even when not a structured ingredient change", async () => {
  let r = await flow(item);
  r.conversation.stage = "human_confirm";
  r.conversation.data.resumeStage = "menu";
  r.conversation.data.humanSummary = "Llamar al timbre azul al llegar.";
  r = await flow(
    [
      "confirmar resumen",
      "finalizar",
      "lo antes posible",
      "tarjeta",
      "Ana Soto",
      "submit",
    ],
    r.conversation,
  );
  assert.deepEqual(r.submit?.humanNotes, ["Llamar al timbre azul al llegar."]);
});
test("waiting for human agreement confirmation cannot silently discard that agreement", async () => {
  let r = await flow(item);
  r.conversation.stage = "human_confirm";
  r.conversation.data.humanSummary = "Retiro a las 20:30";
  r.conversation.updatedAt = "2026-09-10T12:00:00Z";
  r = await flow(["hola"], r.conversation);
  assert.equal(r.conversation.stage, "human_confirm");
  assert.match(r.replies[0].text, /20:30/);
});
test("navigating before last unit confirmation never loses already confirmed units", async () => {
  let r = await flow([
    "retiro",
    "Avo Furay",
    "Elegir cantidad",
    "2",
    "No",
    "Confirmar unidad",
  ]);
  r = await flow(["menu"], r.conversation);
  assert.equal(r.conversation.stage, "modify_question");
  assert.equal(r.conversation.data.configured.length, 1);
  r = await flow(["Cancelar unidad"], r.conversation);
  assert.equal(r.conversation.draft.items.length, 1);
});
