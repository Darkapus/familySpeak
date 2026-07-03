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
  hermesEnabled: readEnv("HERMES_ENABLED", "false") === "true",
  hermesApiUrl: readEnv("HERMES_API_URL", "http://host.docker.internal:8642"),
  hermesApiKey: readEnv("HERMES_API_KEY", ""),
  hermesModel: readEnv("HERMES_MODEL", "hermes-agent"),
  hermesBotUsername: readEnv("HERMES_BOT_USERNAME", "visperine"),
  hermesHistoryLimit: Number(readEnv("HERMES_HISTORY_LIMIT", "30")),
  hermesCompactBatchSize: Number(readEnv("HERMES_COMPACT_BATCH_SIZE", "20")),
  hermesProfileUpdateBatchSize: Number(readEnv("HERMES_PROFILE_UPDATE_BATCH_SIZE", "10")),
  hermesPersona: readEnv(
    "HERMES_PERSONA",
    "Tu es l'IA de la famille. Tu réponds aux messages reçus sur FamilySpeak, l'appli de " +
      "messagerie familiale, à la place de Visperine quand il n'est pas disponible. Réponds " +
      "en français, sur un ton chaleureux et naturel, de façon concise comme dans une " +
      "conversation WhatsApp (pas de listes à puces, pas de ton formel).",
  ),
};
