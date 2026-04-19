import React from "react";

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-background dark p-6">
          <div className="max-w-lg w-full rounded-lg border border-destructive/40 bg-destructive/5 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-destructive">页面渲染出错</h2>
            <pre className="text-xs text-muted-foreground bg-muted/30 rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap break-words">
              {this.state.error?.message ?? "未知错误"}
              {"\n\n"}
              {this.state.error?.stack ?? ""}
            </pre>
            <div className="flex gap-3">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-4 py-2 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
              >
                重试
              </button>
              <button
                onClick={this.handleReset}
                className="px-4 py-2 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                清除缓存并返回首页
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
