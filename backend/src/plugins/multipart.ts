import fp from "fastify-plugin";
import fastifyMultipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";

export default fp(async function multipartPlugin(app: FastifyInstance) {
  await app.register(fastifyMultipart, {
    limits: { fileSize: env.maxVideoSizeBytes },
  });
});
