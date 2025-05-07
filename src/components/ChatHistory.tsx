import { cn } from "@/lib/utils";
import type { KeyboardEvent } from "react";
import type { ApiSessionData } from "@/hooks/useHistory";

interface ChatHistoryProps {
  sessions: ApiSessionData[];
  currentSessionId?: string;
  isLoading: boolean;
  onSelectSession: (id: string) => void;
  className?: string;
}

export function ChatHistory({
  sessions,
  currentSessionId,
  isLoading,
  onSelectSession,
  className,
}: ChatHistoryProps) {
  // 格式化日期显示
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 键盘事件处理
  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, id: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelectSession(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-sm animate-pulse">加载历史记录...</div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-gray-500">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-12 h-12 mb-2 opacity-50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <title>空聊天记录图标</title>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <p className="text-center">暂无历史记录</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3 overflow-y-auto", className)}>
      {sessions.map((session) => (
        <button
          type="button"
          key={session.id}
          className={cn(
            "flex flex-col p-3 rounded-lg border transition-all duration-200 hover:shadow-md cursor-pointer text-left w-full",
            currentSessionId === session.sessionId
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
              : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
          )}
          onClick={() => onSelectSession(session.sessionId)}
          onKeyDown={(e) => handleKeyDown(e, session.sessionId)}
          aria-pressed={currentSessionId === session.sessionId}
        >
          <div className="flex items-start justify-between">
            <h3 className="font-medium truncate text-base">{session.title}</h3>
          </div>
        </button>
      ))}
    </div>
  );
}
