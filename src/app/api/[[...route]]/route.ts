import { Hono } from "hono";
import { handle } from "hono/vercel";

export const runtime = "edge";

const app = new Hono().basePath("/api");

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

app.get("/hello", async (c) => {
  await sleep(1000);

  return c.json({
    message: "Hello Next.js!",
  });
});

export const GET = handle(app);
export const POST = handle(app);
