import { Hono } from "hono";
import { logger } from "hono/logger";
import { corsMiddleware } from "./middleware/cors.js";
import { authMiddleware } from "./middleware/auth.js";
import { rateLimitMiddleware } from "./middleware/ratelimit.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { securityHeaders } from "./middleware/security.js";

import healthRoutes from "./routes/health.js";
import serverRoutes from "./routes/servers.js";
import channelRoutes from "./routes/channels.js";
import threadRoutes from "./routes/threads.js";
import messageRoutes from "./routes/messages.js";
import userRoutes from "./routes/users.js";
import searchRoutes from "./routes/search.js";
import authRoutes from "./routes/auth.js";
import leaderboardRoutes from "./routes/leaderboard.js";
import webhookRoutes from "./routes/webhooks.js";
import feedRoutes from "./routes/feeds.js";

export function createApp(): Hono {
  const app = new Hono();

  // Global middleware
  app.use("*", logger());
  app.use("*", securityHeaders);
  app.use("*", corsMiddleware());
  app.use("*", authMiddleware);
  app.use("*", rateLimitMiddleware);

  // Mount routes
  app.route("/", healthRoutes);
  app.route("/servers", serverRoutes);
  app.route("/channels", channelRoutes);
  app.route("/threads", threadRoutes);
  app.route("/messages", messageRoutes);
  app.route("/users", userRoutes);
  app.route("/search", searchRoutes);
  app.route("/auth", authRoutes);
  app.route("/leaderboard", leaderboardRoutes);
  app.route("/webhooks", webhookRoutes);
  app.route("/feeds", feedRoutes);

  // Error handling
  app.onError(errorHandler);
  app.notFound(notFound);

  return app;
}
