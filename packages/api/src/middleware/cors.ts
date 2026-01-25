import { cors } from "hono/cors";
import { getConfig } from "../config.js";

export function corsMiddleware() {
  const config = getConfig();
  const origins = config.CORS_ORIGINS === "*" ? "*" : config.CORS_ORIGINS.split(",");

  return cors({
    origin: origins,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["X-Total-Count", "X-Has-More", "X-Next-Cursor", "ETag"],
    maxAge: 86400,
    credentials: true,
  });
}
