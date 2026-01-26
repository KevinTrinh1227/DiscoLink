/**
 * Cloudflare Workers entry point for DiscoLink API
 *
 * This file exports a Cloudflare Worker that can be deployed to
 * Cloudflare's edge network with D1 database support.
 */

import { createApp } from "./app.js";
import { createD1Client, setDb } from "@discolink/db";

export interface Env {
  // Cloudflare D1 database binding
  DB: D1Database;

  // Optional environment variables
  API_KEY?: string;
  CORS_ORIGINS?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Initialize D1 database client
    const db = createD1Client(env.DB);
    setDb(db);

    // Create and run the Hono app
    const app = createApp();

    return app.fetch(request, env, ctx);
  },
};
