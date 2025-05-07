import { useState, useCallback, useEffect } from "react";
import { client } from "@/lib/fetch";
import type { InferResponseType } from "hono/client";

const $agent = client.api.agent.$get;

type ResponseType = InferResponseType<typeof $agent>;
// 从ResponseType中提取sessions对象类型
type SessionsResponse = Extract<ResponseType, { sessions: unknown[] }>;
// 从sessions数组中提取单个元素的类型
export type ApiSessionData = SessionsResponse["sessions"][number];

/**
 * 聊天历史记录管理Hook
 * @param shouldFetch 是否应该获取历史记录的条件
 * @returns 会话历史相关状态和方法
 */
export function useHistory(shouldFetch = false) {
  const [sessions, setSessions] = useState<ApiSessionData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!shouldFetch) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await client.api.agent.$get();
      const result = (await response.json()) as ResponseType;

      if ("sessions" in result) {
        setSessions(result.sessions);
      } else if ("error" in result) {
        setError(result.error);
        console.error("获取历史记录失败:", result.error);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setError(errorMessage);
      console.error("获取会话历史失败:", error);
    } finally {
      setIsLoading(false);
    }
  }, [shouldFetch]);

  // 当shouldFetch变化时重新获取数据
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // 手动刷新历史记录
  const refreshSessions = () => {
    fetchSessions();
  };

  return {
    sessions,
    isLoading,
    error,
    refreshSessions,
  };
}
