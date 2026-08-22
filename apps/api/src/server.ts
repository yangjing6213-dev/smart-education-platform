import fastify, { type FastifyInstance } from "fastify";
import { registerHealthRoute } from "./health/health.route.js";

export function buildServer(): FastifyInstance {
  const app = fastify({ logger: false });
  registerHealthRoute(app);
  return app;
}
