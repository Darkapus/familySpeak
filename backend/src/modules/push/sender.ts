import webpush from "web-push";
import { env } from "../../config/env.js";
import { deletePushSubscriptionByEndpoint, listPushSubscriptionsForUser } from "./repository.js";

const isConfigured = Boolean(env.vapidPublicKey && env.vapidPrivateKey);

if (isConfigured) {
  webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; conversationId: string },
): Promise<void> {
  if (!isConfigured) return;

  const subscriptions = listPushSubscriptionsForUser(userId);
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keysP256dh, auth: sub.keysAuth } },
          JSON.stringify(payload),
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          deletePushSubscriptionByEndpoint(sub.endpoint);
        }
      }
    }),
  );
}
