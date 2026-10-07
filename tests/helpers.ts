import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { setTestEnv } from "@/lib/env";

/** Imita la API de D1 (prepare/bind/first/all/run/batch) sobre node:sqlite para probar la lógica real. */
class Stmt {
  private args: unknown[] = [];
  constructor(
    private db: DatabaseSync,
    private sql: string,
  ) {}
  bind(...a: unknown[]) {
    this.args = a.map((x) => (x === undefined ? null : x));
    return this;
  }
  async first<T>(): Promise<T | null> {
    return (this.db.prepare(this.sql).get(...(this.args as never[])) as T | undefined) ?? null;
  }
  async all<T>() {
    return { results: this.db.prepare(this.sql).all(...(this.args as never[])) as T[], meta: {} };
  }
  async run() {
    const r = this.db.prepare(this.sql).run(...(this.args as never[]));
    return { success: true, meta: { changes: Number(r.changes) } };
  }
}

class FakeD1 {
  raw = new DatabaseSync(":memory:");
  constructor() {
    this.raw.exec("PRAGMA foreign_keys = ON");
    const dir = path.resolve(import.meta.dirname, "../migrations");
    for (const f of fs.readdirSync(dir).sort()) this.raw.exec(fs.readFileSync(path.join(dir, f), "utf8"));
  }
  prepare(sql: string) {
    return new Stmt(this.raw, sql);
  }
  async batch(stmts: Stmt[]) {
    return Promise.all(stmts.map((s) => s.run()));
  }
}

class FakeR2 {
  store = new Map<string, { bytes: Uint8Array; contentType: string }>();
  async put(key: string, value: Uint8Array | ArrayBuffer, opts?: { httpMetadata?: { contentType?: string } }) {
    this.store.set(key, { bytes: new Uint8Array(value as ArrayBuffer), contentType: opts?.httpMetadata?.contentType ?? "" });
  }
  async get(key: string) {
    const o = this.store.get(key);
    if (!o) return null;
    return { arrayBuffer: async () => o.bytes.buffer.slice(o.bytes.byteOffset, o.bytes.byteOffset + o.bytes.byteLength), httpMetadata: { contentType: o.contentType } };
  }
  async delete(keys: string | string[]) {
    for (const k of Array.isArray(keys) ? keys : [keys]) this.store.delete(k);
  }
}

export function setupEnv(extra: Partial<CloudflareEnv> = {}) {
  const DB = new FakeD1();
  const BUCKET = new FakeR2();
  const env = {
    DB,
    BUCKET,
    APP_URL: "http://localhost:3000",
    PROVIDER: "mock",
    QUEUE_MODE: "inline",
    EMAIL_PROVIDER: "console",
    SESSION_SECRET: "test-secret",
    ...extra,
  } as unknown as CloudflareEnv;
  setTestEnv(env);
  return { env, DB, BUCKET };
}

export function addUser(DB: FakeD1, id = "u1", email = "a@b.co") {
  DB.raw.prepare("INSERT INTO users (id, email, role, created_at) VALUES (?, ?, 'user', ?)").run(id, email, Date.now());
}

/** JPEG mínimo válido (cabecera + SOF0 con 8x8) para pruebas. */
export const tinyJpeg = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x0b, 0x08,
  0x00, 0x08, 0x00, 0x08, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9,
]);
