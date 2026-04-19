import React, { useState } from "react";
import { useListUsage, useListKeys } from "@workspace/api-client-react";
import { format } from "date-fns";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Activity, Clock, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Usage() {
  const [selectedKeyId, setSelectedKeyId] = useState<number | null>(null);
  
  const { data: logs, isLoading: logsLoading } = useListUsage(
    selectedKeyId ? { keyId: selectedKeyId, limit: 100 } : { limit: 100 }
  );
  
  const { data: keys } = useListKeys();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">使用日志</h1>
          <p className="text-muted-foreground mt-1">详细的代理请求遥测数据。</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mr-2">
            <Filter size={14} /> 筛选：
          </div>
          <Select 
            value={selectedKeyId ? selectedKeyId.toString() : "all"} 
            onValueChange={(v) => setSelectedKeyId(v === "all" ? null : parseInt(v))}
          >
            <SelectTrigger className="w-[200px] bg-card border-border">
              <SelectValue placeholder="全部密钥" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部密钥</SelectItem>
              {keys?.map(k => (
                <SelectItem key={k.id} value={k.id.toString()}>{k.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-border/50 bg-card/50 shadow-sm backdrop-blur-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="w-[180px]">时间</TableHead>
              <TableHead>密钥</TableHead>
              <TableHead>模型</TableHead>
              <TableHead className="text-right">Token 数</TableHead>
              <TableHead className="text-right">延迟</TableHead>
              <TableHead className="text-right">费用</TableHead>
              <TableHead className="w-[100px] text-center">状态码</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logsLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[140px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-[60px] ml-auto" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-[40px] ml-auto" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-[50px] ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-[60px] mx-auto" /></TableCell>
                </TableRow>
              ))
            ) : logs?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-48 text-center text-muted-foreground border-dashed">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Activity size={24} className="text-muted-foreground/50" />
                    <span>暂无使用日志</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              logs?.map((log) => (
                <TableRow key={log.id} className="border-border/50 hover:bg-muted/20 transition-colors">
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {format(new Date(log.createdAt), "MM月dd日 HH:mm:ss")}
                  </TableCell>
                  <TableCell className="font-medium text-sm">
                    {log.keyName}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono text-[10px] bg-secondary/50 text-secondary-foreground border-border/50">
                      {log.model}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end">
                      <span className="font-mono text-sm">{log.totalTokens}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{log.promptTokens}输入 / {log.completionTokens}输出</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1 text-muted-foreground text-sm font-mono">
                      <Clock size={12} /> {log.durationMs}ms
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-primary/80">
                    ${log.estimatedCostUsd.toFixed(5)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant="outline" 
                      className={
                        log.statusCode < 300 ? "border-green-500/30 text-green-500 bg-green-500/10" : 
                        "border-destructive/30 text-destructive bg-destructive/10"
                      }
                    >
                      {log.statusCode}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <div className="border-t border-border/50 p-4 flex items-center justify-between bg-card text-sm text-muted-foreground">
          <div>显示最近 100 条记录</div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled className="h-8 border-border">
              <ChevronLeft size={16} /> 上一页
            </Button>
            <Button variant="outline" size="sm" disabled className="h-8 border-border">
              下一页 <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
