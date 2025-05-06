import { Hono } from "hono";

const app = new Hono().get("/hello", (c) =>
  c.json({ message: "Hello, luckyChat" })
);

export default app;
