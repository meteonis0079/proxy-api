import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, apiKeysTable, usageLogsTable } from "@workspace/db";
import {
  CreateKeyBody,
  GetKeyParams,
  UpdateKeyParams,
  UpdateKeyBody,
  DeleteKeyParams,
} from "@workspace/api-zod";
const router: IRouter = Router();

const PROVIDER_BASE_URLS: Record<string, string> = {
  vercel: "https://ai-gateway.vercel.sh/v1",
  openrouter: "https://openrouter.ai/api/v1",
};

function formatKey(k: typeof apiKeysTable.$inferSelect) {
  return {
    id: k.id,
    name: k.name,
    keyPreview: k.keyPreview,
    provider: k.provider,
    isEnabled: k.isEnabled,
    totalRequests: k.totalRequests,
    totalTokens: k.totalTokens,
    estimatedCostUsd: parseFloat(k.estimatedCostUsd),
    lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
    createdAt: k.createdAt.toISOString(),
    updatedAt: k.updatedAt.toISOString(),
  };
}

router.get("/keys", async (req, res): Promise<void> => {
  const keys = await db
    .select()
    .from(apiKeysTable)
    .orderBy(apiKeysTable.createdAt);
  res.json(keys.map(formatKey));
});

// Returns per-key monthly cost (since start of month or last reset, whichever is later)
router.get("/keys/monthly-usage", async (_req, res): Promise<void> => {
  const rows = await db.execute(sql`
    SELECT
      ul.key_id,
      COALESCE(SUM(ul.estimated_cost_usd::numeric), 0) AS monthly_cost_usd,
      ak.monthly_reset_at
    FROM usage_logs ul
    JOIN api_keys ak ON ak.id = ul.key_id
    WHERE ul.created_at >= GREATEST(
      DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC'),
      COALESCE(ak.monthly_reset_at, '1970-01-01'::timestamptz)
    )
    GROUP BY ul.key_id, ak.monthly_reset_at
  `);

  const map: Record<number, { monthlyCostUsd: number; monthlyResetAt: string | null }> = {};
  for (const row of rows.rows) {
    map[row.key_id as number] = {
      monthlyCostUsd: parseFloat(row.monthly_cost_usd as string),
      monthlyResetAt: row.monthly_reset_at ? new Date(row.monthly_reset_at as string).toISOString() : null,
    };
  }
  res.json(map);
});

// Reset monthly usage counter for a key
router.post("/keys/:id/reset-monthly", async (req, res): Promise<void> => {
  const params = GetKeyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [key] = await db
    .update(apiKeysTable)
    .set({ monthlyResetAt: new Date() })
    .where(eq(apiKeysTable.id, params.data.id))
    .returning();

  if (!key) {
    res.status(404).json({ error: "Key not found" });
    return;
  }

  res.json({ ok: true, monthlyResetAt: key.monthlyResetAt?.toISOString() ?? null });
});

router.post("/keys", async (req, res): Promise<void> => {
  const parsed = CreateKeyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, apiKey } = parsed.data;
  const rawProvider = typeof req.body.provider === "string" ? req.body.provider : "vercel";
  const safeProvider = PROVIDER_BASE_URLS[rawProvider] ? rawProvider : "vercel";
  const keyPreview = apiKey.slice(-4);

  const [key] = await db
    .insert(apiKeysTable)
    .values({ name, apiKey, keyPreview, provider: safeProvider })
    .returning();

  res.status(201).json(formatKey(key));
});

router.get("/keys/stats", async (req, res): Promise<void> => {
  const keys = await db.select().from(apiKeysTable);

  const totalRequests = keys.reduce((sum, k) => sum + k.totalRequests, 0);
  const totalTokens = keys.reduce((sum, k) => sum + k.totalTokens, 0);
  const totalCostUsd = keys.reduce(
    (sum, k) => sum + parseFloat(k.estimatedCostUsd),
    0,
  );

  const recentLogs = await db
    .select({
      id: usageLogsTable.id,
      keyId: usageLogsTable.keyId,
      keyName: apiKeysTable.name,
      model: usageLogsTable.model,
      promptTokens: usageLogsTable.promptTokens,
      completionTokens: usageLogsTable.completionTokens,
      totalTokens: usageLogsTable.totalTokens,
      estimatedCostUsd: usageLogsTable.estimatedCostUsd,
      statusCode: usageLogsTable.statusCode,
      durationMs: usageLogsTable.durationMs,
      createdAt: usageLogsTable.createdAt,
    })
    .from(usageLogsTable)
    .leftJoin(apiKeysTable, eq(usageLogsTable.keyId, apiKeysTable.id))
    .orderBy(sql`${usageLogsTable.createdAt} DESC`)
    .limit(10);

  res.json({
    totalKeys: keys.length,
    enabledKeys: keys.filter((k) => k.isEnabled).length,
    totalRequests,
    totalTokens,
    totalCostUsd,
    recentActivity: recentLogs.map((l) => ({
      ...l,
      keyName: l.keyName ?? "Deleted Key",
      estimatedCostUsd: parseFloat(l.estimatedCostUsd),
      createdAt: l.createdAt.toISOString(),
    })),
  });
});

