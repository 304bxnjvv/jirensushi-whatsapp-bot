import type {
  Database,
  Statement,
  Conversation,
  Order,
  Reply,
} from "./types.ts";
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export function object<T>(row: { data: string } | null): T | null {
  return row ? (JSON.parse(row.data) as T) : null;
}
export function saveConversation(db: Database, c: Conversation): Statement {
  return db
    .prepare(
      "INSERT INTO conversations(phone,mode,updated_at,version,data) VALUES(?,?,?,?,?) ON CONFLICT(phone) DO UPDATE SET mode=excluded.mode,updated_at=excluded.updated_at,version=excluded.version,data=excluded.data",
    )
    .bind(c.phone, c.mode, c.updatedAt, c.version, JSON.stringify(c));
}
export function saveOrder(db: Database, o: Order, insert = false): Statement {
  return insert
    ? db
        .prepare(
          "INSERT INTO orders(id,phone,status,created_at,updated_at,version,data) VALUES(?,?,?,?,?,?,?)",
        )
        .bind(
          o.id,
          o.phone,
          o.status,
          o.createdAt,
          o.updatedAt,
          o.version,
          JSON.stringify(o),
        )
    : db
        .prepare(
          "UPDATE orders SET status=?,updated_at=?,version=?,data=? WHERE id=?",
        )
        .bind(o.status, o.updatedAt, o.version, JSON.stringify(o), o.id);
}
export function audit(
  db: Database,
  actor: string,
  action: string,
  target: string,
  detail: unknown,
  now: string,
): Statement {
  return db
    .prepare(
      "INSERT INTO audit(actor,action,target,detail,created_at) VALUES(?,?,?,?,?)",
    )
    .bind(actor, action, target, JSON.stringify(detail), now);
}
export function outgoing(
  db: Database,
  phone: string,
  reply: Reply,
  now: string,
  simulated = false,
  kind = "bot",
): Statement[] {
  const ops: Statement[] = [];
  const pieces: string[] = [];
  let text = reply.text;
  while (text.length > 3900) {
    let cut = text.lastIndexOf("\n", 3900);
    if (cut < 100) cut = 3900;
    pieces.push(text.slice(0, cut));
    text = text.slice(cut).trimStart();
  }
  pieces.push(text);
  for (let n = 0; n < pieces.length; n++) {
    const id = crypto.randomUUID();
    const r: Reply = {
      text: pieces[n],
      ...(n === pieces.length - 1 ? { choices: reply.choices } : {}),
    };
    // Interactive bodies are capped independently from normal text.
    if (r.choices && r.text.length > 1000) {
      const choices = r.choices;
      delete r.choices;
      ops.push(...outgoing(db, phone, r, now, simulated, kind));
      ops.push(
        ...outgoing(
          db,
          phone,
          { text: "Elige cómo continuar:", choices },
          now,
          simulated,
          kind,
        ),
      );
      continue;
    }
    ops.push(
      db
        .prepare(
          "INSERT INTO messages(id,phone,role,text,created_at) VALUES(?,?,?,?,?)",
        )
        .bind(id, phone, kind === "human" ? "human" : "bot", r.text, now),
    );
    ops.push(
      db
        .prepare(
          "INSERT INTO outbox(id,phone,text,reply,kind,state,created_at,next_attempt,simulated) VALUES(?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          phone,
          r.text,
          JSON.stringify(r),
          kind,
          simulated ? "simulated" : "pending",
          now,
          now,
          simulated ? 1 : 0,
        ),
    );
  }
  return ops;
}
export async function locked<T>(
  db: Database,
  fn: () => Promise<T>,
): Promise<T> {
  const token = crypto.randomUUID();
  let acquired = false;
  for (let i = 0; i < 80; i++) {
    const now = Date.now();
    const r = await db
      .prepare(
        "INSERT INTO locks(key,token,expires_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET token=excluded.token,expires_at=excluded.expires_at WHERE locks.expires_at < ?",
      )
      .bind("mutations", token, now + 120000, now)
      .run();
    if (r.meta.changes === 1) {
      acquired = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 25));
  }
  if (!acquired)
    throw new HttpError(
      409,
      "El sistema está procesando otra acción. Intenta nuevamente.",
    );
  try {
    return await fn();
  } finally {
    await db
      .prepare("DELETE FROM locks WHERE key=? AND token=?")
      .bind("mutations", token)
      .run();
  }
}
