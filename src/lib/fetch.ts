import type { AppType } from "@/server/api";
import { hc } from "hono/client";
import ky from "ky";

const baseUrl =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : process.env.NEXT_PUBLIC_APP_URL;

export const fetch = ky.extend({
  hooks: {
    afterResponse: [
      async (_, __, response: Response) => {
        if (response.ok) {
          return response;
          // biome-ignore lint/style/noUselessElse: <explanation>
        } else {
          throw await response.json();
        }
      },
    ],
  },
});

export const client = hc<AppType>(baseUrl as string, {
  fetch: fetch,
});
