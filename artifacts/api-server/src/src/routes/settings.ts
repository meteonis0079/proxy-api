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

router.get("/settings/blocked-providers", async (_req, res): Promise<void> => {
  const raw = await getSetting("blocked_providers");
  const providers = raw ? raw.split(",").map(s => s.trim()).filter(Boolean) : [];
  res.json({ providers });
});

router.put("/settings/blocked-providers", async (req, res): Promise<void> => {
  const { providers } = req.body as { providers?: string[] };
  if (!Array.isArray(providers)) {
    res.status(400).json({ error: "providers 必须是数组" });
    return;
  }
  const value = providers.map(s => s.trim()).filter(Boolean).join(",");
  await setSetting("blocked_providers", value);
  res.json({ providers: value ? value.split(",") : [] });
});

export async function getBlockedProviders(): Promise<string[]> {
  const raw = await getSetting("blocked_providers");
  return raw ? raw.split(",").map(s => s.trim()).filter(Boolean) : [];
}

export default router;
