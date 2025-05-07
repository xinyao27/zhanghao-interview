"use client";

import { Chat } from "@/components/Chat";
import { Button } from "@/components/ui/button";
import { PlusCircle, MessageSquare, X } from "lucide-react";
import { useSessionManager } from "@/hooks/useSessionManager";
import { cn } from "@/lib/utils";
import { useRef, useState, useEffect } from "react";
import { ChatHistory } from "@/components/ChatHistory";
import { useHistory } from "@/hooks/useHistory";

interface ChatContainerProps {
  title?: string;
  className?: string;
}

export function ChatContainer({ title, className }: ChatContainerProps) {
  const {
    sessionId,
    initialMessages,
    handleSessionIdChange,
    setSessionId,
    startNewChat,
  } = useSessionManager();
  const {
    sessions,
    isLoading: loadingSessions,
    refreshSessions,
  } = useHistory(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [hideTitle, setHideTitle] = useState(false);
  const chatKeyRef = useRef<number>(0);
  const isComeRef = useRef(false);
  useEffect(() => {
    if (sessionId) {
      isComeRef.current = true;
      setHideTitle(true);
    }
  }, [sessionId]);

  // 响应式处理
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleSelectSession = (id: string) => {
    setSessionId(id);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  // 初次打开自动加载会话
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    refreshSessions();
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleNewMessage = (id: string) => {
    if (id) {
      refreshSessions();
    }
  };
  return (
    <div className={cn("flex w-full h-screen", className)}>
      {/* 移动端侧边栏开关按钮 */}
      {isMobile && (
        <Button
          variant="outline"
          size="icon"
          onClick={toggleSidebar}
          className="fixed bottom-4 right-4 z-50 rounded-full shadow-lg bg-primary text-primary-foreground"
        >
          <MessageSquare className="h-5 w-5" />
        </Button>
      )}

      {/* 侧边栏 */}
      <div
        className={cn(
          "bg-slate-50 dark:bg-slate-900 border-r flex flex-col transition-all duration-300 ease-in-out",
          isMobile ? "fixed inset-y-0 left-0 z-40 w-64" : "w-64",
          sidebarOpen ? "translate-x-0" : isMobile ? "-translate-x-full" : "w-0"
        )}
      >
        {/* 侧边栏头部 */}
        {isMobile && (
          <div className="p-2 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-8 w-8 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* 新对话按钮 */}
        <div className="p-2">
          <Button
            onClick={() => {
              startNewChat();
              chatKeyRef.current = chatKeyRef.current + 1;
              setHideTitle(false);
              if (isMobile) {
                setSidebarOpen(false);
              }
            }}
            className="w-full"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            新对话
          </Button>
        </div>

        {/* 历史记录列表 */}
        <div className="flex-1 overflow-auto p-3">
          <ChatHistory
            sessions={sessions}
            currentSessionId={sessionId}
            isLoading={loadingSessions}
            onSelectSession={handleSelectSession}
          />
        </div>
      </div>

      {/* 聊天主区域 */}
      <div
        className={cn(
          "flex-1 relative flex flex-col justify-center p-4 pt-13 overflow-hidden transition-all duration-300",
          sidebarOpen && !isMobile ? "ml-0" : "ml-0 w-full"
        )}
      >
        {/* 固定顶部的 nav 栏，背景透明浅灰色 */}
        <div className="absolute top-0 left-0 w-full h-12 border-b z-50 flex items-center justify-center">
          DeepSeek
        </div>
        {!hideTitle && (
          <div className="mb-8">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-3xl font-bold mb-3 text-center">
              {title || "智能助手"}
            </h2>
          </div>
        )}
        <Chat
          key={chatKeyRef.current}
          sessionId={sessionId}
          initialMessages={initialMessages}
          onSessionIdChange={handleSessionIdChange}
          className="flex-1"
          onNewMessage={handleNewMessage}
          onSendNewMessage={() => setHideTitle(true)}
        />
      </div>
    </div>
  );
}
