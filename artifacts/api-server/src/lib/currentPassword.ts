import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Returns the active proxy/portal password.
 * Priority: settings table (custom_proxy_api_key) > PROXY_API_KEY env var
 */
export async function getCurrentPassword(): Promise<string> {
  try {
    const [row] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, "custom_proxy_api_key"));
    if (row?.value?.trim()) return row.value.trim();
  } catch { /* DB not ready yet, fall through */ }
  return process.env.PROXY_API_KEY ?? "";
}
