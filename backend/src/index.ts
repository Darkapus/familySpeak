import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { db } from "./db/client.js";

const app = buildApp();

async function start() {
  try {
    migrate(db, { migrationsFolder: "./drizzle" });
    await app.listen({ port: env.port, host: env.host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

async function shutdown(signal: string) {
  app.log.info(`Received ${signal}, shutting down gracefully`);
  await app.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

void start();
