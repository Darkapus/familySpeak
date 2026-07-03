import Fastify from "fastify";
import { env } from "./config/env.js";
import jwtPlugin from "./plugins/jwt.js";
import cookiePlugin from "./plugins/cookie.js";
import websocketPlugin from "./plugins/websocket.js";
import multipartPlugin from "./plugins/multipart.js";
import rateLimitPlugin from "./plugins/rate-limit.js";
import { registerAuthRoutes } from "./modules/auth/routes.js";
import { registerUserRoutes } from "./modules/users/routes.js";
import { registerConversationRoutes } from "./modules/conversations/routes.js";
import { registerMessageRoutes } from "./modules/messages/routes.js";
import { registerAttachmentUploadRoutes, registerAttachmentFileRoutes } from "./modules/attachments/routes.js";
import { registerPushRoutes } from "./modules/push/routes.js";
import { registerSignupRequestRoutes } from "./modules/signup-requests/routes.js";

export function buildApp() {
  const app = Fastify({
    logger: {
      level: env.nodeEnv === "development" ? "debug" : "info",
      transport:
        env.nodeEnv === "development"
          ? { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } }
          : undefined,
    },
  });

  app.register(jwtPlugin);
  app.register(cookiePlugin);
  app.register(websocketPlugin);
  app.register(multipartPlugin);
  app.register(rateLimitPlugin);

  app.get("/health", async () => {
    return { status: "ok", timestamp: Date.now() };
  });

  app.register(registerAuthRoutes, { prefix: "/api/auth" });
  app.register(registerUserRoutes, { prefix: "/api/users" });
  app.register(registerConversationRoutes, { prefix: "/api/conversations" });
  app.register(registerMessageRoutes, { prefix: "/api/conversations" });
  app.register(registerAttachmentUploadRoutes, { prefix: "/api/conversations" });
  app.register(registerAttachmentFileRoutes, { prefix: "/api/attachments" });
  app.register(registerPushRoutes, { prefix: "/api/push" });
  app.register(registerSignupRequestRoutes, { prefix: "/api/signup-requests" });

  return app;
}
