import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  CheckCircle2, XCircle, Loader2, Send, Clock, RefreshCw, Wifi, WifiOff,
  ShieldCheck, KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LastPing {
  ok: boolean;
  statusCode: number;
  latencyMs: number;
  at: string;
  error?: string;
}

interface KeepaliveConfig {
  url: string;
  intervalMinutes: number;
  lastPing: LastPing | null;
}

function formatRelative(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff} 秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return new Date(iso).toLocaleString("zh-CN");
}

export default function Settings() {
  const { toast } = useToast();
  const { logout } = useAuth();
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  const [config, setConfig] = useState<KeepaliveConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pinging, setPinging] = useState(false);

  const [url, setUrl] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState(5);

  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [changingPwd, setChangingPwd] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    try {
      const resp = await fetch(`${base}/api/settings/keepalive`);
      const data: KeepaliveConfig = await resp.json();
      setConfig(data);
      setUrl(data.url);
      setIntervalMinutes(data.intervalMinutes);
    } catch {
      toast({ title: "加载配置失败", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const resp = await fetch(`${base}/api/settings/keepalive`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), intervalMinutes }),
      });
      const data: KeepaliveConfig = await resp.json();
      setConfig(data);
      toast({
        title: "保活配置已保存",
        description: url.trim() ? `将每 ${intervalMinutes} 分钟发送一次请求` : "保活已禁用",
      });
    } catch {
      toast({ title: "保存失败", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handlePing() {
    setPinging(true);
    try {
      const resp = await fetch(`${base}/api/settings/keepalive/ping`, { method: "POST" });
      const result = await resp.json() as { ok?: boolean; statusCode?: number; latencyMs?: number; error?: string };
      if (result.ok) {
        toast({ title: "Ping 成功", description: `${result.statusCode} · ${result.latencyMs} ms` });
      } else {
        toast({ title: "Ping 失败", description: result.error ?? `HTTP ${result.statusCode}`, variant: "destructive" });
      }
      await loadConfig();
    } catch {
      toast({ title: "Ping 请求失败", variant: "destructive" });
    } finally {
      setPinging(false);
    }
  }

  async function handleChangePassword() {
    setPwdError("");
    if (!oldPwd || !newPwd || !confirmPwd) {
      setPwdError("请填写所有字段");
      return;
    }
    if (newPwd.length < 6) {
      setPwdError("新密码长度不能少于 6 位");
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError("两次输入的新密码不一致");
      return;
    }
    setChangingPwd(true);
    try {
      const resp = await fetch(`${base}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }),
      });
      const data = await resp.json() as { ok?: boolean; token?: string; error?: string };
      if (data.ok && data.token) {
        setOldPwd(""); setNewPwd(""); setConfirmPwd("");
        toast({ title: "密码修改成功", description: "请用新密码重新登录。" });
        setTimeout(() => logout(), 1200);
      } else {
        setPwdError(data.error ?? "修改失败");
      }
    } catch {
      setPwdError("网络错误，请重试");
    } finally {
      setChangingPwd(false);
    }
  }

  const isEnabled = url.trim().length > 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">系统设置</h1>
        <p className="text-muted-foreground mt-1">配置保活等系统级功能。</p>
      </div>

      {/* Keep-alive Card */}
      <div className="rounded-lg border border-border/60 bg-card/60 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-muted/20">
          <div className="flex items-center gap-3">
            {isEnabled
              ? <Wifi size={18} className="text-green-400" />
              : <WifiOff size={18} className="text-muted-foreground" />
            }
            <div>
              <div className="font-semibold text-sm">定时保活</div>
              <div className="text-xs text-muted-foreground">定期向指定 URL 发送 GET 请求，防止服务休眠</div>
            </div>
          </div>
          <Badge variant="outline" className={cn(
            "text-xs",
            isEnabled ? "border-green-500/40 text-green-400" : "border-muted-foreground/30 text-muted-foreground"
          )}>
            <span>{isEnabled ? "已启用" : "已禁用"}</span>
          </Badge>
        </div>

        <div className="px-6 py-5 space-y-5">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 size={14} className="animate-spin" />
              <span>加载中...</span>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium">保活 URL</label>
                <Input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://your-app.replit.app/api/healthz（留空则禁用）"
                  className="bg-input/50 font-mono text-sm"
                  spellCheck={false}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  留空即禁用保活功能。推荐填入本项目的健康检查地址。
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">发送间隔（分钟）</label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={intervalMinutes}
                    onChange={e => setIntervalMinutes(Math.max(1, Math.min(60, parseInt(e.target.value) || 5)))}
                    className="bg-input/50 w-24"
                  />
                  <span className="text-sm text-muted-foreground">分钟一次（1–60 分钟）</span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  <span>{saving ? "保存中..." : "保存配置"}</span>
                </Button>
                {isEnabled && (
                  <Button
                    variant="outline"
                    onClick={handlePing}
                    disabled={pinging}
                    className="gap-2 text-muted-foreground hover:text-foreground"
                  >
                    {pinging
                      ? <Loader2 size={14} className="animate-spin" />
                      : <Send size={14} />
                    }
                    <span>{pinging ? "发送中..." : "立即 Ping"}</span>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={loadConfig}
                  disabled={loading}
                  className="text-muted-foreground hover:text-foreground h-9 w-9"
                >
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                </Button>
              </div>
            </div>
          )}
        </div>

        {config?.lastPing && (
          <div className={cn(
            "mx-6 mb-5 rounded-md border px-4 py-3",
            config.lastPing.ok
              ? "border-green-500/25 bg-green-500/5"
              : "border-red-500/25 bg-red-500/5"
          )}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {config.lastPing.ok
                  ? <CheckCircle2 size={14} className="text-green-400 shrink-0" />
                  : <XCircle size={14} className="text-red-400 shrink-0" />
                }
                <span className={cn("text-sm font-medium", config.lastPing.ok ? "text-green-400" : "text-red-400")}>
                  <span>上次 Ping {config.lastPing.ok ? "成功" : "失败"}</span>
                  {config.lastPing.ok && <span> · HTTP {config.lastPing.statusCode}</span>}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  <span>{config.lastPing.latencyMs} ms</span>
                </span>
                <span>{formatRelative(config.lastPing.at)}</span>
              </div>
            </div>
            {!config.lastPing.ok && config.lastPing.error && (
              <p className="text-xs text-red-400/80 mt-1.5 ml-5">{config.lastPing.error}</p>
            )}
          </div>
        )}
      </div>

      {/* Change Password Card */}
      <div className="rounded-lg border border-border/60 bg-card/60 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border/40 bg-muted/20">
          <KeyRound size={18} className="text-primary/80" />
          <div>
            <div className="font-semibold text-sm">修改访问密码</div>
            <div className="text-xs text-muted-foreground">同时更新门户登录密码和 API 代理密钥</div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">原密码</label>
            <Input
              key="pwd-old"
              type="password"
              value={oldPwd}
              onChange={e => { setOldPwd(e.target.value); setPwdError(""); }}
              placeholder="当前密码"
              autoComplete="off"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore
              data-bwignore="true"
              className="bg-input/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">新密码</label>
              <Input
                key="pwd-new"
                type="password"
                value={newPwd}
                onChange={e => { setNewPwd(e.target.value); setPwdError(""); }}
                placeholder="至少 6 位"
                autoComplete="off"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore
                data-bwignore="true"
                className="bg-input/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">确认新密码</label>
              <Input
                key="pwd-confirm"
                type="password"
                value={confirmPwd}
                onChange={e => { setConfirmPwd(e.target.value); setPwdError(""); }}
                placeholder="再输一次"
                autoComplete="off"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore
                data-bwignore="true"
                className={cn(
                  "bg-input/50",
                  confirmPwd && newPwd !== confirmPwd ? "border-destructive/60" : ""
                )}
              />
            </div>
          </div>

          {newPwd.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {[6, 10, 16].map(len => (
                  <div key={len} className={cn(
                    "h-1 w-8 rounded-full transition-colors",
                    newPwd.length >= len ? "bg-primary" : "bg-muted/50"
                  )} />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                <span>{newPwd.length < 6 ? "太短" : newPwd.length < 10 ? "一般" : newPwd.length < 16 ? "较强" : "强"}</span>
              </span>
            </div>
          )}

          {pwdError && (
            <p className="text-xs text-destructive flex items-center gap-1.5">
              <XCircle size={13} className="shrink-0" />
              <span>{pwdError}</span>
            </p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <Button
              type="button"
              onClick={handleChangePassword}
              disabled={changingPwd || !oldPwd || !newPwd || !confirmPwd}
              className="gap-2"
            >
              {changingPwd
                ? <Loader2 size={14} className="animate-spin" />
                : <ShieldCheck size={14} />
              }
              <span>{changingPwd ? "修改中..." : "确认修改"}</span>
            </Button>
            <p className="text-xs text-muted-foreground">
              修改后客户端（SillyTavern 等）的 <code className="font-mono">API Key</code> 也需同步更新
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-border/40 bg-muted/20 px-4 py-3 text-xs text-muted-foreground space-y-1">
        <p><span className="font-medium text-foreground/70">提示</span>：保活功能在后端服务进程内运行，每分钟检查一次是否需要 Ping。</p>
        <p>如果你的 Replit 应用有保活需求，建议将本项目 API 服务的健康检查地址（<code className="font-mono">/api/healthz</code>）填入，并设置 5 分钟间隔。</p>
      </div>
    </div>
  );
}
