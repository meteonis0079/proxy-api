import { pgTable, text, serial, timestamp, boolean, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const apiKeysTable = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  apiKey: text("api_key").notNull(),
  keyPreview: text("key_preview").notNull(),
  provider: text("provider").notNull().default("vercel"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  totalRequests: integer("total_requests").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  estimatedCostUsd: numeric("estimated_cost_usd", { precision: 10, scale: 6 }).notNull().default("0"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  monthlyResetAt: timestamp("monthly_reset_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertApiKeySchema = createInsertSchema(apiKeysTable).omit({
  id: true,
  totalRequests: true,
  totalTokens: true,
  estimatedCostUsd: true,
  lastUsedAt: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeysTable.$inferSelect;
