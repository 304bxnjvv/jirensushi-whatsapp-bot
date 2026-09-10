import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

async function domain() {
  assert.ok(
    existsSync(new URL("../src/domain/catalog.ts", import.meta.url)),
    "catalog domain is implemented",
  );
  return import("../src/domain/catalog.ts");
}
test("official catalog contains all 76 foods in eight ordered categories with unique IDs", async () => {
  const { catalog, products } = await domain();
  assert.equal(catalog.currency, "CLP");
  assert.deepEqual(
    catalog.categories.map((c) => c.products.length),
    [16, 10, 15, 20, 3, 4, 2, 6],
  );
  assert.deepEqual(
    catalog.categories.map((c) => c.order),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  assert.equal(products.length, 76);
  assert.equal(new Set(products.map((p) => p.id)).size, 76);
  for (const c of catalog.categories)
    for (const [i, p] of c.products.entries()) {
      assert.equal(p.order, i + 1);
      assert.ok(Number.isInteger(p.price));
      assert.ok(Array.isArray(p.ingredients));
      assert.ok(Array.isArray(p.preparation));
      assert.ok(Array.isArray(p.optionGroups));
      assert.ok(Array.isArray(p.components));
    }
});
test("absent quantities stay null and exact mandatory choices and table composition survive transcription", async () => {
  const { findProduct, catalog } = await domain();
  assert.equal(findProduct("papas-jiren")!.displayQuantity, null);
  assert.equal(findProduct("gyozas-salteadas")!.displayQuantity, 10);
  assert.equal(findProduct("avo-furay")!.displayQuantity, null);
  assert.deepEqual(findProduct("avo-furay")!.ingredients, [
    "Queso Crema",
    "Palmito",
    "Pimentón",
    "Salmón Furay",
  ]);
  for (const p of catalog.categories[1].products) {
    assert.equal(p.price, 8990);
    assert.equal(p.optionGroups[0].options.length, 8);
  }
  assert.deepEqual(findProduct("rainbow-rolls")!.optionGroups[1].options, [
    "Salmón",
    "Camarón",
  ]);
  assert.deepEqual(
    findProduct("tabla-vegetariana-25000")!.optionGroups[0].options,
    ["Palmito", "Pimentón"],
  );
  assert.equal(
    findProduct("tabla-mixta-42000")!.components.reduce(
      (n, c) => n + c.quantity,
      0,
    ),
    100,
  );
});
test("catalog matching normalizes accents and accepts only an unambiguous minor typo", async () => {
  const { matchCatalog } = await domain();
  assert.equal(matchCatalog("  SALMÓN FURAY ")?.product?.id, "salmon-furay");
  assert.equal(matchCatalog("abo furai")?.product?.id, "avo-furay");
  assert.equal(matchCatalog("furay"), null);
  assert.equal(matchCatalog("tabla"), null);
  assert.equal(matchCatalog("cerveza"), null);
});
test("every product page respects WhatsApp limit and exposes back navigation", async () => {
  const { catalog, categoryPage, productDetail, findProduct } = await domain();
  for (const c of catalog.categories)
    for (let page = 0; page < Math.ceil(c.products.length / 7); page++) {
      const reply = categoryPage(c.id, page);
      assert.ok(reply.choices!.length <= 10);
      assert.ok(reply.choices!.some((x) => x.id === "menu"));
      for (const row of reply.choices!.filter((x) =>
        x.id.startsWith("product:"),
      ))
        assert.match(row.description!, /\$/);
    }
  const detail = productDetail(findProduct("avo-furay")!);
  assert.equal(detail.choices!.length, 2);
  assert.match(detail.text, /11\.900/);
  assert.doesNotMatch(detail.text, /Piezas/);
});
