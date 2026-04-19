import { Router, type IRouter } from "express";
import crypto from "crypto";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getCurrentPassword } from "../lib/currentPassword";

const router: IRouter = Router();

async function getPortalToken(): Promise<string> {
  const secret = process.env.SESSION_SECRET ?? "fallback-secret";
  const pwd = await getCurrentPassword();
  return crypto.createHmac("sha256", secret).update("portal:" + pwd).digest("hex");
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const currentPwd = await getCurrentPassword();
  if (!currentPwd) {
    res.status(500).json({ error: "PROXY_API_KEY 未配置" });
    return;
  }

  const { password } = req.body as { password?: string };
  if (!password || password !== currentPwd) {
    res.status(401).json({ error: "密码错误" });
    return;
  }

  res.json({ ok: true, token: await getPortalToken() });
});

router.get("/auth/verify", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  const expected = await getPortalToken();

  if (!token || token !== expected) {
    res.status(401).json({ ok: false });
    return;
  }

  res.json({ ok: true });
});

router.post("/auth/change-password", async (req, res): Promise<void> => {
  const { oldPassword, newPassword } = req.body as { oldPassword?: string; newPassword?: string };

  if (!oldPassword || !newPassword) {
    res.status(400).json({ error: "请填写原密码和新密码" });
    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json({ error: "新密码长度不能少于 6 位" });
    return;
  }

  const currentPwd = await getCurrentPassword();
  if (oldPassword !== currentPwd) {
    res.status(401).json({ error: "原密码错误" });
    return;
  }

  // Save new password to DB (overrides env var going forward)
  await db
    .insert(settingsTable)
    .values({ key: "custom_proxy_api_key", value: newPassword })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: newPassword } });

  // Return new token so the client can stay logged in
  const secret = process.env.SESSION_SECRET ?? "fallback-secret";
  const newToken = crypto.createHmac("sha256", secret).update("portal:" + newPassword).digest("hex");

  res.json({ ok: true, token: newToken });
});

export default router;
