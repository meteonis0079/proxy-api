import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Orbit, Lock, Eye, EyeOff, Loader2 } from "lucide-react";

export function LoginGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, login } = useAuth();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background dark">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <>{children}</>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setSubmitting(true);
    setError("");
    const result = await login(password.trim());
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "密码错误");
      setPassword("");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background dark overflow-hidden">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-primary/3 blur-3xl" />
      </div>

      <div
        className={`relative w-full max-w-sm mx-4 ${shake ? "animate-[shake_0.4s_ease-in-out]" : ""}`}
        style={shake ? { animation: "shake 0.4s ease-in-out" } : {}}
      >
        {/* Card */}
        <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-2xl shadow-black/30 px-8 py-10 space-y-8">
          {/* Logo */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center shadow-lg">
              <Orbit size={28} className="text-primary" />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold tracking-tight">AI 代理管理</h1>
              <p className="text-sm text-muted-foreground mt-0.5">请输入访问密码</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="访问密码"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  autoFocus
                  autoComplete="current-password"
                  className="pl-9 pr-10 bg-input/60 border-border/60 focus:border-primary/60 transition-colors"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  onClick={() => setShowPassword(v => !v)}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {error && (
                <p className="text-xs text-destructive flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                  {error}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={submitting || !password.trim()}
            >
              {submitting ? (
                <><Loader2 size={15} className="animate-spin" /> 验证中...</>
              ) : (
                "进入管理台"
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground/40 mt-4">
          AI Proxy Portal · 仅限授权访问
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
