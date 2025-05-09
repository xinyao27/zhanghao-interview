import { z } from "zod";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export class ApiError extends HTTPException {
  public readonly code?: ContentfulStatusCode;

  constructor({
    code,
    message,
  }: {
    code?: ContentfulStatusCode;
    message: string;
  }) {
    super(code, { message });
    this.code = code;
  }
}

export function handleError(err: Error, c: Context): Response {
  if (err instanceof z.ZodError) {
    const firstError = err.errors[0];

    return c.json(
      { code: 422, message: `\`${firstError.path}\`: ${firstError.message}` },
      422
    );
  }

  /**
   * This is a generic error, we should log it and return a 500
   */

  return c.json(
    {
      code: 500,
      message: "服务端错误, 请稍后再试。",
    },
    { status: 500 }
  );
}
