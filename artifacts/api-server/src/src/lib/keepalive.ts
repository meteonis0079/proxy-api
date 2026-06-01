import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

let lastPingAt = 0;

async function getSetting(key: string): Promise<string> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  return row?.value ?? "";
}

async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value } });
}

export async function pingKeepalive(url: string): Promise<{ ok: boolean; statusCode: number; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const latencyMs = Date.now() - start;
    const result = { ok: resp.ok, statusCode: resp.status, latencyMs };
    await setSetting("keepalive_last_ping", JSON.stringify({ ...result, at: new Date().toISOString() }));
    logger.info({ url, ...result }, "Keep-alive ping sent");
    return result;
  } catch (err) {
    const latencyMs = Date.now() - start;
    const error = err instanceof Error ? err.message : String(err);
    const result = { ok: false, statusCode: 0, latencyMs, error };
    await setSetting("keepalive_last_ping", JSON.stringify({ ...result, at: new Date().toISOString() })).catch(() => {});
    logger.error({ url, error }, "Keep-alive ping failed");
    return result;
  }
}

export async function tickKeepalive(): Promise<void> {
  try {
    const url = (await getSetting("keepalive_url")).trim();
    if (!url) return;

    const intervalMinutes = parseInt(await getSetting("keepalive_interval_minutes")) || 5;
    const now = Date.now();
    const elapsedMinutes = (now - lastPingAt) / 60000;

    if (elapsedMinutes < intervalMinutes) return;

    lastPingAt = now;
    await pingKeepalive(url);
  } catch (err) {
    logger.error({ err }, "Keep-alive tick error");
  }
}

export function startKeepaliveScheduler(): void {
  setInterval(tickKeepalive, 60_000);
  logger.info("Keep-alive scheduler started (checks every 60s)");
}
