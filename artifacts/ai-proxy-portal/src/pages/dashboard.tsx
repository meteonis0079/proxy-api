import React, { useMemo, useState } from "react";
import { useGetKeyStats, useGetUsageSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Key, Activity, DollarSign, Database, ServerCrash, Clock, Copy, Check, Terminal } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useGetKeyStats();
  const { data: summary, isLoading: summaryLoading } = useGetUsageSummary();

  const chartData = useMemo(() => {
    if (!summary?.byKey) return [];
    return summary.byKey
      .map(k => ({
        name: k.keyName,
        requests: k.requests,
        cost: k.costUsd
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 5);
  }, [summary]);

  if (statsError) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
        <ServerCrash size={48} className="text-destructive/50" />
        <h2 className="text-2xl font-bold tracking-tight">统计数据加载失败</h2>
        <p className="text-muted-foreground">API 服务器可能已离线或无法访问。</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">概览</h1>
        <p className="text-muted-foreground mt-1">实时基础设施监控数据。</p>
      </div>

      {/* 顶部统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="API 密钥总数" 
          value={stats?.totalKeys.toString() ?? "-"}
          subValue={`${stats?.enabledKeys ?? 0} 个已启用`}
          icon={Key} 
          isLoading={statsLoading} 
        />
        <StatCard 
          title="总请求次数" 
          value={(stats?.totalRequests ?? 0).toLocaleString()}
          icon={Activity} 
          isLoading={statsLoading} 
        />
        <StatCard 
          title="已处理 Token 数" 
          value={(stats?.totalTokens ?? 0).toLocaleString()}
          icon={Database} 
          isLoading={statsLoading} 
        />
        <StatCard 
          title="预估总费用" 
          value={`$${(stats?.totalCostUsd ?? 0).toFixed(4)}`}
          icon={DollarSign} 
          isLoading={statsLoading} 
          valueClassName="text-primary font-mono"
        />
      </div>

      {/* 代理端点信息 */}
      <ProxyEndpointCard />

      <div className="grid gap-6 md:grid-cols-7">
        {/* 图表 */}
        <Card className="md:col-span-4 border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">各密钥请求量排名</CardTitle>
            <CardDescription>各密钥请求量分布（Top 5）</CardDescription>
          </CardHeader>
          <CardContent className="pl-2 h-[300px]">
            {summaryLoading ? (
              <Skeleton className="w-full h-full rounded-md" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => `${value}`}
                  />
                  <Tooltip 
                    cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(value: number) => [`${value} 次`, '请求数']}
                  />
                  <Bar dataKey="requests" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`hsl(var(--primary) / ${0.5 + (0.1 * (5 - index))})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm border border-dashed rounded-lg border-border">
                暂无使用数据
              </div>
            )}
          </CardContent>
        </Card>

        {/* 最近活动 */}
        <Card className="md:col-span-3 border-border/50 shadow-sm bg-card/50 backdrop-blur-sm flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock size={18} className="text-muted-foreground" />
              最近请求
            </CardTitle>
            <CardDescription>最新代理请求记录</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            {statsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : stats?.recentActivity && stats.recentActivity.length > 0 ? (
              <div className="space-y-4">
                {stats.recentActivity.slice(0, 5).map((log) => (
                  <div key={log.id} className="flex items-center justify-between group">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none group-hover:text-primary transition-colors">
                        {log.keyName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.model} · {log.durationMs}ms
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="flex items-center justify-end gap-2">
                        {log.statusCode >= 400 ? (
                          <span className="w-2 h-2 rounded-full bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-primary/80" />
                        )}
                        <p className="text-xs font-mono">{log.statusCode}</p>
                      </div>
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: zhCN })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm border border-dashed rounded-lg border-border py-12">
                暂无最近活动
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleCopy}>
      {copied ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
    </Button>
  );
}

function ProxyEndpointCard() {
  const baseUrl = `${window.location.origin}/api/v1`;
  const fullUrl = `${baseUrl}/chat/completions`;
  const curlExample = `curl -X POST ${fullUrl} \\
  -H "Authorization: Bearer YOUR_PROXY_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hello!"}]}'`;

  return (
    <Card className="border-primary/20 bg-primary/5 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Terminal size={16} className="text-primary" />
          代理端点使用说明
        </CardTitle>
        <CardDescription>填入 SillyTavern 或任何 OpenAI 兼容客户端的自定义端点</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">
              基础 URL <span className="text-primary/70">（填入 SillyTavern「自定义端点」）</span>
            </p>
            <div className="flex items-center gap-2 bg-background/60 rounded-md px-3 py-2 border border-primary/30">
              <code className="text-xs font-mono text-primary flex-1 truncate">{baseUrl}</code>
              <CopyButton text={baseUrl} />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">
              API 密钥 <span className="text-primary/70">（填入 SillyTavern「API 密钥」）</span>
            </p>
            <div className="flex items-center gap-2 bg-background/60 rounded-md px-3 py-2 border border-primary/30">
              <code className="text-xs font-mono text-primary flex-1">YOUR_PROXY_KEY</code>
              <CopyButton text="YOUR_PROXY_KEY" />
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium">完整端点地址（供参考）</p>
            <CopyButton text={fullUrl} />
          </div>
          <div className="flex items-center gap-2 bg-background/60 rounded-md px-3 py-2 border border-border/50">
            <code className="text-xs font-mono text-muted-foreground flex-1 truncate">{fullUrl}</code>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium">示例 curl 请求</p>
            <CopyButton text={curlExample} />
          </div>
          <pre className="text-xs font-mono bg-background/60 rounded-md px-3 py-2 border border-border/50 overflow-x-auto text-muted-foreground whitespace-pre">{curlExample}</pre>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({ 
  title, 
  value, 
  subValue,
  icon: Icon, 
  isLoading,
  valueClassName
}: { 
  title: string; 
  value: string | number; 
  subValue?: string;
  icon: React.ElementType; 
  isLoading: boolean;
  valueClassName?: string;
}) {
  return (
    <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur-sm transition-all hover:bg-card hover:border-primary/30">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <>
            <div className={cn("text-2xl font-bold", valueClassName)}>{value}</div>
            {subValue && (
              <p className="text-xs text-muted-foreground mt-1">{subValue}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
