"use client";

import { useState, useEffect, useRef } from "react";
import type { Message } from "ai";
import { chatLocalStorage } from "@/lib/local";
import { client } from "@/lib/fetch";

export function useSessionManager() {
  // 初始状态设为固定值，避免服务端和客户端不一致
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const banLoadHistory = useRef(false);
  useEffect(() => {
    const savedSessionId = chatLocalStorage.getSessionId() || undefined;
    if (savedSessionId) {
      setSessionId(savedSessionId);
    }
  }, []);

  // 当会话ID变化时保存到本地存储
  useEffect(() => {
    if (sessionId) {
      chatLocalStorage.setSessionId(sessionId);
    }
  }, [sessionId]);

  // 当会话ID存在时，加载历史消息
  useEffect(() => {
    if (banLoadHistory.current) {
      banLoadHistory.current = false;
      return;
    }
    const fetchMessages = async () => {
      if (!sessionId) {
        setInitialMessages([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await client.api.agent[":sessionId"].$get({
          param: {
            sessionId,
          },
        });
        if (response.ok) {
          const data = await response.json();
          // 将数据库消息格式转换为AI SDK消息格式
          const messages = data.messages?.map((msg) => ({
            id: msg.id.toString(),
            role: msg.role as "user" | "assistant",
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
    banLoadHistory.current = true;
  };

  // 开始新对话
  const startNewChat = () => {
    // 清除本地存储的会话ID
    chatLocalStorage.removeSessionId();
    // 重置状态
    setSessionId(undefined);
    setInitialMessages([]);
  };

  return {
    sessionId,
    initialMessages,
    isLoading,
    handleSessionIdChange,
    setSessionId,
    startNewChat,
  };
}
