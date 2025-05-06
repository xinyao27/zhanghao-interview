import { handleError } from "./error";
import { Hono } from "hono";
import agentRoute from "./routes/agent";
import helloRoute from "./routes/hello";
const app = new Hono().basePath("/api");

app.onError(handleError);

const routes = app.route("/", agentRoute).route("/", helloRoute);

export default app;

export type AppType = typeof routes;
