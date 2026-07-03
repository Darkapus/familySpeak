import fp from "fastify-plugin";
import fastifyRateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";

export default fp(async function rateLimitPlugin(app: FastifyInstance) {
  await app.register(fastifyRateLimit, {
    max: 300,
    timeWindow: "1 minute",
  });
});
