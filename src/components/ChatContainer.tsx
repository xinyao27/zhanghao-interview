"use client";

import { Chat } from "@/components/Chat";
import { Button } from "@/components/ui/button";
import { RefreshCcw, History } from "lucide-react";
import { useSessionManager } from "@/hooks/useSessionManager";
import { cn } from "@/lib/utils";
import { useRef, useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { client } from "@/lib/fetch";

interface ChatContainerProps {
  title?: string;
  className?: string;
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessage: string | null;
}

interface SessionsResponse {
  success: boolean;
  data?: ChatSession[];
  error?: string;
}

export function ChatContainer({ title, className }: ChatContainerProps) {
  const {
    sessionId,
    initialMessages,
    isLoading,
    handleSessionIdChange,
    startNewChat,
  } = useSessionManager();
  const refreshRef = useRef<number>(1);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const fetchSessions = useCallback(async () => {
    if (historyOpen) {
      setLoadingSessions(true);
      try {
        const response = await client.api.agent.sessions.$get();
        const result = (await response.json()) as SessionsResponse;
        if (result.success && result.data) {
          setSessions(result.data);
        }
      } catch (error) {
        console.error("获取会话历史失败:", error);
      } finally {
        setLoadingSessions(false);
      }
    }
  }, [historyOpen]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleSelectSession = (id: string) => {
    handleSessionIdChange(id);
    setHistoryOpen(false);
    refreshRef.current++;
  };

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

  return (
    <div className={cn("flex flex-col w-full", className)}>
      <div className="flex mb-2 items-center justify-between w-full max-w-2xl mx-auto">
        {title && <h1 className="text-xl font-semibold">{title}</h1>}
        <span className="flex-grow" />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHistoryOpen(true)}
            title="查看历史记录"
          >
            <History className="w-4 h-4 mr-2" />
            历史记录
          </Button>
          {sessionId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                startNewChat();
                refreshRef.current++;
              }}
              title="开始新对话"
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              新对话
            </Button>
          )}
        </div>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center w-full h-[80vh]">
          <div className="p-4 text-lg animate-pulse">加载聊天历史...</div>
        </div>
      ) : (
        <Chat
          sessionId={sessionId}
          key={refreshRef.current}
          initialMessages={initialMessages}
          onSessionIdChange={handleSessionIdChange}
          className="w-full h-[80vh] sm:h-[70vh] max-h-[700px] shadow-md rounded-md"
        />
      )}

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>聊天历史记录</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {loadingSessions ? (
              <div className="flex items-center justify-center p-4">
                <div className="text-sm animate-pulse">加载历史记录...</div>
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center p-4 text-sm text-gray-500">
                暂无历史记录
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {sessions.map((session) => (
                  <button
                    type="button"
                    key={session.id}
                    className={cn(
                      "p-3 rounded-md border text-left w-full cursor-pointer hover:bg-gray-100",
                      sessionId === session.id && "border-blue-500 bg-blue-50"
                    )}
                    onClick={() => handleSelectSession(session.id)}
                    aria-label={`选择对话: ${session.title}`}
                  >
                    <div className="font-medium truncate">{session.title}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatDate(session.updatedAt)}
                    </div>
                    {session.lastMessage && (
                      <div className="text-sm text-gray-600 mt-1 truncate">
                        {session.lastMessage}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
