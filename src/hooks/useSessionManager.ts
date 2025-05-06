"use client";

import { useState, useEffect } from "react";
import type { Message } from "ai";

// 定义数据库消息类型
interface DBMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  sessionId: string;
}

export function useSessionManager() {
  // 初始状态设为固定值，避免服务端和客户端不一致
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 客户端渲染后，从localStorage中读取sessionId
  useEffect(() => {
    const savedSessionId = localStorage.getItem("chatSessionId") || undefined;
    if (savedSessionId) {
      setSessionId(savedSessionId);
    }
  }, []);

  // 当会话ID变化时保存到本地存储
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem("chatSessionId", sessionId);
    }
  }, [sessionId]);

  // 当会话ID存在时，加载历史消息
  useEffect(() => {
    const fetchMessages = async () => {
      if (!sessionId) {
        setInitialMessages([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(`/api/agent/${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          // 将数据库消息格式转换为AI SDK消息格式
          const messages: Message[] = data.messages.map((msg: DBMessage) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            createdAt: new Date(msg.createdAt),
          }));
          setInitialMessages(messages);
        }
      } catch (error) {
        console.error("加载历史消息失败:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, [sessionId]);

  // 处理会话ID变化的回调
  const handleSessionIdChange = (newSessionId: string) => {
    setSessionId(newSessionId);
  };

  // 开始新对话
  const startNewChat = () => {
    // 清除本地存储的会话ID
    localStorage.removeItem("chatSessionId");
    // 重置状态
    setSessionId(undefined);
    setInitialMessages([]);
  };

  return {
    sessionId,
    initialMessages,
    isLoading,
    handleSessionIdChange,
    startNewChat,
  };
}
