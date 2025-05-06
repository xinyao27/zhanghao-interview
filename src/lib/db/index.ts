import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// 数据库连接配置
export const client = postgres(
  process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/chat"
);
export const db = drizzle({ client });
