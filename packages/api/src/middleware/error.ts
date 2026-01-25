import { type Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { isProduction } from "../config.js";

export enum ErrorCode {
  BAD_REQUEST = "BAD_REQUEST",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  RATE_LIMITED = "RATE_LIMITED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  VALIDATION_ERROR = "VALIDATION_ERROR",
}

export interface ApiError {
  error: string;
  code: ErrorCode;
  details?: unknown;
}

export function errorHandler(err: Error, c: Context): Response {
  console.error("API Error:", err);

  if (err instanceof HTTPException) {
    const response: ApiError = {
      error: err.message,
      code: mapStatusToCode(err.status),
    };
    return c.json(response, err.status);
  }

  // Zod validation errors
  if (err.name === "ZodError") {
    const response: ApiError = {
      error: "Validation failed",
      code: ErrorCode.VALIDATION_ERROR,
      details: isProduction() ? undefined : JSON.parse(err.message),
    };
    return c.json(response, 400);
  }

  // Generic error
  const response: ApiError = {
    error: isProduction() ? "Internal server error" : err.message,
    code: ErrorCode.INTERNAL_ERROR,
  };
  return c.json(response, 500);
}

function mapStatusToCode(status: number): ErrorCode {
  switch (status) {
    case 400:
      return ErrorCode.BAD_REQUEST;
    case 401:
      return ErrorCode.UNAUTHORIZED;
    case 403:
      return ErrorCode.FORBIDDEN;
    case 404:
      return ErrorCode.NOT_FOUND;
    case 429:
      return ErrorCode.RATE_LIMITED;
    default:
      return ErrorCode.INTERNAL_ERROR;
  }
}

export function notFound(c: Context): Response {
  return c.json(
    {
      error: "Not found",
      code: ErrorCode.NOT_FOUND,
    } satisfies ApiError,
    404
  );
}
