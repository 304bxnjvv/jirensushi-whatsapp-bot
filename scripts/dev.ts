import { createServer } from "node:http";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { createDatabase } from "./sqlite.ts";
import { hashPassword } from "../src/auth.ts";
import worker from "../src/index.ts";
import { Service } from "../src/service.ts";
import type { Env } from "../src/types.ts";
const root = resolve(import.meta.dirname, "..");
await mkdir(resolve(root, ".local"), { recursive: true });
const db = createDatabase(resolve(root, ".local/jiren.sqlite"));
for (const f of (await readdir(resolve(root, "migrations")))
  .filter((f) => f.endsWith(".sql"))
  .sort())
  await db.exec(await readFile(resolve(root, "migrations", f), "utf8"));
for (const [username, password, role] of [
  ["local", "Local-demo-2026!", "local"],
  ["ceo", "CEO-demo-2026!", "ceo"],
]) {
  const found = await db
    .prepare("SELECT id FROM users WHERE username=?")
    .bind(username)
    .first();
  if (!found)
    await db
      .prepare(
        "INSERT INTO users(id,username,password_hash,role) VALUES(?,?,?,?)",
      )
      .bind(crypto.randomUUID(), username, await hashPassword(password), role)
      .run();
}
const publicRoot = resolve(root, "public");
const env: Env = {
  DB: db,
  APP_ENV: "development",
  ASSETS: {
    fetch: async (request) => {
      const pathname = decodeURIComponent(new URL(request.url).pathname);
      const path = resolve(
        publicRoot,
        "." + (pathname === "/" ? "/index.html" : pathname),
      );
      if (!path.startsWith(publicRoot + sep))
        return new Response("Not found", { status: 404 });
      try {
        if (!(await stat(path)).isFile())
          return new Response("Not found", { status: 404 });
        const mime: Record<string, string> = {
          ".html": "text/html; charset=utf-8",
          ".js": "text/javascript; charset=utf-8",
          ".css": "text/css; charset=utf-8",
          ".svg": "image/svg+xml",
        };
        return new Response(await readFile(path), {
          headers: {
            "content-type": mime[extname(path)] ?? "application/octet-stream",
          },
        });
      } catch {
        return new Response("Not found", { status: 404 });
      }
    },
  },
};
const server = createServer(async (req, res) => {
  try {
    const chunks: Buffer[] = [];
    let length = 0;
    for await (const chunk of req) {
      length += chunk.length;
      if (length > 256000) {
        res.writeHead(413).end();
        return;
      }
      chunks.push(chunk);
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers))
      if (value)
        headers.set(key, Array.isArray(value) ? value.join(",") : value);
    const request = new Request("http://" + req.headers.host + req.url, {
      method: req.method,
      headers,
      ...(!["GET", "HEAD"].includes(req.method ?? "GET")
        ? { body: Buffer.concat(chunks) }
        : {}),
    });
    const response = await worker.fetch(request, env, {
      waitUntil(p) {
        p.catch(() => {});
      },
    });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(500).end("Local request failed");
  }
});
const port = Number(process.env.PORT ?? 8787);
server.listen(port, "127.0.0.1", () =>
  console.log(
    "Jiren local: http://localhost:" +
      port +
      " — simulation only; no external messages.",
  ),
);
const timer = setInterval(() => {
  new Service(env).tick().catch(() => {});
}, 60000);
timer.unref();
process.on("SIGINT", () => {
  clearInterval(timer);
  server.close();
});
