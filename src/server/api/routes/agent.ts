import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "../validator";
import { deepseek } from "@ai-sdk/deepseek";
import { db } from "@/lib/db";
import { chatMessages, chatSessions } from "@/lib/db/schema";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { streamText } from "ai";

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

      // 使用streamText创建流式响应
      const result = await streamText({
        model: deepseek("deepseek-chat"),
        messages: allMessages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature: 0.7,
        // 定义完成回调，在流结束时保存助手响应到数据库
        onFinish: async ({ text }) => {
          try {
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
          } catch (error) {
            console.error("Error saving assistant message:", error);
          }
        },
      });

      // 返回包含sessionId的响应，以便客户端保存
      c.res.headers.set("X-Session-ID", sessionId);
      return result.toDataStreamResponse();
    } catch (error) {
      console.error("Error processing chat:", error);
      return c.json({ error: "处理聊天请求失败" }, 500);
    }
  });

export default app;
