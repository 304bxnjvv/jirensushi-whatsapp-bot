import data from "../data/catalog.json" with { type: "json" };
import type { Catalog, Product, Category, Reply } from "../types.ts";

export const catalog: Catalog = data;
export const products = catalog.categories.flatMap((c) => c.products);
export const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[$.,!?¿¡]/g, "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
export const formatMoney = (amount: number) =>
  "$" + amount.toLocaleString("es-CL");
export const findProduct = (id: string) => products.find((p) => p.id === id);
export const findCategory = (id: string) =>
  catalog.categories.find((c) => c.id === id);
function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        next[j - 1] + 1,
        row[j] + 1,
        row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    row = next;
  }
  return row[b.length];
}
export function uniqueMatch<T>(
  text: string,
  list: T[],
  names: (value: T) => string[],
): T | null {
  const value = normalize(text);
  if (!value) return null;
  const exact = list.filter((x) =>
    names(x).some((n) => normalize(n) === value),
  );
  if (exact.length) return exact.length === 1 ? exact[0] : null;
  const contained = list.filter((x) =>
    names(x).some((n) => {
      const k = normalize(n);
      return value.length >= 4 && (k.includes(value) || value.includes(k));
    }),
  );
  if (contained.length) return contained.length === 1 ? contained[0] : null;
  if (value.length < 5) return null;
  const ranked = list
    .map((item) => ({
      item,
      d: Math.min(...names(item).map((n) => distance(value, normalize(n)))),
    }))
    .sort((a, b) => a.d - b.d);
  return ranked[0] &&
    ranked[0].d <= Math.max(1, Math.floor(value.length * 0.25)) &&
    (!ranked[1] || ranked[1].d > ranked[0].d)
    ? ranked[0].item
    : null;
}
export function matchCatalog(
  text: string,
): { product?: Product; category?: Category } | null {
  const all = [
    ...products.map((product) => ({ product })),
    ...catalog.categories.map((category) => ({ category })),
  ];
  return uniqueMatch(text, all, (x) =>
    "product" in x
      ? [x.product.id, x.product.name]
      : [x.category.id, x.category.name],
  );
}
export function categoriesReply(
  prefix = "¿Qué te gustaría pedir? Elige una categoría:",
): Reply {
  return {
    text: prefix,
    choices: catalog.categories.map((c) => ({
      id: `category:${c.id}`,
      title: c.name,
    })),
  };
}
export function categoryPage(
  id: string,
  page = 0,
  excluded: string[] = [],
): Reply {
  const category = findCategory(id);
  if (!category) return categoriesReply();
  const available = category.products.filter((p) => !excluded.includes(p.id));
  const pages = Math.max(1, Math.ceil(available.length / 7));
  page = Math.min(Math.max(0, page), pages - 1);
  const choices = available
    .slice(page * 7, page * 7 + 7)
    .map((p) => ({
      id: `product:${p.id}`,
      title: p.name,
      description: formatMoney(p.price),
    }));
  if (page > 0)
    choices.push({
      id: `page:${id}:${page - 1}`,
      title: "Anterior",
      description: "",
    });
  if (page < pages - 1)
    choices.push({
      id: `page:${id}:${page + 1}`,
      title: "Siguiente",
      description: "",
    });
  choices.push({ id: "menu", title: "Volver a categorías", description: "" });
  return { text: `${category.name} · Página ${page + 1} de ${pages}`, choices };
}
export function productDetail(product: Product): Reply {
  const lines = [`${product.name} — ${formatMoney(product.price)}`];
  if (product.displayQuantity !== null)
    lines.push(`Piezas: ${product.displayQuantity}`);
  if (product.ingredients.length)
    lines.push(`Ingredientes: ${product.ingredients.join(", ")}.`);
  if (product.preparation.length)
    lines.push(`Preparación: ${product.preparation.join(", ")}.`);
  if (product.components.length)
    lines.push(
      `Incluye (composición fija): ${product.components.map((c) => `${c.quantity} ${c.name}`).join("; ")}.`,
    );
  if (product.optionGroups.length)
    lines.push(
      `Opciones obligatorias: ${product.optionGroups.map((g) => `${g.name}: ${g.options.join(" / ")} (elige ${g.min})`).join("; ")}.`,
    );
  return {
    text: lines.join("\n\n"),
    choices: [
      { id: "quantity", title: "Elegir cantidad" },
      { id: "menu", title: "Volver a categorías" },
    ],
  };
}
// These are labels transcribed from ingredient, preparation and option columns only.
export const knownIngredients = [
  ...new Set([
    ...products.flatMap((p) => p.ingredients),
    ...products.flatMap((p) => p.optionGroups.flatMap((g) => g.options)),
    "Pollo",
    "Salmón",
    "Camarón",
    "Atún",
    "Pulpo",
    "Palmito",
    "Champiñón",
    "Kanikama",
    "Queso Crema",
    "Queso Furay",
    "Queso Cheddar",
    "Palta",
    "Pimentón",
    "Cebollín",
    "Plátano",
    "Pepino",
    "Masago",
    "Panko",
    "Sésamo",
    "Alga Nori",
    "Mango",
    "Salsa Spicy",
    "Salsa Unagui",
    "Salsa Acevichada",
    "Salsa Huancaína",
    "Salsa de Maracuyá",
    "Salsa Mango",
    "Salsa de Aceituna",
    "Topping Jiren",
    "Topping Wakame",
    "Topping Ceviche",
    "Topping de Champiñones",
    "Topping de Pulpo al Olivo",
    "Topping de Atún Marinado",
    "Tartar de Salmón",
    "Ceviche Salmón",
  ]),
];
