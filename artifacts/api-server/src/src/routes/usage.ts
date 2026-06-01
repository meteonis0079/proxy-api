import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, apiKeysTable, usageLogsTable } from "@workspace/db";
import { ListUsageQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/usage", async (req, res): Promise<void> => {
  const parsed = ListUsageQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { keyId, limit } = parsed.data;
  const maxLimit = limit ?? 100;

  let query = db
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
    .limit(maxLimit);

  if (keyId != null) {
    query = query.where(eq(usageLogsTable.keyId, keyId)) as typeof query;
  }

  const logs = await query;

  res.json(
    logs.map((l) => ({
      ...l,
      keyName: l.keyName ?? "Deleted Key",
      estimatedCostUsd: parseFloat(l.estimatedCostUsd),
      createdAt: l.createdAt.toISOString(),
    })),
  );
});

router.get("/usage/summary", async (req, res): Promise<void> => {
  const keys = await db.select().from(apiKeysTable);

  const byKey = await Promise.all(
    keys.map(async (key) => {
      const logs = await db
        .select({
          statusCode: usageLogsTable.statusCode,
          totalTokens: usageLogsTable.totalTokens,
          estimatedCostUsd: usageLogsTable.estimatedCostUsd,
        })
        .from(usageLogsTable)
        .where(eq(usageLogsTable.keyId, key.id));

      const requests = logs.length;
      const tokens = logs.reduce((sum, l) => sum + l.totalTokens, 0);
      const costUsd = logs.reduce(
        (sum, l) => sum + parseFloat(l.estimatedCostUsd),
        0,
      );
      const successCount = logs.filter(
        (l) => l.statusCode >= 200 && l.statusCode < 300,
      ).length;
      const successRate = requests > 0 ? successCount / requests : 1;

      return {
        keyId: key.id,
        keyName: key.name,
        requests,
        tokens,
        costUsd,
        successRate,
      };
    }),
  );

  const totalRequests = byKey.reduce((sum, k) => sum + k.requests, 0);
  const totalCostUsd = byKey.reduce((sum, k) => sum + k.costUsd, 0);

  res.json({ byKey, totalRequests, totalCostUsd });
});

export default router;
