import type {
  CartItem,
  Draft,
  Modification,
  Product,
  Settings,
} from "../types.ts";
import {
  findProduct,
  knownIngredients,
  normalize,
  uniqueMatch,
} from "./catalog.ts";
import { scheduledTime, branchAvailability, chileParts } from "./hours.ts";
const priceFor = (ingredient: string) =>
  /atun|pulpo/.test(normalize(ingredient))
    ? 2000
    : /camaron|salmon/.test(normalize(ingredient))
      ? 1500
      : 1000;
function ingredientName(text: string): string | null {
  const aliases: Record<string, string> = {
    champinones: "champinon",
    camarones: "camaron",
    cebollines: "cebollin",
    sesamo: "sesamo",
  };
  const n = normalize(text);
  const key = aliases[n] ?? n;
  return knownIngredients.find((x) => normalize(x) === key) ?? null;
}
export function priceModification(m: Modification): Modification | null {
  const ingredient = ingredientName(m.ingredient);
  if (!ingredient || !["add", "remove", "replace"].includes(m.action))
    return null;
  const from = m.from ? ingredientName(m.from) : undefined;
  if (m.action === "replace" && !from) return null;
  return {
    action: m.action,
    ingredient,
    ...(from ? { from } : {}),
    ...(m.kind === "wrap" ? { kind: "wrap" as const } : {}),
    price:
      m.action === "remove"
        ? 0
        : m.kind === "wrap"
          ? 2000
          : priceFor(ingredient),
  };
}
function present(p: Product, options: Record<string, string>, name: string) {
  const n = normalize(name);
  return [
    ...p.ingredients,
    ...p.preparation,
    ...p.components.map((x) => x.name),
    ...Object.values(options),
  ].some((x) => normalize(x).includes(n) || n.includes(normalize(x)));
}
export function parseModifications(
  text: string,
  product: Product,
  options: Record<string, string>,
): { modifications?: Modification[]; error?: string } {
  if (product.components.length && /cambia|reemplaza/i.test(text))
    return {
      error:
        "La composición de las tablas es fija: no puedes cambiar un corte por otro.",
    };
  const segments = text
    .trim()
    .split(/\s+y\s+|[,;]/i)
    .map((x) => x.trim())
    .filter(Boolean);
  const modifications: Modification[] = [];
  let lastAction = "";
  for (let segment of segments) {
    const wrap = /envoltura|envuelto/i.test(segment);
    segment = segment
      .replace(/(?:la\s+)?envoltura(?:\s+de)?\s*/gi, "")
      .replace(/envuelto(?:\s+en)?\s*/gi, "");
    let action: Modification["action"];
    let ingredient = "";
    let from: string | undefined;
    let m = segment.match(
      /^(?:sin|quitar|quita|sacar|saca|remover)\s+(?:el\s+|la\s+)?(.+)$/i,
    );
    if (m) {
      action = "remove";
      ingredient = m[1];
      lastAction = "sin";
    } else if (
      (m = segment.match(
        /^(?:agregar|agrega|añadir|añade|extra|con extra de)\s+(?:de\s+)?(.+)$/i,
      ))
    ) {
      action = "add";
      ingredient = m[1];
      lastAction = "agregar";
    } else if (
      (m = segment.match(
        /^(?:cambiar|cambia|reemplazar|reemplaza)\s+(.+?)\s+por\s+(.+)$/i,
      ))
    ) {
      action = "replace";
      from = m[1];
      ingredient = m[2];
      lastAction = "";
    } else if (lastAction) {
      const r = parseModifications(
        lastAction + " " + segment,
        product,
        options,
      );
      if (!r.modifications) return r;
      modifications.push(...r.modifications);
      continue;
    } else
      return {
        error:
          "No entendí todas las modificaciones. Escribe nuevamente todo: sin queso crema, agregar camarón.",
      };
    const priced = priceModification({
      action,
      ingredient,
      from,
      kind: wrap ? "wrap" : "ingredient",
      price: 0,
    });
    if (!priced)
      return {
        error:
          "Ese ingrediente no está en la carta. Escribe nuevamente todas las modificaciones de esta unidad.",
      };
    if (
      (priced.action === "remove" || priced.action === "replace") &&
      !present(product, options, priced.from ?? priced.ingredient)
    )
      return {
        error:
          "El ingrediente a quitar o reemplazar no aparece en este producto. Revisa y escribe las modificaciones completas.",
      };
    modifications.push(priced);
  }
  return modifications.length
    ? { modifications }
    : { error: "Escribe todas las modificaciones de esta unidad." };
}
export function repriceItem(item: CartItem): CartItem | null {
  const p = findProduct(item.productId);
  if (
    !p ||
    !item.options ||
    !Array.isArray(item.modifications) ||
    (p.components.length &&
      item.modifications.some((m) => m.action === "replace"))
  )
    return null;
  const options: Record<string, string> = {};
  for (const g of p.optionGroups) {
    const option = g.options.find(
      (x) => normalize(x) === normalize(item.options[g.id] ?? ""),
    );
    if (!option) return null;
    options[g.id] = option;
  }
  const mods: Modification[] = [];
  for (const original of item.modifications) {
    const m = priceModification(original);
    if (!m) return null;
    if (
      (m.action === "remove" || m.action === "replace") &&
      !present(p, options, m.from ?? m.ingredient)
    )
      return null;
    mods.push(m);
  }
  return {
    ...item,
    name: p.name,
    basePrice: p.price,
    options,
    modifications: mods,
    subtotal: p.price + mods.reduce((sum, m) => sum + m.price, 0),
  };
}
export function recalculate(draft: Draft): Draft {
  draft.total =
    draft.items.reduce((n, i) => n + i.subtotal, 0) +
    (draft.mode === "despacho" ? draft.deliveryFee : 0);
  return draft;
}
export function validateDraft(
  draft: Draft,
  settings: Settings,
  now: Date,
): { valid: boolean; draft?: Draft; error?: string } {
  if (!["retiro", "despacho"].includes(draft.mode ?? ""))
    return { valid: false, error: "Elige retiro o despacho." };
  if (!draft.items.length)
    return { valid: false, error: "Tu carrito está vacío." };
  const copy = structuredClone(draft);
  copy.items = [];
  for (const item of draft.items) {
    const valid = repriceItem(item);
    if (!valid)
      return {
        valid: false,
        error: "Revisa las elecciones y modificaciones del producto.",
      };
    copy.items.push(valid);
  }
  if (copy.mode === "despacho") {
    const z = settings.zones.find((z) => z.id === copy.zoneId && z.enabled);
    if (!z || !copy.address?.trim())
      return { valid: false, error: "Revisa zona y dirección de despacho." };
    copy.deliveryFee = z.price;
  } else copy.deliveryFee = 0;
  if (
    !copy.customerName?.trim() ||
    !["Tarjeta", "Efectivo"].includes(copy.payment ?? "")
  )
    return { valid: false, error: "Faltan nombre y forma de pago." };
  const av = branchAvailability(now, settings);
  if (!av.canScheduleToday)
    return {
      valid: false,
      error: "El local está cerrado. No podemos confirmar este pedido ahora.",
    };
  if (!copy.schedule) return { valid: false, error: "Elige horario." };
  if (copy.schedule.kind === "asap" && !av.open)
    return {
      valid: false,
      error:
        "El local aún no está disponible para pedidos lo antes posible. Programa una hora posterior a la apertura.",
    };
  if (copy.schedule.kind === "scheduled") {
    const d = new Date(copy.schedule.time ?? "");
    if (Number.isNaN(+d)) return { valid: false, error: "Horario inválido." };
    const p = chileParts(d);
    const check = scheduledTime(
      p.hour + ":" + String(p.minute).padStart(2, "0"),
      now,
      settings,
    );
    if (!check.ok || check.time !== copy.schedule.time)
      return { valid: false, error: check.error ?? "Revisa horario para hoy." };
  } else
    copy.schedule = { kind: "asap", estimateMinutes: settings.asapMinutes };
  recalculate(copy);
  return { valid: true, draft: copy };
}
