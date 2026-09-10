import type { Conversation, BotContext } from "../types.ts";
import { normalize, findProduct, uniqueMatch } from "./catalog.ts";
import { scheduledTime, chileParts } from "./hours.ts";
import { parseModifications, recalculate } from "./pricing.ts";
/** Applies only explicitly recognized terms in an agreement the customer already confirmed. */
export function applyAgreement(
  c: Conversation,
  summary: string,
  ctx: BotContext,
): string[] {
  const warnings: string[] = [];
  const normalized = normalize(summary);
  c.data.confirmedAgreements = [...(c.data.confirmedAgreements ?? []), summary];
  c.draft.humanNotes = [...(c.draft.humanNotes ?? []), summary];
  c.data.humanContext = ctx.history
    .filter((m) => m.role === "human")
    .map((m) => m.text)
    .join("\n");
  if (
    /retiro|retirar|recoger/.test(normalized) &&
    !/despacho|delivery/.test(normalized)
  ) {
    c.draft.mode = "retiro";
    c.draft.deliveryFee = 0;
  }
  if (
    /despacho|delivery/.test(normalized) &&
    !/retiro|retirar/.test(normalized)
  )
    c.draft.mode = "despacho";
  if (/tarjeta/.test(normalized) && !/efectivo/.test(normalized))
    c.draft.payment = "Tarjeta";
  if (/efectivo/.test(normalized) && !/tarjeta/.test(normalized))
    c.draft.payment = "Efectivo";
  const name = summary.match(/(?:nombre|a nombre de)\s*:?\s*([^;\n]+)/i);
  if (name) c.draft.customerName = name[1].trim();
  const address = summary.match(/direcci[oó]n\s*:\s*([^;\n]+)/i);
  if (address) c.draft.address = address[1].trim();
  const allergy = summary.match(/alergia\s*:\s*([^;\n]+)/i);
  if (allergy) c.draft.allergy = allergy[1].trim();
  const time = summary.match(
    /(?:a las|hora(?:rio)?\s*:?)\s*(\d{1,2})(?::(\d{2}))?/i,
  );
  if (time) {
    let hour = Number(time[1]);
    const minute = Number(time[2] ?? 0),
      now = chileParts(ctx.now);
    if (hour < 12 && hour * 60 + minute < now.hour * 60 + now.minute)
      hour += 12;
    const checked = scheduledTime(
      hour + ":" + String(minute).padStart(2, "0"),
      ctx.now,
      ctx.settings,
    );
    if (checked.ok)
      c.draft.schedule = { kind: "scheduled", time: checked.time };
    else warnings.push(checked.error!);
  }
  for (const part of summary.split(/[;\n]/)) {
    const modification = part.match(
      /\b(sin|quitar|sacar|agregar|añadir|cambiar|cambia|reemplazar)\s+.+/i,
    );
    if (!modification) continue;
    const byNumber = part.match(/unidad\s+(\d+)/i);
    const named = uniqueMatch(
      part.slice(0, modification.index),
      c.draft.items,
      (i) => [i.name, i.productId],
    );
    const item = byNumber
      ? c.draft.items[Number(byNumber[1]) - 1]
      : (named ?? (c.draft.items.length === 1 ? c.draft.items[0] : null));
    if (!item) {
      warnings.push(
        "Para aplicar el cambio de ingredientes, elige la unidad del carrito.",
      );
      continue;
    }
    const parsed = parseModifications(
      modification[0],
      findProduct(item.productId)!,
      item.options,
    );
    if (!parsed.modifications) {
      warnings.push(parsed.error!);
      continue;
    }
    item.modifications = parsed.modifications;
    item.subtotal =
      item.basePrice + item.modifications.reduce((n, m) => n + m.price, 0);
  }
  recalculate(c.draft);
  return warnings;
}
