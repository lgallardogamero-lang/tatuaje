import { all, one, run, now } from "./db";
import { newId } from "./ids";

export type LedgerReason =
  | "free_grant"
  | "purchase"
  | "generation"
  | "refund"
  | "admin_grant"
  | "admin_revoke"
  | "asset_purchase";

export async function balance(userId: string): Promise<number> {
  const r = await one<{ b: number | null }>("SELECT SUM(delta) AS b FROM credit_ledger WHERE user_id = ?", userId);
  return r?.b ?? 0;
}

/**
 * Descuenta `amount` créditos de forma atómica: la inserción solo ocurre si el saldo alcanza,
 * y la restricción única (reason, ref) impide cobrar dos veces lo mismo.
 */
export async function spend(userId: string, amount: number, reason: "generation" | "asset_purchase", ref: string, jobId?: string): Promise<boolean> {
  const changed = await run(
    `INSERT INTO credit_ledger (id, user_id, delta, reason, job_id, ref, created_at)
     SELECT ?, ?, ?, ?, ?, ?, ?
     WHERE (SELECT COALESCE(SUM(delta), 0) FROM credit_ledger WHERE user_id = ?) >= ?`,
    newId(),
    userId,
    -amount,
    reason,
    jobId ?? null,
    ref,
    now(),
    userId,
    amount,
  );
  return changed === 1;
}

/** Devuelve créditos; es idempotente por `ref`. */
export async function refund(userId: string, amount: number, ref: string, jobId?: string): Promise<boolean> {
  const changed = await run(
    "INSERT OR IGNORE INTO credit_ledger (id, user_id, delta, reason, job_id, ref, created_at) VALUES (?, ?, ?, 'refund', ?, ?, ?)",
    newId(),
    userId,
    amount,
    jobId ?? null,
    ref,
    now(),
  );
  return changed === 1;
}

export async function addPurchaseCredits(userId: string, amount: number, ref: string): Promise<boolean> {
  const changed = await run(
    "INSERT OR IGNORE INTO credit_ledger (id, user_id, delta, reason, ref, created_at) VALUES (?, ?, ?, 'purchase', ?, ?)",
    newId(),
    userId,
    amount,
    ref,
    now(),
  );
  return changed === 1;
}

export async function adminAdjust(userId: string, delta: number, adminId: string): Promise<void> {
  if (!Number.isInteger(delta) || delta === 0) throw new Error("Cantidad no válida");
  await run(
    "INSERT INTO credit_ledger (id, user_id, delta, reason, ref, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    newId(),
    userId,
    delta,
    delta > 0 ? "admin_grant" : "admin_revoke",
    `${adminId}:${newId()}`,
    now(),
  );
}

export interface LedgerRow {
  id: string;
  delta: number;
  reason: LedgerReason;
  created_at: number;
}
export const history = (userId: string, limit = 50) =>
  all<LedgerRow>("SELECT id, delta, reason, created_at FROM credit_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT ?", userId, limit);
