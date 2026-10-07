import { getEnv } from "./env";

export const db = () => getEnv().DB;

export async function one<T>(sql: string, ...args: unknown[]): Promise<T | null> {
  return (await db().prepare(sql).bind(...args).first<T>()) ?? null;
}

export async function all<T>(sql: string, ...args: unknown[]): Promise<T[]> {
  const r = await db().prepare(sql).bind(...args).all<T>();
  return r.results ?? [];
}

/** Ejecuta una sentencia y devuelve las filas afectadas. */
export async function run(sql: string, ...args: unknown[]): Promise<number> {
  const r = await db().prepare(sql).bind(...args).run();
  return r.meta?.changes ?? 0;
}

export const now = () => Date.now();
