import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "../validator";
import { deepseek } from "@ai-sdk/deepseek";
import { db } from "@/lib/db";
import { chatMessages, chatSessions } from "@/lib/db/schema";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { streamText, tool } from "ai";

const paramSchema = z.object({
  sessionId: z.string().uuid(),
});

// 定义聊天消息的schema
const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

// 定义聊天请求的schema
const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema),
  sessionId: z.string().optional(),
});

/**
 * 获取当前时间的工具函数
 * 示例：可以询问当前时间，例如"现在几点了"或"告诉我当前的时间"
 */
const getCurrentTimeTool = tool({
  description: "获取当前的日期和时间信息，当用户询问当前时间时使用",
  parameters: z.object({}),
  execute: async () => {
    const now = new Date();
    return {
      date: now.toLocaleDateString("zh-CN"),
      time: now.toLocaleTimeString("zh-CN"),
      timestamp: now.getTime(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      formatted: `${now.toLocaleDateString("zh-CN")} ${now.toLocaleTimeString(
        "zh-CN"
      )}`,
    };
  },
});

const app = new Hono()
  .basePath("/agent")
  .get("/", async (c) => {
    try {
      // 使用SQL查询获取所有会话
      const sessions = await db
        .select()
        .from(chatSessions)
        .orderBy(chatSessions.updatedAt);

      return c.json({ sessions });
    } catch (error) {
      console.error("Error fetching sessions:", error);
      return c.json({ error: "获取会话列表失败" }, 500);
    }
  })
  .get("/sessions", async (c) => {
    try {
      // 使用SQL查询获取所有会话及其最新消息
      const sessions = await db
        .select({
          id: chatSessions.sessionId,
          title: chatSessions.title,
          createdAt: chatSessions.createdAt,
          updatedAt: chatSessions.updatedAt,
          lastMessage: chatMessages.content,
        })
        .from(chatSessions)
        .leftJoin(
          chatMessages,
          eq(chatSessions.sessionId, chatMessages.sessionId)
        )
        .orderBy(chatSessions.updatedAt);

      return c.json({
        success: true,
        data: sessions,
      });
    } catch (error) {
      console.error("获取会话列表失败:", error);
      return c.json(
        {
          success: false,
          error: "获取会话列表失败",
        },
        500
      );
    }
  })
  .get("/:sessionId", zValidator("param", paramSchema), async (c) => {
    try {
      const sessionId = c.req.param("sessionId");

      // 使用SQL查询获取指定会话的消息
      const messages = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId))
        .orderBy(chatMessages.createdAt);

      return c.json({ messages });
    } catch (error) {
      console.error("Error fetching messages:", error);
      return c.json({ error: "获取消息历史失败" }, 500);
    }
  })
  .post("/chat", zValidator("json", chatRequestSchema), async (c) => {
    try {
      const { messages, sessionId: existingSessionId } = c.req.valid("json");

      // 生成或使用现有的会话ID
      const sessionId = existingSessionId || uuidv4();

      // 最终要发送给模型的消息列表
      let allMessages = [...messages];

      // 如果存在会话ID，先获取历史消息
      if (existingSessionId) {
        const historyMessages = await db
          .select()
          .from(chatMessages)
          .where(eq(chatMessages.sessionId, existingSessionId))
          .orderBy(chatMessages.createdAt);

        // 如果有历史消息，将其转换为模型需要的格式并合并
        if (historyMessages.length > 0) {
          // 只保留最新的用户消息，避免重复
          const oldMessages = historyMessages.map((msg) => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          }));

          // 合并历史消息和新消息（如果新消息不是最新的一条历史消息的重复）
          const latestDbMessage = historyMessages[historyMessages.length - 1];
          const latestNewMessage = messages[messages.length - 1];

          if (
            latestDbMessage &&
            latestNewMessage &&
            latestDbMessage.content === latestNewMessage.content &&
            latestDbMessage.role === latestNewMessage.role
          ) {
            // 如果新消息是历史记录中最后一条的重复，只使用历史记录
            allMessages = oldMessages;
          } else {
            // 否则合并历史记录和新消息
            allMessages = [...oldMessages, ...messages];
          }
        }
      }

      // 检查会话是否存在，如果不存在且是已有的sessionId，则创建
      if (existingSessionId) {
        const existingSession = await db
          .select()
          .from(chatSessions)
          .where(eq(chatSessions.sessionId, existingSessionId))
          .limit(1);

        // 如果提供了sessionId但会话不存在，创建新会话
        if (existingSession.length === 0) {
          await db.insert(chatSessions).values({
            sessionId,
            title: messages[0]?.content.substring(0, 50) || "新对话",
          });
        } else {
          await db
            .update(chatSessions)
            .set({ updatedAt: new Date() })
            .where(eq(chatSessions.sessionId, sessionId));
        }
      } else {
        // 如果是新会话，创建会话记录
        await db.insert(chatSessions).values({
          sessionId,
          title: messages[0]?.content.substring(0, 50) || "新对话",
        });
      }

      // 存储用户消息
      const latestMessage = messages[messages.length - 1];
      if (latestMessage && latestMessage.role === "user") {
        await db.insert(chatMessages).values({
          sessionId,
          role: latestMessage.role,
          content: latestMessage.content,
        });
      }

      // 请求是否已经中断的标记
      let isRequestAborted = false;
      // 是否已保存到数据库的标记
      let savedToDb = false;
      // 存储当前AI回复的累积内容
      let currentAIResponse = "";

      // 创建保存AI响应的函数
      const saveAssistantMessage = async (text: string) => {
        if (savedToDb || !text) return; // 避免重复保存或保存空内容

        try {
          console.log("保存AI回复:", text.length, "字符");
          await db.insert(chatMessages).values({
            sessionId,
            role: "assistant",
            content: text,
          });

          // 更新会话的updatedAt时间戳
          await db
            .update(chatSessions)
            .set({ updatedAt: new Date() })
            .where(eq(chatSessions.sessionId, sessionId));

          savedToDb = true;
        } catch (error) {
          console.error("Error saving assistant message:", error);
        }
      };

      // 监听客户端请求中断事件
      c.req.raw.signal.addEventListener("abort", () => {
        console.log("检测到请求中断");
        isRequestAborted = true;

        // 设置延迟保存，确保onFinish有机会先执行
        setTimeout(async () => {
          if (!savedToDb) {
            // 如果还没有保存过，保存已生成的AI回复内容
            if (currentAIResponse.trim()) {
              await saveAssistantMessage(`${currentAIResponse} [回复被中断]`);
            } else {
              await saveAssistantMessage("[AI回复被中断]");
            }
          }
        }, 1000);
      });

      // 使用streamText创建流式响应
      const stream = await streamText({
        model: deepseek("deepseek-chat"),
        messages: allMessages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature: 0.7,
        system:
          "你是一个智能助手。你可以使用工具来提供更准确的信息。当被问到时间相关的问题时，请使用getCurrentTime工具获取准确的时间信息。",
        // 启用函数调用
        tools: {
          getCurrentTime: getCurrentTimeTool,
        },
        // 工具选择策略
        toolChoice: "auto",
        // 最大步骤数（防止无限循环）
        maxSteps: 3,
        // 使用onChunk收集AI响应文本
        onChunk({ chunk }) {
          if (chunk.type === "text-delta") {
            currentAIResponse += chunk.textDelta;
          }
        },
        // 定义完成回调，在流结束时保存助手响应到数据库
        onFinish: async ({ text }) => {
          // 检查请求是否已中断
          if (isRequestAborted) {
            console.log(
              `流完成但请求已中断，保存内容: ${text.substring(0, 30)}...`
            );
          }
          await saveAssistantMessage(text);
        },
      });

      // 返回包含sessionId的响应，以便客户端保存
      c.res.headers.set("X-SESSION-ID", sessionId);
      return stream.toDataStreamResponse();
    } catch (error) {
      console.error("Error processing chat:", error);
      return c.json({ error: "处理聊天请求失败" }, 500);
    }
  });

export default app;
