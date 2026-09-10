import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { Database, Statement, DbResult } from "../src/types.ts";
export function createDatabase(path: string): Database {
  const sqlite = new DatabaseSync(path);
  sqlite.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  class Query implements Statement {
    sql: string;
    values: SQLInputValue[];
    constructor(sql: string, values: SQLInputValue[] = []) {
      this.sql = sql;
      this.values = values;
    }
    bind(...values: unknown[]) {
      return new Query(this.sql, values as SQLInputValue[]);
    }
    async first<T = Record<string, any>>(column?: string): Promise<T | null> {
      const row = sqlite.prepare(this.sql).get(...this.values) as
        Record<string, any> | undefined;
      return row ? ((column ? row[column] : row) as T) : null;
    }
    async all<T = Record<string, any>>(): Promise<DbResult<T>> {
      return {
        success: true,
        results: sqlite.prepare(this.sql).all(...this.values) as T[],
        meta: {},
      };
    }
    async run(): Promise<DbResult> {
      const r = sqlite.prepare(this.sql).run(...this.values);
      return {
        success: true,
        results: [],
        meta: {
          changes: Number(r.changes),
          last_row_id: Number(r.lastInsertRowid),
        },
      };
    }
  }
  return {
    prepare: (sql) => new Query(sql),
    exec: async (sql) => {
      sqlite.exec(sql);
    },
    batch: async <T = unknown>(queries: Statement[]) => {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const results = [];
        for (const q of queries) results.push(await q.run());
        sqlite.exec("COMMIT");
        return results as DbResult<T>[];
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