router.get("/keys/:id", async (req, res): Promise<void> => {
  const params = GetKeyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [key] = await db
    .select()
    .from(apiKeysTable)
    .where(eq(apiKeysTable.id, params.data.id));

  if (!key) {
    res.status(404).json({ error: "Key not found" });
    return;
  }

  res.json(formatKey(key));
});

router.patch("/keys/:id", async (req, res): Promise<void> => {
  const params = UpdateKeyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateKeyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Partial<{ name: string; isEnabled: boolean }> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.isEnabled !== undefined)
    updateData.isEnabled = parsed.data.isEnabled;

  const [key] = await db
    .update(apiKeysTable)
    .set(updateData)
    .where(eq(apiKeysTable.id, params.data.id))
    .returning();

  if (!key) {
    res.status(404).json({ error: "Key not found" });
    return;
  }

  res.json(formatKey(key));
});

router.post("/keys/:id/check", async (req, res): Promise<void> => {
  const params = GetKeyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [key] = await db
    .select()
    .from(apiKeysTable)
    .where(eq(apiKeysTable.id, params.data.id));

  if (!key) {
    res.status(404).json({ error: "Key not found" });
    return;
  }

  const baseUrl = PROVIDER_BASE_URLS[key.provider] ?? PROVIDER_BASE_URLS.vercel;
  const start = Date.now();

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key.apiKey}`,
      },
      body: JSON.stringify({
        model: key.provider === "vercel" ? "openai/gpt-4o-mini" : "openai/gpt-4o-mini",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 16,
        stream: false,
      }),
    });

    const latencyMs = Date.now() - start;
    const statusCode = response.status;
    const contentType = response.headers.get("content-type") ?? "";

    // Collect any rate-limit / quota headers
    const quotaHeaders: Record<string, string> = {};
    for (const [k, v] of response.headers.entries()) {
      const lk = k.toLowerCase();
      if (lk.includes("limit") || lk.includes("remaining") || lk.includes("quota") || lk.includes("credit") || lk.includes("balance") || lk.includes("usage")) {
        quotaHeaders[k] = v;
      }
    }

    let responseBody: unknown = null;
    if (contentType.includes("application/json")) {
      responseBody = await response.json();
    } else {
      responseBody = await response.text();
    }

    const ok = statusCode >= 200 && statusCode < 300;

    res.json({
      ok,
      statusCode,
      latencyMs,
      quotaHeaders,
      error: ok ? null : responseBody,
      localStats: {
        totalRequests: key.totalRequests,
        totalTokens: key.totalTokens,
        estimatedCostUsd: parseFloat(key.estimatedCostUsd),
        lastUsedAt: key.lastUsedAt ? key.lastUsedAt.toISOString() : null,
      },
    });
  } catch (err) {
    const latencyMs = Date.now() - start;
    res.json({
      ok: false,
      statusCode: 0,
      latencyMs,
      quotaHeaders: {},
      error: err instanceof Error ? err.message : "连接失败",
      localStats: {
        totalRequests: key.totalRequests,
        totalTokens: key.totalTokens,
        estimatedCostUsd: parseFloat(key.estimatedCostUsd),
        lastUsedAt: key.lastUsedAt ? key.lastUsedAt.toISOString() : null,
      },
    });
  }
});

router.delete("/keys/:id", async (req, res): Promise<void> => {
  const params = DeleteKeyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [key] = await db
    .delete(apiKeysTable)
    .where(eq(apiKeysTable.id, params.data.id))
    .returning();

  if (!key) {
    res.status(404).json({ error: "Key not found" });
    return;
  }

  res.sendStatus(204);
});

export { PROVIDER_BASE_URLS };
export default router;
