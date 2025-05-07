"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { useChat } from "@ai-sdk/react";
import { Button } from "@/components/ui/button";
import { SendHorizontalIcon, SquareIcon } from "lucide-react";
import type { Message } from "ai";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { throttle } from "lodash";
import { chatLocalStorage } from "@/lib/local";

// 扩展Message类型以支持工具调用
interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

interface ExtendedMessage extends Message {
  toolCalls?: ToolCall[];
  toolCallResults?: (string | Record<string, unknown>)[];
}

interface ChatProps {
  sessionId?: string;
  initialMessages?: ExtendedMessage[];
  className?: string;
  onSessionIdChange?: (sessionId: string) => void;
  onNewMessage?: (id: string) => void;
  onSendNewMessage?: () => void;
}

export function Chat({
  sessionId,
  initialMessages = [],
  className,
  onSessionIdChange,
  onNewMessage,
  onSendNewMessage,
}: ChatProps) {
  const [currentSessionId, setCurrentSessionId] = React.useState<
    string | undefined
  >(sessionId);
  const newSessionIdRef = React.useRef<string | undefined>(undefined);
  const { messages, input, handleInputChange, handleSubmit, isLoading, stop } =
    useChat({
      api: "/api/agent/chat",
      initialMessages,
      body: {
        sessionId: currentSessionId,
      },
      onResponse: (response) => {
        // 从响应头中获取会话ID
        const newSessionId = response.headers.get("X-SESSION-ID");
        if (newSessionId && newSessionId !== currentSessionId) {
          newSessionIdRef.current = newSessionId;
          onNewMessage?.(newSessionIdRef.current as string);
        }
      },
      onFinish: (message) => {
        if (
          newSessionIdRef.current &&
          newSessionIdRef.current !== currentSessionId
        ) {
          setCurrentSessionId(newSessionIdRef.current);
          onSessionIdChange?.(newSessionIdRef.current);
        }
        console.log("聊天完成，消息内容:", message);
      },
      onError: (error) => {
        console.error("聊天出错:", error);
      },
    });
  console.log(messages, " messages");

  // 处理停止时保存会话ID到本地存储
  const handleStop = React.useCallback(() => {
    if (currentSessionId || newSessionIdRef.current) {
      chatLocalStorage.setSessionId(
        currentSessionId || (newSessionIdRef.current as string)
      );
      console.log("已保存会话ID到本地存储:", currentSessionId);
    }
    stop();
  }, [currentSessionId, stop]);

  // 滚动到底部的函数
  const scrollToBottom = () => {
    const container = document.getElementById("messages-container");
    const messagesContainer = document.getElementById("scroll-container");
    if (
      container?.scrollTop !== undefined &&
      messagesContainer?.scrollHeight !== undefined
    ) {
      container.scrollTop = messagesContainer?.scrollHeight;
    }
  };
  const throttledScrollToBottom = React.useCallback(
    throttle(() => {
      scrollToBottom();
    }, 500),
    []
  );
  // 当消息更新时自动滚动到底部
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  React.useEffect(() => {
    if (!messages) return;
    throttledScrollToBottom();
  }, [JSON.stringify(messages)]);

  // 渲染消息内容，处理工具调用结果
  const renderMessageContent = (message: ExtendedMessage) => {
    // 如果有工具调用结果，特殊处理显示
    if (
      message.role === "assistant" &&
      message.toolCalls &&
      message.toolCalls.length > 0
    ) {
      return (
        <>
          {message.content && (
            <div className="mb-2">
              <MarkdownRenderer content={message.content} />
            </div>
          )}
          {message.toolCalls.map((toolCall, toolIndex) => {
            // 获取工具调用结果
            const toolCallResult = message.toolCallResults?.[toolIndex];
            if (!toolCallResult) return null;

            let toolResultContent = "";
            try {
              const resultObj =
                typeof toolCallResult === "string"
                  ? JSON.parse(toolCallResult)
                  : toolCallResult;

              if (toolCall.name === "getCurrentTime") {
                toolResultContent = `**当前时间信息**:\n\n- 日期: ${resultObj.date}\n- 时间: ${resultObj.time}\n- 时区: ${resultObj.timezone}`;
              } else {
                toolResultContent = `\`\`\`json\n${JSON.stringify(
                  resultObj,
                  null,
                  2
                )}\n\`\`\``;
              }
            } catch (e) {
              toolResultContent = String(toolCallResult);
            }

            return (
              <div
                key={`tool-call-${toolCall.id}`}
                className="mb-2 p-2 border border-gray-200 dark:border-gray-700 rounded-md"
              >
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  工具: {toolCall.name}
                </div>
                <MarkdownRenderer content={toolResultContent} />
              </div>
            );
          })}
        </>
      );
    }

    // 标准消息渲染
    if (message.parts && message.parts.length > 0) {
      return (
        <>
          {message.parts.map((part, idx) => {
            if (part.type === "text") {
              return (
                <MarkdownRenderer
                  key={`${message.id}-part-${idx}`}
                  content={part.text}
                />
              );
            }
            return null;
          })}
        </>
      );
    }

    return <MarkdownRenderer content={message.content} key={message.id} />;
  };

  return (
    <>
      {messages && messages.length > 0 && (
        <div
          className={cn(
            "flex flex-col w-full mx-auto overflow-y-auto",
            className
          )}
          id="messages-container"
        >
          <div
            id="scroll-container"
            className="flex-1 w-[766px] mx-auto space-y-4"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex",
                  m.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "p-3 rounded-lg max-w-[95%]",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                    "prose dark:prose-invert prose-sm prose-p:m-0 prose-li:m-0 prose-ul:m-0 prose-ol:m-0"
                  )}
                >
                  {renderMessageContent(m as ExtendedMessage)}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="p-3 rounded-lg bg-muted text-muted-foreground animate-pulse">
                  思考中...
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <form
        onSubmit={(e) => {
          onSendNewMessage?.();
          handleSubmit(e);
        }}
        className="w-full  max-w-[766px] mx-auto mt-4"
      >
        <div className="relative">
          <div className="rounded-xl h-32 shadow-sm border-2 focus-within:border-primary overflow-hidden">
            <textarea
              value={input}
              onChange={(e) =>
                handleInputChange({
                  target: { value: e.target.value },
                } as React.ChangeEvent<HTMLInputElement>)
              }
              placeholder="输入消息..."
              className="w-full resize-none py-1 px-4 outline-none focus:outline-none border-0 focus:ring-0 bg-background min-h-[56px] h-full pr-14"
              rows={Math.min(4, Math.max(1, input.split("\n").length))}
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim()) {
                    const syntheticEvent = new Event("submit", {
                      bubbles: true,
                      cancelable: true,
                    }) as unknown as React.FormEvent<HTMLFormElement>;
                    handleSubmit(syntheticEvent);
                    onSendNewMessage?.();
                  }
                }
              }}
            />
            <div className="absolute bottom-8 right-3">
              {isLoading ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleStop}
                  className="flex items-center gap-1.5"
                >
                  <SquareIcon className="h-3 w-3" />
                  停止
                </Button>
              ) : (
                <Button size="sm" type="submit" disabled={!input.trim()}>
                  <SendHorizontalIcon className="h-3 w-3" />
                  <span className="sr-only">发送</span>
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-right">
            按 Enter 发送，Shift + Enter 换行
          </p>
        </div>
      </form>
    </>
  );
}
