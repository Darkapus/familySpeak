function readEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const nodeEnv = readEnv("NODE_ENV", "development");

export const env = {
  nodeEnv,
  port: Number(readEnv("PORT", "3000")),
  host: readEnv("HOST", "0.0.0.0"),
  databasePath: readEnv("DATABASE_PATH", "./data/familyspeak.sqlite"),
  mediaDir: readEnv("MEDIA_DIR", "./data/media"),
  maxImageSizeBytes: Number(readEnv("MAX_IMAGE_SIZE_BYTES", String(15 * 1024 * 1024))),
  maxVideoSizeBytes: Number(readEnv("MAX_VIDEO_SIZE_BYTES", String(50 * 1024 * 1024))),
  vapidPublicKey: readEnv("VAPID_PUBLIC_KEY", ""),
  vapidPrivateKey: readEnv("VAPID_PRIVATE_KEY", ""),
  vapidSubject: readEnv("VAPID_SUBJECT", "mailto:admin@familyspeak.local"),
  jwtSecret: readEnv("JWT_SECRET", nodeEnv === "development" ? "dev-secret-change-me" : undefined),
  accessTokenTtl: readEnv("ACCESS_TOKEN_TTL", "15m"),
  refreshTokenTtlDays: Number(readEnv("REFRESH_TOKEN_TTL_DAYS", "30")),
  cookieSecure: readEnv("COOKIE_SECURE", nodeEnv === "development" ? "false" : "true") === "true",
};
