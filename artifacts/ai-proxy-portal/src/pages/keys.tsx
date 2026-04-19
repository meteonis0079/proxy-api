import React, { useState } from "react";
import { useListKeys, getListKeysQueryKey, useCreateKey, useUpdateKey, useDeleteKey, getGetKeyStatsQueryKey } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Trash2, Key as KeyIcon, Activity, CheckCircle2, XCircle, Loader2, Clock, RotateCcw } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { cn } from "@/lib/utils";

type Provider = "vercel" | "openrouter";

const MONTHLY_LIMIT_USD = 5;

const PROVIDERS: { value: Provider; label: string; description: string; placeholder: string }[] = [
  {
    value: "vercel",
    label: "Vercel AI",
    description: "Vercel AI Gateway，支持 OpenAI、Anthropic、Google 等多家提供商",
    placeholder: "vc_...",
  },
  {
    value: "openrouter",
    label: "OpenRouter",
    description: "OpenRouter 聚合路由，支持 Claude 全系列及数百个模型",
    placeholder: "sk-or-...",
  },
];

const PROVIDER_BADGE: Record<string, string> = {
  vercel: "bg-zinc-800 text-zinc-300 border-zinc-600",
  openrouter: "bg-violet-500/10 text-violet-400 border-violet-500/20",
};

const createKeySchema = z.object({
  name: z.string().min(1, "名称不能为空").max(50),
  apiKey: z.string().min(10, "请输入有效的 API 密钥"),
  provider: z.enum(["vercel", "openrouter"]).default("vercel"),
});

interface CheckResult {
  ok: boolean;
  statusCode: number;
  latencyMs: number;
  quotaHeaders: Record<string, string>;
  error: unknown;
  localStats: {
    totalRequests: number;
    totalTokens: number;
    estimatedCostUsd: number;
    lastUsedAt: string | null;
  };
}

interface MonthlyUsageMap {
  [keyId: number]: { monthlyCostUsd: number; monthlyResetAt: string | null };
}

function formatDate(iso: string | null) {
  if (!iso) return "从未使用";
  return new Date(iso).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getErrorMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    const e = error as Record<string, unknown>;
    if (e.error && typeof e.error === "object") {
      const inner = e.error as Record<string, unknown>;
      if (typeof inner.message === "string") return inner.message;
    }
    if (typeof e.message === "string") return e.message;
    if (typeof e.error === "string") return e.error;
  }
  return JSON.stringify(error);
}

