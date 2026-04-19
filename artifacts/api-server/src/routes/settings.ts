import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import { pingKeepalive } from "../lib/keepalive";

const router: IRouter = Router();

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

router.get("/settings/keepalive", async (_req, res): Promise<void> => {
  const url = await getSetting("keepalive_url");
  const intervalMinutes = parseInt(await getSetting("keepalive_interval_minutes")) || 5;
  const lastPingRaw = await getSetting("keepalive_last_ping");

  let lastPing: unknown = null;
  try { lastPing = lastPingRaw ? JSON.parse(lastPingRaw) : null; } catch { /* ignore */ }

  res.json({ url, intervalMinutes, lastPing });
});

router.put("/settings/keepalive", async (req, res): Promise<void> => {
  const { url, intervalMinutes } = req.body as { url?: unknown; intervalMinutes?: unknown };

  if (url !== undefined) {
    const trimmed = typeof url === "string" ? url.trim() : "";
    await setSetting("keepalive_url", trimmed);
  }

  if (intervalMinutes !== undefined) {
    const val = Math.max(1, Math.min(60, parseInt(String(intervalMinutes)) || 5));
    await setSetting("keepalive_interval_minutes", String(val));
  }

  const savedUrl = await getSetting("keepalive_url");
  const savedInterval = parseInt(await getSetting("keepalive_interval_minutes")) || 5;
  const lastPingRaw = await getSetting("keepalive_last_ping");
  let lastPing: unknown = null;
  try { lastPing = lastPingRaw ? JSON.parse(lastPingRaw) : null; } catch { /* ignore */ }

  res.json({ url: savedUrl, intervalMinutes: savedInterval, lastPing });
});

router.post("/settings/keepalive/ping", async (_req, res): Promise<void> => {
  const url = (await getSetting("keepalive_url")).trim();
  if (!url) {
    res.status(400).json({ error: "未配置保活 URL" });
    return;
  }
  const result = await pingKeepalive(url);
  res.json(result);
});

export default router;
