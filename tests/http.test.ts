import test from "node:test";
import assert from "node:assert/strict";
import { createDatabase } from "../scripts/sqlite.ts";
import { readFileSync } from "node:fs";
import { hashPassword } from "../src/auth.ts";
import app from "../src/index.ts";
import { createHmac } from "node:crypto";
async function fixture() {
  const DB = createDatabase(":memory:");
  await DB.exec(
    readFileSync(
      new URL("../migrations/0001_initial.sql", import.meta.url),
      "utf8",
    ),
  );
  await DB.prepare("INSERT INTO users VALUES(?,?,?,?)")
    .bind("u", "local", await hashPassword("Valid-password-2026"), "local")
    .run();
  return { DB, APP_ENV: "development" };
}
const req = (path: string, method = "GET", data?: unknown, cookie?: string) =>
  new Request("http://localhost" + path, {
    method,
    headers: {
      origin: "http://localhost",
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
test("panel endpoints require auth, login cookie is HttpOnly, CEO audit forbidden for local", async () => {
  const env = await fixture();
  assert.equal((await app.fetch(req("/api/orders"), env)).status, 401);
  const login = await app.fetch(
    req("/api/login", "POST", {
      username: "local",
      password: "Valid-password-2026",
    }),
    env,
  );
  assert.equal(login.status, 200);
  assert.match(login.headers.get("set-cookie")!, /HttpOnly/);
  const cookie = login.headers.get("set-cookie")!.split(";")[0];
  assert.equal(
    (await app.fetch(req("/api/orders", "GET", undefined, cookie), env)).status,
    200,
  );
  assert.equal(
    (await app.fetch(req("/api/audit", "GET", undefined, cookie), env)).status,
    403,
  );
  await app.fetch(req("/api/logout", "POST", {}, cookie), env);
  assert.equal(
    (await app.fetch(req("/api/orders", "GET", undefined, cookie), env)).status,
    401,
  );
});
test("cross-origin mutations denied and production has no simulator", async () => {
  const env = await fixture();
  assert.equal(
    (
      await app.fetch(
        new Request("http://localhost/api/login", {
          method: "POST",
          headers: {
            origin: "https://evil.test",
            "content-type": "application/json",
          },
          body: "{}",
        }),
        env,
      )
    ).status,
    403,
  );
  const health = await app.fetch(req("/api/health"), {
    ...env,
    APP_ENV: "production",
  });
  assert.equal(((await health.json()) as any).capabilities.simulator, false);
});
test("forged webhook signatures cannot write incoming messages", async () => {
  const env = await fixture();
  const result = await app.fetch(req("/webhook", "POST", { entry: [] }), {
    ...env,
    META_APP_SECRET: "test-only",
    META_PHONE_NUMBER_ID: "123",
  });
  assert.equal(result.status, 401);
  assert.equal(
    (
      await env.DB.prepare("SELECT count(*) n FROM inbox").first<{
        n: number;
      }>()
    )?.n,
    0,
  );
});

function webhook(value: unknown) {
  const raw = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{ changes: [{ field: "messages", value }] }],
  });
  return new Request("http://localhost/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256":
        "sha256=" + createHmac("sha256", "test-only").update(raw).digest("hex"),
    },
    body: raw,
  });
}
test("delivery webhooks advance sent to delivered to read without regression", async () => {
  const env = {
    ...(await fixture()),
    META_APP_SECRET: "test-only",
    META_PHONE_NUMBER_ID: "123",
  };
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO outbox(id,phone,text,reply,kind,state,created_at,next_attempt,provider_id) VALUES(?,?,?,?,?,?,?,?,?)",
  )
    .bind(
      "out",
      "56911111111",
      "Hola",
      '{"text":"Hola"}',
      "notice",
      "sent",
      now,
      now,
      "wamid.real",
    )
    .run();
  async function status(state: string) {
    assert.equal(
      (
        await app.fetch(
          webhook({
            metadata: { phone_number_id: "123" },
            statuses: [{ id: "wamid.real", status: state }],
          }),
          env,
        )
      ).status,
      200,
    );
    return (
      await env.DB.prepare("SELECT state FROM outbox WHERE id=?")
        .bind("out")
        .first<{ state: string }>()
    )?.state;
  }
  assert.equal(await status("delivered"), "delivered");
  assert.equal(await status("sent"), "delivered");
  assert.equal(await status("failed"), "delivered");
  assert.equal(await status("read"), "read");
  assert.equal(await status("delivered"), "read");
  assert.equal(await status("failed"), "read");
});
test("valid webhook for another configured number cannot alter inbox or delivery status", async () => {
  const env = {
    ...(await fixture()),
    META_APP_SECRET: "test-only",
    META_PHONE_NUMBER_ID: "123",
  };
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO outbox(id,phone,text,reply,kind,state,created_at,next_attempt,provider_id) VALUES(?,?,?,?,?,?,?,?,?)",
  )
    .bind(
      "out",
      "56911111111",
      "Hola",
      '{"text":"Hola"}',
      "notice",
      "sent",
      now,
      now,
      "wamid.real",
    )
    .run();
  const response = await app.fetch(
    webhook({
      metadata: { phone_number_id: "different-number" },
      messages: [
        {
          id: "wamid.ignored",
          from: "56911111111",
          type: "text",
          timestamp: String(Math.floor(Date.now() / 1000)),
          text: { body: "hola" },
        },
      ],
      statuses: [{ id: "wamid.real", status: "read" }],
    }),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(
    (
      await env.DB.prepare("SELECT count(*) n FROM inbox").first<{
        n: number;
      }>()
    )?.n,
    0,
  );
  assert.equal(
    (
      await env.DB.prepare("SELECT state FROM outbox WHERE id=?")
        .bind("out")
        .first<{ state: string }>()
    )?.state,
    "sent",
  );
});