// Monthly progress bar component
function MonthlyBar({ cost, limit = MONTHLY_LIMIT_USD }: { cost: number; limit?: number }) {
  const pct = Math.min(100, (cost / limit) * 100);
  const barColor =
    pct >= 90 ? "bg-red-500" :
    pct >= 70 ? "bg-amber-400" :
    pct >= 40 ? "bg-primary" :
    "bg-primary/70";

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-xs">
        <span className={cn("font-mono font-medium", pct >= 90 ? "text-red-400" : pct >= 70 ? "text-amber-300" : "text-foreground/80")}>
          ${cost.toFixed(3)}
        </span>
        <span className="text-muted-foreground/60 font-mono">${limit}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function Keys() {
  const { data: keysRaw, isLoading } = useListKeys();
  const keys = keysRaw as (typeof keysRaw extends (infer T)[] | undefined ? T & { provider?: string } : never)[] | undefined;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createKey = useCreateKey();
  const updateKey = useUpdateKey();
  const deleteKey = useDeleteKey();
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<number | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider>("vercel");

  // Check credit state
  const [checkingKeyId, setCheckingKeyId] = useState<number | null>(null);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [checkResultKeyName, setCheckResultKeyName] = useState<string>("");
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());
  const [resettingIds, setResettingIds] = useState<Set<number>>(new Set());

  // Monthly usage data
  const { data: monthlyUsage, refetch: refetchMonthly } = useQuery<MonthlyUsageMap>({
    queryKey: ["keys-monthly-usage"],
    queryFn: async () => {
      const resp = await fetch(`${base}/api/keys/monthly-usage`);
      return resp.json();
    },
    refetchInterval: 60_000,
  });

  const form = useForm<z.infer<typeof createKeySchema>>({
    resolver: zodResolver(createKeySchema),
    defaultValues: { name: "", apiKey: "", provider: "vercel" },
  });

  const onSubmit = (values: z.infer<typeof createKeySchema>) => {
    createKey.mutate(
      { data: { name: values.name, apiKey: values.apiKey, provider: values.provider } as Parameters<typeof createKey.mutate>[0]["data"] },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListKeysQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetKeyStatsQueryKey() });
          setIsCreateOpen(false);
          form.reset();
          setSelectedProvider("vercel");
          toast({ title: "密钥添加成功", description: `API 密钥「${values.name}」已安全存储。` });
        },
        onError: (err) => {
          toast({ title: "添加密钥失败", description: (err as { error?: { error?: string } }).error?.error || "发生未知错误", variant: "destructive" });
        }
      }
    );
  };

  const handleToggleState = (id: number, currentEnabled: boolean) => {
    updateKey.mutate(
      { id, data: { isEnabled: !currentEnabled } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListKeysQueryKey() });
          toast({ title: "密钥状态已更新" });
        },
        onError: () => {
          toast({ title: "更新密钥状态失败", variant: "destructive" });
        }
      }
    );
  };

  const handleDelete = () => {
    if (keyToDelete === null) return;
    deleteKey.mutate(
      { id: keyToDelete },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListKeysQueryKey() });
          setKeyToDelete(null);
          toast({ title: "密钥已安全删除" });
        },
        onError: () => {
          toast({ title: "删除密钥失败", variant: "destructive" });
          setKeyToDelete(null);
        }
      }
    );
  };

  const handleCheckKey = async (id: number, name: string) => {
    setLoadingIds(prev => new Set(prev).add(id));
    try {
      const resp = await fetch(`${base}/api/keys/${id}/check`, { method: "POST" });
      const data: CheckResult = await resp.json();
      setCheckResult(data);
      setCheckResultKeyName(name);
      setCheckingKeyId(id);
    } catch {
      toast({ title: "检查失败", description: "无法连接到后端服务", variant: "destructive" });
    } finally {
      setLoadingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const handleResetMonthly = async (id: number, name: string) => {
    setResettingIds(prev => new Set(prev).add(id));
    try {
      const resp = await fetch(`${base}/api/keys/${id}/reset-monthly`, { method: "POST" });
      if (!resp.ok) throw new Error("重置失败");
      await refetchMonthly();
      toast({ title: "月度额度已重置", description: `「${name}」的本月用量计数已清零` });
    } catch {
      toast({ title: "重置失败", variant: "destructive" });
    } finally {
      setResettingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const currentProviderInfo = PROVIDERS.find(p => p.value === selectedProvider)!;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API 密钥</h1>
          <p className="text-muted-foreground mt-1">管理你的 Vercel AI 和 OpenRouter API 凭证。</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={(o) => { setIsCreateOpen(o); if (!o) { form.reset(); setSelectedProvider("vercel"); } }}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus size={16} /> 添加密钥
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[460px] border-border bg-card">
            <DialogHeader>
              <DialogTitle>添加 API 密钥</DialogTitle>
              <DialogDescription>
                选择渠道并填入对应的密钥，密钥将被安全存储。
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
                <FormField
                  control={form.control}
                  name="provider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>渠道</FormLabel>
                      <div className="grid grid-cols-2 gap-2">
                        {PROVIDERS.map((p) => (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => {
                              field.onChange(p.value);
                              setSelectedProvider(p.value);
                              form.setValue("apiKey", "");
                            }}
                            className={cn(
                              "rounded-md border px-3 py-2.5 text-left text-sm transition-colors",
                              field.value === p.value
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-input/30 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                            )}
                          >
                            <div className="font-medium">{p.label}</div>
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{currentProviderInfo.description}</p>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>密钥名称</FormLabel>
                      <FormControl>
                        <Input placeholder="例如：生产密钥、备用密钥..." {...field} className="bg-input/50" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="apiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{selectedProvider === "openrouter" ? "OpenRouter API 密钥" : "Vercel API 密钥"}</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder={currentProviderInfo.placeholder}
                          {...field}
                          className="bg-input/50 font-mono text-sm"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter className="pt-4">
                  <Button type="submit" disabled={createKey.isPending}>
                    {createKey.isPending ? "保存中..." : "保存密钥"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border border-border/50 bg-card/50 overflow-x-auto shadow-sm backdrop-blur-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="w-[160px]">名称</TableHead>
              <TableHead>密钥预览</TableHead>
              <TableHead>渠道</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">请求次数</TableHead>
              <TableHead className="text-right">累计费用</TableHead>
              <TableHead className="w-[160px]">
                <div className="flex items-center gap-1.5">
                  本月额度
                  <span className="text-muted-foreground/50 font-normal text-[10px]">/ $5</span>
                </div>
              </TableHead>
              <TableHead className="w-[130px] text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : keys?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground border-dashed">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <KeyIcon size={24} className="text-muted-foreground/50" />
                    <span>暂无已注册的 API 密钥</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              keys?.map((key) => {
                const prov = (key as { provider?: string }).provider ?? "vercel";
                const provLabel = prov === "openrouter" ? "OpenRouter" : "Vercel AI";
                const isChecking = loadingIds.has(key.id);
                const isResetting = resettingIds.has(key.id);
                const monthly = monthlyUsage?.[key.id];
                const monthlyCost = monthly?.monthlyCostUsd ?? 0;
                return (
                  <TableRow key={key.id} className="border-border/50 hover:bg-muted/20 transition-colors">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
                          <KeyIcon size={12} className="text-primary" />
                        </div>
                        <span className="truncate max-w-[110px] text-foreground font-medium">{key.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      •••• {key.keyPreview}
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded border font-medium",
                        PROVIDER_BADGE[prov] ?? "bg-muted text-muted-foreground border-border"
                      )}>
                        {provLabel}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={key.isEnabled ? "border-primary/50 text-primary" : "border-muted-foreground/30 text-muted-foreground"}>
                        {key.isEnabled ? "已启用" : "已禁用"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{key.totalRequests.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-primary/90">${key.estimatedCostUsd.toFixed(4)}</TableCell>
                    {/* Monthly usage */}
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 min-w-[100px]">
                          {monthlyUsage === undefined ? (
                            <Skeleton className="h-4 w-full" />
                          ) : (
                            <MonthlyBar cost={monthlyCost} />
                          )}
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40"
                              onClick={() => handleResetMonthly(key.id, key.name)}
                              disabled={isResetting}
                            >
                              <RotateCcw size={11} className={isResetting ? "animate-spin" : ""} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            重置本月计数
                            {monthly?.monthlyResetAt && (
                              <div className="text-muted-foreground">上次重置：{formatDate(monthly.monthlyResetAt)}</div>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs text-muted-foreground hover:text-blue-400 hover:bg-blue-400/10 gap-1"
                          onClick={() => handleCheckKey(key.id, key.name)}
                          disabled={isChecking}
                        >
                          {isChecking
                            ? <Loader2 size={13} className="animate-spin" />
                            : <Activity size={13} />
                          }
                          {isChecking ? "检查中" : "检查"}
                        </Button>
                        <Switch 
                          checked={key.isEnabled} 
                          onCheckedChange={() => handleToggleState(key.id, key.isEnabled)}
                          aria-label="切换密钥状态"
                        />
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setKeyToDelete(key.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Check Result Dialog */}
      <Dialog open={checkingKeyId !== null && checkResult !== null} onOpenChange={(o) => { if (!o) { setCheckingKeyId(null); setCheckResult(null); } }}>
        <DialogContent className="sm:max-w-[480px] border-border bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {checkResult?.ok
                ? <CheckCircle2 size={20} className="text-green-500" />
                : <XCircle size={20} className="text-red-500" />
              }
              密钥状态检查
            </DialogTitle>
            <DialogDescription>「{checkResultKeyName}」的连通性与用量信息</DialogDescription>
          </DialogHeader>

          {checkResult && (
            <div className="space-y-4 py-2">
              <div className={cn(
                "rounded-lg border px-4 py-3 flex items-center justify-between",
                checkResult.ok
                  ? "border-green-500/30 bg-green-500/5"
                  : "border-red-500/30 bg-red-500/5"
              )}>
                <div>
                  <div className={cn("font-semibold text-sm", checkResult.ok ? "text-green-400" : "text-red-400")}>
                    {checkResult.ok ? "密钥有效，连接正常" : "密钥无效或额度耗尽"}
                  </div>
                  {!checkResult.ok && !!checkResult.error && (
                    <div className="text-xs text-red-400/80 mt-1 max-w-[340px] break-words">
                      {getErrorMessage(checkResult.error)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <Clock size={12} />
                  {checkResult.latencyMs} ms
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">本地累计用量（门户追踪）</div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-center">
                    <div className="text-lg font-bold font-mono">{checkResult.localStats.totalRequests.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">请求次数</div>
                  </div>
                  <div className="rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-center">
                    <div className="text-lg font-bold font-mono">{(checkResult.localStats.totalTokens / 1000).toFixed(1)}K</div>
                    <div className="text-xs text-muted-foreground mt-0.5">总 Token</div>
                  </div>
                  <div className="rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-center">
                    <div className="text-lg font-bold font-mono text-primary">${checkResult.localStats.estimatedCostUsd.toFixed(4)}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">累计费用</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  最近使用：{formatDate(checkResult.localStats.lastUsedAt)}
                </div>
              </div>

              {Object.keys(checkResult.quotaHeaders).length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">服务商返回的限额信息</div>
                  <div className="rounded-md border border-border/50 bg-muted/20 divide-y divide-border/30">
                    {Object.entries(checkResult.quotaHeaders).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between px-3 py-1.5 text-xs">
                        <span className="font-mono text-muted-foreground">{k}</span>
                        <span className="font-mono text-foreground">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground/60 border-t border-border/30 pt-3">
                注：Vercel AI Gateway 暂无公开余额查询 API，以上数据均为本门户追踪的估算值。
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setCheckingKeyId(null); setCheckResult(null); }}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={keyToDelete !== null} onOpenChange={(o) => !o && setKeyToDelete(null)}>
        <AlertDialogContent className="border-destructive/20 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 size={20} /> 确认删除密钥？
            </AlertDialogTitle>
            <AlertDialogDescription>
              此操作不可撤销。所有通过代理使用该密钥的应用将立即无法访问。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
            >
              {deleteKey.isPending ? "删除中..." : "确认永久删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
