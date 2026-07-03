import fp from "fastify-plugin";
import fastifyCookie from "@fastify/cookie";
import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";

export default fp(async function cookiePlugin(app: FastifyInstance) {
  await app.register(fastifyCookie, {
    secret: env.jwtSecret,
  });
});
