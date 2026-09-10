// Real integrated browser test: native local backend + SQLite. No API mocks.
// Starts its own dev server; unique test phones prevent overwriting existing chats.
// Run: node tests/ui-real.mjs
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

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
const root = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.UI_REAL_PORT || 8789);
const base = `http://127.0.0.1:${port}`;
const screenshots = fileURLToPath(
  new URL("../.local/ui-real/", import.meta.url),
);
await mkdir(screenshots, { recursive: true });
const server = spawn(
  process.execPath,
  ["--experimental-strip-types", "scripts/dev.ts"],
  {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
);
let output = "";
server.stdout.on("data", (data) => {
  output += data;
});
server.stderr.on("data", (data) => {
  output += data;
});
let browser;
const phone = "569" + Date.now().toString().slice(-8);
const humanPhone = String(Number(phone) + 1);
const errors = [];
const failedResponses = [];
let report = { phone, humanPhone };

try {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw Error("Local server exited: " + output);
    if (output.includes("Jiren local:")) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.match(output, /Jiren local:/, "Local server must start");
  browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: "America/Santiago",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    // Anonymous /me is intentionally 401 before login.
    if (response.status() >= 400 && !response.url().endsWith("/api/me"))
      failedResponses.push(`${response.status()} ${response.url()}`);
  });

  async function login(username, password) {
    await page.getByLabel("Usuario", { exact: true }).fill(username);
    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/login") && response.status() === 200,
      ),
      page.getByRole("button", { name: "Iniciar sesión", exact: true }).click(),
    ]);
    await page
      .getByRole("button", { name: "Cerrar sesión", exact: true })
      .waitFor();
  }
  async function get(path) {
    const response = await context.request.get(base + "/api" + path);
    assert.equal(response.ok(), true, `GET ${path}: ${response.status()}`);
    return response.json();
  }
  async function simulator(testPhone) {
    await page.getByRole("button", { name: "Simulador", exact: true }).click();
    await page.getByLabel(/^WhatsApp de prueba/).fill(testPhone);
    await page
      .getByRole("button", { name: "Usar horario abierto", exact: true })
      .click();
  }
  async function send(text) {
    await page.getByLabel("Mensaje del cliente", { exact: true }).fill(text);
    const [response] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/dev/message") &&
          response.request().method() === "POST",
      ),
      page
        .getByRole("button", { name: "Enviar como cliente", exact: true })
        .click(),
    ]);
    const result = await response.json();
    assert.equal(
      response.status(),
      200,
      `Client message ${JSON.stringify(text)}: ${JSON.stringify(result)}`,
    );
    return result;
  }
  async function pick(title) {
    const [response] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/dev/message") &&
          response.request().method() === "POST",
      ),
      page
        .locator("#sim-history .message.bot")
        .last()
        .getByRole("button", { name: title, exact: true })
        .click(),
    ]);
    const result = await response.json();
    assert.equal(response.status(), 200, `${title}: ${JSON.stringify(result)}`);
    return result;
  }
  async function createItem() {
    await send("retiro");
    await send("Avo Furay");
    await pick("Elegir cantidad");
    await pick("1");
    await pick("No");
    const confirmed = await pick("Confirmar unidad");
    assert.equal(confirmed.conversation.draft.items.length, 1);
    assert.equal(confirmed.conversation.draft.total, 11900);
  }

  await page.goto(base);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .waitFor();
  await page.screenshot({
    path: screenshots + "login-desktop.png",
    fullPage: true,
  });
  await login("local", "Local-demo-2026!");
  await simulator(phone);
  await createItem();
  await send("finalizar");
  await pick("Lo antes posible");
  await pick("Tarjeta");
  const summary = await send("Cliente Prueba Integrada");
  assert.equal(summary.conversation.stage, "confirm");
  assert.match(summary.replies[0].text, /Cliente Prueba Integrada/);
  const submitted = await pick("Confirmar pedido");
  assert.equal(submitted.order.status, "Pendiente");
  report.orderNumber = submitted.order.number;
  const orderId = submitted.order.id;
  const blocked = await send("quiero otro pedido");
  assert.match(blocked.replies[0].text, /No puedes iniciar otro/);
  await page.getByRole("button", { name: "Pedidos", exact: true }).click();
  await page.getByLabel("Buscar pedido").fill(phone);
  await page
    .getByRole("button", { name: new RegExp(report.orderNumber) })
    .click();
  await page
    .getByRole("button", { name: "Aceptar pedido", exact: true })
    .click();
  await page.getByLabel("Minutos de preparación").fill("45");
  await page
    .getByRole("button", { name: "Confirmar aceptación", exact: true })
    .click();
  await page.getByRole("tab", { name: /Aceptado/ }).waitFor();
  await page
    .getByRole("button", { name: new RegExp(report.orderNumber) })
    .click();
  const accepted = (await get("/orders/" + orderId)).order;
  assert.equal(accepted.status, "Aceptado");
  assert.equal(accepted.schedule.estimateMinutes, 45);
  await page.screenshot({
    path: screenshots + "accepted-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Marcar entregado", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar entrega", exact: true })
    .click();
  await page
    .getByRole("button", { name: new RegExp(report.orderNumber) })
    .waitFor();
  const delivered = (await get("/orders/" + orderId)).order;
  assert.equal(delivered.status, "Entregado");
  const orderChat = await get("/chats/" + phone);
  assert.ok(
    orderChat.messages.some((message) => /aceptado/.test(message.text)),
  );
  assert.ok(
    orderChat.messages.some((message) => /entregado/.test(message.text)),
  );
  report.pickup =
    "Pending → accepted (45 minutes) → delivered; client notices saved";

  await simulator(humanPhone);
  await createItem();
  const requestHuman = await send("hablar con una persona");
  assert.equal(requestHuman.conversation.mode, "waiting");
  await page
    .getByRole("button", { name: "Conversaciones", exact: true })
    .click();
  await page.getByRole("button", { name: new RegExp(humanPhone) }).click();
  await page.getByRole("button", { name: "Tomar chat", exact: true }).click();
  await page
    .getByLabel("Mensaje de Equipo Jiren")
    .fill("Acordamos retiro a las 20:00; sin queso crema.");
  await page
    .getByRole("button", { name: "Enviar mensaje", exact: true })
    .click();
  await page
    .locator("#chat-history")
    .getByText("Equipo Jiren: Acordamos retiro a las 20:00; sin queso crema.", {
      exact: true,
    })
    .waitFor();
  // A customer may write while a person owns the chat, but the bot must stay silent.
  await simulator(humanPhone);
  const silent = await send("perfecto, gracias");
  assert.equal(silent.conversation.mode, "human");
  assert.deepEqual(silent.replies, []);
  await page
    .getByRole("button", { name: "Conversaciones", exact: true })
    .click();
  await page.getByRole("button", { name: new RegExp(humanPhone) }).click();
  await page
    .getByRole("button", { name: "Devolver al bot", exact: true })
    .click();
  await page
    .getByLabel("Resumen del acuerdo")
    .fill("Retiro a las 20:00; sin queso crema.");
  await page
    .getByRole("button", { name: "Confirmar devolución", exact: true })
    .click();
  await page.getByRole("button", { name: "Tomar chat", exact: true }).waitFor();
  await page.screenshot({
    path: screenshots + "chat-desktop.png",
    fullPage: true,
  });
  await simulator(humanPhone);
  // Keep the customer clock at 14:00, so this test is deterministic at any hour.
  // A pending human agreement is protected from the normal draft inactivity reset.
  const agreement = await send("confirmar resumen");
  assert.equal(agreement.conversation.mode, "bot");
  assert.equal(agreement.conversation.draft.schedule.kind, "scheduled");
  assert.equal(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Santiago",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(agreement.conversation.draft.schedule.time)),
    "20:00",
  );
  assert.ok(
    agreement.conversation.draft.items[0].modifications.some(
      (modification) =>
        modification.action === "remove" &&
        /queso crema/i.test(modification.ingredient),
    ),
  );
  const history = await get("/chats/" + humanPhone);
  assert.ok(
    history.messages.some(
      (message) =>
        message.role === "human" && /Acordamos retiro/.test(message.text),
    ),
  );
  assert.ok(
    history.messages.some((message) =>
      /Vuelves a ser atendido por el bot/.test(message.text),
    ),
  );
  report.human =
    "Take → bot muted → human message retained → return → customer confirms → time and ingredient applied";

  for (const [width, height] of [
    [375, 812],
    [768, 1024],
  ]) {
    await page.setViewportSize({ width, height });
    await page.getByRole("button", { name: "Pedidos", exact: true }).click();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `No horizontal overflow at ${width}px`,
    );
    await page.screenshot({
      path: screenshots + `orders-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Mensajes enviados", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Mensajes enviados", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Configuración", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Dirección del local", { exact: true }).inputValue(),
    "5 Norte 615, Viña del Mar",
  );
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await login("ceo", "CEO-demo-2026!");
  await page
    .getByRole("button", { name: "Entrar a la sucursal", exact: true })
    .click();
  await page.getByRole("button", { name: "Auditoría", exact: true }).click();
  await page.getByRole("heading", { name: "Auditoría", exact: true }).waitFor();
  const audits = (await get("/audit")).audit;
  for (const action of [
    "order.submit",
    "order.status",
    "chat.take",
    "chat.message",
    "chat.release",
  ])
    assert.ok(
      audits.some(
        (audit) =>
          audit.action === action &&
          [orderId, humanPhone].includes(audit.target),
      ),
      action + " is audited",
    );
  await page.screenshot({
    path: screenshots + "ceo-audit-desktop.png",
    fullPage: true,
  });
  report.ceo = "Branch view and complete order/chat audit visible";
  assert.deepEqual(errors, [], "No page errors");
  assert.deepEqual(
    failedResponses,
    [],
    "No unexpected failed browser requests",
  );
  report.mobile = "375px and 768px: no document overflow";
  console.log("PASS integrated browser:", JSON.stringify(report, null, 2));
  console.log("Screenshots:", screenshots);
} catch (error) {
  if (browser?.contexts()[0]?.pages()[0]) {
    const page = browser.contexts()[0].pages()[0];
    await page
      .screenshot({ path: screenshots + "failure.png", fullPage: true })
      .catch(() => {});
    console.error(
      "Visible page:",
      (await page.locator("body").innerText()).slice(-10000),
    );
  }
  throw error;
} finally {
  await browser?.close();
  server.kill();
}
