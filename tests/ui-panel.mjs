// Run against npm run dev: node tests/ui-panel.mjs
// PLAYWRIGHT_MODULE can point to a bundled Playwright installation.
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require(
    process.env.PLAYWRIGHT_MODULE ||
      "C:/Users/304bxnjv/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ));
}
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
});
const page = await browser.newPage();
page.setDefaultTimeout(5000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const staticServer = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (!["/", "/app.js", "/styles.css"].includes(pathname)) {
      response.writeHead(404).end();
      return;
    }
    const body = await readFile(
      fileURLToPath(
        new URL(
          "../public/" + (pathname === "/" ? "index.html" : pathname.slice(1)),
          import.meta.url,
        ),
      ),
    );
    response
      .writeHead(200, {
        "content-type": pathname.endsWith(".js")
          ? "application/javascript"
          : pathname.endsWith(".css")
            ? "text/css"
            : "text/html",
      })
      .end(body);
  } catch {
    response.writeHead(404).end("Panel pendiente de implementar");
  }
});
await new Promise((resolve) => staticServer.listen(0, "127.0.0.1", resolve));
const base =
  process.env.UI_BASE_URL || `http://127.0.0.1:${staticServer.address().port}`;
const order = {
  id: "test-order",
  number: "V-0101",
  phone: "56912345678",
  status: "Pendiente",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: 1,
  locked: false,
  items: [
    {
      id: "item-1",
      productId: "roll-1",
      name: "Roll de prueba",
      basePrice: 5000,
      subtotal: 5000,
      options: { envoltura: "Panko" },
      modifications: [{ action: "remove", ingredient: "Cebollín", price: 0 }],
    },
  ],
  customerName: "Cliente <script>prueba</script>",
  mode: "retiro",
  schedule: { kind: "asap" },
  allergy: "Sésamo",
  payment: "Tarjeta",
  deliveryFee: 0,
  total: 5000,
};
const convo = {
  phone: "56912345678",
  stage: "human",
  mode: "human",
  draft: { items: [], total: 0, deliveryFee: 0 },
  data: {},
  version: 1,
  updatedAt: new Date().toISOString(),
  lastCustomerAt: new Date().toISOString(),
};
let statusRequest, releaseRequest, simulatedRequest;
await page.route("**/api/**", async (route) => {
  const url = new URL(route.request().url());
  const path = url.pathname;
  let response = {};
  if (path === "/api/health")
    response = {
      environment: "development",
      capabilities: { simulator: true },
    };
  else if (path === "/api/me" || path === "/api/login")
    response = {
      user: { id: "u", username: "local", role: "local" },
      environment: "development",
      capabilities: { simulator: true },
    };
  else if (path === "/api/orders")
    response = {
      orders: [order],
      counts: { Pendiente: 1, Aceptado: 0, Rechazado: 0, Entregado: 0 },
    };
  else if (path === "/api/orders/test-order/status") {
    statusRequest = route.request().postDataJSON();
    response = {
      order: { ...order, status: statusRequest.status, version: 2 },
    };
  } else if (path === "/api/orders/test-order") response = { order, audit: [] };
  else if (path === "/api/outbox") response = { messages: [] };
  else if (path === "/api/chats") response = { chats: [convo] };
  else if (path === "/api/chats/56912345678")
    response = {
      conversation: convo,
      messages: [
        {
          id: "msg",
          phone: convo.phone,
          role: "customer",
          text: "Hola <img src=x>",
          createdAt: convo.updatedAt,
        },
      ],
      orders: [],
    };
  else if (path.endsWith("/release")) {
    releaseRequest = route.request().postDataJSON();
    response = { conversation: { ...convo, mode: "bot", version: 2 } };
  } else if (path === "/api/dev/message") {
    simulatedRequest = route.request().postDataJSON();
    response = {
      conversation: convo,
      replies: [
        {
          text: "Elige",
          choices: [{ id: "mode:retiro", title: "Retiro en local" }],
        },
      ],
    };
  } else if (path === "/api/settings")
    response = {
      settings: {
        branch: "Viña del Mar",
        address: "Av. de prueba",
        manualClosed: false,
        reopenAt: null,
        asapMinutes: 30,
        retentionDays: 90,
        zones: [],
      },
    };
  else if (path === "/api/catalog")
    response = {
      categories: [
        {
          id: "cat",
          name: "Rolls",
          products: [{ id: "roll-1", name: "Roll de prueba" }],
        },
      ],
    };
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(response),
  });
});
try {
  await page.goto(base);
  await page.getByRole("button", { name: /V-0101/ }).click();
  await page
    .getByRole("button", { name: "Aceptar pedido", exact: true })
    .click();
  await page.getByLabel("Minutos de preparación").fill("45");
  await page.getByRole("button", { name: "Confirmar aceptación" }).click();
  await page.waitForTimeout(100);
  assert.equal(statusRequest.estimateMinutes, 45);
  assert.equal(statusRequest.version, 1);
  assert.equal(
    await page.locator("script:not([src])").count(),
    0,
    "Customer name must remain text",
  );
  await page
    .getByRole("button", { name: "Conversaciones", exact: true })
    .click();
  await page.getByRole("button", { name: /56912345678/ }).click();
  await page
    .getByLabel("Mensaje de Equipo Jiren")
    .fill("Borrador que debe permanecer");
  await page.waitForTimeout(5500);
  assert.equal(
    await page.getByLabel("Mensaje de Equipo Jiren").inputValue(),
    "Borrador que debe permanecer",
  );
  await page
    .getByRole("button", { name: "Devolver al bot", exact: true })
    .click();
  await page
    .getByLabel("Resumen del acuerdo")
    .fill("Retiro a las 20:00, sin cebollín.");
  await page.getByRole("button", { name: "Confirmar devolución" }).click();
  await page.waitForTimeout(100);
  assert.equal(releaseRequest.summary, "Retiro a las 20:00, sin cebollín.");
  await page.getByRole("button", { name: "Simulador", exact: true }).click();
  await page.getByLabel("Mensaje del cliente").fill("hola");
  await page.getByRole("button", { name: "Enviar como cliente" }).click();
  await page
    .getByRole("button", { name: "Retiro en local", exact: true })
    .click();
  await page.waitForTimeout(100);
  assert.equal(simulatedRequest.text, "mode:retiro");
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    "Mobile must not scroll horizontally",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: order acceptance, escaped customer text, draft persistence, human return, simulator choice IDs, mobile overflow.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => staticServer.close(resolve));
}
