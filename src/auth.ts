import type { Database, User } from "./types.ts";
const encoder = new TextEncoder();
function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
function unhex(value: string) {
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (b) => parseInt(b, 16));
}
export async function tokenHash(token: string) {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(token)));
}
async function derive(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return hex(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: unhex(salt),
        iterations: 100000,
      },
      key,
      256,
    ),
  );
}
export async function hashPassword(password: string) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  return "pbkdf2$100000$" + salt + "$" + (await derive(password, salt));
}
export async function verifyPassword(password: string, encoded: string) {
  const parts = encoded.split("$");
  if (
    parts.length !== 4 ||
    parts[0] !== "pbkdf2" ||
    parts[1] !== "100000" ||
    !/^([a-f0-9]{32})$/.test(parts[2]) ||
    !/^([a-f0-9]{64})$/.test(parts[3])
  )
    return false;
  const candidate = await derive(password, parts[2]);
  let mismatch = 0;
  for (let i = 0; i < candidate.length; i++)
    mismatch |= candidate.charCodeAt(i) ^ parts[3].charCodeAt(i);
  return mismatch === 0;
}
export async function currentUser(
  db: Database,
  request: Request,
): Promise<User | null> {
  const token = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("jiren_session="))
    ?.slice(14);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return db
    .prepare(
      "SELECT u.id,u.username,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?",
    )
    .bind(await tokenHash(token))
    .first<User>();
}
export async function login(
  db: Database,
  username: string,
  password: string,
  ip: string,
) {
  const key = await tokenHash(ip + ":" + username.toLowerCase());
  const now = Date.now();
  const start = now - 15 * 60000;
  await db
    .prepare(
      "INSERT INTO rate_limits(key,window_start,attempts) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN window_start < ? THEN 1 ELSE attempts+1 END,window_start=CASE WHEN window_start < ? THEN excluded.window_start ELSE window_start END",
    )
    .bind(key, now, start, start)
    .run();
  const rate = await db
    .prepare("SELECT attempts FROM rate_limits WHERE key=?")
    .bind(key)
    .first<{ attempts: number }>();
  if ((rate?.attempts ?? 0) > 10)
    throw Object.assign(
      new Error("Demasiados intentos. Vuelve a intentar en 15 minutos."),
      { status: 429 },
    );
  const row = await db
    .prepare("SELECT * FROM users WHERE username=?")
    .bind(username)
    .first<User & { password_hash: string }>();
  // Derive even for unknown usernames to avoid a fast existence signal.
  const fallback =
    "pbkdf2$100000$00000000000000000000000000000000$" + "0".repeat(64);
  const valid = await verifyPassword(password, row?.password_hash ?? fallback);
  if (!row || !valid)
    throw Object.assign(new Error("Usuario o contraseña incorrectos."), {
      status: 401,
    });
  const token = hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
  await db
    .prepare(
      "INSERT INTO sessions(token_hash,user_id,created_at) VALUES(?,?,?)",
    )
    .bind(await tokenHash(token), row.id, new Date().toISOString())
    .run();
  await db.prepare("DELETE FROM rate_limits WHERE key=?").bind(key).run();
  return {
    user: { id: row.id, username: row.username, role: row.role } as User,
    token,
  };
}
export async function logout(db: Database, request: Request) {
  const token = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("jiren_session="))
    ?.slice(14);
  if (token)
    await db
      .prepare("DELETE FROM sessions WHERE token_hash=?")
      .bind(await tokenHash(token))
      .run();
}
