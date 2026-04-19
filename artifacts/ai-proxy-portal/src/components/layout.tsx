import React from "react";
import { Link, useLocation } from "wouter";
import { Activity, Key, LayoutDashboard, Orbit, Cpu, Settings } from "lucide-react";
import { useHealthCheck } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { data: health } = useHealthCheck();

  const navItems = [
    { href: "/", label: "控制台", icon: LayoutDashboard },
    { href: "/keys", label: "API 密钥", icon: Key },
    { href: "/usage", label: "使用日志", icon: Activity },
    { href: "/models", label: "支持的模型", icon: Cpu },
    { href: "/settings", label: "系统设置", icon: Settings },
  ];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden dark">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col hidden md:flex">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center text-primary">
            <Orbit size={20} className="text-primary" />
          </div>
          <span className="font-semibold text-lg tracking-tight">AI 代理管理</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                  data-testid={`nav-${item.label}`}
                >
                  <item.icon size={18} className={cn(isActive ? "text-primary" : "text-muted-foreground")} />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between text-xs px-3 py-2 rounded-md bg-secondary/50 border border-border">
            <span className="text-muted-foreground font-mono">系统状态</span>
            <div className="flex items-center gap-2">
              {health?.status === "ok" ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
                  <span className="text-green-500 font-medium">正常</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-destructive" />
                  <span className="text-destructive font-medium">异常</span>
                </>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Mobile Header */}
        <header className="md:hidden border-b border-border p-4 flex items-center justify-between bg-card">
          <div className="flex items-center gap-2">
            <Orbit size={20} className="text-primary" />
            <span className="font-semibold">AI 代理管理</span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6 md:p-8">
          <div className="max-w-6xl mx-auto space-y-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
