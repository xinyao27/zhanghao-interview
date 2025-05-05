import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "../validator";
import { deepseek } from "@ai-sdk/deepseek";
import { db } from "@/lib/db";
import { chatMessages, chatSessions } from "@/lib/db/schema";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { generateText } from "ai";

const paramSchema = z.object({
  sessionId: z.string().cuid(),
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

      // 如果是新会话，创建会话记录
      if (!existingSessionId) {
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

      // 使用AI SDK调用Deepseek API
      const result = await generateText({
        model: deepseek("deepseek-chat"),
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature: 0.7,
      });

      // 获取回复内容
      const fullResponse = result.text;

      // 存储助手回复
      await db.insert(chatMessages).values({
        sessionId,
        role: "assistant",
        content: fullResponse,
      });

      return c.json({
        message: fullResponse,
        sessionId,
      });
    } catch (error) {
      console.error("Error processing chat:", error);
      return c.json({ error: "处理聊天请求失败" }, 500);
    }
  });

export default app;
